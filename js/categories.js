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

// Keyboard navigation for standort dropdown
DOM.standortSelect.addEventListener("keydown", (e) => {
    if (DOM.standortDropdown.classList.contains('hidden')) {
        if (e.key === 'ArrowDown') { e.preventDefault(); DOM.standortDropdown.classList.remove('hidden'); renderStandortDropdown(DOM.standortSelect.value); }
        return;
    }
    const items = [...DOM.standortDropdown.querySelectorAll('.dropdown-item')];
    if (!items.length) return;
    const focused = DOM.standortDropdown.querySelector('.dropdown-item.keyboard-focus');
    const focusedIdx = focused ? items.indexOf(focused) : -1;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[focusedIdx + 1] || items[0];
        if (focused) focused.classList.remove('keyboard-focus', 'bg-blue-50', 'dark:bg-blue-900/30');
        next.classList.add('keyboard-focus', 'bg-blue-50', 'dark:bg-blue-900/30');
        next.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[focusedIdx - 1] || items[items.length - 1];
        if (focused) focused.classList.remove('keyboard-focus', 'bg-blue-50', 'dark:bg-blue-900/30');
        prev.classList.add('keyboard-focus', 'bg-blue-50', 'dark:bg-blue-900/30');
        prev.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focused) focused.click();
    } else if (e.key === 'Escape') {
        DOM.standortDropdown.classList.add('hidden');
    }
});

/** =========================================================================
 * MODUL: KATEGORIE-FARBEN
 * ========================================================================= */
function findCategoryById(catId) {
    return categoriesConfig.find(entry => entry.id === catId) || null;
}

