/** =========================================================================
 * MODUL: DATEILISTE, GRUPPIERUNG, INLINE-EDITIERUNG & VORSCHAU MODAL
 * Performance-Optimierungen:
 *  1. applySelectionStyles() – CSS-Klassen-Toggle statt vollständigem DOM-Rebuild
 *     bei reinen Auswahloperationen.
 *  2. Delegierte Event-Listener – alle Karten-Events werden einmalig auf dem
 *     Container registriert statt pro Karte bei jedem renderList()-Aufruf.
 *  3. Debounced Inline-Edit Blur – verhindert mehrfachen Rebuild beim schnellen
 *     Durchklicken der editierbaren Felder.
 * ========================================================================= */

// --- Hilfsfunktionen ---

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
    const isWhitelistedKom = item.kommentar && (typeof isWhitelistedComment === 'function') && isWhitelistedComment(item.kommentar);
    const komClass = item.kommentar
        ? (isWhitelistedKom ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700' : '')
        : 'placeholder';
    const st = item.standort || 'Standort';
    const dt = item.datum || 'Datum';

    const showSaveBtn = item.kommentar
        && !state.suggestions.includes(item.kommentar)
        && !(typeof isWhitelistedComment === 'function' && isWhitelistedComment(item.kommentar));
    const saveBtnHtml = showSaveBtn
        ? `<button class="save-suggestion-btn shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-600 hover:text-emerald-800 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 dark:text-emerald-400 transition-colors text-[11px] font-bold leading-none" title="&quot;${item.kommentar}&quot; als Vorschlag speichern" data-kommentar="${item.kommentar}">+</button>`
        : '';

    const aiSuggestion = item.aiSuggestion;
    const aiHintHtml = aiSuggestion && aiSuggestion.status === 'ready' && aiSuggestion.label
        ? `<span class="ml-2 inline-flex items-center gap-1 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300" title="AI Vorschlag">AI: ${aiSuggestion.label}${Number.isFinite(aiSuggestion.confidence) ? ` (${Math.round(aiSuggestion.confidence * 100)}%)` : ''}</span>`
        : '';

    return `
          <div class="flex items-center gap-1.5 min-w-0 w-full">
            <div class="file-name-builder font-mono text-[13px] md:text-sm text-slate-800 dark:text-zinc-200 truncate flex-1 min-w-0">
              <span class="editable-segment" contenteditable="true" data-field="standort">${st}</span>_
              <span class="editable-segment" contenteditable="true" data-field="datum">${dt}</span>_
              <span class="editable-segment text-blue-600 dark:text-blue-400 font-semibold" contenteditable="false" data-field="oberkategorie">${item.oberkategorie}</span>_
              <span class="editable-segment ${uKatClass}" contenteditable="true" data-field="unterkategorie">${uKat}</span>_
              <span class="editable-segment ${komClass}" contenteditable="true" data-field="kommentar">${kom}</span>.jpg
                            ${aiHintHtml}
            </div>
            ${saveBtnHtml}
          </div>
        `;
}

function openPreview(item) {
    const finalName = buildName(item);
    const sourceName = item.originalSourceName || item.originalFile.name;
    document.getElementById('previewImage').src = item.objectUrl;
    document.getElementById('previewNewName').textContent = finalName;
    document.getElementById('previewPath').textContent = `${item.oberkategorie}/${finalName}`;
    document.getElementById('previewOldName').innerHTML = `<span class="opacity-70">Ursprung:</span> ${sourceName}`;

    // Aktuelles Item für den Annotationseditor merken
    window.currentPreviewItemId = item.id;

    const modal = document.getElementById('previewModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePreview() {
    // Annotationseditor sauber schließen (ohne Einbrennen)
    if (typeof window.resetImageEditor === 'function') window.resetImageEditor();
    const modal = document.getElementById('previewModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Wenn der Annotationseditor offen ist: nur Editor schließen, nicht die ganze Vorschau
        const editorCanvas = document.getElementById('annotationCanvas');
        if (editorCanvas && !editorCanvas.classList.contains('hidden')) {
            closeImageEditor(false);
            return;
        }
        closePreview();
        closeSettings();
        if (DOM.themeContextMenu) DOM.themeContextMenu.classList.add('hidden');
        closeCategoryColorMenu();
    }
    const tag = document.activeElement?.tagName;
    const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
    if (isEditing) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        // Undo im Annotationseditor hat Vorrang
        const editorCanvas = document.getElementById('annotationCanvas');
        if (editorCanvas && !editorCanvas.classList.contains('hidden')) {
            editorUndo();
        } else {
            applyUndo();
        }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        applyRedo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        getVisibleItemIds().forEach(id => state.selectedFileIds.add(id));
        applySelectionStyles();
        renderSelectionBar();
    }
});

