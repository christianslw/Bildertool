#!/usr/bin/env python3
import sys

INFILE = r'c:\Users\b49891\.vscode\projects\Bildertool\index.html'

with open(INFILE, 'r', encoding='utf-8') as f:
    html = f.read()

errors = []

def sub(old, new, label):
    global html
    if old not in html:
        errors.append(f'MISS: {label}')
        return
    html = html.replace(old, new, 1)
    print(f'OK: {label}')

# ── 1. Standort bar — less prominent ─────────────────────────────────────────
sub(
    '            <div class="mb-3">\n'
    '                <!-- Standort Suche -->\n'
    '                <div class="relative">\n'
    '                    <label\n'
    '                        class="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Standort</label>\n'
    '                    <div class="relative flex items-center">\n'
    '                        <svg class="w-4 h-4 absolute left-3 text-slate-400" fill="none" stroke="currentColor"\n'
    '                            viewBox="0 0 24 24">\n'
    '                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"\n'
    '                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>\n'
    '                        </svg>\n'
    '                        <input type="text" id="standortSelect" placeholder="Name oder Nummer suchen..."\n'
    '                            autocomplete="off"\n'
    '                            class="w-full py-1.5 pl-9 pr-8 text-sm bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-md focus:outline-none focus:border-blue-500 transition-colors dark:text-white" />\n'
    '                        <button type="button" id="clearSearchBtn"\n'
    '                            class="absolute right-2 text-slate-400 hover:text-red-500 hidden" title="Suche l\u00f6schen">\n'
    '                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n'
    '                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>\n'
    '                            </svg>\n'
    '                        </button>\n'
    '                    </div>\n'
    '                    <div id="standortDropdown" class="custom-dropdown hidden w-full mt-1"></div>\n'
    '                </div>\n'
    '            </div>',
    '            <div class="mb-2">\n'
    '                <!-- Standort Suche (manuell; normalerweise per GPS automatisch) -->\n'
    '                <div class="relative">\n'
    '                    <label class="block text-[10px] font-medium text-slate-400 dark:text-zinc-500 mb-1">Standort <span class="font-normal italic">\u00b7 optional, wird per GPS erkannt</span></label>\n'
    '                    <div class="relative flex items-center">\n'
    '                        <svg class="w-3.5 h-3.5 absolute left-2.5 text-slate-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n'
    '                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>\n'
    '                        </svg>\n'
    '                        <input type="text" id="standortSelect" placeholder="Name oder Nummer suchen..." autocomplete="off"\n'
    '                            class="w-full py-1 pl-8 pr-8 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded focus:outline-none focus:border-blue-400 transition-colors text-slate-600 dark:text-zinc-300" />\n'
    '                        <button type="button" id="clearSearchBtn"\n'
    '                            class="absolute right-2 text-slate-300 dark:text-zinc-600 hover:text-red-400 hidden" title="Suche l\u00f6schen">\n'
    '                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n'
    '                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>\n'
    '                            </svg>\n'
    '                        </button>\n'
    '                    </div>\n'
    '                    <div id="standortDropdown" class="custom-dropdown hidden w-full mt-1"></div>\n'
    '                </div>\n'
    '            </div>',
    'standort bar'
)

# ── 2. Tab bar — remove addTabBtn ────────────────────────────────────────────
sub(
    '            <!-- Tab Bar -->\n'
    '            <div id="tabBar" class="flex items-center border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-2 pt-1 overflow-x-auto shrink-0 min-h-[38px]">\n'
    '                <!-- Tabs rendered by JS -->\n'
    '                <button id="addTabBtn" title="Neuen Tab \u00f6ffnen"\n'
    '                    class="ml-1 shrink-0 flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-xl font-semibold leading-none">\n'
    '                    +\n'
    '                </button>\n'
    '            </div>',
    '            <!-- Tab Bar -->\n'
    '            <div id="tabBar" class="flex items-center border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-2 pt-1 overflow-x-auto shrink-0 min-h-[38px]">\n'
    '                <!-- Tabs rendered by JS -->\n'
    '            </div>',
    'tab bar'
)

# ── 3. Save button initial text ───────────────────────────────────────────────
sub(
    '                            Speichern unter\n'
    '                        </button>',
    '                            Alle speichern\n'
    '                        </button>',
    'save btn text'
)

# ── 4. Replace folderImportBtn with quickImportBtn + undoBtn + redoBtn ────────
sub(
    '                    <button id="folderImportBtn"\n'
    '                        class="p-1.5 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:border-blue-800 dark:hover:text-blue-400 text-slate-500 dark:text-zinc-400 rounded-md transition-colors"\n'
    '                        title="Ordner importieren">\n'
    '                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n'
    '                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>\n'
    '                        </svg>\n'
    '                    </button>\n'
    '\n'
    '                    <button id="clearAll"',
    '                    <!-- Schnellimport -->\n'
    '                    <button id="quickImportBtn"\n'
    '                        class="p-1.5 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/20 dark:hover:border-blue-800 dark:hover:text-blue-400 text-slate-500 dark:text-zinc-400 rounded-md transition-colors"\n'
    '                        title="Dateien / Ordner importieren (ohne Kategorie)">\n'
    '                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n'
    '                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>\n'
    '                        </svg>\n'
    '                    </button>\n'
    '                    <button id="undoBtn" disabled\n'
    '                        class="p-1.5 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"\n'
    '                        title="R\u00fckg\u00e4ngig (Strg+Z)">\n'
    '                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.7 5.7L3 8"/></svg>\n'
    '                    </button>\n'
    '                    <button id="redoBtn" disabled\n'
    '                        class="p-1.5 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"\n'
    '                        title="Wiederholen (Strg+Y)">\n'
    '                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.3 5.7L21 8"/></svg>\n'
    '                    </button>\n'
    '\n'
    '                    <button id="clearAll"',
    'folder->quick+undo+redo'
)

