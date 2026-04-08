/** =========================================================================
 * MODUL: INDEXED-DB (FÜR ZIELORDNER & KONFIG-PERSISTENZ)
 * ========================================================================= */
const DB_NAME = "BildertoolDB";
const STORE_NAME = "settings";

function getDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveDirectoryHandle(handle) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, 'targetFolder');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadDirectoryHandle() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('targetFolder');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(tx.error);
    });
}

async function saveConfigFileHandle(handle) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, 'configFile');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadConfigFileHandle() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('configFile');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(tx.error);
    });
}

async function clearConfigFileHandle() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete('configFile');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function verifyPermission(fileHandle, readWrite) {
    if (!fileHandle) return false;
    const options = readWrite ? { mode: 'readwrite' } : {};
    if ((await fileHandle.queryPermission(options)) === 'granted') return true;
    if ((await fileHandle.requestPermission(options)) === 'granted') return true;
    return false;
}

function persistConfigToLocalStorage() {
    localStorage.setItem('commentSuggestions', JSON.stringify(state.suggestions));
    localStorage.setItem('categoriesConfig', JSON.stringify(categoriesConfig));
    localStorage.setItem('customCategoryColors', JSON.stringify(state.customCategoryColors));
    localStorage.setItem('autoGpsEnabled', state.autoGpsEnabled);
    localStorage.setItem('excludeUnmatched', state.excludeUnmatched);
}

function getConfigPayload() {
    return {
        version: 2,
        savedAt: new Date().toISOString(),
        suggestions: state.suggestions,
        categories: categoriesConfig,
        customCategoryColors: state.customCategoryColors,
        autoGpsEnabled: state.autoGpsEnabled,
        excludeUnmatched: state.excludeUnmatched
    };
}

function applyConfigPayload(payload) {
    state.suggestions = normalizeSuggestions(payload?.suggestions);
    categoriesConfig = normalizeCategories(payload?.categories);
    const legacyCustomColor = normalizeHexColor(payload?.customCategoryColor) || normalizeHexColor(localStorage.getItem('customCategoryColor'));
    state.customCategoryColors = normalizeColorList([
        ...(payload?.customCategoryColors || []),
        ...state.customCategoryColors,
        ...(legacyCustomColor ? [legacyCustomColor] : [])
    ]);
    if (typeof payload?.autoGpsEnabled === 'boolean') state.autoGpsEnabled = payload.autoGpsEnabled;
    if (typeof payload?.excludeUnmatched === 'boolean') state.excludeUnmatched = payload.excludeUnmatched;
    persistConfigToLocalStorage();

    if (!categoriesConfig.find(cat => cat.id === state.selectedCategory)) {
        state.selectedCategory = null;
        state.selectedSubcat = null;
        state.currentTarget = null;
    }

    renderCategories();
    renderSettingsList();
}
