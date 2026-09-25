export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-app': 'var(--bg-app)',
        'bg-panel': 'var(--bg-panel)',
        'bg-header': 'var(--bg-header)',
        'bg-active': 'var(--bg-active)',
        border: 'var(--border)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        primary: 'var(--primary)',
        'accent-green': 'var(--accent-green)',
        'accent-red': 'var(--accent-red)',
        'accent-blue': 'var(--accent-blue)',
        'accent-orange': 'var(--accent-orange)',
        'success-bg': 'var(--success-bg)',
        'success-text': 'var(--success-text)',
        warning: 'var(--warning)',
        'warning-bg': 'var(--warning-bg)',
        'warning-text': 'var(--warning-text)',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
};
