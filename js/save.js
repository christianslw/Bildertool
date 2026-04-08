/** =========================================================================
 * MODUL: SPEICHERN & KOMPRIMIEREN
 * Verwendet compression.worker.js für JPEG-Komprimierung im Web Worker,
 * damit der Haupt-Thread während der Speicherung responsiv bleibt.
 * ========================================================================= */

// Web Worker für Komprimierung (einmalig erstellt, wiederverwendet)
let _compressionWorker = null;
let _compressionPendingMap = new Map(); // id → { resolve, reject }
let _compressionJobId = 0;

function _getCompressionWorker() {
    if (_compressionWorker) return _compressionWorker;
    try {
        _compressionWorker = new Worker('js/compression.worker.js');
        _compressionWorker.onmessage = (e) => {
            const { id, blob, error } = e.data;
            const pending = _compressionPendingMap.get(id);
            if (!pending) return;
            _compressionPendingMap.delete(id);
            if (error) pending.reject(new Error(error));
            else pending.resolve(blob);
        };
        _compressionWorker.onerror = (err) => {
            // Alle ausstehenden Jobs abbrechen
            _compressionPendingMap.forEach(p => p.reject(err));
            _compressionPendingMap.clear();
            _compressionWorker = null;
        };
    } catch (e) {
        // Worker nicht unterstützt – Fallback auf Haupt-Thread
        _compressionWorker = null;
    }
    return _compressionWorker;
}

