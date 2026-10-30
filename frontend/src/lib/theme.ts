// Light or dark: follows the OS until the student picks one, then remembers it on this device.

type Theme = 'light' | 'dark'
const KEY = 'cc.theme'

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function getTheme(): Theme {
  return stored() ?? (media?.matches ? 'dark' : 'light')
}

function apply() {
  document.documentElement.dataset.theme = getTheme()
}

export function initTheme() {
  apply()
  media?.addEventListener('change', apply)
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // not remembered, still applied
  }
  apply()
  return next
}
