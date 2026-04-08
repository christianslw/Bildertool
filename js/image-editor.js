/** =========================================================================
 * MODUL: BILD-ANNOTATIONSWERKZEUG
 * Ermöglicht Freihand-Zeichnen, Pfeile, Rechtecke, Ellipsen und Text-
 * Annotierungen auf dem geöffneten Vorschau-Bild. Die Annotierungen können
 * dauerhaft in das Bild eingebrannt werden (volle Originalauflösung).
 * ========================================================================= */

(function () {
    'use strict';

    // --- Interner Zustand ---
    let editorActive  = false;
    let currentTool   = 'pen';   // 'pen' | 'arrow' | 'rect' | 'circle' | 'text'
    let currentColor  = '#ef4444';
    let currentWidth  = 4;
    let isDrawing     = false;
    let startX = 0, startY = 0;
    let history       = [];        // ImageData-Snapshots für Undo
    let previewSnap   = null;     // Snapshot vor Shape-Preview (nicht committed)

    // --- DOM-Referenzen (werden bei openImageEditor gesetzt) ---
    let canvas, ctx, imgEl;

    // -----------------------------------------------------------------------
    // Hilfsfunktionen
    // -----------------------------------------------------------------------

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY
        };
    }

    function pushHistory() {
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (history.length > 40) history.shift();
    }

    function drawArrow(x1, y1, x2, y2) {
        const headLen = Math.max(12, currentWidth * 4);
        const angle   = Math.atan2(y2 - y1, x2 - x1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Pfeilspitze (gefüllt)
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
            x2 - headLen * Math.cos(angle - Math.PI / 6),
            y2 - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            x2 - headLen * Math.cos(angle + Math.PI / 6),
            y2 - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = currentColor;
        ctx.fill();
    }

    function drawShape(x1, y1, x2, y2) {
        ctx.strokeStyle = currentColor;
        ctx.fillStyle   = currentColor;
        ctx.lineWidth   = currentWidth;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';

        if (currentTool === 'arrow') {
            drawArrow(x1, y1, x2, y2);
        } else if (currentTool === 'rect') {
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        } else if (currentTool === 'circle') {
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const rx = Math.abs(x2 - x1) / 2;
            const ry = Math.abs(y2 - y1) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // -----------------------------------------------------------------------
    // Maus-Ereignisse
    // -----------------------------------------------------------------------

    function onMouseDown(e) {
        if (!editorActive) return;
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        startX = pos.x;
        startY = pos.y;

        if (currentTool === 'pen') {
            pushHistory();
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.strokeStyle = currentColor;
            ctx.lineWidth   = currentWidth;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
        } else if (currentTool === 'text') {
            isDrawing = false;
            pushHistory();
            const text = window.prompt('Text eingeben:');
            if (text && text.trim()) {
                const fontSize = Math.max(16, currentWidth * 5);
                ctx.font      = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = currentColor;
                // Stroke für Lesbarkeit bei hellem/dunklem Hintergrund
                ctx.strokeStyle = (currentColor === '#ffffff' || currentColor === '#ffff00')
                    ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
                ctx.lineWidth   = fontSize / 10;
                ctx.strokeText(text, startX, startY);
                ctx.fillText(text, startX, startY);
            }
        } else {
            // Shape-Tools: Snapshot vor dem Zeichnen für Live-Vorschau
            previewSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    }

    function onMouseMove(e) {
        if (!editorActive || !isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);

        if (currentTool === 'pen') {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } else if (previewSnap) {
            ctx.putImageData(previewSnap, 0, 0);
            drawShape(startX, startY, pos.x, pos.y);
        }
    }

    function onMouseUp(e) {
        if (!isDrawing) return;
        isDrawing = false;

        if (previewSnap) {
            ctx.putImageData(previewSnap, 0, 0);
            const pos = getPos(e);
            pushHistory();
            drawShape(startX, startY, pos.x, pos.y);
            previewSnap = null;
        }
    }

    // -----------------------------------------------------------------------
    // Touch-Ereignisse
    // -----------------------------------------------------------------------

    function onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        onMouseDown({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => {} });
    }

    function onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        onMouseMove({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => {} });
    }

    function onTouchEnd(e) {
        const t = e.changedTouches[0];
        onMouseUp({ clientX: t.clientX, clientY: t.clientY });
    }

    // -----------------------------------------------------------------------
    // Toolbar-UI-Sync
    // -----------------------------------------------------------------------

    function syncToolUI() {
        document.querySelectorAll('.editor-tool-btn').forEach(btn => {
            const active = btn.dataset.tool === currentTool;
            btn.classList.toggle('bg-blue-600',   active);
            btn.classList.toggle('text-white',     active);
            btn.classList.toggle('border-blue-500', active);
            btn.classList.toggle('text-zinc-400',  !active);
            btn.classList.toggle('border-zinc-600', !active);
        });
        canvas.style.cursor = currentTool === 'text' ? 'text' : 'crosshair';
    }

    function syncColorUI() {
        document.querySelectorAll('.editor-color-btn').forEach(btn => {
            const sel = btn.dataset.color === currentColor;
            btn.classList.toggle('ring-2',         sel);
            btn.classList.toggle('ring-offset-1',  sel);
            btn.classList.toggle('ring-white',      sel);
            btn.style.outline = sel ? '2px solid white' : '';
        });
        const custom = document.getElementById('editorCustomColor');
        if (custom) custom.value = currentColor;
    }

    function syncWidthUI() {
        const lbl = document.getElementById('editorWidthLabel');
        if (lbl) lbl.textContent = currentWidth + 'px';
    }

    // -----------------------------------------------------------------------
    // Öffentliche API
    // -----------------------------------------------------------------------

    /** Öffnet den Annotationseditor für ein Bild-Item. */
    window.openImageEditor = function () {
        canvas  = document.getElementById('annotationCanvas');
        ctx     = canvas.getContext('2d', { willReadFrequently: true });
        imgEl   = document.getElementById('previewImage');

        // Zustand zurücksetzen
        editorActive = true;
        history      = [];
        previewSnap  = null;
        isDrawing    = false;
        currentTool  = 'pen';

        // UI aktivieren ZUERST – damit das Layout (Toolbar sichtbar) eingeschwungen
        // ist, bevor wir die Canvas-Dimensionen messen.
        canvas.classList.remove('hidden');
        const toolbar = document.getElementById('annotationToolbar');
        toolbar.classList.remove('hidden');
        toolbar.classList.add('flex');
        document.getElementById('openEditorBtn').classList.add('hidden');

        // Event-Listener registrieren
        canvas.addEventListener('mousedown',  onMouseDown);
        canvas.addEventListener('mousemove',  onMouseMove);
        canvas.addEventListener('mouseup',    onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
        canvas.addEventListener('touchend',   onTouchEnd);

        syncColorUI();
        syncWidthUI();

        // Canvas-Dimensionen NACH dem Reflow setzen – doppeltes rAF stellt sicher,
        // dass Browser das Layout komplett berechnet hat.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            // Canvas auf die tatsächlich angezeigte Bildgröße setzen.
            // CSS "w-full h-full" auf dem Canvas sorgt dafür, dass er exakt
            // das Bild überdeckt – wir setzen nur die internen Pixel-Dimensionen.
            canvas.width  = imgEl.clientWidth;
            canvas.height = imgEl.clientHeight;
            syncToolUI();
        }));
    };

    /** Schließt den Editor. apply=true brennt Annotierungen ein. */
    window.closeImageEditor = function (apply) {
        if (!editorActive) return;

        if (apply && canvas.width > 0) {
            _applyAnnotations();
        }

        _destroyEditor();
    };

    /** Wird von closePreview() aufgerufen um sauber aufzuräumen. */
    window.resetImageEditor = function () {
        if (editorActive) {
            _destroyEditor();
        }
    };

    function _destroyEditor() {
        editorActive = false;
        history      = [];
        previewSnap  = null;

        if (canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.removeEventListener('mousedown',  onMouseDown);
            canvas.removeEventListener('mousemove',  onMouseMove);
            canvas.removeEventListener('mouseup',    onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseUp);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove',  onTouchMove);
            canvas.removeEventListener('touchend',   onTouchEnd);
            canvas.classList.add('hidden');
        }

        const toolbar = document.getElementById('annotationToolbar');
        if (toolbar) {
            toolbar.classList.add('hidden');
            toolbar.classList.remove('flex');
        }
        const openBtn = document.getElementById('openEditorBtn');
        if (openBtn) openBtn.classList.remove('hidden');
    }

    /** Brennt Annotierungen in Originalauflösung in das Bild ein. */
    function _applyAnnotations() {
        const item = state.files.find(f => f.id === window.currentPreviewItemId);
        if (!item) return;
        if (canvas.width === 0 || canvas.height === 0) return;

        const offscreen = document.createElement('canvas');
        offscreen.width  = imgEl.naturalWidth;
        offscreen.height = imgEl.naturalHeight;
        const offCtx = offscreen.getContext('2d');

        // Originalbild in voller Auflösung einzeichnen
        offCtx.drawImage(imgEl, 0, 0, offscreen.width, offscreen.height);

        // Annotations-Canvas explizit auf die Originalgröße hochskalieren:
        // Quelle: gesamter Canvas (0,0 → canvas.width × canvas.height)
        // Ziel:   gesamtes Offscreen-Canvas (0,0 → naturalWidth × naturalHeight)
        offCtx.drawImage(
            canvas,
            0, 0, canvas.width,     canvas.height,
            0, 0, offscreen.width,  offscreen.height
        );

        offscreen.toBlob(blob => {
            if (!blob) return;
            if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
            item.objectUrl    = URL.createObjectURL(blob);
            item.originalFile = new File([blob], item.originalFile.name, { type: 'image/jpeg' });

            // Vorschau aktualisieren
            const previewImg = document.getElementById('previewImage');
            if (previewImg) previewImg.src = item.objectUrl;

            if (typeof showToast === 'function')
                showToast('Annotierungen eingebrannt ✓', 'success');
        }, 'image/jpeg', 0.93);
    }

    // -----------------------------------------------------------------------
    // Tool / Farbe / Breite setzen
    // -----------------------------------------------------------------------

    window.setEditorTool = function (tool) {
        currentTool = tool;
        syncToolUI();
    };

    window.setEditorColor = function (color) {
        currentColor = color;
        syncColorUI();
    };

    window.setEditorColorCustom = function (input) {
        currentColor = input.value;
        syncColorUI();
    };

    window.setEditorWidth = function (val) {
        currentWidth = parseInt(val, 10);
        syncWidthUI();
    };

    // -----------------------------------------------------------------------
    // Undo / Löschen
    // -----------------------------------------------------------------------

    window.editorUndo = function () {
        if (history.length === 0) return;
        ctx.putImageData(history.pop(), 0, 0);
    };

    window.editorClear = function () {
        if (canvas.width === 0) return;
        pushHistory();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

})();
