/** =========================================================================
 * MODUL: RESIZABLE PANEL DIVIDER
 * Ermöglicht das Verschieben des Trennbalkens zwischen Kategorien- und Listenbereich.
 * Split-Breite wird in localStorage gespeichert.
 * ========================================================================= */

(function () {
    const STORAGE_KEY = 'bildertool-panel-split';
    const MIN_PCT = 18;
    const MAX_PCT = 75;

    const divider    = document.getElementById('resizeDivider');
    const leftPanel  = document.getElementById('categoriesPanel');
    const rightPanel = document.getElementById('listPanel');

    if (!divider || !leftPanel || !rightPanel) return;

    // Initialbreite setzen
    const stored = parseFloat(localStorage.getItem(STORAGE_KEY));
    const initialPct = (stored >= MIN_PCT && stored <= MAX_PCT) ? stored : 42;
    applyWidth(initialPct);

    // Drag-State
    let dragging = false;
    let startX   = 0;
    let startPct = initialPct;

    divider.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        startX   = e.clientX;
        startPct = leftPanel.getBoundingClientRect().width /
                   leftPanel.parentElement.getBoundingClientRect().width * 100;
        document.body.classList.add('select-none');
        divider.classList.add('bg-blue-400/40');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const container = leftPanel.parentElement;
        const containerW = container.getBoundingClientRect().width;
        const delta = e.clientX - startX;
        const newPct = Math.min(MAX_PCT, Math.max(MIN_PCT, startPct + (delta / containerW * 100)));
        applyWidth(newPct);
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        document.body.classList.remove('select-none');
        divider.classList.remove('bg-blue-400/40');
        const pct = parseFloat(leftPanel.style.width);
        if (!isNaN(pct)) localStorage.setItem(STORAGE_KEY, pct.toFixed(2));
    });

    function applyWidth(pct) {
        leftPanel.style.width  = pct.toFixed(2) + '%';
        rightPanel.style.width = (100 - pct).toFixed(2) + '%';
    }
})();
