/** =========================================================================
 * MODUL: LOKALER AI-KATEGORISIERER CLIENT
 * ========================================================================= */

const aiCategorizer = {
    enabled: localStorage.getItem('aiCategorizerEnabled') !== 'false',
    baseUrl: localStorage.getItem('aiCategorizerBaseUrl') || 'http://127.0.0.1:8765',
    topK: Math.max(1, parseInt(localStorage.getItem('aiCategorizerTopK') || '5', 10) || 5),
    timeoutMs: Math.max(1000, parseInt(localStorage.getItem('aiCategorizerTimeoutMs') || '6000', 10) || 6000),
};

let _aiHealthPollTimer = null;
let _aiLearnToastTimer = null;
let _aiLearnToastCount = 0;
const _aiLearnToastSources = new Set();

function _humanizeLearnSource(source) {
    const key = String(source || '').trim().toLowerCase();
    if (key === 'manual-recategory') return 'manuelle Zuordnung (Drag & Drop)';
    if (key === 'manual-comment-edit') return 'manuelle Kommentar-Verbesserung';
    if (key === 'manual-list-edit') return 'manuelle Listenänderung';
    if (key === 'manual-bulk-edit') return 'manuelle Bulk-Änderung';
    if (key === 'ingest-labeled') return 'Import mit gesetzter Kategorie';
    if (key === 'ai-confirmed') return 'übernommener AI-Vorschlag';
    if (key === 'manual') return 'manuelle Zuordnung';
    return key || 'Lernereignis';
}

function _queueAiLearnToast(source) {
    _aiLearnToastCount += 1;
    _aiLearnToastSources.add(_humanizeLearnSource(source));

    if (_aiLearnToastTimer) return;
    _aiLearnToastTimer = setTimeout(() => {
        const sources = [..._aiLearnToastSources];
        const sourceLabel = sources.length === 1 ? sources[0] : 'gemischte Aktionen';
        const countLabel = _aiLearnToastCount > 1 ? ` (${_aiLearnToastCount}x)` : '';
        if (typeof showToast === 'function') {
            showToast(`AI gelernt${countLabel}: ${sourceLabel}`, {
                duration: 2600,
                variant: 'ai-learn',
                multiplier: _aiLearnToastCount,
            });
        }
        _aiLearnToastCount = 0;
        _aiLearnToastSources.clear();
        _aiLearnToastTimer = null;
    }, 450);
}

function _setAiServiceStatus(stateKey, title = '') {
    const el = DOM?.aiServiceStatus || document.getElementById('aiServiceStatus');
    if (!el) return;

    const dotClass = {
        online: 'bg-emerald-500',
        offline: 'bg-red-500',
        disabled: 'bg-slate-400 dark:bg-zinc-500',
        checking: 'bg-amber-500'
    }[stateKey] || 'bg-slate-400 dark:bg-zinc-500';

    const text = {
        online: 'AI: online',
        offline: 'AI: offline',
        disabled: 'AI: aus',
        checking: 'AI: pruefen...'
    }[stateKey] || 'AI: unbekannt';

    const textClass = {
        online: 'text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20',
        offline: 'text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20',
        disabled: 'text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900',
        checking: 'text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
    }[stateKey] || 'text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900';

    el.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${textClass}`;
    el.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full ${dotClass}"></span>${text}`;
    el.title = title || 'AI Backend Status';
}

async function refreshAiServiceHealth() {
    if (!aiCategorizer.enabled) {
        _setAiServiceStatus('disabled', 'AI-Kategorisierung ist deaktiviert.');
        return;
    }
    _setAiServiceStatus('checking');
    try {
        const health = await _fetchAi('/health', { method: 'GET' });
        const model = health?.model_available ? 'Modell geladen' : 'Modell fehlt';
        const count = Number.isFinite(health?.vector_count) ? health.vector_count : '?';
        _setAiServiceStatus('online', `Backend online | ${model} | Vektoren: ${count}`);
    } catch (_error) {
        _setAiServiceStatus('offline', `Backend nicht erreichbar unter ${aiCategorizer.baseUrl}`);
    }
}

