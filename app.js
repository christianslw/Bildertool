/** =========================================================================
 * MODUL: GLOBAL DRAG & DROP FIX
 * ========================================================================= */
// Verhindert das Standard-Verhalten des Browsers (Bilder im neuen Tab öffnen),
// damit unser Custom-Drag & Drop auf den Kategorien und Chips sauber funktioniert.
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, e => e.preventDefault());
});

/** =========================================================================
 * MODUL: GLOBAL STATE & KONFIGURATION
 * ========================================================================= */
const DEFAULT_SUGGESTIONS = ['Vodafone', 'Telekom', 'O2', '1&1', 'Wartung', 'Umbau', 'Demontage'];
const DEFAULT_CATEGORIES = [
    { id: "Mast", label: "Mast", subcats: ["Pandunen", "Fundament", "Antennen", "Flugwarnbefeuerung", "Steigweg", "Kabel"] },
    { id: "Kabine", label: "Kabine", subcats: ["Keller", "Sendersaal", "Dach"] },
    { id: "Energietechnik", label: "Energietechnik", subcats: ["Trafo", "NEA", "Evt", "ZAS"] },
    { id: "Grundstück", label: "Grundstück", subcats: ["Zaun", "Zisterne", "Zufahrt"] }
];

function normalizeSuggestions(rawSuggestions) {
    if (!Array.isArray(rawSuggestions)) return [...DEFAULT_SUGGESTIONS];
    const cleaned = rawSuggestions
        .map(item => String(item || '').trim())
        .filter(Boolean);
    return [...new Set(cleaned)];
}

function normalizeCategories(rawCategories) {
    if (!Array.isArray(rawCategories) || !rawCategories.length) {
        return DEFAULT_CATEGORIES.map(cat => ({ ...cat, subcats: [...cat.subcats] }));
    }

    return rawCategories
        .map((cat, index) => {
            const label = String(cat?.label || cat?.id || '').trim();
            const id = String(cat?.id || label || `Kategorie-${index + 1}`).trim();
            const subcats = Array.isArray(cat?.subcats)
                ? [...new Set(cat.subcats.map(sub => String(sub || '').trim()).filter(Boolean))]
                : [];

            if (!label || !id) return null;
            return { id, label, subcats };
        })
        .filter(Boolean);
}

function mergeLegacyCustomSubcats(categories, legacyCustomSubcats) {
    if (!legacyCustomSubcats || typeof legacyCustomSubcats !== 'object') return categories;
    categories.forEach(cat => {
        const extras = Array.isArray(legacyCustomSubcats[cat.id]) ? legacyCustomSubcats[cat.id] : [];
        extras.forEach(sub => {
            const trimmed = String(sub || '').trim();
            if (trimmed && !cat.subcats.includes(trimmed)) cat.subcats.push(trimmed);
        });
    });
    return categories;
}

let categoriesConfig = mergeLegacyCustomSubcats(
    normalizeCategories(JSON.parse(localStorage.getItem('categoriesConfig'))),
    JSON.parse(localStorage.getItem('customSubcats') || '{}')
);

