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
  ink: '#0e0f13',
  ink2: '#565b69',
  ink3: '#868c9c',
  line: '#e7e7ed',
  surface: '#ffffff',
  accent: '#5b47e0',
  win: '#0d8a63',
  loss: '#d0384f',
  blue: '#2f6fe0',
  red: '#dc5844',
  gold: '#96701a',
  muted: '#868c9c',
})

export function refreshPalette() {
  palette.ink = token('--color-ink', palette.ink)
  palette.ink2 = token('--color-ink-2', palette.ink2)
  palette.ink3 = token('--color-ink-3', palette.ink3)
  palette.line = token('--color-line', palette.line)
  palette.surface = token('--color-panel', palette.surface)
  palette.accent = token('--color-ink', palette.accent)
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

const AXIS_FONT = { size: 10, weight: 500 as const }

function tooltipStyle() {
  return {
    backgroundColor: palette.ink,
    titleColor: palette.surface,
    bodyColor: palette.surface,
    borderWidth: 0,
    padding: 10,
    cornerRadius: 8,
    displayColors: false,
    titleFont: { size: 11, weight: 600 as const },
    bodyFont: { size: 11 },
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
    animation: { duration: 320 },
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
