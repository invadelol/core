<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Link } from '@inertiajs/vue3'
import { champIconUrl } from '../../lib/champions.js'
import { layoutPlot } from '../../lib/plot_layout.js'

/**
 * Win rate against pick rate: each champion its round portrait, at its pick rate (across, on a
 * log scale) and win rate (up). Portraits never cover one another: a crowd spreads around its
 * spot, a hairline back to each true point (lib/plot_layout.ts). A name stands beside its
 * portrait where there is room; every portrait gives its name and figures on hover, focus or a
 * first tap (the second opens the champion).
 */
export interface PlotChampion {
  key: string
  champion: number
  name: string
  /** The role's word, shown in the tooltip when the plot mixes roles. */
  role: string | null
  href: string
  /** 0‥1 */
  win: number
  pick: number
}

const props = defineProps<{
  /** The order is the labels' priority: the first ones are named first. */
  points: PlotChampion[]
}>()

/* ── Size: laid out for the box it has (a laptop's until the browser measures it) ── */
const box = ref<HTMLElement>()
const size = shallowRef({ w: 714, h: 340 })
/** Text widths: an estimate on the server, the browser's own measure once the font is there. */
const measure = shallowRef<(text: string) => number>((t) => t.length * 6.6 + 2)
let observer: ResizeObserver | null = null

onMounted(() => {
  const el = box.value
  if (!el) return
  const read = () => {
    const w = Math.round(el.clientWidth)
    const h = Math.round(el.clientHeight)
    if (w > 0 && h > 0 && (w !== size.value.w || h !== size.value.h)) size.value = { w, h }
  }
  read()
  observer = new ResizeObserver(read)
  observer.observe(el)
  document.fonts?.ready.then(() => {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.font = `650 12px ${getComputedStyle(el).fontFamily}`
    measure.value = (t) => ctx.measureText(t).width + 1
  })
})
onBeforeUnmount(() => observer?.disconnect())

/* ── Scales ── */
const radius = computed(() => (size.value.w < 480 ? 13 : 15))
const PICK_TICKS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40]

const frame = computed(() => {
  const { w, h } = size.value
  const pad = radius.value + 4
  const picks = props.points.map((p) => p.pick * 100)
  const wins = props.points.map((p) => p.win * 100)
  const xlo = Math.log(Math.max(0.2, Math.min(...picks) * 0.85))
  const xhi = Math.log(Math.max(...picks) * 1.12)
  const ylo = Math.floor(Math.min(...wins, 50) - 0.4)
  const yhi = Math.ceil(Math.max(...wins, 50) + 0.4)
  const x = (p: number) =>
    pad + ((Math.log(Math.max(p, 0.2)) - xlo) / (xhi - xlo || 1)) * (w - 2 * pad)
  const y = (v: number) => pad + (1 - (v - ylo) / (yhi - ylo || 1)) * (h - 2 * pad)
  const step = yhi - ylo > 6 ? 2 : 1
  const gy: { y: number; t: string; mid: boolean }[] = []
  for (let v = Math.ceil(ylo / step) * step; v <= yhi; v += step)
    gy.push({ y: y(v), t: `${v}%`, mid: v === 50 })
  if (!gy.some((g) => g.mid)) gy.push({ y: y(50), t: '50%', mid: true })
  // Round shares across, at least 64 px apart.
  const gx: { x: number; t: string }[] = []
  for (const v of PICK_TICKS) {
    const at = x(v)
    if (at > 24 && at < w - 24 && at - (gx[gx.length - 1]?.x ?? -Infinity) >= 64)
      gx.push({ x: at, t: `${v}%` })
  }
  return { x, y, gy, gx }
})

const byKey = computed(() => new Map(props.points.map((p) => [p.key, p])))
const markers = computed(() =>
  layoutPlot(
    props.points.map((p) => ({
      key: p.key,
      x: frame.value.x(p.pick * 100),
      y: frame.value.y(p.win * 100),
      label: p.name,
    })),
    {
      width: size.value.w,
      height: size.value.h,
      radius: radius.value,
      gap: 4,
      labelHeight: 16,
      labelWidth: measure.value,
    }
  )
)