const state = {
    files: [],
    currentTarget: null,
    directoryHandle: null,
    viewMode: localStorage.getItem('viewMode') || 'list', // 'list', 'gallery', 'compact'
    suggestions: normalizeSuggestions(JSON.parse(localStorage.getItem('commentSuggestions'))),
    selectedCategory: null,
    selectedSubcat: null,
    configFileHandle: null
};
const viewIcons = {
    list: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
    gallery: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    compact: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`
};

const DOM = {
    standortSelect: document.getElementById("standortSelect"),
    standortDropdown: document.getElementById("standortDropdown"),
    clearSearchBtn: document.getElementById("clearSearchBtn"),

    // Isometric diagram elements
    isoContainer: document.getElementById("iso-container"),
    contextPanel: document.getElementById("context-panel"),
    contextTitle: document.getElementById("context-title"),
    contextChips: document.getElementById("context-chips"),

    fileListContainer: document.getElementById("fileListContainer"),
    fileInput: document.getElementById("fileInput"),
    statusEl: document.getElementById("status"),
    autocompleteDropdown: document.getElementById("autocompleteDropdown"),

    // Toolbar UI Elemente
    compressCheck: document.getElementById("compressCheck"),
    mainSaveBtn: document.getElementById("mainSaveBtn"),
    saveDropdownTrigger: document.getElementById("saveDropdownTrigger"),
    saveDropdownMenu: document.getElementById("saveDropdownMenu"),
    saveAsMenuOption: document.getElementById("saveAsMenuOption"),
    clearAll: document.getElementById("clearAll"),
    viewDropdownTrigger: document.getElementById("viewDropdownTrigger"),
    viewDropdownMenu: document.getElementById("viewDropdownMenu"),

    configFileStatus: document.getElementById("configFileStatus"),
    chooseConfigFileBtn: document.getElementById("chooseConfigFileBtn"),
    reloadConfigFileBtn: document.getElementById("reloadConfigFileBtn")
};

// Checkbox Zustand aus LocalStorage initialisieren
if (localStorage.getItem('compressCheck') === 'true') DOM.compressCheck.checked = true;
DOM.compressCheck.addEventListener('change', (e) => localStorage.setItem('compressCheck', e.target.checked));

/** =========================================================================
 * MODUL: 3D MAP CALLBACKS
 * These are called by site-3d.js when the user hovers/clicks on 3D objects.
 * ========================================================================= */
// Tooltip element for hover labels
const _tooltip = document.createElement('div');
_tooltip.style.cssText = 'position:fixed;background:rgba(15,23,42,0.92);color:#e2e8f0;padding:5px 12px;border-radius:6px;font-size:13px;font-weight:600;pointer-events:none;display:none;z-index:9999;border:1px solid rgba(99,179,255,0.4);letter-spacing:.03em;backdrop-filter:blur(4px)';
document.body.appendChild(_tooltip);

window.handle3DMapHover = function(cat, sub, label, event) {
    if (!cat) {
        _tooltip.style.display = 'none';
        return;
    }
    _tooltip.textContent = label || cat;
    _tooltip.style.display = 'block';
    if (event) {
        _tooltip.style.left = (event.clientX + 14) + 'px';
        _tooltip.style.top  = (event.clientY - 8)  + 'px';
    }
};

window.handle3DMapSelect = function(cat, sub) {
    if (!cat) return;
    state.selectedCategory = cat;
    renderCategories();
    // Scroll the context panel into view on mobile
    if (DOM.contextPanel) DOM.contextPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

/** =========================================================================
 * MODUL: THEME & UI HELPERS
 * ========================================================================= */
const THEME_STYLESHEETS = {
    'dracula': 'themes/dracula.css',
    'dracula-laser': 'themes/dracula-laser.css',
    'kirschbluete': 'themes/kirschbluete.css',
    'swr-ms': 'themes/swr-ms.css'
};

function ensureThemeStylesheet(colorTheme) {
    const existing = document.getElementById('custom-theme-css');

    if (!THEME_STYLESHEETS[colorTheme]) {
        if (existing) existing.remove();
        return;
    }

    if (existing) {
        existing.href = THEME_STYLESHEETS[colorTheme];
        return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'custom-theme-css';
    link.href = THEME_STYLESHEETS[colorTheme];
    document.head.appendChild(link);
}

function updateSelectionButton(buttonId, isActive) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.classList.toggle('bg-blue-100', isActive);
    btn.classList.toggle('dark:bg-blue-900/50', isActive);
    btn.classList.toggle('text-blue-700', isActive);
    btn.classList.toggle('dark:text-blue-300', isActive);
    btn.classList.toggle('border-blue-500', isActive);
}

function refreshThemeMenuUI() {
    const appearance = localStorage.getItem('appearance') || 'system';
    const colorTheme = localStorage.getItem('colorTheme') || 'standard';

    ['light', 'dark', 'system'].forEach(mode => updateSelectionButton(`btn-appearance-${mode}`, appearance === mode));
    ['standard', 'dracula', 'dracula-laser', 'kirschbluete', 'swr-ms'].forEach(theme => {
        updateSelectionButton(`btn-theme-${theme}`, colorTheme === theme);
    });
}

function applyStoredThemeSettings() {
    const appearance = localStorage.getItem('appearance') || 'system';
    const colorTheme = localStorage.getItem('colorTheme') || 'standard';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = appearance === 'dark' || (appearance === 'system' && prefersDark);

    document.documentElement.classList.toggle('dark', shouldUseDark);
    Object.keys(THEME_STYLESHEETS).forEach(themeClass => document.documentElement.classList.remove(themeClass));

    if (THEME_STYLESHEETS[colorTheme]) {
        document.documentElement.classList.add(colorTheme);
    }

    ensureThemeStylesheet(colorTheme);
    refreshThemeMenuUI();
}

function changeAppearance(mode) {
    localStorage.setItem('appearance', mode);
    applyStoredThemeSettings();
}

function changeColorTheme(theme) {
    localStorage.setItem('colorTheme', theme);
    applyStoredThemeSettings();
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
}

function updateStatusText() {
    if (state.directoryHandle) {
        DOM.statusEl.textContent = `Ziel: ${state.directoryHandle.name} | ${state.files.length} Datei(en)`;
        DOM.statusEl.title = `Gesteuerter Ordner: ${state.directoryHandle.name}`;
    } else {
        DOM.statusEl.textContent = `${state.files.length} Datei(en) in der Liste`;
        DOM.statusEl.title = "";
    }
}

function updateSaveButtonUI() {
    if (state.directoryHandle) {
        DOM.mainSaveBtn.textContent = "Speichern";
        DOM.mainSaveBtn.classList.remove('rounded-md');
        DOM.mainSaveBtn.classList.add('rounded-l-md');
        DOM.saveDropdownTrigger.classList.remove('hidden');
    } else {
        DOM.mainSaveBtn.textContent = "Speichern unter";
        DOM.mainSaveBtn.classList.remove('rounded-l-md');
        DOM.mainSaveBtn.classList.add('rounded-md');
        DOM.saveDropdownTrigger.classList.add('hidden');
    }
    updateStatusText();
}

/** =========================================================================
 * MODUL: INDEXED-DB (FÜR ZIELORDNER PERSISTENZ)
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
}

function getConfigPayload() {
    return {
        version: 1,
        savedAt: new Date().toISOString(),
        suggestions: state.suggestions,
        categories: categoriesConfig
    };
}

function applyConfigPayload(payload) {
    state.suggestions = normalizeSuggestions(payload?.suggestions);
    categoriesConfig = normalizeCategories(payload?.categories);
    persistConfigToLocalStorage();

    if (!categoriesConfig.find(cat => cat.id === state.selectedCategory)) {
        state.selectedCategory = null;
        state.selectedSubcat = null;
        state.currentTarget = null;
    }

    renderCategories();
    renderSettingsList();
}

function updateConfigFileStatus(message = '') {
    if (!DOM.configFileStatus) return;
    if (message) {
        DOM.configFileStatus.textContent = message;
        return;
    }
    DOM.configFileStatus.textContent = state.configFileHandle
        ? `Verknüpft: ${state.configFileHandle.name}`
        : 'Keine Konfigurationsdatei ausgewählt';
}

async function loadConfigFromFileHandle(handle, options = {}) {
    if (!handle) return false;
    try {
        const file = await handle.getFile();
        const text = await file.text();
        if (!text.trim()) return false;
        const payload = JSON.parse(text);
        applyConfigPayload(payload);
        if (!options.silent) updateConfigFileStatus(`Geladen: ${handle.name}`);
        return true;
    } catch (error) {
        if (!options.silent) updateConfigFileStatus(`Fehler beim Laden von ${handle.name}`);
        console.error('Konfigurationsdatei konnte nicht geladen werden:', error);
        return false;
    }
}

async function syncConfigFile(options = {}) {
    persistConfigToLocalStorage();
    if (!state.configFileHandle) {
        if (!options.silent) updateConfigFileStatus('Änderungen lokal gespeichert. Bitte Konfigurationsdatei auswählen.');
        return false;
    }

    try {
        const hasPermission = await verifyPermission(state.configFileHandle, true);
        if (!hasPermission) {
            if (!options.silent) updateConfigFileStatus('Schreibzugriff auf Konfigurationsdatei fehlt');
            return false;
        }

        const writer = await state.configFileHandle.createWritable();
        await writer.write(JSON.stringify(getConfigPayload(), null, 2));
        await writer.close();
        if (!options.silent) updateConfigFileStatus(`Gespeichert: ${state.configFileHandle.name}`);
        return true;
    } catch (error) {
        if (!options.silent) updateConfigFileStatus('Konfigurationsdatei konnte nicht gespeichert werden');
        console.error('Konfigurationsdatei konnte nicht gespeichert werden:', error);
        return false;
    }
}

async function chooseConfigFile() {
    if (!window.showSaveFilePicker) {
        alert('Dein Browser unterstützt keine lokale Konfigurationsdatei per Dateizugriff.');
        return;
    }

    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: 'bildertool-config.json',
            types: [{
                description: 'JSON Konfiguration',
                accept: { 'application/json': ['.json'] }
            }]
        });

        state.configFileHandle = handle;
        await saveConfigFileHandle(handle);

        const loaded = await loadConfigFromFileHandle(handle, { silent: true });
        if (!loaded) {
            await syncConfigFile({ silent: true });
        } else {
            await syncConfigFile({ silent: true });
        }
        updateConfigFileStatus();
    } catch (error) {
        if (error?.name !== 'AbortError') {
            updateConfigFileStatus('Auswahl der Konfigurationsdatei fehlgeschlagen');
            console.error(error);
        }
    }
}

async function reloadConfigFile() {
    if (!state.configFileHandle) {
        updateConfigFileStatus('Keine Konfigurationsdatei ausgewählt');
        return;
    }
    await loadConfigFromFileHandle(state.configFileHandle);
}

function getUniqueCategoryId(label) {
    const base = String(label || '').trim();
    let candidate = base;
    let counter = 2;
    while (categoriesConfig.some(cat => cat.id.toLowerCase() === candidate.toLowerCase())) {
        candidate = `${base}-${counter++}`;
    }
    return candidate;
}

async function handleAddNewMainCategory() {
    const name = prompt('Neue Hauptkategorie:');
    const label = String(name || '').trim();
    if (!label) return;
    if (categoriesConfig.some(cat => cat.label.toLowerCase() === label.toLowerCase())) {
        alert('Diese Hauptkategorie existiert bereits.');
        return;
    }

    categoriesConfig.push({ id: getUniqueCategoryId(label), label, subcats: [] });
    renderCategories();
    renderSettingsList();
    await syncConfigFile();
}

async function handleRemoveCategory(catId) {
    const cat = categoriesConfig.find(entry => entry.id === catId);
    if (!cat) return;
    if (categoriesConfig.length <= 1) {
        alert('Mindestens eine Hauptkategorie muss bestehen bleiben.');
        return;
    }
    if (!confirm(`Hauptkategorie "${cat.label}" wirklich löschen?`)) return;

    categoriesConfig = categoriesConfig.filter(entry => entry.id !== catId);
    if (state.selectedCategory === catId) {
        state.selectedCategory = null;
        state.selectedSubcat = null;
        state.currentTarget = null;
    }
    renderCategories();
    renderSettingsList();
    await syncConfigFile();
}

async function handleRemoveSubcat(catId, subcat) {
    const cat = categoriesConfig.find(entry => entry.id === catId);
    if (!cat) return;
    cat.subcats = cat.subcats.filter(sub => sub !== subcat);
    if (state.selectedCategory === catId && state.selectedSubcat === subcat) {
        state.selectedSubcat = null;
        state.currentTarget = { oberkategorie: catId, unterkategorie: '' };
    }
    renderCategories();
    renderSettingsList();
    await syncConfigFile();
}

/** =========================================================================
 * MODUL: STANDORT-SUCHE (DROPDOWN)
 * ========================================================================= */
function renderStandortDropdown(filterText = "") {
    DOM.standortDropdown.innerHTML = "";
    const lowerFilter = filterText.toLowerCase();

    if (typeof standorteDaten === 'undefined') return;

    const filtered = standorteDaten
        .filter(s => s.name.toLowerCase().includes(lowerFilter) || s.nummer.includes(lowerFilter))
        .sort((a, b) => parseInt(a.nummer) - parseInt(b.nummer));

    if (filtered.length === 0) {
        const noRes = document.createElement("div");
        noRes.className = "p-3 text-sm text-slate-400 dark:text-zinc-500 italic";
        noRes.textContent = "Keine Standorte gefunden";
        DOM.standortDropdown.appendChild(noRes);
    } else {
        filtered.forEach(s => {
            const item = document.createElement("div");
            item.className = "dropdown-item text-slate-700 dark:text-zinc-200";
            item.innerHTML = `<strong class="text-blue-600 dark:text-blue-400 font-mono">${s.nummer}</strong> <span>${s.name}</span>`;
            item.addEventListener("click", () => {
                DOM.standortSelect.value = `${s.name} (${s.nummer})`;
                DOM.standortDropdown.classList.add("hidden");
                DOM.clearSearchBtn.style.display = "flex";
            });
            DOM.standortDropdown.appendChild(item);
        });
    }
}

DOM.standortSelect.addEventListener("input", (e) => {
    DOM.standortDropdown.classList.remove("hidden");
    DOM.clearSearchBtn.style.display = e.target.value ? "flex" : "none";
    renderStandortDropdown(e.target.value);
});
DOM.standortSelect.addEventListener("focus", (e) => {
    DOM.standortDropdown.classList.remove("hidden");
    renderStandortDropdown(e.target.value);
});
DOM.clearSearchBtn.addEventListener("click", () => {
    DOM.standortSelect.value = "";
    DOM.clearSearchBtn.style.display = "none";
    DOM.standortDropdown.classList.add("hidden");
    DOM.standortSelect.focus();
});

/** =========================================================================
 * MODUL: KATEGORIEN & DATEI-VERARBEITUNG
 * ========================================================================= */
function createCategoryDropBox(cat, sub, onChangeCallback) {
    const isMainCategory = !sub;
    const targetSubcat = sub || '';
    const box = document.createElement("div");

    box.className = isMainCategory
        ? "group/box relative rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/80 px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-zinc-100 cursor-pointer select-none transition-colors hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 shadow-sm"
        : "group/box relative rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 cursor-pointer select-none transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 shadow-sm";

    const isSelected = state.selectedCategory === cat.id && ((state.selectedSubcat || '') === targetSubcat);
    if (isSelected) {
        box.classList.add('ring-2', 'ring-indigo-500', 'border-indigo-500', 'bg-indigo-50', 'text-indigo-700', 'dark:bg-indigo-900/30', 'dark:text-indigo-300');
    }

    const boxLabel = isMainCategory ? cat.label : sub;
    let boxHtml = `
        <div class="flex items-center justify-between gap-2">
            <span class="truncate">${boxLabel}</span>
            <span class="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 group-hover/box:bg-blue-200 group-hover/box:text-blue-700 dark:group-hover/box:bg-blue-800 dark:group-hover/box:text-blue-300 transition-colors">Drop</span>
        </div>
    `;

    boxHtml += `<button class="hidden group-hover/box:flex absolute top-1 right-1 items-center justify-center w-4 h-4 text-red-500 hover:text-red-700 bg-white/90 dark:bg-zinc-800 rounded-full" title="Entfernen">&times;</button>`;
    box.innerHTML = boxHtml;

    box.addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedCategory = cat.id;
        state.selectedSubcat = targetSubcat || null;
        state.currentTarget = { oberkategorie: cat.id, unterkategorie: targetSubcat };
        renderCategories();
        DOM.fileInput.click();
    });

    box.querySelector('button').addEventListener("click", async (e) => {
        e.stopPropagation();
        if (isMainCategory) {
            await handleRemoveCategory(cat.id);
        } else {
            await handleRemoveSubcat(cat.id, sub);
        }
        if (onChangeCallback) onChangeCallback();
    });

    box.addEventListener("dragover", (e) => {
        e.preventDefault();
        box.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    });
    box.addEventListener("dragleave", (e) => {
        e.preventDefault();
        box.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    });
    box.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        box.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
        state.selectedCategory = cat.id;
        state.selectedSubcat = targetSubcat || null;
        state.currentTarget = { oberkategorie: cat.id, unterkategorie: targetSubcat };
        renderCategories();
        handleDroppedFiles(e.dataTransfer.files, { oberkategorie: cat.id, unterkategorie: targetSubcat });
    });

    return box;
}

function handleAddNewSubcat(catId, onChangeCallback) {
    const name = prompt(`Neue Unterkategorie für ${catId}:`);
    if (name && name.trim()) {
        const trimmed = name.trim();
        const catConfig = categoriesConfig.find(c => c.id === catId);
        if (catConfig && !catConfig.subcats.includes(trimmed)) {
            catConfig.subcats.push(trimmed);
            if (onChangeCallback) onChangeCallback();
            renderSettingsList();
            syncConfigFile();
        }
    }
}

function renderCategories() {
    if (!DOM.contextChips || !DOM.contextTitle) return;

    if (state.selectedCategory) {
        const selectedCat = categoriesConfig.find(c => c.id === state.selectedCategory);
        if (selectedCat && state.selectedSubcat) {
            DOM.contextTitle.innerHTML = `Ausgewählt: <span class="text-blue-600 dark:text-blue-400 font-bold">${selectedCat.label}</span> <span class="text-slate-400 dark:text-zinc-500 font-normal">›</span> <span class="text-indigo-600 dark:text-indigo-400 font-bold">${state.selectedSubcat}</span>`;
        } else if (selectedCat) {
            DOM.contextTitle.innerHTML = `Ausgewählt: <span class="text-blue-600 dark:text-blue-400 font-bold">${selectedCat.label}</span>`;
        } else {
            DOM.contextTitle.innerHTML = `Bauteile & Kategorien`;
        }
    } else {
        DOM.contextTitle.innerHTML = `Bauteile & Kategorien`;
    }

    DOM.contextChips.innerHTML = '';

    const hint = document.createElement('p');
    hint.className = 'text-xs text-slate-500 dark:text-zinc-400 italic w-full mb-3';
    hint.textContent = 'Jede Box ist auswählbar und ein Drop-Ziel für Bilder (auch Hauptkategorien).';
    DOM.contextChips.append(hint);

    const topActions = document.createElement('div');
    topActions.className = 'flex justify-end mb-3';
    const addMainBtn = document.createElement('button');
    addMainBtn.type = 'button';
    addMainBtn.className = 'rounded-md border border-dashed border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors';
    addMainBtn.textContent = '+ Hauptkategorie';
    addMainBtn.addEventListener('click', handleAddNewMainCategory);
    topActions.append(addMainBtn);
    DOM.contextChips.append(topActions);

    const onChangeCallback = () => { renderCategories(); };
    const categoriesWrapper = document.createElement('div');
    categoriesWrapper.className = 'w-full flex flex-col gap-4';

    categoriesConfig.forEach(cat => {
        const section = document.createElement('div');
        section.className = 'w-full flex flex-col gap-1.5';

        // Main category box
        const mainBoxWrapper = document.createElement('div');
        mainBoxWrapper.className = 'relative';
        mainBoxWrapper.append(createCategoryDropBox(cat, null, onChangeCallback));
        
        section.append(mainBoxWrapper);

        // Sub categories container
        const subCatsContainer = document.createElement('div');
        subCatsContainer.className = 'grid grid-cols-2 lg:grid-cols-3 gap-2 pl-4 border-l-2 border-slate-200 dark:border-zinc-800 ml-3 mt-1';

        const allSubs = [...cat.subcats.map(sub => ({ sub }))];

        allSubs.forEach((entry) => {
            subCatsContainer.append(createCategoryDropBox(cat, entry.sub, onChangeCallback));
        });

        // Add subcat button
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'flex items-center justify-center rounded-md border border-dashed border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shadow-sm';
        addBtn.innerHTML = '+ Unterkategorie';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleAddNewSubcat(cat.id, onChangeCallback);
        });
        subCatsContainer.append(addBtn);

        section.append(subCatsContainer);
        categoriesWrapper.append(section);
    });

    DOM.contextChips.append(categoriesWrapper);

    DOM.contextPanel.ondragover = null;
    DOM.contextPanel.ondragleave = null;
    DOM.contextPanel.ondrop = null;
}


function handleDroppedFiles(fileList, targetConfig) {
    const files = [...fileList].filter(f => f.type === "image/jpeg" || f.name.toLowerCase().endsWith('.jpg'));
    processFiles(files, targetConfig);
}

function processFiles(files, targetConfig) {
    const inputValue = DOM.standortSelect.value;
    const match = inputValue.match(/\((\d+)\)$/);
    const standortNummer = match ? match[1] : inputValue;
    const standort = standortNummer.trim() ? standortNummer.padStart(4, "0") : "";

    for (const file of files) {
        const item = {
            id: crypto.randomUUID(),
            standort: standort,
            datum: formatDate(file.lastModified || Date.now()),
            oberkategorie: targetConfig.oberkategorie,
            unterkategorie: targetConfig.unterkategorie,
            kommentar: "",
            originalFile: file,
            objectUrl: URL.createObjectURL(file)
        };
        state.files.push(item);
    }
    renderList();
}

/** =========================================================================
 * MODUL: DATEILISTE, GRUPPIERUNG, INLINE-EDITIERUNG & VORSCHAU MODAL
 * ========================================================================= */
function buildName(item) {
    const parts = [];
    if (item.standort && item.standort !== 'Standort') parts.push(item.standort);
    if (item.datum && item.datum !== 'Datum') parts.push(item.datum);
    if (item.oberkategorie) parts.push(item.oberkategorie);
    if (item.unterkategorie && item.unterkategorie !== 'Unterkategorie') parts.push(item.unterkategorie);
    if (item.kommentar && item.kommentar !== 'Kommentar') parts.push(item.kommentar);
    return parts.join("_") + ".jpg";
}

function getEditorHTML(item) {
    const uKat = item.unterkategorie || 'Unterkategorie';
    const uKatClass = item.unterkategorie ? '' : 'placeholder';
    const kom = item.kommentar || 'Kommentar';
    const komClass = item.kommentar ? '' : 'placeholder';
    const st = item.standort || 'Standort';
    const dt = item.datum || 'Datum';

    const showSaveBtn = item.kommentar && !state.suggestions.includes(item.kommentar);
    const saveBtnHtml = showSaveBtn
        ? `<button class="save-suggestion-btn shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-600 hover:text-emerald-800 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 dark:text-emerald-400 transition-colors text-[11px] font-bold leading-none" title="&quot;${item.kommentar}&quot; als Vorschlag speichern" data-kommentar="${item.kommentar}">+</button>`
        : '';

    return `
          <div class="flex items-center gap-1.5 min-w-0 w-full">
            <div class="file-name-builder font-mono text-[13px] md:text-sm text-slate-800 dark:text-zinc-200 truncate flex-1 min-w-0">
              <span class="editable-segment" contenteditable="true" data-field="standort">${st}</span>_
              <span class="editable-segment" contenteditable="true" data-field="datum">${dt}</span>_
              <span class="editable-segment text-blue-600 dark:text-blue-400 font-semibold" contenteditable="false" data-field="oberkategorie">${item.oberkategorie}</span>_
              <span class="editable-segment ${uKatClass}" contenteditable="true" data-field="unterkategorie">${uKat}</span>_
              <span class="editable-segment ${komClass}" contenteditable="true" data-field="kommentar">${kom}</span>.jpg
            </div>
            ${saveBtnHtml}
          </div>
        `;
}

function openPreview(item) {
    const finalName = buildName(item);
    document.getElementById('previewImage').src = item.objectUrl;
    document.getElementById('previewNewName').textContent = finalName;
    document.getElementById('previewOldName').innerHTML = `<span class="opacity-70">Ursprung:</span> ${item.originalFile.name}`;
    document.getElementById('previewPath').innerHTML = `<span class="opacity-70">Zukünftiger Pfad:</span> ${item.oberkategorie}/${finalName}`;

    const modal = document.getElementById('previewModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePreview() {
    const modal = document.getElementById('previewModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePreview();
        closeSettings();
    }
});

function renderList() {
    DOM.fileListContainer.innerHTML = "";

    const sortedFiles = [...state.files].sort((a, b) => {
        const dateA = a.originalFile.lastModified || 0;
        const dateB = b.originalFile.lastModified || 0;
        return dateB - dateA; // Absteigend
    });

    const groups = {};
    sortedFiles.forEach(f => {
        if (!groups[f.oberkategorie]) groups[f.oberkategorie] = [];
        groups[f.oberkategorie].push(f);
    });

    for (const cat in groups) {
        const catHeader = document.createElement("h3");
        catHeader.className = "text-xs font-bold text-slate-500 dark:text-zinc-400 mt-4 mb-2 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800 pb-1";
        catHeader.textContent = cat;
        DOM.fileListContainer.appendChild(catHeader);

        const wrapper = document.createElement("div");
        if (state.viewMode === 'list') wrapper.className = 'flex flex-col gap-2';
        else if (state.viewMode === 'compact') wrapper.className = 'flex flex-col gap-1 border border-slate-200 dark:border-zinc-800 rounded-md overflow-hidden shadow-sm';
        else wrapper.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

        groups[cat].forEach((item) => {
            const el = document.createElement("div");
            el.dataset.id = item.id;

            const editorHTML = getEditorHTML(item);
            const delBtnHTML = `<button class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors shrink-0" title="Entfernen">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>`;

            if (state.viewMode === 'compact') {
                el.className = 'flex items-center justify-between p-1.5 px-3 border-b last:border-0 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors';
                el.innerHTML = `
                  <div class="flex-1 min-w-0 flex items-center overflow-hidden mr-2">
                      ${editorHTML}
                  </div>
                  ${delBtnHTML}
                `;
            } else if (state.viewMode === 'list') {
                el.className = 'flex items-center p-2.5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md shadow-sm gap-3';
                const finalName = buildName(item);
                const subTextHTML = `<div class="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5" title="${item.originalFile.name}">
                  Ursprung: ${item.originalFile.name} &bull; Pfad: ${item.oberkategorie}/${finalName}
                </div>`;
                el.innerHTML = `
                  <div class="w-12 h-12 shrink-0 bg-slate-100 dark:bg-zinc-800 rounded overflow-hidden border border-slate-200 dark:border-zinc-700">
                      <img src="${item.objectUrl}" class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity preview-trigger" alt="Vorschau" />
                  </div>
                  <div class="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                      ${editorHTML}
                      ${subTextHTML}
                  </div>
                  ${delBtnHTML}
                `;
            } else {
                // Gallery
                el.className = 'border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 flex flex-col shadow-sm';
                const finalName = buildName(item);
                const subTextHTML = `<div class="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5" title="${item.originalFile.name}">
                  Ursprung: ${item.originalFile.name} &bull; Pfad: ${item.oberkategorie}/${finalName}
                </div>`;
                el.innerHTML = `
                  <div class="relative w-full h-28 bg-slate-100 dark:bg-zinc-800 group">
                    <img src="${item.objectUrl}" alt="Vorschau" class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity preview-trigger" />
                    <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-black/80 rounded-md">
                        ${delBtnHTML}
                    </div>
                  </div>
                  <div class="p-3 overflow-hidden flex flex-col">
                    ${editorHTML}
                    ${subTextHTML}
                  </div>
                `;
            }

            // Event für das Löschen-Icon
            el.querySelector('button[title="Entfernen"]').addEventListener('click', () => {
                URL.revokeObjectURL(item.objectUrl);
                state.files = state.files.filter(f => f.id !== item.id);
                renderList();
            });

            // Event für die Bildvorschau (falls existent)
            const imgTrigger = el.querySelector('.preview-trigger');
            if (imgTrigger) {
                imgTrigger.addEventListener('click', () => openPreview(item));
            }

            wrapper.append(el);
        });
        DOM.fileListContainer.appendChild(wrapper);
    }

    updateStatusText();
    DOM.viewDropdownTrigger.innerHTML = viewIcons[state.viewMode] || viewIcons.list;
}