// --- Sortierung & Gruppierung ---

function getSortedFiles() {
    const q = state.filterText.toLowerCase().trim();
    let files = state.activeTabId === 'all'
        ? [...state.files]
        : state.files.filter(f => f.tabId === state.activeTabId);
    if (q) {
        files = files.filter(f =>
            buildName(f).toLowerCase().includes(q) ||
            (f.standort || '').includes(q) ||
            (f.kommentar || '').toLowerCase().includes(q) ||
            (f.oberkategorie || '').toLowerCase().includes(q) ||
            (f.unterkategorie || '').toLowerCase().includes(q) ||
            (f.originalSourceName || '').toLowerCase().includes(q)
        );
    }
    return files.sort((a, b) => {
        let valA, valB;
        if (state.sortKey === 'name') {
            valA = buildName(a).toLowerCase();
            valB = buildName(b).toLowerCase();
        } else if (state.sortKey === 'kategorie') {
            valA = (a.oberkategorie || '').toLowerCase();
            valB = (b.oberkategorie || '').toLowerCase();
        } else if (state.sortKey === 'standort') {
            valA = (a.standort || '').padStart(6, '0');
            valB = (b.standort || '').padStart(6, '0');
        } else {
            valA = a.originalFile.lastModified || 0;
            valB = b.originalFile.lastModified || 0;
        }
        if (valA < valB) return state.sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortDir === 'asc' ? 1 : -1;
        return 0;
    });
}