async function compressToUnder1MB(file) {
    const worker = _getCompressionWorker();
    if (worker) {
        // Worker-Pfad: ArrayBuffer transferieren, Blob zurückbekommen
        const arrayBuffer = await file.arrayBuffer();
        const id = ++_compressionJobId;
        return new Promise((resolve, reject) => {
            _compressionPendingMap.set(id, { resolve, reject });
            worker.postMessage({ id, arrayBuffer, targetBytes: 1_000_000 }, [arrayBuffer]);
        });
    }

    // Fallback auf Haupt-Thread (wenn Worker nicht verfügbar)
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
    const filesToUse = state.activeTabId === 'all'
        ? [...state.files]
        : state.files.filter(f => f.tabId === state.activeTabId);
    if (!filesToUse.length) return;

    if (!window.showDirectoryPicker) {
        alert("Dein Browser unterstützt die Ordnerauswahl leider nicht. Dateien werden direkt heruntergeladen.");
        await processSaveLoop(null, filesToUse);
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

    await processSaveLoop(state.directoryHandle, filesToUse);
}

async function processSaveLoop(baseHandle, fileList = null) {
    const filesToSave = fileList || (state.activeTabId === 'all' ? [...state.files] : state.files.filter(f => f.tabId === state.activeTabId));
    const totalCount = filesToSave.length;
    let savedCount = 0;
    DOM.statusEl.textContent = `Speicherung läuft… (0 / ${totalCount})`;
    const nameTracker = {};

    const sanitizeFolderSegment = (value) => {
        const cleaned = String(value || '')
            .trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\.+$/g, '')
            .replace(/\s+/g, ' ');
        return cleaned || 'Unbekannt';
    };

    const REGION_FOLDERS = {
        1: '1000_Bereich Koblenz',
        2: '2000_Bereich Haardtkopf',
        3: '3000_Bereich Donnersberg',
        4: '4000_Bereich Hornisgrinde',
        5: '5000_Bereich Bodensee',
        6: '6000_Bereich Feldberg',
        7: '7000_Temporäre Standorte',
        8: '8000_Bereich Stuttgart',
        9: '9000_Bereich Mühlacker',
    };

    const getRegionFolderName = (nummer) => {
        const firstDigit = parseInt(String(nummer || '0').trim().charAt(0), 10);
        return REGION_FOLDERS[firstDigit] || sanitizeFolderSegment(`${firstDigit}000_Bereich Unbekannt`);
    };

    const getStandortNameByNummer = (nummer) => {
        if (typeof standorteDaten === 'undefined' || !Array.isArray(standorteDaten)) return '';
        const match = standorteDaten.find(entry => String(entry?.nummer || '').padStart(4, '0') === nummer);
        return String(match?.name || '').trim();
    };

    const getStandortFolderName = (item) => {
        const nummer = String(item?.standort || '').trim().padStart(4, '0') || '0000';
        const standortName = getStandortNameByNummer(nummer) || sanitizeFolderSegment(DOM.standortSelect.value.replace(/\(\d+\)\s*$/, '').trim()) || 'Unbekannt';
        return sanitizeFolderSegment(`${nummer}_${standortName}`);
    };

    const getUniqueName = (folderPath, proposedName) => {
        if (!nameTracker[folderPath]) nameTracker[folderPath] = {};
        if (nameTracker[folderPath][proposedName]) {
            const count = nameTracker[folderPath][proposedName]++;
            return proposedName.replace(/\.jpg$/i, `_${count}.jpg`);
        }
        nameTracker[folderPath][proposedName] = 1;
        return proposedName;
    };

    for (const item of filesToSave) {
        const isCompressing = item.compress !== undefined ? item.compress : DOM.compressCheck.checked;
        const regionFolder = getRegionFolderName(item?.standort);
        const standortFolder = getStandortFolderName(item);
        const folderName = item.oberkategorie;
        const basePathKey = `${regionFolder}/${standortFolder}/${folderName}`;
        const compressedPathKey = `${regionFolder}/${standortFolder}/_komprimiert/${folderName}`;
        const finalNameOriginal = getUniqueName(basePathKey, buildName(item));
        const finalNameCompressed = isCompressing
            ? getUniqueName(compressedPathKey, buildName(item))
            : null;

        const originalData = item.originalFile;
        const compressedData = isCompressing ? await compressToUnder1MB(item.originalFile) : null;

        if (baseHandle) {
            const regionDir = await baseHandle.getDirectoryHandle(regionFolder, { create: true });
            const standortDir = await regionDir.getDirectoryHandle(standortFolder, { create: true });

            const originalCategoryDir = await standortDir.getDirectoryHandle(folderName, { create: true });
            const originalFileHandle = await originalCategoryDir.getFileHandle(finalNameOriginal, { create: true });
            const originalWriter = await originalFileHandle.createWritable();
            await originalWriter.write(originalData);
            await originalWriter.close();

            if (isCompressing && compressedData) {
                const compressedRootDir = await standortDir.getDirectoryHandle('_komprimiert', { create: true });
                const compressedCategoryDir = await compressedRootDir.getDirectoryHandle(folderName, { create: true });
                const compressedFileHandle = await compressedCategoryDir.getFileHandle(finalNameCompressed, { create: true });
                const compressedWriter = await compressedFileHandle.createWritable();
                await compressedWriter.write(compressedData);
                await compressedWriter.close();
            }
        } else {
            const originalDownload = document.createElement("a");
            originalDownload.href = item.objectUrl;
            originalDownload.download = `${regionFolder}_${standortFolder}_${folderName}_${finalNameOriginal}`;
            originalDownload.click();

            if (isCompressing && compressedData) {
                const compressedUrl = URL.createObjectURL(compressedData);
                const compressedDownload = document.createElement("a");
                compressedDownload.href = compressedUrl;
                compressedDownload.download = `${regionFolder}_${standortFolder}_komprimiert_${folderName}_${finalNameCompressed}`;
                compressedDownload.click();
                setTimeout(() => URL.revokeObjectURL(compressedUrl), 1500);
            }
        }

        savedCount++;
        DOM.statusEl.textContent = `Speicherung läuft… (${savedCount} / ${totalCount})`;
    }
    DOM.statusEl.textContent = `✅ ${totalCount} Bild${totalCount !== 1 ? 'er' : ''} erfolgreich gespeichert!`;
    setTimeout(updateStatusText, 4000);
}

// --- Buttons ---
DOM.mainSaveBtn.addEventListener("click", () => executeSave(false));
DOM.saveAsMenuOption.addEventListener("click", () => {
    DOM.saveDropdownMenu.classList.add('hidden');
    executeSave(true);
});