// View Buttons Logic
document.querySelectorAll('.view-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
        state.viewMode = e.currentTarget.dataset.view;
        localStorage.setItem('viewMode', state.viewMode);
        DOM.viewDropdownMenu.classList.add('hidden');
        renderList();
    });
});

// Inline Edit Focus/Blur & Autocomplete triggers
DOM.fileListContainer.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('editable-segment')) {
        const val = e.target.textContent.trim();
        if (['Standort', 'Datum', 'Unterkategorie', 'Kommentar'].includes(val)) {
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(e.target);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
            }, 10);
        }
        if (e.target.dataset.field === 'kommentar') {
            showAutocomplete(e.target, 'kommentar');
        } else if (e.target.dataset.field === 'standort') {
            showAutocomplete(e.target, 'standort');
        }
    }
});

DOM.fileListContainer.addEventListener('input', (e) => {
    if (e.target.dataset.field === 'kommentar') {
        showAutocomplete(e.target, 'kommentar');
    } else if (e.target.dataset.field === 'standort') {
        showAutocomplete(e.target, 'standort');
    }
});

DOM.fileListContainer.addEventListener('blur', (e) => {
    if (e.target.classList.contains('editable-segment')) {
        const id = e.target.closest('[data-id]').dataset.id;
        const field = e.target.dataset.field;
        let val = e.target.textContent.trim();

        if (val === 'Unterkategorie' && field === 'unterkategorie') val = '';
        if (val === 'Kommentar' && field === 'kommentar') val = '';
        if (val === 'Standort' && field === 'standort') val = '';
        if (val === 'Datum' && field === 'datum') val = '';

        const item = state.files.find(f => f.id === id);
        if (item && item[field] !== val) {
            item[field] = val;
            renderList();
        } else {
            if (!val) {
                e.target.classList.add('placeholder');
                e.target.textContent = field === 'unterkategorie' ? 'Unterkategorie' : 'Kommentar';
            }
        }
        // Delay closing autocomplete to allow click event on it
        setTimeout(() => DOM.autocompleteDropdown.classList.add('hidden'), 200);
    }
}, true);

