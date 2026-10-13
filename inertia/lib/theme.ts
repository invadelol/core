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

function stored(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    /* private mode, blocked storage: the system preference still works */
  }
  return null
}

function read(): ThemeChoice {
  return stored() ?? 'system'
}

/** The browser's own bars (a phone's status bar, Safari's toolbar) in the header's ink. */
const BAR = { light: '#ffffff', dark: '#08090c' }

/** The package's tokens read `data-theme`: `system` follows the system's preference. */
function paint(value: ThemeChoice) {
  document.documentElement.setAttribute('data-theme', value)
  // A chosen theme holds for both of the head's colour-scheme variants; `system` restores them.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = BAR[value === 'system' ? scheme : value]
  })
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
 * A page that is dark unless the visitor chose otherwise (the desktop app's page, like the app).
 * The layout's first-paint script does the same for a direct visit; leaving the page restores
 * the system's theme. A choice made on the page is stored as usual.
 */
export function useDarkByDefault() {
  onMounted(() => {
    if (stored()) return
    choice.value = 'dark'
    paint('dark')
  })
  onBeforeUnmount(() => {
    if (stored()) return
    choice.value = 'system'
    paint('system')
  })
}
