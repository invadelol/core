import { reactive } from 'vue'
import { compact } from './format.js'
import { token } from './theme.js'

/**
 * Chart.js paints to a canvas, so it cannot read a CSS variable the way the
 * rest of the app does. The tokens are resolved once here and refreshed
 * whenever the theme changes, which keeps a single palette for the whole
 * product rather than a second, hard-coded one for charts.
 */
export const palette = reactive({
  ink: '#0c0c14',
  ink2: '#4a4a5c',
  ink3: '#77778a',
  ink4: '#a8a8b8',
  line: '#e7e7ee',
  line2: '#dcdce5',
  surface: '#ffffff',
  accent: '#5a4bf0',
  accentFill: 'rgb(90 75 240 / 0.1)',
  win: '#1f6fe0',
  loss: '#d42f4b',
  blue: '#1f6fe0',
  red: '#d42f4b',
  gold: '#9a6d0f',
  muted: '#77778a',
})

export function refreshPalette() {
  palette.ink = token('--color-ink', palette.ink)
  palette.ink2 = token('--color-ink-2', palette.ink2)
  palette.ink3 = token('--color-ink-3', palette.ink3)
  palette.ink4 = token('--color-ink-4', palette.ink4)
  palette.line = token('--color-line', palette.line)
  palette.line2 = token('--color-line-2', palette.line2)
  palette.surface = token('--color-solid', palette.surface)
  palette.accent = token('--color-brand', palette.accent)
  palette.accentFill = `rgb(${token('--brand-rgb', '90 75 240')} / 0.1)`
  palette.win = token('--color-win', palette.win)
  palette.loss = token('--color-loss', palette.loss)
  palette.blue = token('--color-blue', palette.blue)
  palette.red = token('--color-red', palette.red)
  palette.gold = token('--color-gold', palette.gold)
  palette.muted = token('--color-ink-3', palette.muted)
}

let watching = false

/** Called once from the app entry; idempotent. */
export function watchPalette() {
  if (watching || typeof document === 'undefined') return
  watching = true
  refreshPalette()
  new MutationObserver(refreshPalette).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', refreshPalette)
}

/** Kept for call sites that want a named series colour. */
export const CHART_COLORS = palette

const AXIS_FONT = { size: 11, weight: 500 as const, family: 'Archivo, Inter, sans-serif' }

/** Tooltips are popovers: opaque surface, a hairline border, 12px text. */
function tooltipStyle() {
  return {
    backgroundColor: palette.surface,
    titleColor: palette.ink,
    bodyColor: palette.ink2,
    borderColor: palette.line2,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    displayColors: false,
    titleFont: { size: 12, weight: 600 as const, family: AXIS_FONT.family },
    bodyFont: { size: 12, family: AXIS_FONT.family },
  }
}

/**
 * Shared line-chart options: no legend (series are labelled in the markup),
 * hairline horizontal grid only, hover across the whole x position.
 */
/**
 * The next round number above `value`. Chart.js picks its own ceiling from the
 * tick count, which on a 41k peak lands at 60k and leaves a third of the plot
 * empty; this keeps the curve filling the box.
 */
export function niceMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1
  // Half-magnitude steps, so a 41k peak reads "45k" rather than "42k".
  const step = 10 ** Math.floor(Math.log10(value)) / 2
  return Math.ceil((value * 1.02) / step) * step
}

export function lineOptions(
  overrides: {
    yFormat?: (value: number) => string
    yTicks?: number
    xTicks?: number
    yMax?: number
    hideY?: boolean
    hideX?: boolean
    tooltipLabel?: (ctx: any) => string | string[]
    tooltipTitle?: (items: any[]) => string
  } = {}
) {
  const yFormat = overrides.yFormat ?? compact
  const axis = {
    ticks: { font: AXIS_FONT, color: palette.ink3, padding: 6 },
    border: { display: false },
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    animation: { duration: 240 },
    /* Straight segments: a smoothed line invents values between games. */
    elements: { line: { tension: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle(),
        callbacks: {
          ...(overrides.tooltipTitle ? { title: overrides.tooltipTitle } : {}),
          label:
            overrides.tooltipLabel ??
            ((ctx: any) => `${ctx.dataset.label}: ${yFormat(ctx.parsed.y)}`),
        },
      },
    },
    scales: {
      x: {
        ...axis,
        display: !overrides.hideX,
        ticks: { ...axis.ticks, maxTicksLimit: overrides.xTicks ?? 6, maxRotation: 0 },
        grid: { display: false },
      },
      y: {
        ...axis,
        display: !overrides.hideY,
        ...(overrides.yMax === undefined ? {} : { max: overrides.yMax }),
        ticks: {
          ...axis.ticks,
          maxTicksLimit: overrides.yTicks ?? 4,
          callback: (v: any) => yFormat(Number(v)),
        },
        grid: { color: palette.line, drawTicks: false },
      },
    },
  }
}

/** Horizontal bars, used for per-player comparisons inside one lobby. */
export function barOptions(yFormat: (value: number) => string = compact) {
  const axis = {
    ticks: { font: AXIS_FONT, color: palette.ink3, padding: 6 },
    border: { display: false },
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    animation: { duration: 320 },
    plugins: {
      legend: { display: false },
      tooltip: { ...tooltipStyle(), callbacks: { label: (ctx: any) => yFormat(ctx.parsed.x) } },
    },
    scales: {
      x: {
        ...axis,
        ticks: { ...axis.ticks, maxTicksLimit: 4, callback: (v: any) => yFormat(Number(v)) },
        grid: { color: palette.line, drawTicks: false },
      },
      y: { ...axis, ticks: { ...axis.ticks, color: palette.ink2 }, grid: { display: false } },
    },
  }
}

/** A soft fill under a line, matching the line's colour. */
export function areaFill(color: string) {
  return `color-mix(in srgb, ${color} 14%, transparent)`
}