DOM.fileListContainer.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('editable-segment') && e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
    }
});

DOM.fileListContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.save-suggestion-btn');
    if (!btn) return;
    const kommentar = btn.dataset.kommentar;
    if (kommentar && !state.suggestions.includes(kommentar)) {
        state.suggestions.push(kommentar);
        persistConfigToLocalStorage();
        // Kurzes visuelles Feedback, dann neu rendern
        btn.textContent = '✓';
        btn.classList.remove('bg-emerald-100', 'text-emerald-600', 'hover:bg-emerald-200', 'dark:bg-emerald-900/30', 'dark:text-emerald-400');
        btn.classList.add('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/30', 'dark:text-blue-400');
        btn.disabled = true;
        syncConfigFile({ silent: true });
        setTimeout(() => renderList(), 700);
    }
});

/** =========================================================================
 * MODUL: INLINE AUTOCOMPLETE (KOMMENTARE & STANDORT) & EINSTELLUNGEN
 * ========================================================================= */
function showAutocomplete(element, type) {
    const val = element.textContent.trim().toLowerCase();
    let filtered = [];
    DOM.autocompleteDropdown.innerHTML = '';

    if (type === 'kommentar') {
        const query = (val === 'kommentar') ? '' : val;
        filtered = state.suggestions.filter(s => s.toLowerCase().includes(query));

        filtered.forEach(s => {
            const div = document.createElement('div');
            div.className = "px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 last:border-0";
            div.textContent = s;
            div.onmousedown = (ev) => {
                ev.preventDefault(); // Verhindert Blur
                element.textContent = s;
                element.blur(); // Triggert Speichern
            };
            DOM.autocompleteDropdown.appendChild(div);
        });
    } else if (type === 'standort') {
        if (typeof standorteDaten === 'undefined') return;
        const query = (val === 'standort') ? '' : val;
        if (!query) return; // Zeige Standort Dropdown erst ab Eingabe

        filtered = standorteDaten.filter(s => s.name.toLowerCase().includes(query) || s.nummer.includes(query)).slice(0, 15);
        filtered.forEach(s => {
            const div = document.createElement('div');
            div.className = "px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 last:border-0 flex gap-2";
            div.innerHTML = `<strong class="text-blue-600 dark:text-blue-400 font-mono">${s.nummer}</strong> <span>${s.name}</span>`;
            div.onmousedown = (ev) => {
                ev.preventDefault();
                element.textContent = s.nummer; // Nur die Nummer wird übernommen
                element.blur();
            };
            DOM.autocompleteDropdown.appendChild(div);
        });
    }

    if (filtered.length === 0) {
        DOM.autocompleteDropdown.classList.add('hidden');
        return;
    }

    const rect = element.getBoundingClientRect();
    DOM.autocompleteDropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    DOM.autocompleteDropdown.style.left = rect.left + 'px';
    DOM.autocompleteDropdown.classList.remove('hidden');
}

function openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
    renderSettingsList();
    refreshThemeMenuUI();
}
function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}
function renderSettingsList() {
    const list = document.getElementById('suggestionsList');
    list.innerHTML = '';
    state.suggestions.forEach((s, idx) => {
        const row = document.createElement('div');
        row.className = "flex justify-between items-center p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-sm";
        row.innerHTML = `
                <span class="text-slate-800 dark:text-zinc-200">${s}</span>
                <button onclick="removeSuggestion(${idx})" class="text-slate-400 hover:text-red-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
              `;
        list.appendChild(row);
    });
    persistConfigToLocalStorage();
    updateConfigFileStatus();
}
function addSuggestion() {
    const input = document.getElementById('newSuggestionInput');
    const val = input.value.trim();
    if (val && !state.suggestions.includes(val)) {
        state.suggestions.push(val);
        input.value = '';
        renderSettingsList();
        syncConfigFile();
    }
}
function removeSuggestion(idx) {
    state.suggestions.splice(idx, 1);
    renderSettingsList();
    syncConfigFile();
}

if (DOM.chooseConfigFileBtn) DOM.chooseConfigFileBtn.addEventListener('click', chooseConfigFile);
if (DOM.reloadConfigFileBtn) DOM.reloadConfigFileBtn.addEventListener('click', reloadConfigFile);

