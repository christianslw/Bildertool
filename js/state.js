/** =========================================================================
 * MODUL: GLOBAL DRAG & DROP FIX
 * ========================================================================= */
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, e => e.preventDefault());
});

/** =========================================================================
 * MODUL: STATE OBJECT & DOM CACHE
 * ========================================================================= */
const state = {
    files: [],
    hashes: new Set(),
    tabs: [{ id: 'all', label: 'Alle', standort: null }],
    activeTabId: 'all',
    currentTarget: null,
    directoryHandle: null,
    viewMode: localStorage.getItem('viewMode') || 'list', // 'list', 'gallery', 'compact'
    suggestions: normalizeSuggestions(JSON.parse(localStorage.getItem('commentSuggestions'))),
    selectedCategory: null,
    selectedSubcat: null,
    configFileHandle: null,
    configSource: 'default',
    customCategoryColors: normalizeColorList(JSON.parse(localStorage.getItem('customCategoryColors') || '[]')),
    openCategoryColorMenuFor: null,
    sortKey: 'lastModified',
    sortDir: 'desc',
    selectedFileIds: new Set(),
    dragReorderSrcId: null,
    groupBy: null,
    filterText: '',
    undoStack: [],
    redoStack: [],
    lastClickedId: null,
    autoGpsEnabled: localStorage.getItem('autoGpsEnabled') !== 'false',
    excludeUnmatched: localStorage.getItem('excludeUnmatched') === 'true',
    aiCategorizerEnabled: localStorage.getItem('aiCategorizerEnabled') !== 'false',
    aiCategorizerBaseUrl: localStorage.getItem('aiCategorizerBaseUrl') || 'http://127.0.0.1:8765',
    aiCategorizerTopK: Math.max(1, parseInt(localStorage.getItem('aiCategorizerTopK') || '5', 10) || 5),
    aiWhitelistedComments: normalizeSuggestions(JSON.parse(localStorage.getItem('aiWhitelistedComments') || '[]')),
    aiAutoLearnOnIngest: localStorage.getItem('aiAutoLearnOnIngest') !== 'false',
    aiPassiveLearnOnSave: localStorage.getItem('aiPassiveLearnOnSave') !== 'false',
    aiPassiveLearnMinConfidence: Math.max(0, Math.min(1, parseFloat(localStorage.getItem('aiPassiveLearnMinConfidence') || '0.72') || 0.72)),
    aiAutoCommentEnabled: localStorage.getItem('aiAutoCommentEnabled') === 'true',
    aiAutoCommentMinConfidence: Math.max(0, Math.min(1, parseFloat(localStorage.getItem('aiAutoCommentMinConfidence') || '0.68') || 0.68))
};

const viewIcons = {
    list:    `<i class="mdi mdi-view-list text-xl"></i>`,
    gallery: `<i class="mdi mdi-view-grid text-xl"></i>`,
    compact: `<i class="mdi mdi-view-agenda text-xl"></i>`
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
    folderInput: document.getElementById("folderInput"),
    quickImportBtn: document.getElementById("quickImportBtn"),
    undoBtn: document.getElementById("undoBtn"),
    redoBtn: document.getElementById("redoBtn"),
    statusEl: document.getElementById("status"),
    aiServiceStatus: document.getElementById("aiServiceStatus"),
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
    reloadConfigFileBtn: document.getElementById("reloadConfigFileBtn"),
    themeContextMenu: document.getElementById("themeContextMenu"),
    themeMenuToggle: document.getElementById("themeMenuToggle"),
    tabBar: document.getElementById("tabBar"),
    filterDropdownTrigger: document.getElementById("filterDropdownTrigger"),
    filterDropdownMenu: document.getElementById("filterDropdownMenu"),
    filterTextInput: document.getElementById("filterTextInput"),
    autoGpsToggle: document.getElementById("autoGpsToggle"),
    excludeUnmatchedToggle: document.getElementById("excludeUnmatchedToggle"),
    aiPassiveLearnOnSaveToggle: document.getElementById("aiPassiveLearnOnSaveToggle"),
    aiPassiveLearnMinConfidenceInput: document.getElementById("aiPassiveLearnMinConfidenceInput"),
    aiAutoCommentEnabledToggle: document.getElementById("aiAutoCommentEnabledToggle"),
    aiAutoCommentMinConfidenceInput: document.getElementById("aiAutoCommentMinConfidenceInput")
};

// Checkbox Zustand aus LocalStorage initialisieren
if (localStorage.getItem('compressCheck') === 'true') DOM.compressCheck.checked = true;
DOM.compressCheck.addEventListener('change', (e) => localStorage.setItem('compressCheck', e.target.checked));

const categoryColorMenu = document.createElement('div');
categoryColorMenu.className = 'category-color-menu hidden fixed z-[90] w-56 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-xl p-3';
categoryColorMenu.addEventListener('click', (e) => e.stopPropagation());
document.body.appendChild(categoryColorMenu);

const categoryCustomColorInput = document.createElement('input');
categoryCustomColorInput.type = 'color';
categoryCustomColorInput.className = 'sr-only';
document.body.appendChild(categoryCustomColorInput);

// Tooltip element for 3D map hover labels
const _tooltip = document.createElement('div');
_tooltip.style.cssText = 'position:fixed;background:rgba(15,23,42,0.92);color:#e2e8f0;padding:5px 12px;border-radius:6px;font-size:13px;font-weight:600;pointer-events:none;display:none;z-index:9999;border:1px solid rgba(99,179,255,0.4);letter-spacing:.03em;backdrop-filter:blur(4px)';
document.body.appendChild(_tooltip);