function getCategoryAccentPalette(color) {
    const rgb = hexToRgb(color);
    if (!rgb) return null;

    const darkMode = document.documentElement.classList.contains('dark');
    return {
        text: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.98 : 0.92})`,
        mutedText: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.9 : 0.84})`,
        background: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.2 : 0.12})`,
        backgroundStrong: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.28 : 0.18})`,
        border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.62 : 0.45})`,
        borderStrong: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.9 : 0.72})`,
        shadow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${darkMode ? 0.22 : 0.14})`
    };
}

function getCategoryColor(catId) {
    return normalizeHexColor(findCategoryById(catId)?.color);
}

function createCategoryAccentText(text, color, fallbackClassName = '') {
    const span = document.createElement('span');
    span.textContent = text;
    if (fallbackClassName) {
        span.className = fallbackClassName;
    }

    const palette = getCategoryAccentPalette(color);
    if (palette) {
        span.style.color = palette.text;
    }

    return span;
}

function buildCategoryPathHTML(categoryName, fileName) {
    const palette = getCategoryAccentPalette(getCategoryColor(categoryName));
    const categoryStyle = palette
        ? `style="color:${palette.text}; font-weight:700;"`
        : 'class="font-semibold text-slate-700 dark:text-zinc-300"';

    return `<span ${categoryStyle}>${categoryName}</span><span class="text-slate-400 dark:text-zinc-500">/</span><span>${fileName}</span>`;
}

function applyCategoryToneStyles(box, color, isSelected = false) {
    const palette = getCategoryAccentPalette(color);
    if (!palette) return;

    box.style.backgroundColor = isSelected ? palette.backgroundStrong : palette.background;
    box.style.borderColor = isSelected ? palette.borderStrong : palette.border;
    box.style.color = palette.text;
    if (isSelected) {
        box.style.boxShadow = `0 0 0 2px ${palette.shadow}`;
    }
}

function closeCategoryColorMenu() {
    state.openCategoryColorMenuFor = null;
    categoryColorMenu.classList.add('hidden');
    categoryColorMenu.innerHTML = '';
}

async function applyCategoryColor(catId, color) {
    const cat = findCategoryById(catId);
    const nextColor = normalizeHexColor(color);
    if (!cat || !nextColor) return;
    cat.color = nextColor;
    renderCategories();
    renderList();
    renderSettingsList();
    closeCategoryColorMenu();
    await syncConfigFile({ silent: true });
}

function openCategoryColorMenu(catId, anchorEl) {
    const cat = findCategoryById(catId);
    if (!cat || !anchorEl) return;

    state.openCategoryColorMenuFor = catId;
    const currentColor = normalizeHexColor(cat.color);
    const customColors = normalizeColorList([
        ...state.customCategoryColors,
        ...(currentColor && !DEFAULT_CATEGORY_COLORS.includes(currentColor) ? [currentColor] : [])
    ]);
    const swatches = DEFAULT_CATEGORY_COLORS.map(color => `
        <button type="button" class="category-color-swatch w-8 h-8 rounded-full border-2 transition-transform hover:scale-105 ${currentColor === color ? 'border-slate-900 dark:border-white' : 'border-white dark:border-zinc-800'}" data-color="${color}" style="background:${color};"></button>
    `).join('');
    const customSwatches = customColors.map(color => `
        <button type="button" class="category-color-swatch w-8 h-8 rounded-full border-2 transition-transform hover:scale-105 ${currentColor === color ? 'border-slate-900 dark:border-white' : 'border-white dark:border-zinc-800'}" data-color="${color}" style="background:${color};"></button>
    `).join('');

    categoryColorMenu.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-3">
            <div>
                <div class="text-xs font-semibold text-slate-900 dark:text-zinc-100">Farbton</div>
                <div class="text-[11px] text-slate-500 dark:text-zinc-400 truncate">${cat.label}</div>
            </div>
            <button type="button" class="category-color-reset text-[11px] text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100">Zurücksetzen</button>
        </div>
        <div class="grid grid-cols-4 gap-2 mb-2">
            ${swatches}
        </div>
        ${customSwatches ? `<div class="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-2">Eigene Farben</div><div class="grid grid-cols-4 gap-2 mb-2">${customSwatches}</div>` : ''}
        <button type="button" class="category-add-custom w-full rounded-lg border border-dashed border-slate-300 dark:border-zinc-600 px-3 py-2 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">+ Eigene Farbe hinzufügen</button>
    `;

    const rect = anchorEl.getBoundingClientRect();
    categoryColorMenu.style.top = `${Math.min(window.innerHeight - 180, rect.bottom + 8)}px`;
    categoryColorMenu.style.left = `${Math.min(window.innerWidth - 240, Math.max(8, rect.right - 224))}px`;
    categoryColorMenu.classList.remove('hidden');

    categoryColorMenu.querySelectorAll('.category-color-swatch').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await applyCategoryColor(catId, btn.dataset.color);
        });
    });

    const resetBtn = categoryColorMenu.querySelector('.category-color-reset');
    resetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        cat.color = '';
        renderCategories();
        renderList();
        renderSettingsList();
        closeCategoryColorMenu();
        await syncConfigFile({ silent: true });
    });

    const customBtn = categoryColorMenu.querySelector('.category-add-custom');
    customBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        categoryCustomColorInput.value = currentColor || customColors.at(-1) || DEFAULT_CUSTOM_CATEGORY_COLOR;
        categoryCustomColorInput.click();
    });
}

categoryCustomColorInput.addEventListener('input', async (e) => {
    const nextColor = normalizeHexColor(e.target.value) || DEFAULT_CUSTOM_CATEGORY_COLOR;
    state.customCategoryColors = normalizeColorList([...state.customCategoryColors, nextColor]);
    persistConfigToLocalStorage();
    if (state.openCategoryColorMenuFor) {
        await applyCategoryColor(state.openCategoryColorMenuFor, nextColor);
    }
});