# ── 5. Save dropdown — rename + remove allTabsExportOption ───────────────────
sub(
    '                            <div id="saveAsMenuOption"\n'
    '                                class="px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-slate-700 dark:text-zinc-200 flex items-center gap-2">\n'
    '                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"\n'
    '                                    stroke-width="2">\n'
    '                                    <path\n'
    '                                        d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z">\n'
    '                                    </path>\n'
    '                                </svg>\n'
    '                                Speichern unter...\n'
    '                            </div>\n'
    '                            <div class="border-t border-slate-100 dark:border-zinc-800 my-1"></div>\n'
    '                            <div id="allTabsExportOption"\n'
    '                                class="px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-slate-700 dark:text-zinc-200 flex items-center gap-2">\n'
    '                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n'
    '                                    <rect x="2" y="3" width="20" height="4" rx="1"/>\n'
    '                                    <rect x="2" y="10" width="20" height="4" rx="1" opacity="0.5"/>\n'
    '                                    <rect x="2" y="17" width="20" height="4" rx="1" opacity="0.25"/>\n'
    '                                    <path d="M19 22l3-3-3-3M22 19H17"/>\n'
    '                                </svg>\n'
    '                                Alle Tabs exportieren\n'
    '                            </div>',
    '                            <div id="saveAsMenuOption"\n'
    '                                class="px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer text-slate-700 dark:text-zinc-200 flex items-center gap-2">\n'
    '                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n'
    '                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>\n'
    '                                </svg>\n'
    '                                Alle speichern unter...\n'
    '                            </div>',
    'save dropdown'
)

# ── 6. Swap view ↔ filter in toolbar right side ───────────────────────────────
view_marker   = '                    <!-- View Dropdown -->'
filter_marker = '                    <!-- Filter / Sort / Group Dropdown -->'

vi = html.find(view_marker)
fi = html.find(filter_marker)
assert vi != -1 and fi != -1 and vi < fi, 'View/filter markers not found or wrong order'

def find_block_end(text, start):
    count = 0
    i = start
    while i < len(text):
        if text[i:i+4] == '<div':
            count += 1
            i += 4
        elif text[i:i+6] == '</div>':
            count -= 1
            if count == 0:
                return i + 6
            i += 6
        else:
            i += 1
    return -1

view_div_start   = html.find('<div class="relative">', vi)
view_div_end     = find_block_end(html, view_div_start)
view_block       = html[view_div_start:view_div_end]

filter_div_start = html.find('<div class="relative">', fi)
filter_div_end   = find_block_end(html, filter_div_start)
filter_block     = html[filter_div_start:filter_div_end]

mid_gap = html[view_div_end:fi]   # text between end of view block and start of filter marker
old_seg = html[vi:filter_div_end]

ws_view   = ''
i = vi - 1
while i >= 0 and html[i] in (' ', '\t'):
    ws_view = html[i] + ws_view; i -= 1

ws_filter = ''
i = fi - 1
while i >= 0 and html[i] in (' ', '\t'):
    ws_filter = html[i] + ws_filter; i -= 1

new_seg = (
    filter_marker + '\n'
    + ws_filter + filter_block
    + mid_gap
    + view_marker + '\n'
    + ws_view + view_block
)

if old_seg in html:
    html = html.replace(old_seg, new_seg, 1)
    print('OK: view/filter swap')
else:
    errors.append('MISS: view/filter swap')

# ── 7. Settings modal — add GPS section ──────────────────────────────────────
sub(
    '                <div class="rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">\n'
    '                    <h4 class="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-3">Kommentar-Vorschl\u00e4ge</h4>',
    '                <div class="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3">\n'
    '                    <h4 class="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-2">Standort-Automatik</h4>\n'
    '                    <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer mb-2 select-none">\n'
    '                        <input type="checkbox" id="autoGpsToggle" checked class="w-4 h-4 accent-blue-600">\n'
    '                        GPS-Standort automatisch zuordnen\n'
    '                    </label>\n'
    '                    <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer select-none">\n'
    '                        <input type="checkbox" id="excludeUnmatchedToggle" class="w-4 h-4 accent-blue-600">\n'
    '                        Bilder ohne Standort ausschlie\u00dfen\n'
    '                    </label>\n'
    '                </div>\n'
    '\n'
    '                <div class="rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">\n'
    '                    <h4 class="text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-3">Kommentar-Vorschl\u00e4ge</h4>',
    'settings GPS section'
)

if errors:
    print('ERRORS:', errors)
    sys.exit(1)

with open(INFILE, 'w', encoding='utf-8') as f:
    f.write(html)
print('\nAll HTML patches applied.')