function getGroupedFiles() {
    const files = getSortedFiles();

    if (state.activeTabId === 'all') {
        const outer = {};
        files.forEach(f => {
            const standortKey = f.standort
                ? getStandortLabel(f.standort)
                : 'Kein Standort';
            let subKey;
            if (state.groupBy === 'datum') {
                subKey = f.datum || 'Kein Datum';
            } else {
                subKey = f.oberkategorie || 'Unkategorisiert';
            }
            if (!outer[standortKey]) outer[standortKey] = {};
            if (!outer[standortKey][subKey]) outer[standortKey][subKey] = [];
            outer[standortKey][subKey].push(f);
        });
        return outer;
    }

    const groups = {};
    files.forEach(f => {
        let key;
        if (state.groupBy === 'standort') {
            if (f.standort) {
                const sData = typeof standorteDaten !== 'undefined' ? standorteDaten.find(s => String(s.nummer).padStart(4, '0') === f.standort) : null;
                key = sData ? `${f.standort} · ${sData.name}` : `Standort ${f.standort}`;
            } else { key = 'Kein Standort'; }
        } else if (state.groupBy === 'datum') {
            key = f.datum || 'Kein Datum';
        } else {
            key = f.oberkategorie || 'Unkategorisiert';
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(f);
    });
    return groups;
}

function getVisibleItemIds() {
    return getSortedFiles().map(f => f.id);
}

// --- Auswahlstile ohne vollständigen DOM-Rebuild ---

/**
 * Aktualisiert CSS-Klassen auf vorhandenen Karten basierend auf state.selectedFileIds.
 * Deutlich schneller als renderList() bei reinen Auswahloperationen.
 */
function applySelectionStyles() {
    DOM.fileListContainer.querySelectorAll('[data-id]').forEach(el => {
        const isSelected = state.selectedFileIds.has(el.dataset.id);
        el.classList.toggle('ring-2', isSelected);
        el.classList.toggle('ring-inset', isSelected);
        el.classList.toggle('ring-blue-500', isSelected);
    });
}

// --- Selection Bar ---

function renderSelectionBar() {
    const existing = document.getElementById('selectionBar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'selectionBar';

    const count = state.selectedFileIds.size;
    if (count === 0) {
        bar.className = 'sticky top-0 z-10 flex items-center gap-2 px-3 py-2 mb-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md text-xs text-slate-400 dark:text-zinc-500';
        bar.innerHTML = `
          <span class="flex-1"></span>
          <button id="selBarSelectAll" class="px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors">Alle auswählen</button>
        `;
        bar.querySelector('#selBarSelectAll').addEventListener('click', () => {
            getVisibleItemIds().forEach(id => state.selectedFileIds.add(id));
            applySelectionStyles();
            renderSelectionBar();
        });
    } else {
        bar.className = 'sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 mb-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md shadow-sm';
        const subOpts = categoriesConfig.flatMap(c => c.subcats).map(s => `<option value="${s}">${s}</option>`).join('');
        bar.innerHTML = `
          <span class="text-xs font-bold text-blue-700 dark:text-blue-300">${count} ausgewählt</span>
          <button id="selBarAll" class="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">Alle</button>
          <button id="selBarNone" class="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">Aufheben</button>
          <select id="bulkSubcat" class="text-xs p-1 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200"><option value="">Unterkategorie…</option>${subOpts}</select>
          <input id="bulkKommentar" type="text" placeholder="Kommentar…" class="text-xs p-1 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 flex-1 min-w-[120px]" />
          <input id="bulkDatum" type="text" placeholder="Datum…" class="text-xs p-1 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 w-32" />
          <button id="bulkApplyBtn" class="text-xs px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors">Anwenden</button>
        `;
        bar.querySelector('#selBarAll').addEventListener('click', () => {
            getVisibleItemIds().forEach(id => state.selectedFileIds.add(id));
            applySelectionStyles();
            renderSelectionBar();
        });
        bar.querySelector('#selBarNone').addEventListener('click', () => {
            state.selectedFileIds.clear();
            applySelectionStyles();
            renderSelectionBar();
        });
        bar.querySelector('#bulkApplyBtn').addEventListener('click', () => {
            const subcat = bar.querySelector('#bulkSubcat').value;
            const kommentar = bar.querySelector('#bulkKommentar').value.trim();
            const datum = bar.querySelector('#bulkDatum').value.trim();
            const oldValues = {};
            state.files.forEach(f => {
                if (!state.selectedFileIds.has(f.id)) return;
                oldValues[f.id] = { unterkategorie: f.unterkategorie, kommentar: f.kommentar, datum: f.datum };
                if (subcat && f.unterkategorie !== subcat) {
                    f.unterkategorie = subcat;
                    f.aiManuallyOverridden = true;
                    if (typeof queueAiLearnForItem === 'function') {
                        queueAiLearnForItem(f, 'manual-bulk-edit');
                    }
                }
                if (kommentar) f.kommentar = kommentar;
                if (datum) f.datum = datum;
            });
            pushUndo({ type: 'bulkEdit', ids: [...state.selectedFileIds], fields: { subcat, kommentar, datum }, oldValues });
            state.selectedFileIds.clear();
            renderList();
            showToast('Bulk-Bearbeitung angewendet.');
        });
    }

    DOM.fileListContainer.insertBefore(bar, DOM.fileListContainer.firstChild);
}

// --- Gruppenabschnitte & Karten ---

function renderGroupSection(container, groupKey, items, palette) {
    const groupSection = document.createElement('section');
    groupSection.className = 'mb-5 relative';
    groupSection.dataset.groupOber = groupKey;
    if (palette) {
        groupSection.style.borderLeft = `3px solid ${palette.borderStrong}`;
        groupSection.style.paddingLeft = '0.9rem';
    }

    const catCount = items.length;
    const catHeader = document.createElement('h3');
    catHeader.className = 'text-xs font-bold text-slate-500 dark:text-zinc-400 mt-4 mb-2 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800 pb-1 flex items-center gap-2';
    catHeader.innerHTML = `<span>${groupKey}</span><span class="font-normal normal-case tracking-normal px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px]">${catCount}</span>`;
    if (palette) {
        catHeader.style.color = palette.text;
        catHeader.style.borderBottomColor = palette.border;
    }
    groupSection.appendChild(catHeader);

    const wrapper = document.createElement('div');
    if (state.viewMode === 'list') wrapper.className = 'flex flex-col gap-2';
    else if (state.viewMode === 'compact') wrapper.className = 'flex flex-col gap-1 border border-slate-200 dark:border-zinc-800 rounded-md overflow-hidden shadow-sm';
    else wrapper.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

    if (palette) {
        if (state.viewMode === 'compact') {
            wrapper.style.borderColor = palette.border;
            wrapper.style.boxShadow = `0 8px 24px -18px ${palette.shadow}`;
        } else if (state.viewMode === 'list') {
            wrapper.style.borderLeft = `2px solid ${palette.border}`;
            wrapper.style.paddingLeft = '0.75rem';
        } else {
            wrapper.style.borderTop = `2px solid ${palette.border}`;
            wrapper.style.paddingTop = '0.75rem';
        }
    }

    items.forEach(item => {
        const el = document.createElement('div');
        el.dataset.id = item.id;
        el.draggable = true;

        const editorHTML = getEditorHTML(item);
        const isSelected = state.selectedFileIds.has(item.id);
        const selectedClass = isSelected ? ' ring-2 ring-inset ring-blue-500' : '';

        const dragHandleHTML = `<span class="drag-handle shrink-0 text-slate-300 dark:text-zinc-600 cursor-grab active:cursor-grabbing select-none" title="Verschieben"><i class="mdi mdi-drag-vertical text-lg"></i></span>`;
        const copyBtnHTML = `<button class="copy-name-btn p-1 text-slate-400 hover:text-blue-500 rounded transition-colors shrink-0" title="Dateiname kopieren">
            <i class="mdi mdi-content-copy text-sm"></i>
          </button>`;
        const delBtnHTML = `<button class="delete-btn p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors shrink-0" title="Entfernen">
            <i class="mdi mdi-close text-base"></i>
          </button>`;

        if (state.viewMode === 'compact') {
            el.className = `flex items-center justify-between p-1.5 px-3 border-b last:border-0 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors gap-2${selectedClass}`;
            el.innerHTML = `
              <div class="flex-1 min-w-0 flex items-center overflow-hidden">${editorHTML}</div>
              <div class="flex items-center gap-0.5 shrink-0">${copyBtnHTML}${delBtnHTML}${dragHandleHTML}</div>
            `;
        } else if (state.viewMode === 'list') {
            el.className = `flex items-center p-2.5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md shadow-sm gap-3${selectedClass}`;
            const finalName = buildName(item);
            const sourceName = item.originalSourceName || item.originalFile.name;
            const subTextHTML = `
                <div class="text-[11px] text-slate-700 dark:text-zinc-300 truncate mt-0.5" title="${item.oberkategorie}/${finalName} | Ursprung: ${sourceName}">
                    <span>${buildCategoryPathHTML(item.oberkategorie, finalName)}</span>
                    <span class="text-slate-400 dark:text-zinc-500"> &bull; Ursprung: ${sourceName}</span>
                </div>
            `;
            el.innerHTML = `
              <div class="w-12 h-12 shrink-0 bg-slate-100 dark:bg-zinc-800 rounded overflow-hidden border border-slate-200 dark:border-zinc-700">
                  <img src="${item.objectUrl}" class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity preview-trigger" alt="Vorschau" />
              </div>
              <div class="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                  ${editorHTML}
                  ${subTextHTML}
              </div>
              <div class="flex items-center gap-0.5 shrink-0">${copyBtnHTML}${delBtnHTML}${dragHandleHTML}</div>
            `;
        } else {
            // Gallery
            el.className = `border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 flex flex-col shadow-sm${selectedClass}`;
            const finalName = buildName(item);
            const sourceName = item.originalSourceName || item.originalFile.name;
            const subTextHTML = `
                <div class="text-[11px] text-slate-700 dark:text-zinc-300 truncate mt-0.5" title="${item.oberkategorie}/${finalName}">${buildCategoryPathHTML(item.oberkategorie, finalName)}</div>
                <div class="text-[11px] text-slate-400 dark:text-zinc-500 truncate" title="${sourceName}">Ursprung: ${sourceName}</div>
            `;
            el.innerHTML = `
              <div class="relative w-full h-28 bg-slate-100 dark:bg-zinc-800 group">
                <img src="${item.objectUrl}" alt="Vorschau" class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity preview-trigger" />
                <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-black/80 rounded-md flex items-center gap-0.5 p-0.5">${delBtnHTML}</div>
              </div>
              <div class="p-3 overflow-hidden flex flex-col">
                ${editorHTML}
                ${subTextHTML}
                <div class="flex gap-1 mt-1.5 justify-end">${copyBtnHTML}</div>
              </div>
            `;
        }

        wrapper.append(el);
    });

    groupSection.appendChild(wrapper);
    container.appendChild(groupSection);
}

function renderListAll() {
    const grouped = getGroupedFiles();
    const isCategoryGrouped = !state.groupBy || state.groupBy === 'kategorie';

    for (const standortKey in grouped) {
        const standortHeader = document.createElement('div');
        standortHeader.className = 'flex items-center gap-2 mt-6 mb-1 first:mt-0';
        standortHeader.innerHTML = `
          <div class="flex-1 border-t-2 border-slate-300 dark:border-zinc-700"></div>
          <span class="text-sm font-bold text-slate-700 dark:text-zinc-200 whitespace-nowrap px-2">${standortKey}</span>
          <div class="flex-1 border-t-2 border-slate-300 dark:border-zinc-700"></div>
        `;
        DOM.fileListContainer.appendChild(standortHeader);

        const subGroups = grouped[standortKey];
        for (const subKey in subGroups) {
            const palette = isCategoryGrouped ? getCategoryAccentPalette(getCategoryColor(subKey)) : null;
            renderGroupSection(DOM.fileListContainer, subKey, subGroups[subKey], palette);
        }
    }
}

function renderListStation() {
    const groups = getGroupedFiles();
    const isCategoryGrouped = !state.groupBy || state.groupBy === 'kategorie';
    for (const groupKey in groups) {
        const palette = isCategoryGrouped ? getCategoryAccentPalette(getCategoryColor(groupKey)) : null;
        renderGroupSection(DOM.fileListContainer, groupKey, groups[groupKey], palette);
    }
}

function renderList() {
    DOM.fileListContainer.innerHTML = '';
    renderSelectionBar();

    if (state.activeTabId === 'all') {
        renderListAll();
    } else {
        renderListStation();
    }

    // Show / hide the persistent empty drop zone
    const emptyZone = document.getElementById('emptyDropZone');
    if (emptyZone) emptyZone.classList.toggle('hidden', getSortedFiles().length > 0);

    updateStatusText();
    DOM.viewDropdownTrigger.innerHTML = viewIcons[state.viewMode] || viewIcons.list;
}

// --- Delegierte Event-Listener (einmalig registriert) ---

// Hilfsfunktion: Datei nach ID aus state.files ermitteln
function _getFileById(id) {
    return state.files.find(f => f.id === id) || null;
}

// Click-Delegation: Auswahl, Löschen, Kopieren, Vorschau, Vorschläge
DOM.fileListContainer.addEventListener('click', (e) => {
    // Vorschlag speichern
    const saveBtn = e.target.closest('.save-suggestion-btn');
    if (saveBtn) {
        const kommentar = saveBtn.dataset.kommentar;
        if (kommentar && !state.suggestions.includes(kommentar)) {
            state.suggestions.push(kommentar);
            persistConfigToLocalStorage();
            saveBtn.textContent = '✓';
            saveBtn.classList.remove('bg-emerald-100', 'text-emerald-600', 'hover:bg-emerald-200', 'dark:bg-emerald-900/30', 'dark:text-emerald-400');
            saveBtn.classList.add('bg-blue-100', 'text-blue-600', 'dark:bg-blue-900/30', 'dark:text-blue-400');
            saveBtn.disabled = true;
            syncConfigFile({ silent: true });
            setTimeout(() => renderList(), 700);
        }
        return;
    }

    // Vorschaubild
    const previewTrigger = e.target.closest('.preview-trigger');
    if (previewTrigger) {
        const cardEl = previewTrigger.closest('[data-id]');
        if (cardEl) {
            const item = _getFileById(cardEl.dataset.id);
            if (item) openPreview(item);
        }
        return;
    }

    // Löschen
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const cardEl = deleteBtn.closest('[data-id]');
        if (!cardEl) return;
        const id = cardEl.dataset.id;
        const idx = state.files.findIndex(f => f.id === id);
        if (idx === -1) return;
        const [removed] = state.files.splice(idx, 1);
        if (removed.hash) state.hashes.delete(removed.hash);
        state.selectedFileIds.delete(removed.id);
        pushUndo({ type: 'remove', item: { ...removed }, idx });
        removeEmptyStandortTabs();
        renderList();
        showToast(`„${buildName(removed)}" entfernt.`, {
            undoAction: () => {
                state.files.splice(idx, 0, removed);
                if (removed.hash) state.hashes.add(removed.hash);
                if (removed.standort) ensureStandortTab(removed.standort);
                state.undoStack.pop();
                updateUndoRedoUI();
                renderList();
            }
        });
        return;
    }

    // Dateiname kopieren
    const copyBtn = e.target.closest('.copy-name-btn');
    if (copyBtn) {
        const cardEl = copyBtn.closest('[data-id]');
        if (!cardEl) return;
        const item = _getFileById(cardEl.dataset.id);
        if (!item) return;
        const name = buildName(item);
        navigator.clipboard.writeText(name).then(() => showToast(`„${name}" kopiert.`, { duration: 2500 }));
        return;
    }

    // Kartenauswahl (Strg/Shift-Klick) → nur CSS-Klassen, kein vollständiger Rebuild
    const cardEl = e.target.closest('[data-id]');
    if (!cardEl) return;
    if (e.target.closest('.editable-segment, button, input, select')) return;

    const id = cardEl.dataset.id;
    if (e.ctrlKey || e.metaKey) {
        if (state.selectedFileIds.has(id)) {
            state.selectedFileIds.delete(id);
        } else {
            state.selectedFileIds.add(id);
            state.lastClickedId = id;
        }
        applySelectionStyles();
        renderSelectionBar();
    } else if (e.shiftKey && state.lastClickedId) {
        const visible = getVisibleItemIds();
        const fromIdx = visible.indexOf(state.lastClickedId);
        const toIdx = visible.indexOf(id);
        if (fromIdx !== -1 && toIdx !== -1) {
            const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
            visible.slice(lo, hi + 1).forEach(sid => state.selectedFileIds.add(sid));
            applySelectionStyles();
            renderSelectionBar();
        }
    }
});

// ---- Drop-target visual feedback helpers (file-system drags) ----
let _dragOverSection = null;
const _dropBadge = (() => {
    const el = document.createElement('div');
    el.className = 'drop-badge hidden';
    return el;
})();

function _setDropTarget(section, hint) {
    if (_dragOverSection === section) return;  // already highlighted
    _clearDropTarget();
    _dragOverSection = section;
    if (section) {
        const key = section.dataset.groupOber;
        const color = getCategoryColor(key);
        const palette = getCategoryAccentPalette(color);
        const accentColor = (palette && palette.borderStrong) ||
            getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#3b82f6';
        section.style.outline = `2px solid ${accentColor}`;
        section.style.outlineOffset = '3px';
        section.style.borderRadius = '8px';
        _dropBadge.style.background = accentColor;
    } else {
        DOM.fileListContainer.classList.add('container-drop-target');
        _dropBadge.style.background =
            getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim() || '#64748b';
    }
    _dropBadge.innerHTML = hint;
    _dropBadge.classList.remove('hidden');
    (section || DOM.fileListContainer).insertBefore(_dropBadge, (section || DOM.fileListContainer).firstChild);
}

function _clearDropTarget() {
    if (_dragOverSection) {
        _dragOverSection.style.outline = '';
        _dragOverSection.style.outlineOffset = '';
        _dragOverSection.style.borderRadius = '';
    }
    _dragOverSection = null;
    DOM.fileListContainer.classList.remove('container-drop-target');
    _dropBadge.classList.add('hidden');
    if (_dropBadge.parentNode) _dropBadge.remove();
}

// Drag-Delegation
DOM.fileListContainer.addEventListener('dragstart', (e) => {
    const cardEl = e.target.closest('[data-id]');
    if (!cardEl) return;
    state.dragReorderSrcId = cardEl.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/card-id', cardEl.dataset.id);
    setTimeout(() => cardEl.classList.add('opacity-50'), 0);
});

DOM.fileListContainer.addEventListener('dragend', (e) => {
    const cardEl = e.target.closest('[data-id]');
    if (cardEl) cardEl.classList.remove('opacity-50');
    state.dragReorderSrcId = null;
});

// Defensive fallback: some browsers can lose per-element dragend when DOM re-renders mid-drag.
document.addEventListener('dragend', () => {
    state.dragReorderSrcId = null;
}, true);

DOM.fileListContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    // External file drag: per-section drop-target highlight
    if (!state.dragReorderSrcId && e.dataTransfer.types.includes('Files')) {
        const section = e.target.closest('section[data-group-ober]');
        const key = section?.dataset.groupOber;
        const isRealCategory = section && key && key !== 'Unkategorisiert' &&
            (!state.groupBy || state.groupBy === 'kategorie');
        if (isRealCategory) {
            _setDropTarget(section,
                `<i class="mdi mdi-folder-arrow-down"></i>&ensp;Zu „${key}“`);
        } else if (section) {
            _setDropTarget(section,
                `<i class="mdi mdi-tray-arrow-down"></i>&ensp;Ohne Kategorie`);
        } else {
            _setDropTarget(null,
                `<i class="mdi mdi-tray-arrow-down"></i>&ensp;Ohne Kategorie`);
        }
        return;
    }
    const cardEl = e.target.closest('[data-id]');
    if (cardEl && state.dragReorderSrcId && state.dragReorderSrcId !== cardEl.dataset.id) {
        cardEl.classList.add('ring-2', 'ring-blue-400', 'ring-inset');
    }
});

