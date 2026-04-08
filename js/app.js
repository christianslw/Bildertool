/** =========================================================================
 * app.js — Initialisierung & 3D-Karte Callbacks
 *
 * Alle anderen Module werden über separate <script>-Tags geladen.
 * Ladereihenfolge:
 *   utils.js → state.js → ui.js → tabs.js → db.js → config.js
 *   → categories.js → file-ingestion.js → undo.js → render.js
 *   → settings.js → save.js → app.js (diese Datei)
 * ========================================================================= */

// --- 3D-Karte Callbacks (werden vom iframe aufgerufen) ---

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
    if (DOM.contextPanel) DOM.contextPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// --- App-Initialisierung ---

window.onload = async () => {
    applyStoredThemeSettings();
    renderCategories();
    renderStandortDropdown();
    renderTabs();
    updateUndoRedoUI();
    if (DOM.autoGpsToggle) DOM.autoGpsToggle.checked = state.autoGpsEnabled;
    if (DOM.excludeUnmatchedToggle) DOM.excludeUnmatchedToggle.checked = state.excludeUnmatched;
    DOM.viewDropdownTrigger.innerHTML = viewIcons[state.viewMode] || viewIcons.list;

    try {
        const savedHandle = await loadDirectoryHandle();
        if (savedHandle) {
            state.directoryHandle = savedHandle;
        }
    } catch (e) { console.log("Kein Ordner in DB gefunden."); }

    let hasManualOverride = false;
    try {
        const savedConfigHandle = await loadConfigFileHandle();
        if (savedConfigHandle) {
            const permission = await savedConfigHandle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                state.configFileHandle = savedConfigHandle;
                state.configSource = 'manual';
                hasManualOverride = true;
                const loaded = await loadConfigFromFileHandle(savedConfigHandle, { silent: true });
                if (!loaded) await syncConfigFile({ silent: true, skipEnsure: true });
            } else {
                await clearConfigFileHandle();
            }
        }
    } catch (e) {
        console.log("Manuelle Konfigurationsdatei nicht verfügbar, verwende Standarddatei.");
    }

    if (!hasManualOverride) {
        await initializeDefaultConfigFile({ silent: true });
    }

    updateConfigFileStatus();
    refreshThemeMenuUI();
    updateSaveButtonUI();
};