/** A share of the box, rounded so the server and the browser write the same style. */
const pctX = (v: number) => `${((v / size.value.w) * 100).toFixed(3)}%`
const pctY = (v: number) => `${((v / size.value.h) * 100).toFixed(3)}%`
const pct1 = (v: number) => (v * 100).toFixed(1)

/* ── The tooltip: hover, focus, or a first tap ── */
const active = ref<string | null>(null)
let touched = false
const tip = computed(() => {
  const m = markers.value.find((x) => x.key === active.value)
  const p = active.value ? byKey.value.get(active.value) : null
  if (!m || !p) return null
  const below = m.my - radius.value - 64 < 0
  const left = Math.min(size.value.w - 96, Math.max(96, m.mx))
  return {
    p,
    style: {
      left: pctX(left),
      top: pctY(below ? m.my + radius.value + 8 : m.my - radius.value - 8),
      transform: `translate(-50%, ${below ? '0' : '-100%'})`,
    },
  }
})
function onPointerDown(event: PointerEvent) {
  touched = event.pointerType === 'touch' || event.pointerType === 'pen'
}
function onEnter(event: PointerEvent, key: string) {
  if (event.pointerType === 'mouse') active.value = key
}
function onLeave(event: PointerEvent, key: string) {
  if (event.pointerType === 'mouse' && active.value === key) active.value = null
}
/** On touch, the first tap on a portrait names it; the second opens its page. */
function onClick(event: MouseEvent) {
  const el = (event.target as HTMLElement).closest<HTMLElement>('[data-key]')
  if (!touched) return
  // A tap beside the portraits puts the name away.
  if (!el) return void (active.value = null)
  const key = el.dataset.key!
  if (active.value !== key) {
    event.preventDefault()
    event.stopPropagation()
    active.value = key
  }
}
</script>

<template>
  <div
    ref="box"
    class="wpp"
    role="group"
    :aria-label="`Win rate against pick rate, ${points.length} champions`"
    @pointerdown.capture="onPointerDown"
    @click.capture="onClick"
  >
    <div
      v-for="g in frame.gy"
      :key="`y${g.t}`"
      class="wpp-gy"
      :class="{ mid: g.mid }"
      :style="{ top: pctY(g.y) }"
    >
      <span class="num">{{ g.t }}</span>
    </div>
    <div v-for="g in frame.gx" :key="`x${g.t}`" class="wpp-gx" :style="{ left: pctX(g.x) }">
      <span class="num">{{ g.t }}</span>
    </div>
    <svg
      class="wpp-ln"
      :viewBox="`0 0 ${size.w} ${size.h}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        v-for="m in markers.filter((x) => x.moved)"
        :key="`l${m.key}`"
        :x1="m.x"
        :y1="m.y"
        :x2="m.mx"
        :y2="m.my"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <i
      v-for="m in markers.filter((x) => x.moved)"
      :key="`d${m.key}`"
      class="wpp-dot"
      :style="{ left: pctX(m.x), top: pctY(m.y) }"
    />
    <Link
      v-for="m in markers"
      :key="m.key"
      class="wpp-m"
      :class="{ on: active === m.key, sm: radius < 15 }"
      :href="byKey.get(m.key)!.href"
      :data-key="m.key"
      :style="{ left: pctX(m.mx), top: pctY(m.my) }"
      :aria-label="`${byKey.get(m.key)!.name}: ${pct1(byKey.get(m.key)!.win)}% win rate, ${pct1(byKey.get(m.key)!.pick)}% pick rate`"
      @pointerenter="onEnter($event, m.key)"
      @pointerleave="onLeave($event, m.key)"
      @focus="!touched && (active = m.key)"
      @blur="!touched && active === m.key && (active = null)"
      ><img :src="champIconUrl(byKey.get(m.key)!.champion)" alt="" loading="lazy"
    /></Link>
    <span
      v-for="m in markers.filter((x) => x.label)"
      :key="`n${m.key}`"
      class="wpp-n"
      :class="{ on: active === m.key }"
      :style="{ left: pctX(m.label!.x), top: pctY(m.label!.y) }"
      aria-hidden="true"
      >{{ byKey.get(m.key)!.name }}</span
    >
    <div v-if="tip" class="wpp-tip" :style="tip.style" aria-hidden="true">
      <b>{{ tip.p.name }}</b
      ><span v-if="tip.p.role" class="wpp-tip-r">{{ tip.p.role }}</span>
      <span class="wpp-tip-f num"
        ><b>{{ pct1(tip.p.win) }}%</b> win rate<i /><b>{{ pct1(tip.p.pick) }}%</b> pick rate</span
      >
    </div>
  </div>
