/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Rust+ inspired dark palette (see CLAUDE.md > Design)
        'rust-bg': '#1a1a1a',
        'rust-card': '#252525',
        'rust-accent': '#cd4a22',
      },
    },
  },
  plugins: [],
}
