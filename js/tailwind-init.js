tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
            colors: {
                oled: '#000000',
                zinc: { 900: '#18181b', 950: '#09090b' },
                token: {
                    bg:        'var(--color-bg)',
                    surface:   'var(--color-surface)',
                    border:    'var(--color-border)',
                    accent:    'var(--color-accent)',
                    muted:     'var(--color-text-muted)',
                }
            },
            borderRadius: {
                'token-sm': 'var(--radius-sm)',
                'token-md': 'var(--radius-md)',
                'token-lg': 'var(--radius-lg)',
                'token-xl': 'var(--radius-xl)',
            },
            boxShadow: {
                'token-sm': 'var(--shadow-sm)',
                'token-md': 'var(--shadow-md)',
                'token-lg': 'var(--shadow-lg)',
                'token-xl': 'var(--shadow-xl)',
            },
            transitionTimingFunction: {
                'spring': 'cubic-bezier(0.175,0.885,0.32,1.275)',
            }
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
