/** Mirrors `DESKTOP_PLATFORMS` in `app/services/desktop_release.ts`, which serves `/download/:id`. */
export type DesktopPlatform = 'windows' | 'mac-arm' | 'mac-intel'

export interface DesktopTarget {
  id: DesktopPlatform
  label: string
}

export const DESKTOP_TARGETS: DesktopTarget[] = [
  { id: 'windows', label: 'Windows' },
  { id: 'mac-arm', label: 'macOS (Apple Silicon)' },
  { id: 'mac-intel', label: 'macOS (Intel)' },
]

export const targetLabel = (id: DesktopPlatform) => DESKTOP_TARGETS.find((t) => t.id === id)!.label

interface NavigatorWithHints extends Navigator {
  userAgentData?: {
    platform?: string
    mobile?: boolean
    getHighEntropyValues(hints: string[]): Promise<{ architecture?: string }>
  }
}

/** True on Apple Silicon when the GPU name says so. Safari reports "Apple GPU" on every Mac. */
function gpuIsIntel(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    return /intel|amd|radeon/i.test(renderer) && !/apple/i.test(renderer)
  } catch {
    return false
  }
}

/**
 * The installer that fits this browser's computer, or null when the app does not run here
 * (phones, tablets, Linux). Browsers only reveal a Mac's chip in some cases, so a Mac is
 * treated as Apple Silicon unless something says Intel: every Mac sold since late 2020 is.
 */
export async function detectDesktopTarget(): Promise<DesktopPlatform | null> {
  const nav = navigator as NavigatorWithHints
  const hinted = nav.userAgentData?.platform
  const ua = navigator.userAgent
  if (nav.userAgentData?.mobile || /android|iphone|ipad|ipod|cros/i.test(ua)) return null
  const platform = hinted || navigator.platform || ua
  if (/win/i.test(platform)) return 'windows'
  if (!/mac/i.test(platform)) return null
  // iPadOS pretends to be a Mac; a real one has no touch screen.
  if (navigator.maxTouchPoints > 1) return null

  try {
    const { architecture } = (await nav.userAgentData?.getHighEntropyValues(['architecture'])) ?? {}
    if (architecture) return architecture === 'arm' ? 'mac-arm' : 'mac-intel'
  } catch {
    /* fall through to the GPU hint */
  }
  return gpuIsIntel() ? 'mac-intel' : 'mac-arm'
}
