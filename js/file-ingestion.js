/** =========================================================================
 * MODUL: DATEI-INGESTION & VERARBEITUNG
 * ========================================================================= */
async function handleDroppedFiles(fileList, targetConfig) {
    await processFiles(fileList, targetConfig);
}

function isJpegFile(file) {
    const lowerName = String(file?.name || '').toLowerCase();
    return file?.type === 'image/jpeg' || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
}

function isHeicFile(file) {
    const lowerName = String(file?.name || '').toLowerCase();
    return file?.type === 'image/heic'
        || file?.type === 'image/heif'
        || lowerName.endsWith('.heic')
        || lowerName.endsWith('.heif');
}

function isSupportedImageFile(file) {
    return isJpegFile(file) || isHeicFile(file);
}

async function convertHeicToJpeg(file) {
    if (typeof heic2any !== 'function') {
        throw new Error('HEIC-Konvertierung ist nicht verfügbar.');
    }

    const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.95
    });

    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
    const newName = String(file.name || 'bild.heic').replace(/\.(heic|heif)$/i, '.jpg');
    return new File([jpegBlob], newName, {
        type: 'image/jpeg',
        lastModified: file.lastModified || Date.now()
    });
}

async function normalizeIncomingFiles(fileList) {
    const accepted = [...fileList].filter(isSupportedImageFile);
    const normalized = [];
    const failedHeicNames = [];

    for (const file of accepted) {
        if (!isHeicFile(file)) {
            normalized.push({ file, originalSourceName: file.name });
            continue;
        }

        try {
            const jpegFile = await convertHeicToJpeg(file);
            normalized.push({ file: jpegFile, originalSourceName: file.name });
        } catch (error) {
            failedHeicNames.push(file.name);
            console.error('HEIC konnte nicht konvertiert werden:', file.name, error);
        }
    }

    if (failedHeicNames.length) {
        showToast(`${failedHeicNames.length} HEIC-Datei(en) konnten nicht konvertiert werden.`, { duration: 6000 });
    }

    return normalized;
}

async function processFiles(files, targetConfig) {
    const inputValue = DOM.standortSelect.value;
    const match = inputValue.match(/\((\d+)\)$/);
    const standortNummer = match ? match[1] : inputValue;
    const globalStandort = standortNummer.trim() ? standortNummer.padStart(4, "0") : "";

    const normalizedFiles = await normalizeIncomingFiles(files);

    let autoAssignCount = 0;
    let autoAssignLabel = '';
    let excludedCount = 0;
    const duplicateNames = [];
    const addedItems = [];

    // Process files in parallel batches of 8 for hash + EXIF
    const BATCH_SIZE = 8;
    for (let batchStart = 0; batchStart < normalizedFiles.length; batchStart += BATCH_SIZE) {
        const batch = normalizedFiles.slice(batchStart, batchStart + BATCH_SIZE);

        const batchResults = await Promise.all(batch.map(async (fileEntry) => {
            const file = fileEntry.file;

            // Hash + EXIF in parallel for each file
            let hash = null;
            let exifDatum = null;
            let itemStandort = globalStandort;

            try {
                const [hashBuffer, exif] = await Promise.all([
                    file.arrayBuffer().then(buf => crypto.subtle.digest('SHA-256', buf)),
                    typeof exifr !== 'undefined'
                        ? exifr.parse(file, { gps: true, exif: true, ifd0: false }).catch(() => null)
                        : Promise.resolve(null)
                ]);

                hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

                if (exif?.DateTimeOriginal instanceof Date) {
                    const d = exif.DateTimeOriginal;
                    exifDatum = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
                }
                if (!itemStandort && state.autoGpsEnabled && typeof exif?.latitude === 'number' && typeof exif?.longitude === 'number') {
                    const closest = findClosestStandort(exif.latitude, exif.longitude, 1.0);
                    if (closest) {
                        itemStandort = String(closest.nummer).padStart(4, '0');
                    }
                }
            } catch (err) {
                console.warn('Hash/EXIF Parsing fehlgeschlagen:', file.name, err);
            }

            return { fileEntry, file, hash, exifDatum, itemStandort };
        }));

        for (const result of batchResults) {
            const { fileEntry, file, hash, exifDatum } = result;
            let { itemStandort } = result;

            // Duplicate detection
            if (hash && state.hashes.has(hash)) {
                duplicateNames.push(fileEntry.originalSourceName || file.name);
                continue;
            }

            // GPS auto-label for toast
            if (!globalStandort && state.autoGpsEnabled && itemStandort) {
                autoAssignCount++;
                const sData = typeof standorteDaten !== 'undefined'
                    ? standorteDaten.find(s => String(s.nummer).padStart(4, '0') === itemStandort)
                    : null;
                autoAssignLabel = sData ? `${sData.nummer} ${sData.name}` : itemStandort;
            }

            // Exclude unmatched
            if (state.excludeUnmatched && !itemStandort) {
                excludedCount++;
                continue;
            }

            const tabId = itemStandort ? ensureStandortTab(itemStandort) : 'all';

            const item = {
                id: crypto.randomUUID(),
                tabId,
                standort: itemStandort,
                datum: exifDatum || formatDate(file.lastModified || Date.now()),
                oberkategorie: targetConfig.oberkategorie,
                unterkategorie: targetConfig.unterkategorie,
                kommentar: "",
                originalFile: file,
                originalSourceName: fileEntry.originalSourceName || file.name,
                objectUrl: URL.createObjectURL(file),
                hash: hash
            };

            if (hash) state.hashes.add(hash);
            state.files.push(item);
            addedItems.push(item);
        }
    }

    if (addedItems.length > 0) {
        pushUndo({ type: 'add', items: addedItems.map(it => ({ ...it })) });
    }

    renderList();

    if (duplicateNames.length) {
        const names = duplicateNames.slice(0, 3).join(', ') + (duplicateNames.length > 3 ? ` (+${duplicateNames.length - 3})` : '');
        DOM.statusEl.textContent = `${duplicateNames.length} Duplikat(e) übersprungen: ${names}`;
        setTimeout(updateStatusText, 5000);
    }
    if (excludedCount > 0) {
        DOM.statusEl.textContent = `${excludedCount} Bild(er) ohne Standort ausgeschlossen.`;
        setTimeout(updateStatusText, 5000);
    } else if (autoAssignCount > 0) {
        DOM.statusEl.textContent = `${autoAssignCount} Foto(s) auto-zugeordnet → ${autoAssignLabel}`;
        setTimeout(updateStatusText, 5000);
    }
}
