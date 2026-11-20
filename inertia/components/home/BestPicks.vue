<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import TierChip from '../ui/TierChip.vue'
import WinRate from '../ui/WinRate.vue'
import Icon from '../ui/Icon.vue'
import { championHref, positionOf } from '../header/sections.js'
import { champIcon, championSplash } from '../../lib/assets.js'
import type { HomePick } from '../../lib/home.js'

/**
 * The home's best pick of each role, drawn three ways for the founder to choose (`?v=a|b|c`):
 * a — the lineup: one sheet, five columns, square portraits done well;
 * b — on the Rift: the five on a drawn map, each at its lane, the lineup beside it;
 * c — the spotlight: one role at a time, its splash fading in on the right, the role tabs above.
 */
const props = defineProps<{
  variant: 'a' | 'b' | 'c'
  picks: HomePick[]
  /** The patch's other S+ picks (the spotlight shows a role's beside its best). */
  splus: HomePick[]
}>()

const pct1 = (x: number) => (x * 100).toFixed(1)
const roleOf = (p: HomePick) => positionOf(p.position)

/* ── b: where each role stands on the map (percent of the square) ── */
const SPOT: Record<string, { x: number; y: number; side: 'r' | 'l' }> = {
  TOP: { x: 12, y: 12, side: 'r' },
  JUNGLE: { x: 30, y: 44, side: 'l' },
  MIDDLE: { x: 51, y: 51, side: 'r' },
  BOTTOM: { x: 87, y: 87, side: 'l' },
  UTILITY: { x: 69, y: 75, side: 'l' },
}

/* ── c: the role shown ── */
const shown = ref(0)
const spot = computed(() => props.picks[shown.value] ?? props.picks[0])
const alsoS = computed(() =>
  props.splus
    .filter((p) => p.position === spot.value?.position && p.championId !== spot.value?.championId)
    .slice(0, 4)
)
</script>

