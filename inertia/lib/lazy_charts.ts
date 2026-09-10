import { defineAsyncComponent } from 'vue'

// Keep Chart.js out of the profile's initial dependency graph.
async function loadCharts() {
  const [charts, { useChartJs }] = await Promise.all([
    import('vue-chartjs'),
    import('./chart_registration.js'),
  ])
  useChartJs()
  return charts
}

export const LineChart = defineAsyncComponent(async () => {
  const charts = await loadCharts()
  return charts.Line
})
export const BarChart = defineAsyncComponent(async () => {
  const charts = await loadCharts()
  return charts.Bar
})
