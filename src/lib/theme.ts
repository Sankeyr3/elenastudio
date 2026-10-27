export const THEMES = ['light', 'dark', 'funky', 'twilight', 'solarized', 'night'] as const
export type Theme = (typeof THEMES)[number]

const KEY = 'theme'

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (THEMES.includes(saved as Theme)) return saved as Theme
  } catch {
    // sin almacenamiento: tema por defecto
  }
  return 'light'
}

/** Aplica el tema al documento (y a la barra del navegador en móvil) y lo recuerda. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--color-paper').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper || '#ffffff')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // no pasa nada si no se puede guardar
  }
}