DOM.fileListContainer.addEventListener('dragleave', (e) => {
    // Only clear when truly leaving the container
    if (!e.relatedTarget || !DOM.fileListContainer.contains(e.relatedTarget)) {
        _clearDropTarget();
    }
    const cardEl = e.target.closest('[data-id]');
    if (cardEl) cardEl.classList.remove('ring-2', 'ring-blue-400', 'ring-inset');
});

DOM.fileListContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    _clearDropTarget();

    // External file drop onto the list
    if (!state.dragReorderSrcId && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // Check if dropped onto an existing category group section
        const groupSection = e.target.closest('section[data-group-ober]');
        const groupKey = groupSection ? groupSection.dataset.groupOber : null;
        const isRealCategory = groupKey && groupKey !== 'Unkategorisiert' &&
            (!state.groupBy || state.groupBy === 'kategorie');
        const target = isRealCategory
            ? { oberkategorie: groupKey, unterkategorie: '', lockCategory: true }
            : { oberkategorie: '', unterkategorie: '' };
        handleDroppedFiles(e.dataTransfer.files, target);
        state.dragReorderSrcId = null;
        return;
    }

    // Card reorder
    const cardEl = e.target.closest('[data-id]');
    if (!cardEl) return;
    cardEl.classList.remove('ring-2', 'ring-blue-400', 'ring-inset');
    if (!state.dragReorderSrcId || state.dragReorderSrcId === cardEl.dataset.id) return;
    const srcIdx = state.files.findIndex(f => f.id === state.dragReorderSrcId);
    const dstIdx = state.files.findIndex(f => f.id === cardEl.dataset.id);
    if (srcIdx === -1 || dstIdx === -1) return;
    const [moved] = state.files.splice(srcIdx, 1);
    state.files.splice(dstIdx, 0, moved);
    state.dragReorderSrcId = null;
    renderList();
});