function startAiServiceHealthPolling() {
    if (_aiHealthPollTimer) clearInterval(_aiHealthPollTimer);
    refreshAiServiceHealth();
    _aiHealthPollTimer = setInterval(refreshAiServiceHealth, 10000);
}

function getWhitelistedComments() {
    return Array.isArray(state.aiWhitelistedComments) ? state.aiWhitelistedComments : [];
}

function isWhitelistedComment(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return false;
    return getWhitelistedComments().some((entry) => String(entry || '').trim().toLowerCase() === normalized);
}

function _persistWhitelistedComments(comments) {
    state.aiWhitelistedComments = normalizeSuggestions(Array.isArray(comments) ? comments : []);
    localStorage.setItem('aiWhitelistedComments', JSON.stringify(state.aiWhitelistedComments));
}

function refreshAiCommentWhitelist() {
    if (!aiCategorizer.enabled) return;
    _fetchAi('/v1/comment-whitelist', { method: 'GET' })
        .then((result) => {
            _persistWhitelistedComments(result?.comments || []);
            if (typeof renderSettingsList === 'function') renderSettingsList();
            if (typeof renderList === 'function') renderList();
        })
        .catch((error) => {
            console.warn('AI Comment-Whitelist konnte nicht geladen werden:', error);
        });
}

function _composeAiLabel(item) {
    const cat = (item?.oberkategorie || '').trim();
    const sub = (item?.unterkategorie || '').trim();
    if (!cat) return '';
    return sub ? `${cat}::${sub}` : cat;
}

function _splitAiLabel(label) {
    const raw = String(label || '').trim();
    if (!raw) return { oberkategorie: '', unterkategorie: '' };
    const idx = raw.indexOf('::');
    if (idx < 0) return { oberkategorie: raw, unterkategorie: '' };
    return {
        oberkategorie: raw.slice(0, idx).trim(),
        unterkategorie: raw.slice(idx + 2).trim()
    };
}

function _buildStoredImagePath(item) {
    const fileName = item?.originalSourceName || item?.originalFile?.name || 'unknown.jpg';
    const cat = (item?.oberkategorie || 'Unkategorisiert').trim() || 'Unkategorisiert';
    return `${cat}/${fileName}`;
}

function _currentCategoryLabel(item) {
    return _composeAiLabel(item);
}

function _aiSuggestionLabel(item) {
    return String(item?.aiSuggestion?.label || '').trim();
}

function _isSuggestionAccepted(item) {
    const suggested = _aiSuggestionLabel(item);
    if (!suggested) return false;
    const current = _currentCategoryLabel(item);
    return !!current && current === suggested;
}