<template>
  <!-- a: the lineup -->
  <div v-if="variant === 'a'" class="bp-a">
    <Link
      v-for="p in picks"
      :key="p.position"
      class="bp-a-c"
      :href="championHref(p.slug, p.position)"
      prefetch
    >
      <span class="bp-role"
        ><RoleIcon :lane="roleOf(p).lane" :size="15" />{{ roleOf(p).label }}</span
      >
      <span class="bp-a-p"><img :src="champIcon(p.championId)" alt="" /></span>
      <span class="bp-a-n"
        ><b>{{ p.name }}</b
        ><TierChip :tier="p.tier"
      /></span>
      <span class="bp-a-w"
        ><span class="fg-m num">{{ pct1(p.winRate) }}<span class="u">%</span></span
        ><span class="meta">win rate</span></span
      >
      <WinRate :rate="p.winRate" bare class="bp-a-l" />
    </Link>
  </div>

  <!-- b: on the Rift -->
  <div v-else-if="variant === 'b'" class="bp-b">
    <div
      class="bp-map"
      role="img"
      aria-label="The best pick of each role at its place on Summoner's Rift"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <!-- The river across, the three lanes, the two bases. -->
        <path class="rv" d="M20 20 L 80 80" />
        <path class="ln" d="M10 84 V 17 Q 10 10 17 10 H 84" />
        <path class="ln" d="M16 90 H 83 Q 90 90 90 83 V 16" />
        <path class="ln" d="M15 85 L 85 15" />
        <circle class="bs" cx="10" cy="90" r="4.5" />
        <circle class="bs" cx="90" cy="10" r="4.5" />
      </svg>
      <Link
        v-for="p in picks"
        :key="p.position"
        class="bp-pin"
        :class="SPOT[p.position]?.side"
        :href="championHref(p.slug, p.position)"
        :style="{ left: `${SPOT[p.position]?.x ?? 50}%`, top: `${SPOT[p.position]?.y ?? 50}%` }"
        prefetch
      >
        <span class="bp-pin-p"><img :src="champIcon(p.championId)" alt="" /></span>
        <span class="bp-pin-t"
          ><b>{{ p.name }}</b
          ><span class="num">{{ pct1(p.winRate) }}%</span></span
        >
      </Link>
    </div>
    <div class="bp-b-l">
      <Link
        v-for="p in picks"
        :key="p.position"
        class="bp-b-r"
        :href="championHref(p.slug, p.position)"
        prefetch
      >
        <span class="bp-b-g"><RoleIcon :lane="roleOf(p).lane" :size="16" /></span>
        <span class="bp-b-i"><img :src="champIcon(p.championId)" alt="" /></span>
        <span class="bp-b-n"
          ><b>{{ p.name }}</b
          ><span class="meta">{{ roleOf(p).label }}</span></span
        >
        <TierChip :tier="p.tier" />
        <WinRate :rate="p.winRate" :digits="1" small end width="96px" />
      </Link>
    </div>
  </div>

  <!-- c: the spotlight -->
  <div v-else class="bp-c">
    <div class="bp-c-tabs" role="tablist" aria-label="Role">
      <button
        v-for="(p, i) in picks"
        :key="p.position"
        type="button"
        role="tab"
        :aria-selected="shown === i"
        :class="{ on: shown === i }"
        @click="shown = i"
      >
        <span class="bp-c-ti"><img :src="champIcon(p.championId)" alt="" /></span
        ><span class="bp-c-tl"
          ><RoleIcon :lane="roleOf(p).lane" :size="14" />{{ roleOf(p).label }}</span
        >
      </button>
    </div>
    <div v-if="spot" class="bp-c-p" role="tabpanel">
      <img :key="spot.championId" class="bp-c-art" :src="championSplash(spot.championId)" alt="" />
      <div class="bp-c-t">
        <span class="bp-role"
          ><RoleIcon :lane="roleOf(spot).lane" :size="15" />Best
          {{ roleOf(spot).label.toLowerCase() }} pick</span
        >
        <span class="bp-c-n"
          ><b>{{ spot.name }}</b
          ><TierChip :tier="spot.tier" large
        /></span>
        <span class="bp-c-w"
          ><span class="fg-l num">{{ pct1(spot.winRate) }}<span class="u">%</span></span
          ><span class="meta">win rate</span></span
        >
        <span v-if="alsoS.length" class="bp-c-s"
          ><span class="meta">Also S+</span
          ><Link
            v-for="s in alsoS"
            :key="s.championId"
            :href="championHref(s.slug, s.position)"
            :title="`${s.name}, ${pct1(s.winRate)}%`"
            prefetch
            ><img :src="champIcon(s.championId)" :alt="s.name" /></Link
        ></span>
        <Link class="btn sm bp-c-b" :href="championHref(spot.slug, spot.position)" prefetch
          >{{ spot.name }} build<Icon name="chevr" :size="14"
        /></Link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bp-role {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--t3);
}
.bp-role :deep(svg) {
  opacity: 0.62;
}

/* ── a: the lineup ── */
.bp-a {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border-radius: var(--r3);
  background: var(--d-sheen), var(--d-sf1);
  box-shadow: var(--d-lit), var(--d-drop);
  overflow: hidden;
}
.bp-a-c {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 22px 22px 24px;
  transition: background var(--m) var(--ease);
}
.bp-a-c + .bp-a-c {
  box-shadow: inset 1px 0 0 var(--line);
}
.bp-a-c:hover {
  background: rgb(var(--v-rgb) / 0.05);
}
.bp-a-p {
  width: 76px;
  height: 76px;
  border-radius: var(--r2);
  overflow: hidden;
  background: var(--s3);
  box-shadow:
    0 0 0 1px var(--line-2),
    0 10px 24px rgb(4 3 10 / 0.35);
}
.bp-a-p img,
.bp-b-i img,
.bp-pin-p img,
.bp-c-ti img,
.bp-c-s img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.1);
}
.bp-a-n {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 2px;
}
.bp-a-n b {
  min-width: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--t1);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bp-a-w {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: -4px;
}
.bp-a-l {
  margin-top: -6px;
}