// Inline-Edit: Focus, Input, Blur (debounced), Keydown
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
        } else if (e.target.dataset.field === 'unterkategorie') {
            showAutocomplete(e.target, 'unterkategorie');
        }
    }
});

DOM.fileListContainer.addEventListener('input', (e) => {
    if (e.target.dataset.field === 'kommentar') {
        showAutocomplete(e.target, 'kommentar');
    } else if (e.target.dataset.field === 'standort') {
        showAutocomplete(e.target, 'standort');
    } else if (e.target.dataset.field === 'unterkategorie') {
        showAutocomplete(e.target, 'unterkategorie');
    }
});

// Debounce helper (render.js-internal)
function _debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

const _handleEditBlur = _debounce((target) => {
    if (!target.classList || !target.classList.contains('editable-segment')) return;
    const cardEl = target.closest('[data-id]');
    if (!cardEl) return;
    const id = cardEl.dataset.id;
    const field = target.dataset.field;
    let val = target.textContent.trim();

    if (val === 'Unterkategorie' && field === 'unterkategorie') val = '';
    if (val === 'Kommentar' && field === 'kommentar') val = '';
    if (val === 'Standort' && field === 'standort') val = '';
    if (val === 'Datum' && field === 'datum') val = '';

    const item = state.files.find(f => f.id === id);
    if (item && item[field] !== val) {
        const oldValue = item[field];
        item[field] = val;
        if (field === 'kommentar') {
            let learnSource = 'manual-list-edit';
            if (item.aiCommentStatus === 'auto') {
                item.aiCommentManuallyOverridden = true;
                learnSource = 'manual-comment-edit';
            }
            item.aiCommentStatus = 'manual';
            if (typeof queueAiLearnForItem === 'function') {
                queueAiLearnForItem(item, learnSource);
            }
        }
        if (field === 'unterkategorie') {
            item.aiManuallyOverridden = true;
            if (typeof queueAiLearnForItem === 'function') {
                queueAiLearnForItem(item, 'manual-list-edit');
            }
        }
        pushUndo({ type: 'edit', id: item.id, field, oldValue });
        if (field === 'standort') {
            const normalized = val ? val.padStart(4, '0') : '';
            item.standort = normalized;
            item.tabId = normalized ? ensureStandortTab(normalized) : 'all';
            removeEmptyStandortTabs();
        }
        renderList();
    } else if (!val) {
        target.classList.add('placeholder');
        target.textContent = field === 'unterkategorie' ? 'Unterkategorie' : 'Kommentar';
    }
    setTimeout(() => DOM.autocompleteDropdown.classList.add('hidden'), 200);
}, 80);

