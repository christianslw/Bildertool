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
            normalized.push({ file, originalSourceName: file.name, exifSourceFile: file });
            continue;
        }

        try {
            const jpegFile = await convertHeicToJpeg(file);
            // Keep original HEIC as EXIF source because conversion usually strips metadata.
            normalized.push({ file: jpegFile, originalSourceName: file.name, exifSourceFile: file });
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

function _toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.replace(',', '.').trim();
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function _dmsArrayToDecimal(arr, ref) {
    if (!Array.isArray(arr) || arr.length < 3) return null;
    const deg = _toNumber(arr[0]);
    const min = _toNumber(arr[1]);
    const sec = _toNumber(arr[2]);
    if (deg == null || min == null || sec == null) return null;
    let dec = deg + min / 60 + sec / 3600;
    const signRef = String(ref || '').toUpperCase();
    if (signRef === 'S' || signRef === 'W') dec *= -1;
    return dec;
}

function _extractExifCoords(exif) {
    if (!exif || typeof exif !== 'object') return null;

    const latDirect = _toNumber(exif.latitude);
    const lonDirect = _toNumber(exif.longitude);
    if (latDirect != null && lonDirect != null) {
        return { latitude: latDirect, longitude: lonDirect };
    }

    const latAlt = _toNumber(exif.GPSLatitude);
    const lonAlt = _toNumber(exif.GPSLongitude);
    if (latAlt != null && lonAlt != null) {
        return { latitude: latAlt, longitude: lonAlt };
    }

    const latDms = _dmsArrayToDecimal(exif.GPSLatitude, exif.GPSLatitudeRef);
    const lonDms = _dmsArrayToDecimal(exif.GPSLongitude, exif.GPSLongitudeRef);
    if (latDms != null && lonDms != null) {
        return { latitude: latDms, longitude: lonDms };
    }

    return null;
}

async function processFiles(files, targetConfig) {
    const resolvedTarget = {
        oberkategorie: targetConfig?.oberkategorie || '',
        unterkategorie: targetConfig?.unterkategorie || '',
        lockCategory: !!targetConfig?.lockCategory,
    };

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
            const exifSourceFile = fileEntry.exifSourceFile || file;

            // Hash + EXIF in parallel for each file
            let hash = null;
            let exifDatum = null;
            let itemStandort = globalStandort;

            try {
                const [hashBuffer, exif] = await Promise.all([
                    file.arrayBuffer().then(buf => crypto.subtle.digest('SHA-256', buf)),
                    typeof exifr !== 'undefined'
                        ? exifr.parse(exifSourceFile, { gps: true, exif: true, ifd0: false }).catch(() => null)
                        : Promise.resolve(null)
                ]);

                hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

                if (exif?.DateTimeOriginal instanceof Date) {
                    const d = exif.DateTimeOriginal;
                    exifDatum = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
                }
                const coords = _extractExifCoords(exif);
                if (!itemStandort && state.autoGpsEnabled && coords) {
                    const closest = findClosestStandort(coords.latitude, coords.longitude, 1.0);
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
                oberkategorie: resolvedTarget.oberkategorie,
                unterkategorie: resolvedTarget.unterkategorie,
                kommentar: "",
                originalFile: file,
                originalSourceName: fileEntry.originalSourceName || file.name,
                objectUrl: URL.createObjectURL(file),
                hash: hash,
                aiCategorySeeded: !!(resolvedTarget.oberkategorie || resolvedTarget.unterkategorie),
                aiCategoryLocked: resolvedTarget.lockCategory,
                aiSuggestion: null,
                aiLearnStatus: null,
                aiPassiveLearnStatus: null,
                aiManuallyOverridden: false,
                aiCommentStatus: null,
                aiCommentManuallyOverridden: false
            };

            if (hash) state.hashes.add(hash);
            state.files.push(item);
            addedItems.push(item);

            if (typeof queueAiSuggestionForItem === 'function') {
                // Mark that ingest-learn is pending; ai-categorizer will fire it
                // AFTER the suggestion resolves so the stored label is correct.
                if (state.aiAutoLearnOnIngest) {
                    item._pendingIngestLearn = true;
                }
                queueAiSuggestionForItem(item);
            } else if (state.aiAutoLearnOnIngest && typeof queueAiLearnForItem === 'function') {
                // AI suggestions not available at all — learn immediately with zone label.
                queueAiLearnForItem(item, 'ingest-labeled');
            }
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