async function _fetchAi(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiCategorizer.timeoutMs);

    try {
        const response = await fetch(`${aiCategorizer.baseUrl}${path}`, {
            ...options,
            signal: controller.signal
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`AI request failed (${response.status}): ${detail || response.statusText}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function queueAiSuggestionForItem(item) {
    if (!aiCategorizer.enabled || !item?.originalFile) return;

    item.aiSuggestion = {
        status: 'pending',
        label: null,
        confidence: null,
        matches: []
    };

    const payload = new FormData();
    payload.append('file', item.originalFile, item.originalFile.name || 'image.jpg');
    payload.append('top_k', String(aiCategorizer.topK));

    _fetchAi('/v1/suggest', {
        method: 'POST',
        body: payload
    }).then((result) => {
        const suggested = _splitAiLabel(result?.label || '');
        const confidence = Number.isFinite(result?.confidence) ? result.confidence : 0;

        item.aiSuggestion = {
            status: 'ready',
            label: result?.label || null,
            confidence: confidence,
            suggestedComment: result?.suggested_comment || null,
            suggestedCommentConfidence: Number.isFinite(result?.suggested_comment_confidence)
                ? result.suggested_comment_confidence
                : null,
            matches: Array.isArray(result?.matches) ? result.matches : []
        };

                // Apply AI suggestion when category is empty, or when it was only
                // seeded by a non-locked default target (e.g. stale currentTarget).
                const canOverrideSeeded = !item.aiCategoryLocked && !item.aiManuallyOverridden;
                const shouldApplySuggestion = !!suggested.oberkategorie && (
                    !item.oberkategorie
                    || (item.aiCategorySeeded && canOverrideSeeded)
                );

                if (shouldApplySuggestion) {
                    item.oberkategorie  = suggested.oberkategorie;
                    item.unterkategorie = suggested.unterkategorie || '';
                    item.aiCategorySeeded = false;
            }

            if (item._pendingIngestLearn && aiCategorizer.enabled) {
                item._pendingIngestLearn = false;
                if (typeof queueAiLearnForItem === 'function') {
                    queueAiLearnForItem(item, 'ingest-labeled');
                }
            }

            if (
                state.aiAutoCommentEnabled
                && !String(item.kommentar || '').trim()
                && item.aiSuggestion.suggestedComment
                && Number(item.aiSuggestion.suggestedCommentConfidence || 0) >= state.aiAutoCommentMinConfidence
            ) {
                item.kommentar = item.aiSuggestion.suggestedComment;
                item.aiCommentStatus = 'auto';
                item.aiCommentManuallyOverridden = false;
            }

        renderList();
    }).catch((error) => {
        item.aiSuggestion = {
            status: 'error',
            label: null,
            confidence: null,
            matches: []
        };
            if (item._pendingIngestLearn && aiCategorizer.enabled) {
                item._pendingIngestLearn = false;
                if (typeof queueAiLearnForItem === 'function') {
                    queueAiLearnForItem(item, 'ingest-labeled');
                }
            }
            console.warn('AI Suggest fehlgeschlagen:', error);
    });
}

function queueAiLearnForItem(item, source = 'manual') {
    if (!aiCategorizer.enabled || !item?.originalFile) return;

    const label = _composeAiLabel(item);
    if (!label) return;

    const payload = new FormData();
    payload.append('file', item.originalFile, item.originalFile.name || 'image.jpg');
    payload.append('label', label);
    payload.append('image_path', _buildStoredImagePath(item));
    payload.append('source', source);
    payload.append('comment', String(item.kommentar || '').trim());

    _fetchAi('/v1/learn', {
        method: 'POST',
        body: payload
    }).then(() => {
        item.aiLearnStatus = 'learned';
        _queueAiLearnToast(source);
    }).catch((error) => {
        item.aiLearnStatus = 'error';
        console.warn('AI Learn fehlgeschlagen:', error);
    });
}

function queueAiPassiveLearnForItem(item) {
    if (!aiCategorizer.enabled || !item?.originalFile) return;
    if (!state.aiPassiveLearnOnSave) return;
    if (item.aiPassiveLearnStatus === 'learned') return;
    if (item.aiManuallyOverridden) return;
    if (item.aiCommentStatus === 'auto' && item.aiCommentManuallyOverridden) return;
    if (!_isSuggestionAccepted(item)) return;

    const conf = Number(item?.aiSuggestion?.confidence || 0);
    if (!Number.isFinite(conf) || conf < state.aiPassiveLearnMinConfidence) return;

    item.aiPassiveLearnStatus = 'pending';
    const payload = new FormData();
    payload.append('file', item.originalFile, item.originalFile.name || 'image.jpg');
    payload.append('label', _currentCategoryLabel(item));
    payload.append('image_path', _buildStoredImagePath(item));
    payload.append('source', 'ai-confirmed');
    payload.append('comment', String(item.kommentar || '').trim());

    _fetchAi('/v1/learn', {
        method: 'POST',
        body: payload
    }).then(() => {
        item.aiPassiveLearnStatus = 'learned';
        _queueAiLearnToast('ai-confirmed');
    }).catch((error) => {
        item.aiPassiveLearnStatus = 'error';
        console.warn('AI Passive Learn fehlgeschlagen:', error);
    });
}

refreshAiCommentWhitelist();
startAiServiceHealthPolling();