/* ── b: on the Rift ── */
.bp-b {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 28px;
  align-items: center;
  padding: 24px;
  border-radius: var(--r3);
  background: var(--d-sheen), var(--d-sf1);
  box-shadow: var(--d-lit), var(--d-drop);
}
.bp-map {
  position: relative;
  aspect-ratio: 1;
  max-height: 420px;
  border-radius: var(--r3);
  background:
    radial-gradient(120% 90% at 50% 50%, rgb(var(--v-rgb) / 0.07), transparent 70%), var(--s2);
  box-shadow: inset 0 0 0 1px var(--line);
}
.bp-map svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.bp-map .ln {
  fill: none;
  stroke: var(--line-3);
  stroke-width: 1.1;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: none;
}
.bp-map .rv {
  fill: none;
  stroke: rgb(var(--v-rgb) / 0.1);
  stroke-width: 5;
  stroke-linecap: round;
}
.bp-map .bs {
  fill: var(--s3);
  stroke: var(--line-3);
  stroke-width: 0.5;
}
.bp-pin {
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  transform: translate(-26px, -50%);
}
.bp-pin.l {
  flex-direction: row-reverse;
  transform: translate(calc(-100% + 26px), -50%);
  text-align: right;
}
.bp-pin-p {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--s3);
  box-shadow:
    0 0 0 2px var(--s2),
    0 0 0 3.5px rgb(var(--v-rgb) / 0.55),
    0 10px 22px rgb(4 3 10 / 0.45);
  transition: box-shadow var(--m) var(--ease);
}
.bp-pin:hover .bp-pin-p {
  box-shadow:
    0 0 0 2px var(--s2),
    0 0 0 3.5px var(--v400),
    0 10px 22px rgb(4 3 10 / 0.45);
}
.bp-pin-t {
  display: flex;
  flex-direction: column;
  gap: 1px;
  white-space: nowrap;
}
.bp-pin-t b {
  font-size: 13.5px;
  font-weight: 650;
  color: var(--t1);
}
.bp-pin-t span {
  font-size: 12px;
  font-weight: 600;
  color: var(--t3);
}
.bp-b-l {
  display: flex;
  flex-direction: column;
}
.bp-b-r {
  display: grid;
  grid-template-columns: 22px 40px minmax(0, 1fr) auto 112px;
  align-items: center;
  gap: 14px;
  height: 64px;
  padding: 0 8px;
  border-radius: var(--r2);
  transition: background var(--m) var(--ease);
}
.bp-b-r + .bp-b-r {
  box-shadow: inset 0 1px 0 var(--line);
}
.bp-b-r:hover {
  background: rgb(var(--v-rgb) / 0.05);
}
.bp-b-g {
  display: grid;
  place-items: center;
  color: var(--t3);
}
.bp-b-i {
  width: 40px;
  height: 40px;
  border-radius: var(--r2);
  overflow: hidden;
  background: var(--s3);
}
.bp-b-n {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.bp-b-n b {
  font-size: 15px;
  font-weight: 650;
  color: var(--t1);
}

/* ── c: the spotlight ── */
.bp-c {
  border-radius: var(--r3);
  background: var(--d-sheen), var(--d-sf1);
  box-shadow: var(--d-lit), var(--d-drop);
  overflow: hidden;
}
.bp-c-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 8px 0;
  border-bottom: 1px solid var(--line);
}
.bp-c-tabs button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 16px 0 10px;
  border: 0;
  background: none;
  font: inherit;
  color: var(--t3);
  cursor: pointer;
  transition: color var(--m) var(--ease);
}
.bp-c-tabs button::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 16px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
}
.bp-c-tabs button.on {
  color: var(--t1);
}
.bp-c-tabs button.on::after {
  background: var(--v400);
}
.bp-c-tabs button:hover {
  color: var(--t1);
}
.bp-c-ti {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--s3);
  opacity: 0.7;
  transition: opacity var(--m) var(--ease);
}
.bp-c-tabs button.on .bp-c-ti,
.bp-c-tabs button:hover .bp-c-ti {
  opacity: 1;
}
.bp-c-tl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
}
.bp-c-p {
  position: relative;
  min-height: 300px;
}
/* The splash fades in from the right, never behind the words. */
.bp-c-art {
  position: absolute;
  top: 0;
  right: 0;
  width: 66%;
  height: 100%;
  object-fit: cover;
  object-position: 60% 22%;
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 42%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 42%);
  animation: bp-in 260ms var(--ease) both;
}
@keyframes bp-in {
  from {
    opacity: 0;
  }
}
.bp-c-t {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  max-width: 420px;
  padding: 30px 32px 32px;
}
.bp-c-n {
  display: flex;
  align-items: center;
  gap: 14px;
}
.bp-c-n b {
  font-size: 34px;
  font-weight: 650;
  line-height: 1.05;
  letter-spacing: -0.025em;
  color: var(--t1);
}
.bp-c-w {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.bp-c-s {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bp-c-s a {
  width: 28px;
  height: 28px;
  border-radius: var(--r2);
  overflow: hidden;
  background: var(--s3);
  box-shadow: 0 0 0 1px var(--line-2);
}
.bp-c-s .meta {
  margin-right: 2px;
}
.bp-c-b {
  margin-top: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .bp-c-art {
    animation: none;
  }
}

/* ── Narrower screens ── */
@media (max-width: 1023px) {
  .bp-a {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .bp-a-c:nth-child(4) {
    box-shadow: inset 0 1px 0 var(--line);
  }
  .bp-a-c:nth-child(5) {
    box-shadow:
      inset 0 1px 0 var(--line),
      inset 1px 0 0 var(--line);
  }
  .bp-b {
    grid-template-columns: minmax(0, 1fr);
  }
  .bp-map {
    max-height: none;
    width: min(100%, 460px);
    margin: 0 auto;
  }
}
@media (max-width: 639px) {
  .bp-a {
    grid-template-columns: minmax(0, 1fr);
  }
  .bp-a-c {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    grid-template-areas: 'p r w' 'p n w';
    align-items: center;
    gap: 2px 14px;
    padding: 14px 16px;
  }
  .bp-a-c + .bp-a-c,
  .bp-a-c:nth-child(4),
  .bp-a-c:nth-child(5) {
    box-shadow: inset 0 1px 0 var(--line);
  }
  .bp-a-c .bp-role {
    grid-area: r;
  }
  .bp-a-p {
    grid-area: p;
    width: 56px;
    height: 56px;
  }
  .bp-a-n {
    grid-area: n;
    justify-content: flex-start;
    margin: 0;
  }
  .bp-a-n b {
    font-size: 16px;
  }
  .bp-a-w {
    grid-area: w;
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
    margin: 0;
  }
  .bp-a-l {
    display: none;
  }
  .bp-b {
    padding: 14px;
  }
  .bp-pin-p {
    width: 40px;
    height: 40px;
  }
  .bp-pin {
    transform: translate(-20px, -50%);
  }
  .bp-pin.l {
    transform: translate(calc(-100% + 20px), -50%);
  }
  .bp-pin-t b {
    font-size: 12.5px;
  }
  .bp-b-r {
    grid-template-columns: 18px 36px minmax(0, 1fr) auto;
    gap: 10px;
    padding: 0;
  }
  .bp-b-r :deep(.wrt) {
    display: none;
  }
  .bp-b-i {
    width: 36px;
    height: 36px;
  }
  .bp-c-tabs {
    overflow-x: auto;
    scrollbar-width: none;
  }
  .bp-c-tabs button {
    flex: none;
    padding: 0 12px 0 8px;
  }
  .bp-c-tl {
    display: none;
  }
  .bp-c-p {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .bp-c-art {
    position: relative;
    width: 100%;
    height: 200px;
    -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
    mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
  }
  .bp-c-t {
    margin-top: -36px;
    padding: 0 18px 22px;
  }
  .bp-c-n b {
    font-size: 28px;
  }
}
</style>
