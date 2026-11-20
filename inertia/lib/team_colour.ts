import { onMounted, ref, watch } from 'vue'
import { teamLogo } from './board.js'

/**
 * A team's colour, read in the browser from its logo (served by our own /cdn, so the canvas may
 * read it): the hue most of its coloured pixels share, as an `r g b` triple for `rgb(… / a)`. A
 * logo without colour (black, white, greys) gives null, and the page keeps its violet.
 */
export function useTeamColour(team: () => string | null | undefined) {
  const rgb = ref<string | null>(null)
  onMounted(() =>
    watch(
      team,
      (id) => {
        rgb.value = null
        if (id) void read(id).then((c) => team() === id && (rgb.value = c))
      },
      { immediate: true }
    )
  )
  return rgb
}

const read = (() => {
  const known = new Map<string, Promise<string | null>>()
  return (id: string) => {
    let colour = known.get(id)
    if (!colour) {
      colour = new Promise((resolve) => {
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => resolve(dominant(img))
        img.onerror = () => resolve(null)
        img.src = teamLogo(id, 56)
      })
      known.set(id, colour)
    }
    return colour
  }
})()

/** 24 hue bins of 15°: the fullest one's mean colour, when colour covers enough of the logo. */
function dominant(img: HTMLImageElement): string | null {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, size, size)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    return null
  }
  const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }))
  let solid = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255
    if (a < 0.6) continue
    solid++
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const chroma = (max - min) / 255
    const light = (max + min) / 510
    if (chroma < 0.22 || light < 0.12 || light > 0.9) continue
    const d = max - min
    const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    const bin = bins[Math.min(23, Math.floor(h * 4))]
    const w = a * chroma
    bin.w += w
    bin.r += r * w
    bin.g += g * w
    bin.b += b * w
  }
  const best = bins.reduce((x, y) => (y.w > x.w ? y : x))
  if (!solid || best.w < solid * 0.05) return null
  return [best.r, best.g, best.b].map((c) => Math.round(c / best.w)).join(' ')
}