/** =========================================================================
 * MODUL: KATEGORIEN UI & DROP-BOXES
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
        if (isMainCategory && normalizeHexColor(cat.color)) {
            box.classList.add('ring-2');
        } else {
            box.classList.add('ring-2', 'ring-indigo-500', 'border-indigo-500', 'bg-indigo-50', 'text-indigo-700', 'dark:bg-indigo-900/30', 'dark:text-indigo-300');
        }
    }

    if (isMainCategory && normalizeHexColor(cat.color)) {
        applyCategoryToneStyles(box, cat.color, isSelected);
    }

    const boxLabel = isMainCategory ? cat.label : sub;
    const paletteColor = normalizeHexColor(cat.color) || '#64748b';
    let boxHtml = `
        <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex items-center gap-1.5">
                <span class="truncate">${boxLabel}</span>
                ${isMainCategory ? `<button type="button" class="palette-btn inline-flex items-center justify-center w-5 h-5 rounded-md hover:bg-white/60 dark:hover:bg-zinc-800/70 transition-colors" title="Farbton ändern" style="color:${paletteColor};"><i class="mdi mdi-palette text-base"></i></button>` : ''}
            </div>
            <span class="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 group-hover/box:bg-blue-200 group-hover/box:text-blue-700 dark:group-hover/box:bg-blue-800 dark:group-hover/box:text-blue-300 transition-colors">Drop</span>
        </div>
    `;

    boxHtml += `<button class="remove-cat-btn hidden group-hover/box:flex absolute top-1 right-1 items-center justify-center w-4 h-4 text-red-500 hover:text-red-700 bg-white/90 dark:bg-zinc-800 rounded-full" title="Entfernen">&times;</button>`;
    box.innerHTML = boxHtml;

    const removeBtn = box.querySelector('.remove-cat-btn');
    const paletteBtn = box.querySelector('.palette-btn');

    box.addEventListener("click", (e) => {
        e.stopPropagation();
        state.selectedCategory = cat.id;
        state.selectedSubcat = targetSubcat || null;
        state.currentTarget = { oberkategorie: cat.id, unterkategorie: targetSubcat };
        renderCategories();
        showImportPopover(box, state.currentTarget);
    });

    removeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (isMainCategory) {
            await handleRemoveCategory(cat.id);
        } else {
            await handleRemoveSubcat(cat.id, sub);
        }
        if (onChangeCallback) onChangeCallback();
    });

    if (isMainCategory && paletteBtn) {
        paletteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.openCategoryColorMenuFor === cat.id) {
                closeCategoryColorMenu();
                return;
            }
            openCategoryColorMenu(cat.id, paletteBtn);
        });
    }

    box.addEventListener("dragover", (e) => {
        e.preventDefault();
        const accentColor = normalizeHexColor(cat.color) || '#3b82f6';
        box.style.outline = `2px solid ${accentColor}`;
        box.style.outlineOffset = '2px';
    });
    box.addEventListener("dragleave", (e) => {
        e.preventDefault();
        box.style.outline = '';
        box.style.outlineOffset = '';
    });
    box.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        box.style.outline = '';
        box.style.outlineOffset = '';
        box.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
        state.selectedCategory = cat.id;
        state.selectedSubcat = targetSubcat || null;
        state.currentTarget = { oberkategorie: cat.id, unterkategorie: targetSubcat };

        // Card re-categorization
        const cardId = e.dataTransfer.getData('text/card-id');
        if (cardId) {
            const file = state.files.find(f => f.id === cardId);
            if (file) {
                const prevOber = file.oberkategorie;
                const prevUnter = file.unterkategorie;
                file.oberkategorie = cat.id;
                file.unterkategorie = targetSubcat;
                renderList();
                renderCategories();
                showToast(`Kategorie geändert.`, {
                    undoAction: () => {
                        file.oberkategorie = prevOber;
                        file.unterkategorie = prevUnter;
                        renderList();
                        renderCategories();
                    }
                });
            } else {
                renderCategories();
            }
            return;
        }

        // Native file drop
        renderCategories();
        if (e.dataTransfer.files.length > 0) {
            handleDroppedFiles(e.dataTransfer.files, { oberkategorie: cat.id, unterkategorie: targetSubcat });
        }
    });

    return box;
}

async function handleAddNewSubcat(catId, onChangeCallback) {
    const name = await showPromptModal(`Neue Unterkategorie für ${catId}:`, 'Name eingeben...');
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

// Import popover (files vs. folder)
let _importPopover = null;
function showImportPopover(anchorEl, targetConfig) {
    if (_importPopover) _importPopover.remove();
    const pop = document.createElement('div');
    _importPopover = pop;
    pop.className = 'fixed z-[200] rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-xl p-1.5 flex flex-col gap-0.5 text-sm';
    pop.innerHTML = `
      <button id="imp-files" class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-zinc-200 text-left whitespace-nowrap">
        <i class="mdi mdi-file-multiple shrink-0 text-base"></i>Dateien auswählen
      </button>
      <button id="imp-folder" class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-zinc-200 text-left whitespace-nowrap">
        <i class="mdi mdi-folder-open shrink-0 text-base"></i>Ordner importieren
      </button>
    `;
    document.body.appendChild(pop);
    const rect = anchorEl.getBoundingClientRect();
    pop.style.top = (rect.bottom + 4) + 'px';
    pop.style.left = rect.left + 'px';
    const close = () => { pop.remove(); _importPopover = null; document.removeEventListener('click', close, true); };
    setTimeout(() => document.addEventListener('click', close, true), 10);
    pop.querySelector('#imp-files').addEventListener('click', () => {
        close();
        state.currentTarget = targetConfig;
        DOM.fileInput.click();
    });
    pop.querySelector('#imp-folder').addEventListener('click', () => {
        close();
        state.currentTarget = targetConfig;
        DOM.folderInput.click();
    });
}

function renderCategories() {
    if (!DOM.contextChips || !DOM.contextTitle) return;

    if (state.selectedCategory) {
        const selectedCat = categoriesConfig.find(c => c.id === state.selectedCategory);
        if (selectedCat && state.selectedSubcat) {
            DOM.contextTitle.textContent = '';
            DOM.contextTitle.append('Ausgewählt: ');
            DOM.contextTitle.append(createCategoryAccentText(selectedCat.label, selectedCat.color, 'font-bold text-blue-600 dark:text-blue-400'));
            DOM.contextTitle.append(' ');

            const separator = document.createElement('span');
            separator.className = 'text-slate-400 dark:text-zinc-500 font-normal';
            separator.textContent = '›';
            DOM.contextTitle.append(separator);
            DOM.contextTitle.append(' ');
            DOM.contextTitle.append(createCategoryAccentText(state.selectedSubcat, selectedCat.color, 'font-bold text-indigo-600 dark:text-indigo-400'));
        } else if (selectedCat) {
            DOM.contextTitle.textContent = '';
            DOM.contextTitle.append('Ausgewählt: ');
            DOM.contextTitle.append(createCategoryAccentText(selectedCat.label, selectedCat.color, 'font-bold text-blue-600 dark:text-blue-400'));
        } else {
            DOM.contextTitle.textContent = 'Bauteile & Kategorien';
        }
    } else {
        DOM.contextTitle.textContent = 'Bauteile & Kategorien';
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
        const catTotalCount = state.files.filter(f => f.oberkategorie === cat.id).length;
        if (catTotalCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'absolute top-1 right-6 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold pointer-events-none z-10';
            badge.textContent = catTotalCount;
            mainBoxWrapper.append(badge);
        }

        section.append(mainBoxWrapper);

        // Sub categories container
        const subCatsContainer = document.createElement('div');
        subCatsContainer.className = 'grid grid-cols-2 lg:grid-cols-3 gap-2 pl-4 border-l-2 border-slate-200 dark:border-zinc-800 ml-3 mt-1';

        const allSubs = [...cat.subcats.map(sub => ({ sub }))];

        allSubs.forEach((entry) => {
            const subcatCount = state.files.filter(f => f.oberkategorie === cat.id && f.unterkategorie === entry.sub).length;
            if (subcatCount > 0) {
                const subcatWrapper = document.createElement('div');
                subcatWrapper.className = 'relative';
                subcatWrapper.append(createCategoryDropBox(cat, entry.sub, onChangeCallback));
                const subBadge = document.createElement('span');
                subBadge.className = 'absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] font-semibold pointer-events-none z-10';
                subBadge.textContent = subcatCount;
                subcatWrapper.append(subBadge);
                subCatsContainer.append(subcatWrapper);
            } else {
                subCatsContainer.append(createCategoryDropBox(cat, entry.sub, onChangeCallback));
            }
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
