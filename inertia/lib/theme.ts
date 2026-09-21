import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEME_KEY = 'invade-theme'

/**
 * Module-level so every toggle on the page agrees, and so a theme
 * change costs one attribute write rather than a re-render.
 */
const choice = ref<ThemeChoice>('system')
const systemDark = ref(false)
let started = false

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* private mode, blocked storage: the system preference still works */
  }
  return 'system'
}

function paint(value: ThemeChoice) {
  const root = document.documentElement
  if (value === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', value)
}

export function useTheme() {
  const media =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null

  function sync() {
    systemDark.value = Boolean(media?.matches)
  }

  onMounted(() => {
    if (!started) {
      started = true
      choice.value = read()
      paint(choice.value)
    }
    sync()
    media?.addEventListener('change', sync)
  })

  onBeforeUnmount(() => media?.removeEventListener('change', sync))

  const resolved = computed<'light' | 'dark'>(() =>
    choice.value === 'system' ? (systemDark.value ? 'dark' : 'light') : choice.value
  )

  function setTheme(value: ThemeChoice) {
    choice.value = value
    paint(value)
    try {
      localStorage.setItem(THEME_KEY, value)
    } catch {
      /* the attribute is already applied; persistence is a bonus */
    }
  }

  /** Light → dark → light, ignoring "system" once someone has chosen. */
  function toggle() {
    setTheme(resolved.value === 'dark' ? 'light' : 'dark')
  }

  return { choice, resolved, setTheme, toggle }
}

/**
 * Reads a themed token at runtime. Chart.js draws to a canvas and so
 * cannot use CSS variables; it asks for the computed value instead.
 */
export function token(name: string, fallback = '#000') {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}
