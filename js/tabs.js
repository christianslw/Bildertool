/** =========================================================================
 * MODUL: TABS
 * ========================================================================= */
function getStandortLabel(numStr) {
    if (!numStr) return 'Kein Standort';
    const entry = standorteDaten?.find(s => String(s.nummer) === String(numStr));
    return entry ? `${entry.nummer} ${entry.name}` : `Standort ${numStr}`;
}

function ensureStandortTab(standortNummer) {
    const tabId = 'standort-' + standortNummer;
    if (!state.tabs.find(t => t.id === tabId)) {
        state.tabs.push({ id: tabId, label: getStandortLabel(standortNummer), standort: standortNummer });
        // Sort: 'all' always first, then by standort number ascending
        state.tabs.sort((a, b) => {
            if (a.id === 'all') return -1;
            if (b.id === 'all') return 1;
            return parseInt(a.standort || 0) - parseInt(b.standort || 0);
        });
        renderTabs();
    }
    return tabId;
}

function removeEmptyStandortTabs() {
    const before = state.activeTabId;
    state.tabs = state.tabs.filter(t => {
        if (t.id === 'all') return true;
        return state.files.some(f => f.tabId === t.id);
    });
    if (!state.tabs.find(t => t.id === state.activeTabId)) {
        state.activeTabId = 'all';
    }
    renderTabs();
    if (state.activeTabId !== before) renderList();
}

function renderTabs() {
    if (!DOM.tabBar) return;
    DOM.tabBar.querySelectorAll('.tab-btn').forEach(el => el.remove());
    state.tabs.forEach(tab => {
        const isAll = tab.id === 'all';
        const isActive = tab.id === state.activeTabId;
        const fileCount = isAll
            ? state.files.length
            : state.files.filter(f => f.tabId === tab.id).length;
        const btn = document.createElement('div');
        btn.className = `tab-btn flex items-center gap-1.5 px-2.5 py-1 mr-0.5 rounded-t-md text-xs font-medium cursor-pointer select-none transition-colors shrink-0 border-x border-t ${isActive ? 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 -mb-px z-10 shadow-sm' : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'}`;
        btn.dataset.tabId = tab.id;
        const labelSpan = document.createElement('span');
        labelSpan.className = 'tab-label max-w-[120px] truncate';
        labelSpan.textContent = tab.label + (fileCount > 0 ? ` (${fileCount})` : '');
        btn.appendChild(labelSpan);
        // Station tabs (not 'all') get a close button
        if (!isAll) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tab-close opacity-40 hover:opacity-100 hover:text-red-500 transition-all leading-none pt-px';
            closeBtn.innerHTML = '\u00d7';
            closeBtn.title = 'Tab schließen';
            closeBtn.addEventListener('click', e => { e.stopPropagation(); closeTab(tab.id); });
            btn.appendChild(closeBtn);
        }
        btn.addEventListener('click', e => { if (!e.target.classList.contains('tab-close')) switchTab(tab.id); });
        // Station tabs support rename via double-click
        if (!isAll) {
            btn.addEventListener('dblclick', e => {
                if (e.target.classList.contains('tab-close')) return;
                const labelEl = btn.querySelector('.tab-label');
                const prev = tab.label;
                labelEl.contentEditable = 'true';
                labelEl.textContent = prev;
                labelEl.focus();
                const range = document.createRange();
                range.selectNodeContents(labelEl);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
                const finish = () => { labelEl.contentEditable = 'false'; const t = labelEl.textContent.trim(); tab.label = t || prev; renderTabs(); };
                labelEl.addEventListener('blur', finish, { once: true });
                labelEl.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); labelEl.blur(); } if (ev.key === 'Escape') { labelEl.textContent = prev; labelEl.blur(); } }, { once: true });
            });
        }
        DOM.tabBar.appendChild(btn);
    });
}

function closeTab(tabId) {
    if (tabId === 'all') return;
    const toRemove = state.files.filter(f => f.tabId === tabId);
    toRemove.forEach(f => { URL.revokeObjectURL(f.objectUrl); if (f.hash) state.hashes.delete(f.hash); });
    state.files = state.files.filter(f => f.tabId !== tabId);
    state.tabs = state.tabs.filter(t => t.id !== tabId);
    if (state.activeTabId === tabId) state.activeTabId = 'all';
    state.selectedFileIds.clear();
    renderTabs();
    renderList();
}

function switchTab(tabId) {
    if (!state.tabs.find(t => t.id === tabId)) return;
    state.activeTabId = tabId;
    state.selectedFileIds.clear();
    renderTabs();
    renderList();
}