DOM.fileListContainer.addEventListener('blur', (e) => {
    if (e.target.classList.contains('editable-segment')) {
        _handleEditBlur(e.target);
    }
}, true);

// Helper: returns the name of the next empty editable field after currentField for a given item
function _getNextFreeFieldName(item, currentField) {
    const editableFields = ['standort', 'datum', 'unterkategorie', 'kommentar'];
    const currentIdx = editableFields.indexOf(currentField);
    for (let i = currentIdx + 1; i < editableFields.length; i++) {
        const f = editableFields[i];
        if (!item[f]) return f;
    }
    return null;
}

// Helper: focuses a specific editable field inside a card, after the DOM has been rebuilt
function _focusFieldInCard(itemId, fieldName) {
    setTimeout(() => {
        const card = DOM.fileListContainer.querySelector(`[data-id="${itemId}"]`);
        if (!card) return;
        const el = card.querySelector(`[data-field="${fieldName}"].editable-segment`);
        if (!el || el.getAttribute('contenteditable') !== 'true') return;
        el.focus();
        setTimeout(() => {
            const range = document.createRange();
            range.selectNodeContents(el);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
        }, 10);
    }, 150);
}

DOM.fileListContainer.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('editable-segment')) return;

    const dropdown = DOM.autocompleteDropdown;
    const isDropdownVisible = !dropdown.classList.contains('hidden');
    const acItems = isDropdownVisible ? [...dropdown.querySelectorAll('[data-autocomplete-item]')] : [];
    const keyboardFocused = isDropdownVisible ? dropdown.querySelector('[data-autocomplete-item].keyboard-focus') : null;
    const focusedIdx = keyboardFocused ? acItems.indexOf(keyboardFocused) : -1;
    const currentEl = e.target;

    if (e.key === 'ArrowDown' && isDropdownVisible && acItems.length) {
        e.preventDefault();
        const next = acItems[focusedIdx + 1] || acItems[0];
        if (keyboardFocused) keyboardFocused.classList.remove('keyboard-focus', 'bg-blue-50', 'dark:bg-blue-900/30');
        next.classList.add('keyboard-focus', 'bg-blue-50', 'dark:bg-blue-900/30');
        next.scrollIntoView({ block: 'nearest' });
        return;
    }

    if (e.key === 'ArrowUp' && isDropdownVisible && acItems.length) {
        e.preventDefault();
        const prev = acItems[focusedIdx - 1] || acItems[acItems.length - 1];
        if (keyboardFocused) keyboardFocused.classList.remove('keyboard-focus', 'bg-blue-50', 'dark:bg-blue-900/30');
        prev.classList.add('keyboard-focus', 'bg-blue-50', 'dark:bg-blue-900/30');
        prev.scrollIntoView({ block: 'nearest' });
        return;
    }

    if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
        return;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();

        const card = currentEl.closest('[data-id]');
        const itemId = card?.dataset.id;
        const field = currentEl.dataset.field;
        const item = itemId ? state.files.find(f => f.id === itemId) : null;
        const nextField = item ? _getNextFreeFieldName(item, field) : null;

        if (e.key === 'Enter' && isDropdownVisible && acItems.length) {
            // Autofill: accept keyboard-focused item, or first item if none highlighted
            const itemToSelect = keyboardFocused || acItems[0];
            itemToSelect.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            // onmousedown sets textContent + calls element.blur() → triggers _handleEditBlur
        } else {
            dropdown.classList.add('hidden');
            currentEl.blur();
        }

        if (nextField && itemId) {
            _focusFieldInCard(itemId, nextField);
        }
        return;
    }
});