DOM.clearAll.addEventListener("click", () => {
    if (state.activeTabId === 'all') {
        state.files.forEach(f => { URL.revokeObjectURL(f.objectUrl); });
        state.files = [];
        state.hashes.clear();
        state.tabs = [{ id: 'all', label: 'Alle', standort: null }];
        state.activeTabId = 'all';
    } else {
        const toRemove = state.files.filter(f => f.tabId === state.activeTabId);
        toRemove.forEach(f => { URL.revokeObjectURL(f.objectUrl); if (f.hash) state.hashes.delete(f.hash); });
        state.files = state.files.filter(f => f.tabId !== state.activeTabId);
        removeEmptyStandortTabs();
    }
    state.selectedFileIds.clear();
    renderList();
});

DOM.fileInput.addEventListener("change", async () => {
    const files = [...DOM.fileInput.files].filter(isSupportedImageFile);
    if (files.length) {
        const target = state.currentTarget || { oberkategorie: null, unterkategorie: '' };
        await processFiles(files, target);
    }
    DOM.fileInput.value = "";
});

if (DOM.quickImportBtn) {
    DOM.quickImportBtn.addEventListener('click', () => {
        DOM.fileInput.click();
    });
}

DOM.folderInput.addEventListener('change', async () => {
    const files = [...DOM.folderInput.files].filter(isSupportedImageFile);
    if (files.length) {
        const target = state.currentTarget || { oberkategorie: null, unterkategorie: '' };
        await processFiles(files, target);
    }
    DOM.folderInput.value = '';
});

// Globale Dropdown Toggle & Schließen Logic
document.addEventListener('click', (e) => {
    if (!e.target.closest('#standortSelect') && !e.target.closest('#standortDropdown') && !e.target.closest('#clearSearchBtn')) {
        DOM.standortDropdown.classList.add('hidden');
    }
    if (!e.target.closest('.editable-segment') && !e.target.closest('#autocompleteDropdown')) {
        DOM.autocompleteDropdown.classList.add('hidden');
    }
    if (!e.target.closest('#saveDropdownTrigger') && !e.target.closest('#saveDropdownMenu')) {
        DOM.saveDropdownMenu.classList.add('hidden');
    }
    if (!e.target.closest('#viewDropdownTrigger') && !e.target.closest('#viewDropdownMenu')) {
        DOM.viewDropdownMenu.classList.add('hidden');
    }
    if (!e.target.closest('#themeMenuToggle') && !e.target.closest('#themeContextMenu')) {
        if (DOM.themeContextMenu) DOM.themeContextMenu.classList.add('hidden');
    }
    if (!e.target.closest('.palette-btn') && !e.target.closest('.category-color-menu')) {
        closeCategoryColorMenu();
    }
    if (!e.target.closest('#filterDropdownTrigger') && !e.target.closest('#filterDropdownMenu')) {
        if (DOM.filterDropdownMenu) DOM.filterDropdownMenu.classList.add('hidden');
    }
    const sortBtn = e.target.closest('.sort-key-btn');
    if (sortBtn && DOM.filterDropdownMenu?.contains(sortBtn)) {
        state.sortKey = sortBtn.dataset.sort;
        refreshFilterUI(); renderList();
    }
    const dirBtn = e.target.closest('.sort-dir-btn');
    if (dirBtn && DOM.filterDropdownMenu?.contains(dirBtn)) {
        state.sortDir = dirBtn.dataset.dir;
        refreshFilterUI(); renderList();
    }
    const groupBtn = e.target.closest('.group-by-btn');
    if (groupBtn && DOM.filterDropdownMenu?.contains(groupBtn)) {
        state.groupBy = groupBtn.dataset.group || null;
        refreshFilterUI(); renderList();
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

window.addEventListener('beforeunload', (event) => {
    if (!state.files.length) return;
    event.preventDefault();
    event.returnValue = '';
});
