/** =========================================================================
 * MODUL: INLINE AUTOCOMPLETE (KOMMENTARE & STANDORT) & EINSTELLUNGEN
 * ========================================================================= */
function showAutocomplete(element, type) {
    const val = element.textContent.trim().toLowerCase();
    let filtered = [];
    DOM.autocompleteDropdown.innerHTML = '';

    if (type === 'kommentar') {
        const query = (val === 'kommentar') ? '' : val;
        const whitelist = typeof getWhitelistedComments === 'function' ? getWhitelistedComments() : [];
        const userSuggestions = state.suggestions || [];
        const merged = [...whitelist, ...userSuggestions.filter(s => !whitelist.some(w => w.toLowerCase() === String(s).toLowerCase()))];
        filtered = merged.filter(s => s.toLowerCase().includes(query));

        filtered.forEach(s => {
            const isWhitelisted = typeof isWhitelistedComment === 'function' && isWhitelistedComment(s);
            const div = document.createElement('div');
            div.className = isWhitelisted
                ? "px-3 py-2 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-b border-slate-100 dark:border-zinc-800 last:border-0 flex items-center justify-between gap-2"
                : "px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 last:border-0";
            div.dataset.autocompleteItem = '1';
            if (isWhitelisted) {
                div.innerHTML = `<span class="truncate">${s}</span><span class="shrink-0 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold">Whitelist</span>`;
            } else {
                div.textContent = s;
            }
            div.onmousedown = (ev) => {
                ev.preventDefault();
                element.textContent = s;
                element.blur();
            };
            DOM.autocompleteDropdown.appendChild(div);
        });
    } else if (type === 'standort') {
        if (typeof standorteDaten === 'undefined') return;
        const query = (val === 'standort') ? '' : val;
        if (!query) return;

        filtered = standorteDaten.filter(s => s.name.toLowerCase().includes(query) || s.nummer.includes(query)).slice(0, 15);
        filtered.forEach(s => {
            const div = document.createElement('div');
            div.className = "px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 last:border-0 flex gap-2";
            div.dataset.autocompleteItem = '1';
            div.innerHTML = `<strong class="text-blue-600 dark:text-blue-400 font-mono">${s.nummer}</strong> <span>${s.name}</span>`;
            div.onmousedown = (ev) => {
                ev.preventDefault();
                element.textContent = s.nummer;
                element.blur();
            };
            DOM.autocompleteDropdown.appendChild(div);
        });
    } else if (type === 'unterkategorie') {
        const cardEl = element.closest('[data-id]');
        const fileId = cardEl?.dataset.id;
        const file = fileId ? state.files.find(f => f.id === fileId) : null;
        const catConfig = file ? categoriesConfig.find(c => c.id === file.oberkategorie) : null;
        const subcats = catConfig?.subcats || [];
        const query = (val === 'unterkategorie') ? '' : val;
        filtered = subcats.filter(s => s.toLowerCase().includes(query));

        filtered.forEach(s => {
            const div = document.createElement('div');
            div.className = "px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 last:border-0";
            div.dataset.autocompleteItem = '1';
            div.textContent = s;
            div.onmousedown = (ev) => {
                ev.preventDefault();
                element.textContent = s;
                element.classList.remove('placeholder');
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
    if (typeof refreshAiCommentWhitelist === 'function') refreshAiCommentWhitelist();
    if (DOM.autoGpsToggle) DOM.autoGpsToggle.checked = state.autoGpsEnabled;
    if (DOM.excludeUnmatchedToggle) DOM.excludeUnmatchedToggle.checked = state.excludeUnmatched;
    if (DOM.aiPassiveLearnOnSaveToggle) DOM.aiPassiveLearnOnSaveToggle.checked = state.aiPassiveLearnOnSave;
    if (DOM.aiPassiveLearnMinConfidenceInput) DOM.aiPassiveLearnMinConfidenceInput.value = String(state.aiPassiveLearnMinConfidence);
    if (DOM.aiAutoCommentEnabledToggle) DOM.aiAutoCommentEnabledToggle.checked = state.aiAutoCommentEnabled;
    if (DOM.aiAutoCommentMinConfidenceInput) DOM.aiAutoCommentMinConfidenceInput.value = String(state.aiAutoCommentMinConfidence);
    renderSettingsList();
}
function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}
function toggleThemeContextMenu(event) {
    if (event) event.stopPropagation();
    if (!DOM.themeContextMenu) return;
    DOM.themeContextMenu.classList.toggle('hidden');
    refreshThemeMenuUI();
}
window.toggleThemeContextMenu = toggleThemeContextMenu;

function renderSettingsList() {
    const list = document.getElementById('suggestionsList');
    list.innerHTML = '';

    const whitelist = typeof getWhitelistedComments === 'function' ? getWhitelistedComments() : [];
    whitelist.forEach((entry) => {
        const row = document.createElement('div');
        row.className = "flex justify-between items-center p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded text-sm";
        row.innerHTML = `
            <span class="min-w-0 truncate text-emerald-800 dark:text-emerald-300 font-medium">${entry}</span>
            <span class="ml-2 shrink-0 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Whitelist</span>
        `;
        list.appendChild(row);
    });

    state.suggestions.forEach((s, idx) => {
        if (typeof isWhitelistedComment === 'function' && isWhitelistedComment(s)) return;
        const row = document.createElement('div');
        row.className = "flex justify-between items-center p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded text-sm";
        const input = document.createElement('input');
        input.type = 'text';
        input.value = s;
        input.className = 'flex-1 min-w-0 bg-transparent text-slate-800 dark:text-zinc-200 border border-transparent rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-950';
        input.title = 'Vorschlag bearbeiten';
        input.addEventListener('blur', () => updateSuggestion(idx, input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                input.value = state.suggestions[idx] || '';
                input.blur();
            }
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'ml-2 text-slate-400 hover:text-red-500';
        removeBtn.title = 'Vorschlag löschen';
        removeBtn.innerHTML = '<i class="mdi mdi-delete text-base"></i>';
        removeBtn.addEventListener('click', () => removeSuggestion(idx));

        row.append(input, removeBtn);
        list.appendChild(row);
    });
    persistConfigToLocalStorage();
    updateConfigFileStatus();
}

function hasSuggestion(value, exceptIdx = -1) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return false;
    if (typeof isWhitelistedComment === 'function' && isWhitelistedComment(normalized)) return true;
    return state.suggestions.some((entry, idx) => idx !== exceptIdx && String(entry || '').trim().toLowerCase() === normalized);
}

function updateSuggestion(idx, nextValue) {
    if (idx < 0 || idx >= state.suggestions.length) return;
    const trimmed = String(nextValue || '').trim();
    const current = state.suggestions[idx];

    if (!trimmed) {
        removeSuggestion(idx);
        return;
    }

    if (hasSuggestion(trimmed, idx)) {
        alert('Dieser Vorschlag existiert bereits.');
        renderSettingsList();
        return;
    }

    if (current !== trimmed) {
        state.suggestions[idx] = trimmed;
        renderSettingsList();
        syncConfigFile();
    }
}

function addSuggestion() {
    const input = document.getElementById('newSuggestionInput');
    const val = input.value.trim();
    if (val && !hasSuggestion(val)) {
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

if (DOM.aiPassiveLearnOnSaveToggle) {
    DOM.aiPassiveLearnOnSaveToggle.addEventListener('change', (e) => {
        state.aiPassiveLearnOnSave = e.target.checked;
        persistConfigToLocalStorage();
        syncConfigFile({ silent: true });
    });
}

if (DOM.aiPassiveLearnMinConfidenceInput) {
    DOM.aiPassiveLearnMinConfidenceInput.addEventListener('change', (e) => {
        const value = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
        state.aiPassiveLearnMinConfidence = value;
        e.target.value = String(value);
        persistConfigToLocalStorage();
        syncConfigFile({ silent: true });
    });
}

if (DOM.aiAutoCommentEnabledToggle) {
    DOM.aiAutoCommentEnabledToggle.addEventListener('change', (e) => {
        state.aiAutoCommentEnabled = e.target.checked;
        persistConfigToLocalStorage();
        syncConfigFile({ silent: true });
    });
}

if (DOM.aiAutoCommentMinConfidenceInput) {
    DOM.aiAutoCommentMinConfidenceInput.addEventListener('change', (e) => {
        const value = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
        state.aiAutoCommentMinConfidence = value;
        e.target.value = String(value);
        persistConfigToLocalStorage();
        syncConfigFile({ silent: true });
    });
}
