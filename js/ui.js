/** =========================================================================
 * MODUL: TOAST & MODAL HELPERS
 * ========================================================================= */
function showToast(message, { undoAction, duration = 4000 } = {}) {
    const container = document.getElementById('toastContainer');
    if (!container) { console.warn(message); return; }
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg bg-slate-800 dark:bg-zinc-100 text-slate-100 dark:text-zinc-900 text-sm font-medium max-w-sm transition-all duration-300 opacity-0 translate-y-2';
    toast.innerHTML = `<span class="flex-1">${message}</span>`;
    if (undoAction) {
        const undoBtn = document.createElement('button');
        undoBtn.textContent = 'Rückgängig';
        undoBtn.className = 'shrink-0 text-xs font-bold text-blue-300 dark:text-blue-600 hover:underline';
        undoBtn.addEventListener('click', () => { undoAction(); toast.remove(); });
        toast.appendChild(undoBtn);
    }
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.remove('opacity-0', 'translate-y-2'); });
    const timer = setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, duration);
    toast.addEventListener('click', () => { clearTimeout(timer); toast.remove(); });
}

function showPromptModal(title, placeholder = '', defaultValue = '') {
    return new Promise(resolve => {
        const modal = document.getElementById('promptModal');
        const titleEl = document.getElementById('promptModalTitle');
        const input = document.getElementById('promptModalInput');
        const cancelBtn = document.getElementById('promptModalCancel');
        const confirmBtn = document.getElementById('promptModalConfirm');
        if (!modal) { resolve(prompt(title) || null); return; }
        titleEl.textContent = title;
        input.placeholder = placeholder;
        input.value = defaultValue;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => input.focus(), 50);
        const finish = (value) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            input.removeEventListener('keydown', onKey);
            resolve(value);
        };
        const onCancel = () => finish(null);
        const onConfirm = () => finish(input.value.trim() || null);
        const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(input.value.trim() || null); } else if (e.key === 'Escape') finish(null); };
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        input.addEventListener('keydown', onKey);
    });
}

function showConfirmModal(message) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirmModal');
        const msgEl = document.getElementById('confirmModalMessage');
        const cancelBtn = document.getElementById('confirmModalCancel');
        const okBtn = document.getElementById('confirmModalOk');
        if (!modal) { resolve(confirm(message)); return; }
        msgEl.textContent = message;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const finish = (value) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
            resolve(value);
        };
        const onCancel = () => finish(false);
        const onOk = () => finish(true);
        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
    });
}

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
    const tabCount = state.activeTabId === 'all'
        ? state.files.length
        : state.files.filter(f => f.tabId === state.activeTabId).length;
    const totalCount = state.files.length;
    const allTabsText = state.activeTabId !== 'all' && totalCount > tabCount ? ` (${totalCount} gesamt)` : '';
    if (state.directoryHandle) {
        DOM.statusEl.textContent = `Ziel: ${state.directoryHandle.name} | ${tabCount} Datei(en)${allTabsText}`;
        DOM.statusEl.title = `Gesteuerter Ordner: ${state.directoryHandle.name}`;
    } else {
        DOM.statusEl.textContent = `${tabCount} Datei(en) in der Liste${allTabsText}`;
        DOM.statusEl.title = "";
    }
}

function updateSaveButtonUI() {
    if (state.directoryHandle) {
        DOM.mainSaveBtn.textContent = "Alle speichern";
        DOM.mainSaveBtn.classList.remove('rounded-md');
        DOM.mainSaveBtn.classList.add('rounded-l-md');
        DOM.saveDropdownTrigger.classList.remove('hidden');
    } else {
        DOM.mainSaveBtn.textContent = "Alle speichern unter";
        DOM.mainSaveBtn.classList.remove('rounded-l-md');
        DOM.mainSaveBtn.classList.add('rounded-md');
        DOM.saveDropdownTrigger.classList.add('hidden');
    }
    updateStatusText();
}
