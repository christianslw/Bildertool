/** =========================================================================
 * MODUL: GLOBAL STATE & KONFIGURATION
 * Konstanten, reine Hilfsfunktionen, kategoriesConfig-Initialisierung
 * ========================================================================= */
const DEFAULT_SUGGESTIONS = ['Vodafone', 'Telekom', 'O2', '1&1', 'Wartung', 'Umbau', 'Demontage'];
const DEFAULT_CONFIG_FILE_NAME = 'bildertool-config.json';
const DEFAULT_CATEGORY_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
];
const DEFAULT_CUSTOM_CATEGORY_COLOR = '#64748b';
const DEFAULT_CATEGORIES = [
    { id: "Mast", label: "Mast", subcats: ["Pandunen", "Fundament", "Antennen", "Flugwarnbefeuerung", "Steigweg", "Kabel"] },
    { id: "Kabine", label: "Kabine", subcats: ["Keller", "Sendersaal", "Dach"] },
    { id: "Energietechnik", label: "Energietechnik", subcats: ["Trafo", "NEA", "Evt", "ZAS"] },
    { id: "Grundstück", label: "Grundstück", subcats: ["Zaun", "Zisterne", "Zufahrt"] }
];

function normalizeSuggestions(rawSuggestions) {
    if (!Array.isArray(rawSuggestions)) return [...DEFAULT_SUGGESTIONS];
    const cleaned = rawSuggestions
        .map(item => String(item || '').trim())
        .filter(Boolean);
    return [...new Set(cleaned)];
}

function normalizeHexColor(rawColor) {
    const trimmed = String(rawColor || '').trim();
    if (!trimmed) return '';
    const shortMatch = trimmed.match(/^#([0-9a-fA-F]{3})$/);
    if (shortMatch) {
        const [r, g, b] = shortMatch[1].split('');
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    const fullMatch = trimmed.match(/^#([0-9a-fA-F]{6})$/);
    return fullMatch ? trimmed.toLowerCase() : '';
}

function hexToRgb(hexColor) {
    const hex = normalizeHexColor(hexColor);
    if (!hex) return null;
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
    };
}

function normalizeColorList(rawColors = []) {
    if (!Array.isArray(rawColors)) return [];
    const normalized = rawColors
        .map(normalizeHexColor)
        .filter(Boolean)
        .filter(color => !DEFAULT_CATEGORY_COLORS.includes(color));
    return [...new Set(normalized)];
}

function normalizeCategories(rawCategories) {
    if (!Array.isArray(rawCategories) || !rawCategories.length) {
        return DEFAULT_CATEGORIES.map(cat => ({ ...cat, subcats: [...cat.subcats] }));
    }

    return rawCategories
        .map((cat, index) => {
            const label = String(cat?.label || cat?.id || '').trim();
            const id = String(cat?.id || label || `Kategorie-${index + 1}`).trim();
            const subcats = Array.isArray(cat?.subcats)
                ? [...new Set(cat.subcats.map(sub => String(sub || '').trim()).filter(Boolean))]
                : [];
            const color = normalizeHexColor(cat?.color);

            if (!label || !id) return null;
            return { id, label, subcats, color };
        })
        .filter(Boolean);
}

function mergeLegacyCustomSubcats(categories, legacyCustomSubcats) {
    if (!legacyCustomSubcats || typeof legacyCustomSubcats !== 'object') return categories;
    categories.forEach(cat => {
        const extras = Array.isArray(legacyCustomSubcats[cat.id]) ? legacyCustomSubcats[cat.id] : [];
        extras.forEach(sub => {
            const trimmed = String(sub || '').trim();
            if (trimmed && !cat.subcats.includes(trimmed)) cat.subcats.push(trimmed);
        });
    });
    return categories;
}

let categoriesConfig = mergeLegacyCustomSubcats(
    normalizeCategories(JSON.parse(localStorage.getItem('categoriesConfig'))),
    JSON.parse(localStorage.getItem('customSubcats') || '{}')
);

/** =========================================================================
 * GPS HAVERSINE (reine Berechnungsfunktionen)
 * ========================================================================= */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findClosestStandort(lat, lon, maxDistanceKm = 1.0) {
    if (typeof standorteDaten === 'undefined' || !Array.isArray(standorteDaten)) return null;
    let closest = null;
    let minDist = Infinity;
    for (const s of standorteDaten) {
        if (s.lat == null || s.lon == null) continue;
        const d = haversineDistance(lat, lon, s.lat, s.lon);
        if (d < minDist) { minDist = d; closest = s; }
    }
    return (closest && minDist <= maxDistanceKm) ? closest : null;
}
