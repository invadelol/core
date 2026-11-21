import { ref, computed, onMounted } from 'vue'
import { afterPaint } from './after_paint.js'

export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEME_KEY = 'invade-theme'

/**
 * Module-level so every toggle on the page agrees, and so a theme
 * change costs one attribute write rather than a re-render.
 */
const choice = ref<ThemeChoice>('dark')
const systemDark = ref(false)
let started = false

function read(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* private mode, blocked storage: the default theme still works */
  }
  // Dark is the reference look: a visitor who never chose gets it, whatever their system says.
  return 'dark'
}

/** The browser's own bars (a phone's status bar, Safari's toolbar) in the header's ink. */
const BAR = { light: '#ffffff', dark: '#08070d' }

function media() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
}

/**
 * `data-theme` on <html> only ever says `dark` or `light`: Auto is resolved here, from the
 * device's preference, and again whenever the device switches. A stylesheet then never needs a
 * block of its own for Auto (several had none, so Auto on a dark device lost the sheets' and the
 * search list's backgrounds). The choice itself sits beside it, in `data-theme-choice`.
 */
function paint(value: ThemeChoice) {
  const root = document.documentElement
  const on = value === 'system' ? (media()?.matches ? 'dark' : 'light') : value
  root.setAttribute('data-theme', on)
  root.setAttribute('data-theme-choice', value)
  // A chosen theme holds for both of the head's colour-scheme variants; `system` restores them.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = BAR[value === 'system' ? scheme : value]
  })
}

/** Once per page load: the stored choice, and the device's switches while it is Auto. */
function start() {
  if (started || typeof window === 'undefined') return
  started = true
  choice.value = read()
  paint(choice.value)
  const query = media()
  systemDark.value = Boolean(query?.matches)
  query?.addEventListener('change', (event) => {
    systemDark.value = event.matches
    if (choice.value === 'system') paint('system')
  })
}

export function useTheme() {
  onMounted(start)

  const resolved = computed<'light' | 'dark'>(() =>
    choice.value === 'system' ? (systemDark.value ? 'dark' : 'light') : choice.value
  )

  function setTheme(value: ThemeChoice) {
    choice.value = value
    // The button's icon turns in this frame; the whole page restyles in the next.
    afterPaint(() => choice.value === value && paint(value))
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
