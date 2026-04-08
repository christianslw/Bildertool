/** =========================================================================
 * MODUL: CONFIG FILE MANAGEMENT & KATEGORIE-VERWALTUNG
 * ========================================================================= */
function updateConfigFileStatus(message = '') {
    if (!DOM.configFileStatus) return;
    if (message) {
        DOM.configFileStatus.textContent = message;
        return;
    }
    if (state.configFileHandle && state.configSource === 'manual') {
        DOM.configFileStatus.textContent = `Manuell verknüpft: ${state.configFileHandle.name}`;
        return;
    }
    if (state.configFileHandle) {
        DOM.configFileStatus.textContent = `Standarddatei aktiv: ${DEFAULT_CONFIG_FILE_NAME} (browser-lokal)`;
        return;
    }
    DOM.configFileStatus.textContent = 'Nur lokale Browserdaten aktiv';
}

function canUseDefaultConfigFile() {
    return !!navigator.storage?.getDirectory;
}

async function getDefaultConfigFileHandle() {
    if (!canUseDefaultConfigFile()) return null;
    const rootHandle = await navigator.storage.getDirectory();
    return rootHandle.getFileHandle(DEFAULT_CONFIG_FILE_NAME, { create: true });
}

async function initializeDefaultConfigFile(options = {}) {
    if (!canUseDefaultConfigFile()) {
        if (!options.silent) updateConfigFileStatus('Standarddatei nicht verfügbar, nur Browserdaten aktiv');
        return false;
    }

    try {
        const handle = await getDefaultConfigFileHandle();
        state.configFileHandle = handle;
        state.configSource = 'default';

        const loaded = await loadConfigFromFileHandle(handle, { silent: true });
        if (!loaded) {
            await syncConfigFile({ silent: true, skipEnsure: true });
        }

        if (!options.silent) updateConfigFileStatus();
        return true;
    } catch (error) {
        console.error('Standard-Konfigurationsdatei konnte nicht initialisiert werden:', error);
        if (!options.silent) updateConfigFileStatus('Standarddatei konnte nicht geladen werden');
        return false;
    }
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
    if (!state.configFileHandle && !options.skipEnsure) {
        const initialized = await initializeDefaultConfigFile({ silent: true });
        if (!initialized) {
            if (!options.silent) updateConfigFileStatus('Änderungen lokal gespeichert (ohne Datei)');
            return false;
        }
    }

    if (!state.configFileHandle) return false;

    try {
        if (state.configSource === 'manual') {
            const hasPermission = await verifyPermission(state.configFileHandle, true);
            if (!hasPermission) {
                if (!options.silent) updateConfigFileStatus('Schreibzugriff auf manuelle Konfigurationsdatei fehlt');
                return false;
            }
        }

        const writer = await state.configFileHandle.createWritable();
        await writer.write(JSON.stringify(getConfigPayload(), null, 2));
        await writer.close();
        if (!options.silent) updateConfigFileStatus();
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
        state.configSource = 'manual';
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
        await initializeDefaultConfigFile();
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
    const name = await showPromptModal('Neue Hauptkategorie:', 'Name eingeben...');
    const label = String(name || '').trim();
    if (!label) return;
    if (categoriesConfig.some(cat => cat.label.toLowerCase() === label.toLowerCase())) {
        showToast('Diese Hauptkategorie existiert bereits.');
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
        showToast('Mindestens eine Hauptkategorie muss bestehen bleiben.');
        return;
    }
    if (!await showConfirmModal(`Hauptkategorie "${cat.label}" wirklich löschen?`)) return;

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
