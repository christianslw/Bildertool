/** =========================================================================
 * MODUL: UNDO / REDO
 * ========================================================================= */
const MAX_UNDO = 50;

function pushUndo(entry) {
    state.undoStack.push(entry);
    if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
    state.redoStack = [];
    updateUndoRedoUI();
}

function updateUndoRedoUI() {
    if (DOM.undoBtn) DOM.undoBtn.disabled = state.undoStack.length === 0;
    if (DOM.redoBtn) DOM.redoBtn.disabled = state.redoStack.length === 0;
}

function invertAndApply(entry) {
    if (entry.type === 'add') {
        const ids = new Set(entry.items.map(it => it.id));
        entry.items.forEach(it => {
            if (it.hash) state.hashes.delete(it.hash);
            URL.revokeObjectURL(it.objectUrl);
        });
        state.files = state.files.filter(f => !ids.has(f.id));
        removeEmptyStandortTabs();
        return { type: 'readd', items: entry.items };
    }
    if (entry.type === 'readd') {
        entry.items.forEach(it => {
            if (!state.files.find(f => f.id === it.id)) {
                if (it.hash) state.hashes.add(it.hash);
                it.objectUrl = URL.createObjectURL(it.originalFile);
                state.files.push(it);
                if (it.standort) ensureStandortTab(it.standort);
            }
        });
        return { type: 'add', items: entry.items };
    }
    if (entry.type === 'remove') {
        const { item, idx } = entry;
        if (item.hash) state.hashes.add(item.hash);
        item.objectUrl = URL.createObjectURL(item.originalFile);
        state.files.splice(Math.min(idx, state.files.length), 0, item);
        if (item.standort) ensureStandortTab(item.standort);
        return { type: 'unremove', item, idx };
    }
    if (entry.type === 'unremove') {
        const idx = state.files.findIndex(f => f.id === entry.item.id);
        if (idx !== -1) {
            const [removed] = state.files.splice(idx, 1);
            if (removed.hash) state.hashes.delete(removed.hash);
            URL.revokeObjectURL(removed.objectUrl);
            removeEmptyStandortTabs();
        }
        return { type: 'remove', item: entry.item, idx: entry.idx };
    }
    if (entry.type === 'edit') {
        const file = state.files.find(f => f.id === entry.id);
        if (file) {
            const currentVal = file[entry.field];
            file[entry.field] = entry.oldValue;
            if (entry.field === 'standort') {
                const newStandort = entry.oldValue;
                file.tabId = newStandort ? ensureStandortTab(String(newStandort).padStart(4, '0')) : 'all';
                removeEmptyStandortTabs();
            }
            return { type: 'edit', id: entry.id, field: entry.field, oldValue: currentVal };
        }
        return entry;
    }
    if (entry.type === 'bulkEdit') {
        const newOldValues = {};
        state.files.forEach(f => {
            if (!entry.ids.includes(f.id)) return;
            newOldValues[f.id] = { unterkategorie: f.unterkategorie, kommentar: f.kommentar, datum: f.datum };
            const old = entry.oldValues[f.id] || {};
            if ('unterkategorie' in old) f.unterkategorie = old.unterkategorie;
            if ('kommentar' in old) f.kommentar = old.kommentar;
            if ('datum' in old) f.datum = old.datum;
        });
        return { type: 'bulkEdit', ids: entry.ids, fields: entry.fields, oldValues: newOldValues };
    }
    return entry;
}

function applyUndo() {
    if (!state.undoStack.length) return;
    const entry = state.undoStack.pop();
    state.redoStack.push(invertAndApply(entry));
    updateUndoRedoUI();
    renderList();
}

function applyRedo() {
    if (!state.redoStack.length) return;
    const entry = state.redoStack.pop();
    state.undoStack.push(invertAndApply(entry));
    updateUndoRedoUI();
    renderList();
}
