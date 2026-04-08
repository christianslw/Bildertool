tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { sans: ['Segoe UI', 'system-ui', 'sans-serif'] },
            colors: { oled: '#000000', zinc: { 900: '#18181b', 950: '#09090b' } }
        }
    }
};

const colorTheme = localStorage.getItem('colorTheme') || 'standard';
const appearance = localStorage.getItem('appearance') || 'system';
const themeMap = {
    'dracula': 'themes/dracula.css',
    'dracula-laser': 'themes/dracula-laser.css',
    'kirschbluete': 'themes/kirschbluete.css',
    'swr-ms': 'themes/swr-ms.css'
};

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const shouldUseDark = appearance === 'dark' || (appearance === 'system' && prefersDark);

if (shouldUseDark) document.documentElement.classList.add('dark');
else document.documentElement.classList.remove('dark');

Object.keys(themeMap).forEach(themeClass => document.documentElement.classList.remove(themeClass));

if (themeMap[colorTheme]) {
    document.documentElement.classList.add(colorTheme);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'custom-theme-css';
    link.href = themeMap[colorTheme];
    document.head.appendChild(link);
}
