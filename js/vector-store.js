/** =========================================================================
 * MODUL: BROWSER-SIDE VECTOR STORE (replaces Python vector_store.py)
 * IndexedDB-backed k-NN store with cosine similarity.
 * No SQLite, no server – fully offline.
 * ========================================================================= */

const VS_DB_NAME    = 'bildertool-vectors';
const VS_DB_VERSION = 1;
const VS_STORE      = 'embeddings';

// Source trust weights – mirror Python api.py._source_weight()
const SOURCE_WEIGHTS = {
    'manual':             1.0,
    'manual-recategory':  1.0,
    'manual-list-edit':   0.9,
    'manual-bulk-edit':   0.9,
    'ingest-labeled':     0.8,
    'ai-confirmed':       0.4,
};

function _sourceWeight(source) {
    return SOURCE_WEIGHTS[String(source || '').trim().toLowerCase()] ?? 0.6;
}

/** Open (or upgrade) the IndexedDB */
function _openVectorDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(VS_DB_NAME, VS_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(VS_STORE)) {
                const store = db.createObjectStore(VS_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('label',      'label',      { unique: false });
                store.createIndex('image_path', 'image_path', { unique: false });
                store.createIndex('source',     'source',     { unique: false });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

/** Return all records from the store */
async function _getAllRecords(db) {
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(VS_STORE, 'readonly');
        const req = tx.objectStore(VS_STORE).getAll();
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

/** Dot product of two Float32Arrays (== cosine sim when both are L2-normalized) */
function _dotProduct(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) sum += a[i] * b[i];
    return sum;
}

/** L2 distance from cosine similarity: sqrt(2 - 2*cos) – mirrors sqlite-vec distance */
function _cosineDistance(a, b) {
    const cos = _dotProduct(a, b);
    return Math.sqrt(Math.max(0, 2 - 2 * cos));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Store a learned image.
 * @param {string} imagePath  - file path / identifier
 * @param {string} label      - "Oberkategorie::Unterkategorie" or just "Oberkategorie"
 * @param {Float32Array} vector
 * @param {string} source     - 'manual', 'ingest-labeled', etc.
 * @param {string} comment
 * @returns {Promise<number>} new record id
 */
async function vsAddEmbedding(imagePath, label, vector, source = 'manual', comment = '') {
    const db = await _openVectorDb();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(VS_STORE, 'readwrite');
        const req = tx.objectStore(VS_STORE).add({
            image_path: imagePath,
            label,
            source,
            comment,
            embedding: Array.from(vector),       // IDB can store plain arrays
            created_at: new Date().toISOString(),
        });
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

/**
 * k-NN search returns sorted matches [{id, image_path, label, source, comment, distance}]
 * @param {Float32Array} vector
 * @param {number} topK
 * @returns {Promise<Array>}
 */
async function vsKnnSearch(vector, topK = 5) {
    const db      = await _openVectorDb();
    const records = await _getAllRecords(db);
    if (!records.length) return [];

    const scored = records.map((rec) => {
        const recVec = rec.embedding instanceof Float32Array
            ? rec.embedding
            : new Float32Array(rec.embedding);
        return {
            id:         rec.id,
            image_path: rec.image_path,
            label:      rec.label,
            source:     rec.source,
            comment:    rec.comment || '',
            distance:   _cosineDistance(vector, recVec),
        };
    });

    scored.sort((a, b) => a.distance - b.distance);
    return scored.slice(0, topK);
}

/**
 * Build a suggest response from k-NN matches.
 * Mirrors Python api.py._build_suggest_response()
 */
function vsBuildSuggestion(matches, commentWhitelist = []) {
    if (!matches.length) return { label: null, confidence: null, suggested_comment: null, suggested_comment_confidence: null, matches: [] };

    const labelScores = {};
    let labelTotal = 0;

    for (const m of matches) {
        const sim = Math.max(0, Math.min(1, 1 - m.distance));
        if (sim <= 0) continue;
        const score = sim * _sourceWeight(m.source);
        labelScores[m.label] = (labelScores[m.label] ?? 0) + score;
        labelTotal += score;
    }

    let bestLabel = null;
    let labelConfidence = null;

    if (labelTotal > 0) {
        bestLabel = Object.keys(labelScores).reduce((a, b) => labelScores[a] > labelScores[b] ? a : b);
        labelConfidence = Math.max(0, Math.min(1, labelScores[bestLabel] / labelTotal));
    } else {
        bestLabel = matches[0].label;
        labelConfidence = Math.max(0, Math.min(1, 1 - matches[0].distance));
    }

    // Comment suggestion: restrict to whitelist
    let suggestedComment = null;
    let suggestedCommentConf = null;

    const whiteset = new Set((commentWhitelist || []).map(s => String(s).trim().toLowerCase()));
    if (whiteset.size > 0) {
        const commentScores = {};
        let commentTotal = 0;
        for (const m of matches) {
            const c = String(m.comment || '').trim();
            if (!c || !whiteset.has(c.toLowerCase())) continue;
            const sim = Math.max(0, Math.min(1, 1 - m.distance));
            if (sim <= 0) continue;
            const score = sim * _sourceWeight(m.source);
            commentScores[c] = (commentScores[c] ?? 0) + score;
            commentTotal += score;
        }
        if (commentTotal > 0) {
            suggestedComment = Object.keys(commentScores).reduce((a, b) => commentScores[a] > commentScores[b] ? a : b);
            suggestedCommentConf = Math.max(0, Math.min(1, commentScores[suggestedComment] / commentTotal));
        }
    }

    return {
        label: bestLabel,
        confidence: labelConfidence,
        suggested_comment: suggestedComment,
        suggested_comment_confidence: suggestedCommentConf,
        matches,
    };
}

/** Count total stored vectors */
async function vsCountItems() {
    const db = await _openVectorDb();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(VS_STORE, 'readonly');
        const req = tx.objectStore(VS_STORE).count();
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

/**
 * Import training data from the old Python SQLite DB export (JSON format).
 * Call once when migrating from the backend.
 */
async function vsImportFromJson(jsonData) {
    const db = await _openVectorDb();
    const tx = db.transaction(VS_STORE, 'readwrite');
    const store = tx.objectStore(VS_STORE);
    let count = 0;
    for (const row of jsonData) {
        if (!row.embedding || !row.label) continue;
        store.add({
            image_path: row.image_path || '',
            label:      row.label,
            source:     row.source || 'manual',
            comment:    row.comment || '',
            embedding:  Array.isArray(row.embedding) ? row.embedding : Array.from(row.embedding),
            created_at: row.created_at || new Date().toISOString(),
        });
        count++;
    }
    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror    = (e) => reject(e.target.error);
    });
    return count;
}

/** Clear all vectors (use for reset / re-training) */
async function vsClearAll() {
    const db = await _openVectorDb();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(VS_STORE, 'readwrite');
        const req = tx.objectStore(VS_STORE).clear();
        req.onsuccess = resolve;
        req.onerror   = (e) => reject(e.target.error);
    });
}