</template>

<style scoped>
.wpp {
  position: relative;
  height: 340px;
  margin: 8px 24px 0 64px;
  touch-action: manipulation;
}
/* Guides: hairlines, the 50% line dashed. */
.wpp-gy {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--line);
}
.wpp-gy.mid {
  background: none;
  border-top: 1px dashed var(--line-3);
}
.wpp-gy span {
  position: absolute;
  left: -52px;
  top: -8px;
  width: 40px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t3);
  text-align: right;
}
.wpp-gx {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--line);
}
.wpp-gx span {
  position: absolute;
  bottom: -24px;
  left: -20px;
  width: 40px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t3);
  text-align: center;
}
/* A portrait moved off its point: a hairline and a dot back to where it is. */
.wpp-ln {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.wpp-ln line {
  stroke: var(--line-3);
  stroke-width: 1;
}
.wpp-dot {
  position: absolute;
  width: 4px;
  height: 4px;
  margin: -2px 0 0 -2px;
  border-radius: 50%;
  background: var(--t3);
  pointer-events: none;
}
.wpp-m {
  position: absolute;
  z-index: 1;
  display: block;
  width: 30px;
  height: 30px;
  margin: -15px 0 0 -15px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--s3);
  box-shadow:
    0 0 0 2px var(--s1),
    0 2px 6px rgb(4 3 10 / 0.35);
  transition: box-shadow var(--m) var(--ease);
}
.wpp-m.sm {
  width: 26px;
  height: 26px;
  margin: -13px 0 0 -13px;
}
.wpp-m img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.12);
}
.wpp-m:hover,
.wpp-m.on,
.wpp-m:focus-visible {
  z-index: 3;
  outline: none;
  box-shadow:
    0 0 0 2px var(--s1),
    0 0 0 4px var(--v400);
}
.wpp-n {
  position: absolute;
  z-index: 2;
  height: 16px;
  font-size: 12px;
  font-weight: 650;
  line-height: 16px;
  color: var(--t2);
  white-space: nowrap;
  pointer-events: none;
  transition: color var(--m) var(--ease);
}
.wpp-n.on {
  color: var(--t1);
}
.wpp-tip {
  position: absolute;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  max-width: 200px;
  padding: 8px 11px 9px;
  border-radius: var(--r2);
  background: var(--s2);
  box-shadow:
    inset 0 0 0 1px var(--line-2),
    var(--drop);
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  animation: wpp-in 120ms var(--ease) both;
}
.wpp-tip > b {
  font-size: 13px;
  font-weight: 650;
  color: var(--t1);
}
.wpp-tip-r {
  font-weight: 500;
  color: var(--t3);
}
.wpp-tip-f {
  flex-basis: 100%;
  font-weight: 500;
  color: var(--t3);
}
.wpp-tip-f b {
  font-weight: 650;
  color: var(--t1);
}
.wpp-tip-f i {
  display: inline-block;
  width: 10px;
}
@keyframes wpp-in {
  from {
    opacity: 0;
  }
}
@media (max-width: 767px) {
  .wpp {
    height: 280px;
    margin: 8px 12px 0 44px;
  }
  .wpp-gy span {
    left: -40px;
    width: 32px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .wpp-tip {
    animation: none;
  }
}
</style>