// --- View Buttons ---
document.querySelectorAll('.view-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
        state.viewMode = e.currentTarget.dataset.view;
        localStorage.setItem('viewMode', state.viewMode);
        DOM.viewDropdownMenu.classList.add('hidden');
        renderList();
    });
});

// --- Filter & Sort ---
function refreshFilterUI() {
    if (!DOM.filterDropdownMenu) return;
    const activeCls = 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-700 dark:text-blue-300 font-semibold';
    const inactiveCls = 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800';
    const baseCls = 'text-[10px] px-2 py-0.5 rounded-full border transition-colors';
    DOM.filterDropdownMenu.querySelectorAll('.sort-key-btn').forEach(btn => {
        const isActive = btn.dataset.sort === state.sortKey;
        btn.className = `sort-key-btn ${baseCls} ${isActive ? activeCls : inactiveCls}`;
    });
    DOM.filterDropdownMenu.querySelectorAll('.sort-dir-btn').forEach(btn => {
        const isActive = btn.dataset.dir === state.sortDir;
        btn.className = `sort-dir-btn ${baseCls} ${isActive ? activeCls : inactiveCls}`;
    });
    DOM.filterDropdownMenu.querySelectorAll('.group-by-btn').forEach(btn => {
        const btnGroup = btn.dataset.group || null;
        const isActive = btnGroup === state.groupBy;
        btn.className = `group-by-btn ${baseCls} ${isActive ? activeCls : inactiveCls}`;
    });
    const isFiltered = !!(state.filterText || state.groupBy || state.sortKey !== 'lastModified' || state.sortDir !== 'desc');
    DOM.filterDropdownTrigger?.classList.toggle('text-blue-500', isFiltered);
    DOM.filterDropdownTrigger?.classList.toggle('border-blue-400', isFiltered);
}

if (DOM.filterDropdownTrigger) {
    DOM.filterDropdownTrigger.addEventListener('click', e => {
        e.stopPropagation();
        DOM.filterDropdownMenu.classList.toggle('hidden');
        refreshFilterUI();
    });
}

if (DOM.filterTextInput) {
    DOM.filterTextInput.addEventListener('input', e => {
        state.filterText = e.target.value;
        renderList();
    });
}

// Undo / Redo Buttons
if (DOM.undoBtn) DOM.undoBtn.addEventListener('click', applyUndo);
if (DOM.redoBtn) DOM.redoBtn.addEventListener('click', applyRedo);

// GPS settings toggles
if (DOM.autoGpsToggle) {
    DOM.autoGpsToggle.addEventListener('change', (e) => {
        state.autoGpsEnabled = e.target.checked;
        persistConfigToLocalStorage();
        syncConfigFile({ silent: true });
    });
}
if (DOM.excludeUnmatchedToggle) {
    DOM.excludeUnmatchedToggle.addEventListener('change', (e) => {
        state.excludeUnmatched = e.target.checked;
        persistConfigToLocalStorage();
        syncConfigFile({ silent: true });
    });
}