/** =========================================================================
 * MODUL: SPEICHERN & KOMPRIMIEREN
 * ========================================================================= */
async function compressToUnder1MB(file) {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    let width = imageBitmap.width;
    let height = imageBitmap.height;
    const maxSide = 2200;

    if (Math.max(width, height) > maxSide) {
        const ratio = maxSide / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    let quality = 0.9;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    while (blob.size > 1_000_000 && quality > 0.35) {
        quality -= 0.1;
        blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    }
    return blob;
}

async function executeSave(forceSaveAs = false) {
    if (!state.files.length) return;

    // Check if File System API is supported
    if (!window.showDirectoryPicker) {
        alert("Dein Browser unterstützt die Ordnerauswahl leider nicht. Dateien werden direkt heruntergeladen.");
        await processSaveLoop(null);
        return;
    }

    if (forceSaveAs || !state.directoryHandle) {
        try {
            const handle = await window.showDirectoryPicker({ mode: "readwrite" });
            state.directoryHandle = handle;
            await saveDirectoryHandle(handle);
            updateSaveButtonUI();
        } catch (e) {
            DOM.statusEl.textContent = "Ordnerauswahl abgebrochen.";
            setTimeout(updateStatusText, 2500);
            return;
        }
    } else {
        const hasPermission = await verifyPermission(state.directoryHandle, true);
        if (!hasPermission) {
            alert("Berechtigung fehlt. Bitte wähle den Ordner erneut aus (Sicherheitsrichtlinie des Browsers).");
            return executeSave(true);
        }
    }

    await processSaveLoop(state.directoryHandle);
}

async function processSaveLoop(baseHandle) {
    const isCompressing = DOM.compressCheck.checked;
    DOM.statusEl.textContent = isCompressing ? "Komprimierung & Speicherung läuft..." : "Speicherung läuft...";
    const nameTracker = {};

    let targetBaseDir = baseHandle;
    // Wenn komprimiert werden soll und ein Ordner da ist, wechsle in den "komprimiert" Unterordner
    if (targetBaseDir && isCompressing) {
        targetBaseDir = await baseHandle.getDirectoryHandle("komprimiert", { create: true });
    }

    for (const item of state.files) {
        let finalName = buildName(item);
        const folderName = item.oberkategorie;

        // Verhindere Überschreiben bei identischen generierten Namen
        if (!nameTracker[folderName]) nameTracker[folderName] = {};
        if (nameTracker[folderName][finalName]) {
            let count = nameTracker[folderName][finalName]++;
            finalName = finalName.replace(/\.jpg$/i, `_${count}.jpg`);
        } else {
            nameTracker[folderName][finalName] = 1;
        }

        let fileData = item.originalFile;
        if (isCompressing) {
            fileData = await compressToUnder1MB(item.originalFile);
        }

        if (targetBaseDir) {
            const subDir = await targetBaseDir.getDirectoryHandle(folderName, { create: true });
            const fileHandle = await subDir.getFileHandle(finalName, { create: true });
            const writer = await fileHandle.createWritable();
            await writer.write(fileData);
            await writer.close();
        } else {
            // Fallback: Normaler Download, falls showDirectoryPicker nicht existiert
            const a = document.createElement("a");
            a.href = isCompressing ? URL.createObjectURL(fileData) : item.objectUrl;
            a.download = isCompressing ? `komprimiert_${folderName}_${finalName}` : `${folderName}_${finalName}`;
            a.click();
        }
    }
    DOM.statusEl.textContent = "Erfolgreich gespeichert!";
    setTimeout(updateStatusText, 3000);
}

// Buttons Logic
DOM.mainSaveBtn.addEventListener("click", () => executeSave(false));
DOM.saveAsMenuOption.addEventListener("click", () => {
    DOM.saveDropdownMenu.classList.add('hidden');
    executeSave(true);
});

DOM.clearAll.addEventListener("click", () => {
    state.files.forEach(f => URL.revokeObjectURL(f.objectUrl));
    state.files = [];
    renderList();
});

DOM.fileInput.addEventListener("change", () => {
    const files = [...DOM.fileInput.files].filter(f => f.type === "image/jpeg" || f.name.toLowerCase().endsWith('.jpg'));
    if (state.currentTarget && files.length) {
        processFiles(files, state.currentTarget);
    }
    DOM.fileInput.value = "";
});

// Globale Dropdown Toggle & Schließen Logic
document.addEventListener('click', (e) => {
    // Standort Dropdown (Hauptsuche)
    if (!e.target.closest('#standortSelect') && !e.target.closest('#standortDropdown') && !e.target.closest('#clearSearchBtn')) {
        DOM.standortDropdown.classList.add('hidden');
    }
    // Autocomplete Dropdown
    if (!e.target.closest('.editable-segment') && !e.target.closest('#autocompleteDropdown')) {
        DOM.autocompleteDropdown.classList.add('hidden');
    }
    // Save Dropdown
    if (!e.target.closest('#saveDropdownTrigger') && !e.target.closest('#saveDropdownMenu')) {
        DOM.saveDropdownMenu.classList.add('hidden');
    }
    // View Dropdown
    if (!e.target.closest('#viewDropdownTrigger') && !e.target.closest('#viewDropdownMenu')) {
        DOM.viewDropdownMenu.classList.add('hidden');
    }
});

DOM.saveDropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.saveDropdownMenu.classList.toggle('hidden');
});
DOM.viewDropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.viewDropdownMenu.classList.toggle('hidden');
});

/** =========================================================================
 * INIT
 * ========================================================================= */
window.onload = async () => {
    applyStoredThemeSettings();
    renderCategories();
    renderStandortDropdown();
    DOM.viewDropdownTrigger.innerHTML = viewIcons[state.viewMode] || viewIcons.list;

    try {
        const savedHandle = await loadDirectoryHandle();
        if (savedHandle) {
            state.directoryHandle = savedHandle;
        }
    } catch (e) { console.log("Kein Ordner in DB gefunden."); }

    try {
        const savedConfigHandle = await loadConfigFileHandle();
        if (savedConfigHandle) {
            state.configFileHandle = savedConfigHandle;
            await loadConfigFromFileHandle(savedConfigHandle, { silent: true });
        }
    } catch (e) { console.log("Keine Konfigurationsdatei in DB gefunden."); }

    updateConfigFileStatus();
    updateSaveButtonUI();
};
