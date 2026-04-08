/**
 * site-2d.js — Technische Monochrome Line-Art (CAD Style)
 */
(function () {
    'use strict';
  
    const NS = 'http://www.w3.org/2000/svg';
  
    // Konstanten & Farben für das Line-Art Design
    const STROKE_COLOR = '#1e293b'; // Dunkles Schiefergrau
    const ACCENT_COLOR = '#3b82f6'; // Blau für Hover/Aktiv
    const DROP_COLOR = '#10b981';   // Grün für Drop
    const BG_FILL = '#ffffff';      // Für Verdeckungen (Occlusion)
    const STROKE_WIDTH = 2;
  
    let activeZone = null;
    const visualGroups = new Map();
  
    // Hilfsfunktion für SVG Elemente
    function svgEl(tag, attrs, parent) {
      const node = document.createElementNS(NS, tag);
      Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
      if (parent) parent.appendChild(node);
      return node;
    }
  
    // Update der visuellen States
    function setZoneState(zoneId, state) {
      const visualG = visualGroups.get(zoneId);
      if (!visualG) return;
  
      // Alle child-paths/rects ansteuern
      const elements = visualG.querySelectorAll('path, rect, line, circle, ellipse, polygon');
      
      elements.forEach(el => {
        // Ursprünglichen Zustand sichern, falls noch nicht passiert
        if (!el.dataset.origStroke) el.dataset.origStroke = el.getAttribute('stroke') || STROKE_COLOR;
        if (!el.dataset.origWidth) el.dataset.origWidth = el.getAttribute('stroke-width') || STROKE_WIDTH;
        if (!el.dataset.origDash) el.dataset.origDash = el.getAttribute('stroke-dasharray') || '';
  
        el.style.transition = 'stroke 0.2s, stroke-width 0.2s';
  
        if (state === 'active') {
          el.setAttribute('stroke', ACCENT_COLOR);
          el.setAttribute('stroke-width', (parseFloat(el.dataset.origWidth) + 1.5).toString());
        } else if (state === 'hover') {
          el.setAttribute('stroke', ACCENT_COLOR);
          el.setAttribute('stroke-width', el.dataset.origWidth);
        } else if (state === 'drop') {
          el.setAttribute('stroke', DROP_COLOR);
          el.setAttribute('stroke-width', (parseFloat(el.dataset.origWidth) + 1).toString());
        } else {
          el.setAttribute('stroke', el.dataset.origStroke);
          el.setAttribute('stroke-width', el.dataset.origWidth);
        }
      });
  
      // Label-Text einfärben falls vorhanden
      const labelText = visualG.querySelector('text');
      if (labelText) {
        labelText.style.transition = 'fill 0.2s';
        if (state === 'active' || state === 'hover') labelText.setAttribute('fill', ACCENT_COLOR);
        else if (state === 'drop') labelText.setAttribute('fill', DROP_COLOR);
        else labelText.setAttribute('fill', STROKE_COLOR);
      }
    }
  
    // Hitbox mit Visuals verdrahten
    function wireZone(hitbox, visualG, cat, sub, onSelect, onDrop) {
      const zoneId = `${cat}_${sub}`;
      visualGroups.set(zoneId, visualG);
      
      hitbox.style.cursor = 'crosshair'; // Technischer Cursor
      hitbox.style.pointerEvents = 'all';
  
      hitbox.addEventListener('mouseenter', () => {
        if (activeZone !== zoneId) setZoneState(zoneId, 'hover');
      });
      hitbox.addEventListener('mouseleave', () => {
        if (activeZone !== zoneId) setZoneState(zoneId, 'idle');
      });
      hitbox.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeZone && activeZone !== zoneId) setZoneState(activeZone, 'idle');
        activeZone = zoneId;
        setZoneState(zoneId, 'active');
        if (onSelect) onSelect(cat, sub);
      });
      hitbox.addEventListener('dragover', (e) => {
        e.preventDefault();
        setZoneState(zoneId, 'drop');
      });
      hitbox.addEventListener('dragleave', () => {
        if (zoneId === activeZone) setZoneState(zoneId, 'active');
        else setZoneState(zoneId, 'idle');
      });
      hitbox.addEventListener('drop', (e) => {
        e.preventDefault();
        if (zoneId === activeZone) setZoneState(zoneId, 'active');
        else setZoneState(zoneId, 'idle');
        if (onDrop) onDrop(cat, sub, e.dataTransfer.files);
      });
    }
  
    // Technisches Label
    function addTechLabel(group, x, y, text) {
      const t = svgEl('text', {
        x: x, y: y,
        'font-family': 'monospace, "Courier New", Courier',
        'font-size': '12',
        'font-weight': 'bold',
        'letter-spacing': '1',
        fill: STROKE_COLOR,
        'text-anchor': 'middle',
        class: 'pointer-events-none'
      }, group);
      t.textContent = text.toUpperCase();
      
      // Kleiner Unterstrich fürs Label
      const w = text.length * 7.5;
      svgEl('line', {
        x1: x - w/2, y1: y + 4, x2: x + w/2, y2: y + 4,
        stroke: STROKE_COLOR, 'stroke-width': 1,
        class: 'pointer-events-none'
      }, group);
    }
  
    // Standard-Attributset für Vektorlinien
    const lineBase = { fill: 'none', stroke: STROKE_COLOR, 'stroke-width': STROKE_WIDTH, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const lineDashed = { ...lineBase, 'stroke-dasharray': '6 6' };
    const shapeBase = { fill: BG_FILL, stroke: STROKE_COLOR, 'stroke-width': STROKE_WIDTH, 'stroke-linejoin': 'round' };
    const shapeDashed = { ...shapeBase, 'stroke-dasharray': '6 6' };
  
    window.initSite2D = function (containerId, onSelect, onDrop) {
      const host = document.getElementById(containerId);
      if (!host) return;
      host.innerHTML = '';
      activeZone = null;
      visualGroups.clear();
  
      const VW = 1200;
      const VH = 800;
      const GND = 600; // Erdniveau
  
      const svg = svgEl('svg', {
        viewBox: `0 0 ${VW} ${VH}`,
        preserveAspectRatio: 'xMidYMid meet',
        class: 'w-full h-full block select-none bg-white'
      }, host);
  
      const artLayer = svgEl('g', { id: 'art-layer' }, svg);
      const hitLayer = svgEl('g', { id: 'hit-layer' }, svg);
  
      // --- BODENLINIE ---
      svgEl('line', { x1: 20, y1: GND, x2: VW - 20, y2: GND, stroke: STROKE_COLOR, 'stroke-width': 1.5 }, artLayer);
  
      /* ==========================================
         GRUNDSTÜCK
         ========================================== */
      
      // Zisterne (unterirdisch)
      const zisterneVis = svgEl('g', {}, artLayer);
      svgEl('circle', { cx: 150, cy: GND + 70, r: 40, ...shapeDashed }, zisterneVis);
      svgEl('rect', { x: 135, y: GND + 5, width: 30, height: 25, ...shapeDashed }, zisterneVis);
      svgEl('line', { x1: 130, y1: GND, x2: 170, y2: GND, stroke: STROKE_COLOR, 'stroke-width': 3 }, zisterneVis); // Deckel
      addTechLabel(zisterneVis, 150, GND + 140, 'Zisterne');
      const zisterneHit = svgEl('circle', { cx: 150, cy: GND + 70, r: 60, fill: 'transparent' }, hitLayer);
      wireZone(zisterneHit, zisterneVis, 'Grundstück', 'Zisterne', onSelect, onDrop);
  
      // Rasen / Freifläche
      const rasenVis = svgEl('g', {}, artLayer);
      for(let i=0; i<5; i++) {
        svgEl('path', { d: `M ${80 + i*15} ${GND} l -5 -10 m 5 10 l 0 -12 m 0 12 l 5 -8`, ...lineBase, 'stroke-width': 1 }, rasenVis);
      }
      addTechLabel(rasenVis, 110, GND - 20, 'Rasen');
      const rasenHit = svgEl('rect', { x: 50, y: GND - 30, width: 120, height: 50, fill: 'transparent' }, hitLayer);
      wireZone(rasenHit, rasenVis, 'Grundstück', 'Rasen', onSelect, onDrop);
  
      // Zufahrt
      const zufahrtVis = svgEl('g', {}, artLayer);
      svgEl('path', { d: `M 1000 ${GND} l 150 0 l 0 40 l -150 0`, ...lineDashed }, zufahrtVis);
      addTechLabel(zufahrtVis, 1075, GND + 60, 'Zufahrt');
      const zufahrtHit = svgEl('rect', { x: 990, y: GND - 10, width: 170, height: 80, fill: 'transparent' }, hitLayer);
      wireZone(zufahrtHit, zufahrtVis, 'Grundstück', 'Zufahrt', onSelect, onDrop);
  
      // Zaun (Links & Rechts)
      const zaunVis = svgEl('g', {}, artLayer);
      const drawFence = (x) => {
        svgEl('line', { x1: x, y1: GND, x2: x, y2: GND - 120, ...lineBase, 'stroke-width': 3 }, zaunVis);
        for(let i=1; i<=5; i++) {
          svgEl('line', { x1: x-10, y1: GND - i*20, x2: x+10, y2: GND - i*20, ...lineBase, 'stroke-width': 1 }, zaunVis);
          svgEl('line', { x1: x-10, y1: GND - i*20, x2: x+10, y2: GND - i*20 - 10, ...lineBase, 'stroke-width': 0.5 }, zaunVis);
        }
      };
      drawFence(40); drawFence(1160);
      addTechLabel(zaunVis, 70, GND - 140, 'Zaun');
      const zaunHit1 = svgEl('rect', { x: 20, y: GND - 130, width: 40, height: 140, fill: 'transparent' }, hitLayer);
      const zaunHit2 = svgEl('rect', { x: 1140, y: GND - 130, width: 40, height: 140, fill: 'transparent' }, hitLayer);
      wireZone(zaunHit1, zaunVis, 'Grundstück', 'Zaun', onSelect, onDrop);
      zaunHit2.addEventListener('click', (e) => zaunHit1.dispatchEvent(new MouseEvent('click', e)));
  
      /* ==========================================
         KABINE (Gebäude)
         ========================================== */
      const kX = 250, kW = 220, kY = GND - 160, kH = 160;
  
      // Keller
      const kellerVis = svgEl('g', {}, artLayer);
      svgEl('rect', { x: kX, y: GND, width: kW, height: 100, ...shapeDashed }, kellerVis);
      addTechLabel(kellerVis, kX + kW/2, GND + 50, 'Keller');
      const kellerHit = svgEl('rect', { x: kX, y: GND, width: kW, height: 100, fill: 'transparent' }, hitLayer);
      wireZone(kellerHit, kellerVis, 'Kabine', 'Keller', onSelect, onDrop);
  
      // Sendersaal
      const saalVis = svgEl('g', {}, artLayer);
      svgEl('rect', { x: kX, y: kY, width: kW, height: kH, ...shapeBase, 'stroke-width': 3 }, saalVis);
      // Tür
      svgEl('rect', { x: kX + 30, y: GND - 110, width: 50, height: 110, ...lineBase }, saalVis);
      svgEl('circle', { cx: kX + 70, cy: GND - 55, r: 3, ...lineBase }, saalVis);
      // Lüftung
      svgEl('rect', { x: kX + 110, y: kY + 30, width: 70, height: 40, ...lineBase }, saalVis);
      for(let i=1; i<5; i++) svgEl('line', { x1: kX + 110, y1: kY + 30 + i*8, x2: kX + 180, y2: kY + 30 + i*8, ...lineBase, 'stroke-width': 1 }, saalVis);
      addTechLabel(saalVis, kX + kW/2, kY + 80, 'Sendersaal');
      const saalHit = svgEl('rect', { x: kX, y: kY, width: kW, height: kH, fill: 'transparent' }, hitLayer);
      wireZone(saalHit, saalVis, 'Kabine', 'Sendersaal', onSelect, onDrop);
  
      // Dach
      const dachVis = svgEl('g', {}, artLayer);
      svgEl('path', { d: `M ${kX-10} ${kY} l ${kW+20} 0 l 0 -15 l ${-kW-20} 0 Z`, ...shapeBase, 'stroke-width': 2 }, dachVis);
      addTechLabel(dachVis, kX + kW/2, kY - 25, 'Dach');
      const dachHit = svgEl('rect', { x: kX-20, y: kY-25, width: kW+40, height: 35, fill: 'transparent' }, hitLayer);
      wireZone(dachHit, dachVis, 'Kabine', 'Dach', onSelect, onDrop);
  
      /* ==========================================
         ENERGIETECHNIK
         ========================================== */
      // Trafo
      const trafoVis = svgEl('g', {}, artLayer);
      const tX = 510, tW = 60, tH = 80;
      svgEl('rect', { x: tX, y: GND - tH, width: tW, height: tH, ...shapeBase }, trafoVis);
      for(let i=1; i<=4; i++) svgEl('line', { x1: tX + i*12, y1: GND - tH + 10, x2: tX + i*12, y2: GND - 10, ...lineBase, 'stroke-width': 1 }, trafoVis);
      // Isolatoren
      svgEl('path', { d: `M ${tX+15} ${GND-tH} l 0 -15 m -5 5 l 10 0 m -10 5 l 10 0`, ...lineBase }, trafoVis);
      svgEl('path', { d: `M ${tX+45} ${GND-tH} l 0 -15 m -5 5 l 10 0 m -10 5 l 10 0`, ...lineBase }, trafoVis);
      addTechLabel(trafoVis, tX + tW/2, GND - tH - 30, 'Trafo');
      const trafoHit = svgEl('rect', { x: tX-10, y: GND-tH-20, width: tW+20, height: tH+20, fill: 'transparent' }, hitLayer);
      wireZone(trafoHit, trafoVis, 'Energietechnik', 'Trafo', onSelect, onDrop);
  
      // NEA
      const neaVis = svgEl('g', {}, artLayer);
      const nX = 600, nW = 80, nH = 65;
      svgEl('rect', { x: nX, y: GND - nH, width: nW, height: nH, ...shapeBase }, neaVis);
      svgEl('rect', { x: nX + 10, y: GND - nH + 15, width: 40, height: 35, ...lineBase, 'stroke-width': 1 }, neaVis);
      // Auspuff
      svgEl('path', { d: `M ${nX+nW-10} ${GND-nH} l 0 -40 a 10 10 0 0 1 10 -10 l 10 0`, ...lineBase, 'stroke-width': 3 }, neaVis);
      addTechLabel(neaVis, nX + nW/2, GND - nH - 60, 'NEA');
      const neaHit = svgEl('rect', { x: nX-10, y: GND-nH-50, width: nW+40, height: nH+50, fill: 'transparent' }, hitLayer);
      wireZone(neaHit, neaVis, 'Energietechnik', 'NEA', onSelect, onDrop);
  
      // EvT / ZAS (An der Kabinenwand)
      const evtVis = svgEl('g', {}, artLayer);
      svgEl('rect', { x: kX + kW, y: GND - 120, width: 20, height: 35, ...shapeBase }, evtVis);
      addTechLabel(evtVis, kX + kW + 30, GND - 130, 'EvT');
      const evtHit = svgEl('rect', { x: kX+kW, y: GND-125, width: 40, height: 45, fill: 'transparent' }, hitLayer);
      wireZone(evtHit, evtVis, 'Energietechnik', 'Evt', onSelect, onDrop);
  
      const zasVis = svgEl('g', {}, artLayer);
      svgEl('rect', { x: kX + kW, y: GND - 60, width: 20, height: 35, ...shapeBase }, zasVis);
      svgEl('circle', { cx: kX + kW + 10, cy: GND - 45, r: 4, ...lineBase }, zasVis);
      addTechLabel(zasVis, kX + kW + 30, GND - 70, 'ZAS');
      const zasHit = svgEl('rect', { x: kX+kW, y: GND-65, width: 40, height: 45, fill: 'transparent' }, hitLayer);
      wireZone(zasHit, zasVis, 'Energietechnik', 'ZAS', onSelect, onDrop);
  
      /* ==========================================
         MAST (Gittermast / Lattice Tower)
         ========================================== */
      const mX = 880; 
      const mastH = 480;
      const mastTopY = GND - mastH;
      const baseW = 160;
      const topW = 40;
  
      // Fundament
      const fundVis = svgEl('g', {}, artLayer);
      svgEl('rect', { x: mX - baseW/2 - 20, y: GND, width: baseW + 40, height: 60, ...shapeDashed }, fundVis);
      addTechLabel(fundVis, mX, GND + 85, 'Fundament');
      const fundHit = svgEl('rect', { x: mX - baseW/2 - 20, y: GND, width: baseW + 40, height: 80, fill: 'transparent' }, hitLayer);
      wireZone(fundHit, fundVis, 'Mast', 'Fundament', onSelect, onDrop);
  
      // Mast Struktur (Gittermast)
      const mastVis = svgEl('g', {}, artLayer);
      const segments = 10;
      
      // Beine
      const legL = `M ${mX - baseW/2} ${GND} L ${mX - topW/2} ${mastTopY}`;
      const legR = `M ${mX + baseW/2} ${GND} L ${mX + topW/2} ${mastTopY}`;
      svgEl('path', { d: `${legL} ${legR}`, ...lineBase, 'stroke-width': 4 }, mastVis);
  
      // Verstrebungen berechnen
      let pointsL = [], pointsR = [];
      for(let i=0; i<=segments; i++) {
        let t = i / segments;
        let y = GND - (t * mastH);
        let w = baseW - (t * (baseW - topW));
        pointsL.push({x: mX - w/2, y: y});
        pointsR.push({x: mX + w/2, y: y});
      }
  
      let latticePath = '';
      for(let i=0; i<segments; i++) {
        // Horizontale
        latticePath += `M ${pointsL[i].x} ${pointsL[i].y} L ${pointsR[i].x} ${pointsR[i].y} `;
        // X-Diagonale
        latticePath += `M ${pointsL[i].x} ${pointsL[i].y} L ${pointsR[i+1].x} ${pointsR[i+1].y} `;
        latticePath += `M ${pointsR[i].x} ${pointsR[i].y} L ${pointsL[i+1].x} ${pointsL[i+1].y} `;
      }
      // Top horizontal
      latticePath += `M ${pointsL[segments].x} ${pointsL[segments].y} L ${pointsR[segments].x} ${pointsR[segments].y}`;
      
      svgEl('path', { d: latticePath, ...lineBase, 'stroke-width': 1.5 }, mastVis);
      // Spitze
      svgEl('rect', { x: mX - 5, y: mastTopY - 40, width: 10, height: 40, ...shapeBase, 'stroke-width': 3 }, mastVis);
  
      addTechLabel(mastVis, mX + 120, GND - 200, 'Mast');
      const mastHit = svgEl('polygon', { 
        points: `${mX-baseW/2-20},${GND} ${mX+baseW/2+20},${GND} ${mX+topW/2+20},${mastTopY-40} ${mX-topW/2-20},${mastTopY-40}`, 
        fill: 'transparent' 
      }, hitLayer);
      wireZone(mastHit, mastVis, 'Mast', 'Mast', onSelect, onDrop);
  
      // Steigweg (Leiter, exakt mittig an den Querträgern befestigt)
      const steigVis = svgEl('g', {}, artLayer);
      const ladderW = 12;
      const ladderL = mX - ladderW/2;
      const ladderR = mX + ladderW/2;
      
      // Holme (weißer Hintergrund, um Gittermast dahinter leicht zu verdecken für Lesbarkeit)
      svgEl('rect', { x: ladderL, y: mastTopY, width: ladderW, height: mastH, fill: BG_FILL, stroke: 'none' }, steigVis);
      svgEl('line', { x1: ladderL, y1: GND, x2: ladderL, y2: mastTopY, ...lineBase, 'stroke-width': 1.5 }, steigVis);
      svgEl('line', { x1: ladderR, y1: GND, x2: ladderR, y2: mastTopY, ...lineBase, 'stroke-width': 1.5 }, steigVis);
      
      // Sprossen
      let sprossenPath = '';
      for(let y = GND - 10; y > mastTopY; y -= 8) {
        sprossenPath += `M ${ladderL} ${y} L ${ladderR} ${y} `;
      }
      svgEl('path', { d: sprossenPath, ...lineBase, 'stroke-width': 1 }, steigVis);
  
      // Rückenschutz (Käfig-Bögen von der Seite angedeutet)
      let cagePath = '';
      for(let y = GND - 50; y > mastTopY + 20; y -= 40) {
        cagePath += `M ${ladderR} ${y} A 12 12 0 0 1 ${ladderR} ${y-20} `;
      }
      // Vertikale Streben des Käfigs
      svgEl('line', { x1: ladderR + 12, y1: GND - 50, x2: ladderR + 12, y2: mastTopY + 20, ...lineBase, 'stroke-width': 0.5 }, steigVis);
      svgEl('path', { d: cagePath, ...lineBase, 'stroke-width': 1 }, steigVis);
  
      addTechLabel(steigVis, mX + 50, GND - 100, 'Steigweg');
      const steigHit = svgEl('rect', { x: ladderL - 10, y: mastTopY, width: 40, height: mastH, fill: 'transparent' }, hitLayer);
      wireZone(steigHit, steigVis, 'Mast', 'Steigweg', onSelect, onDrop);
  
      // Kabeltrasse (Brücke vom Kabinendach zum Mast, dann am Mast hoch)
      const kabelVis = svgEl('g', {}, artLayer);
      const trasseY = kY - 30; // Höhe der Brücke
      const mastAttachX = mX - (baseW - (1 - trasseY/GND)*(baseW-topW))/2 + 15; // Ungefähre linke Kante Mast auf der Höhe
      
      // Brücke
      svgEl('path', { d: `M ${kX + kW/2} ${kY} L ${kX + kW/2} ${trasseY} L ${mastAttachX} ${trasseY}`, ...lineBase, 'stroke-width': 4 }, kabelVis);
      // Trasse am Mast hoch (links der Leiter)
      svgEl('line', { x1: mX - 15, y1: trasseY, x2: mX - 15, y2: mastTopY + 50, ...lineBase, 'stroke-width': 4 }, kabelVis);
      
      addTechLabel(kabelVis, kX + kW + 80, trasseY - 10, 'Kabeltrasse');
      const kabelHit = svgEl('path', { d: `M ${kX + kW/2} ${kY} L ${kX + kW/2} ${trasseY} L ${mX-15} ${trasseY} L ${mX-15} ${mastTopY}`, fill: 'none', stroke: 'transparent', 'stroke-width': 20 }, hitLayer);
      wireZone(kabelHit, kabelVis, 'Mast', 'Kabel', onSelect, onDrop);
  
      // Antennen
      const antVis = svgEl('g', {}, artLayer);
      const antY = mastTopY + 20;
      
      // Halterungen (Ausleger)
      svgEl('line', { x1: mX - 40, y1: antY, x2: mX + 40, y2: antY, ...lineBase, 'stroke-width': 3 }, antVis);
      svgEl('line', { x1: mX - 40, y1: antY + 50, x2: mX + 40, y2: antY + 50, ...lineBase, 'stroke-width': 3 }, antVis);
      
      // Panel-Antennen
      svgEl('rect', { x: mX - 45, y: antY - 10, width: 10, height: 70, ...shapeBase, 'stroke-width': 2 }, antVis);
      svgEl('rect', { x: mX + 35, y: antY - 10, width: 10, height: 70, ...shapeBase, 'stroke-width': 2 }, antVis);
      
      // Richtfunk (Schüssel) unten
      svgEl('line', { x1: mX - 35, y1: antY + 100, x2: mX, y2: antY + 100, ...lineBase, 'stroke-width': 3 }, antVis);
      svgEl('path', { d: `M ${mX-35} ${antY+80} Q ${mX-45} ${antY+100} ${mX-35} ${antY+120}`, ...lineBase, 'stroke-width': 3 }, antVis);
  
      addTechLabel(antVis, mX - 80, antY + 30, 'Antennen');
      const antHit = svgEl('rect', { x: mX - 60, y: antY - 30, width: 120, height: 180, fill: 'transparent' }, hitLayer);
      wireZone(antHit, antVis, 'Mast', 'Antennen', onSelect, onDrop);
  
      // Flugwarnbefeuerung
      const beaconVis = svgEl('g', {}, artLayer);
      svgEl('rect', { x: mX - 6, y: mastTopY - 45, width: 12, height: 10, ...shapeBase, 'stroke-width': 2 }, beaconVis);
      svgEl('line', { x1: mX, y1: mastTopY - 40, x2: mX, y2: mastTopY - 35, ...lineBase }, beaconVis); // Strahlen
      svgEl('line', { x1: mX-8, y1: mastTopY - 40, x2: mX-12, y2: mastTopY - 40, ...lineBase }, beaconVis);
      svgEl('line', { x1: mX+8, y1: mastTopY - 40, x2: mX+12, y2: mastTopY - 40, ...lineBase }, beaconVis);
      
      addTechLabel(beaconVis, mX + 60, mastTopY - 40, 'Flugwarn');
      const beaconHit = svgEl('rect', { x: mX - 20, y: mastTopY - 60, width: 40, height: 30, fill: 'transparent' }, hitLayer);
      wireZone(beaconHit, beaconVis, 'Mast', 'Flugwarnbefeuerung', onSelect, onDrop);
  
      // Pandunen (nur angedeutet, da CAD Stil, oft abgeschnitten oder an Ankerpunkten)
      const panVis = svgEl('g', {}, artLayer);
      const pY = GND - 250;
      const pW = baseW - (250/mastH)*(baseW-topW);
      // Seile (gestrichelt)
      svgEl('line', { x1: mX - pW/2, y1: pY, x2: mX - 250, y2: GND, ...lineDashed, 'stroke-width': 1.5 }, panVis);
      svgEl('line', { x1: mX + pW/2, y1: pY, x2: mX + 250, y2: GND, ...lineDashed, 'stroke-width': 1.5 }, panVis);
      // Anker (Betonblöcke im Boden)
      svgEl('polygon', { points: `${mX-260},${GND} ${mX-240},${GND} ${mX-250},${GND-10}`, ...shapeBase }, panVis);
      svgEl('polygon', { points: `${mX+240},${GND} ${mX+260},${GND} ${mX+250},${GND-10}`, ...shapeBase }, panVis);
  
      addTechLabel(panVis, mX - 180, pY + 80, 'Pandunen');
      const panHit = svgEl('path', { d: `M ${mX-pW/2} ${pY} L ${mX-250} ${GND} L ${mX+250} ${GND} L ${mX+pW/2} ${pY} Z`, fill: 'transparent' }, hitLayer);
      wireZone(panHit, panVis, 'Mast', 'Pandunen', onSelect, onDrop);
    };
  
  })();