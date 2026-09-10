import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { compact } from './format.js'

let registered = false

/** Registers the chart.js pieces every chart in the app relies on. */
export function useChartJs() {
  if (registered) return
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Filler,
    Tooltip,
    Legend
  )
  registered = true
}

export const CHART_COLORS = {
  ink: '#16181d',
  win: '#2f66cc',
  loss: '#cf5050',
  gold: '#9c7420',
  pos: '#1d7d5c',
  muted: '#9aa0aa',
}

const tooltip = {
  backgroundColor: '#16181d',
  titleColor: '#ffffff',
  bodyColor: '#d7d9de',
  borderWidth: 0,
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
  titleFont: { size: 11, weight: 600 as const },
  bodyFont: { size: 11 },
}

const axis = {
  ticks: { font: { size: 10 }, color: '#9aa0aa', padding: 6 },
  border: { display: false },
}

/**
 * Shared line-chart options: no legend (series are labelled in the markup),
 * hairline horizontal grid only, hover across the whole x position.
 */
export function lineOptions(
  overrides: {
    yFormat?: (value: number) => string
    yTicks?: number
    xTicks?: number
    tooltipLabel?: (ctx: any) => string | string[]
    tooltipTitle?: (items: any[]) => string
  } = {}
) {
  const yFormat = overrides.yFormat ?? compact
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip,
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
        ticks: { ...axis.ticks, maxTicksLimit: overrides.xTicks ?? 6, maxRotation: 0 },
        grid: { display: false },
      },
      y: {
        ...axis,
        ticks: {
          ...axis.ticks,
          maxTicksLimit: overrides.yTicks ?? 4,
          callback: (v: any) => yFormat(Number(v)),
        },
        grid: { color: '#f3f3f6', drawTicks: false },
      },
    },
  }
}

/** Horizontal bars, used for per-player comparisons inside one lobby. */
export function barOptions(yFormat: (value: number) => string = compact) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip,
        callbacks: { label: (ctx: any) => yFormat(ctx.parsed.x) },
      },
    },
    scales: {
      x: {
        ...axis,
        ticks: { ...axis.ticks, maxTicksLimit: 4, callback: (v: any) => yFormat(Number(v)) },
        grid: { color: '#f3f3f6', drawTicks: false },
      },
      y: {
        ...axis,
        ticks: { ...axis.ticks, color: '#5f636c' },
        grid: { display: false },
      },
    },
  }
}

/** A soft fill under a line, matching the line's colour. */
export function areaFill(color: string) {
  return `${color}14`
}
