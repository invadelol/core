<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import TierChip from '../ui/TierChip.vue'
import Icon from '../ui/Icon.vue'
import { championHref, positionOf } from '../header/sections.js'
import { champIcon, championSplash } from '../../lib/assets.js'
import type { HomePick } from '../../lib/home.js'

/**
 * The home's best pick of each role: the roles as tabs (each with its pick's portrait), and one
 * role at a time in a lit sheet: the champion, its tier and win rate, the role's other S+ picks
 * and a link to the build, its splash fading in on the right, never behind the words. A role's
 * art is fetched as soon as its tab is pointed at; a picked role swaps in once its art is there
 * (or after a short wait), so the sheet never shows an empty frame.
 */
const props = defineProps<{
  picks: HomePick[]
  /** The patch's other S+ picks: a role's are shown beside its best. */
  splus: HomePick[]
}>()

const pct1 = (x: number) => (x * 100).toFixed(1)
const roleOf = (p: HomePick) => positionOf(p.position)

/** The tab marked (at once) and the role on show (once its art is there). */
const tab = ref(0)
const shown = ref(0)
const pick = computed(() => props.picks[shown.value] ?? props.picks[0])
const also = computed(() =>
  props.splus
    .filter((p) => p.position === pick.value?.position && p.championId !== pick.value?.championId)
    .slice(0, 4)
)

/** Each splash once, the browser keeping it from then on. */
const fetched = new Map<string, Promise<void>>()
function fetchArt(i: number) {
  const p = props.picks[i]
  if (!p || typeof window === 'undefined') return Promise.resolve()
  const url = championSplash(p.championId)
  let done = fetched.get(url)
  if (!done) {
    done = new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = img.onerror = () => resolve()
      img.src = url
    })
    fetched.set(url, done)
  }
  return done
}
/** The longest a picked role waits for its art before it shows anyway. */
const ART_WAIT_MS = 600
function choose(i: number) {
  tab.value = i
  void Promise.race([fetchArt(i), new Promise((resolve) => setTimeout(resolve, ART_WAIT_MS))]).then(
    () => {
      if (tab.value === i) shown.value = i
    }
  )
}

/* ── Keyboard: the tabs as one stop, the arrows between them ── */
const tabs = ref<HTMLButtonElement[]>([])
function onKey(event: KeyboardEvent, i: number) {
  const n = props.picks.length
  const to =
    event.key === 'ArrowRight'
      ? (i + 1) % n
      : event.key === 'ArrowLeft'
        ? (i - 1 + n) % n
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? n - 1
            : null
  if (to === null) return
  event.preventDefault()
  choose(to)
  tabs.value[to]?.focus()
}
</script>

<template>
  <div class="bp">
    <div class="bp-tabs" role="tablist" aria-label="Role">
      <button
        v-for="(p, i) in picks"
        :id="`bp-tab-${i}`"
        :key="p.position"
        ref="tabs"
        type="button"
        role="tab"
        :aria-selected="tab === i"
        aria-controls="bp-panel"
        :aria-label="`${roleOf(p).label}: ${p.name}`"
        :tabindex="tab === i ? 0 : -1"
        :class="{ on: tab === i }"
        @click="choose(i)"
        @pointerenter="fetchArt(i)"
        @focus="fetchArt(i)"
        @keydown="onKey($event, i)"
      >
        <span class="bp-ti"><img :src="champIcon(p.championId)" alt="" /></span
        ><span class="bp-tl"
          ><RoleIcon :lane="roleOf(p).lane" :size="14" />{{ roleOf(p).label }}</span
        >
      </button>
    </div>
    <div
      v-if="pick"
      id="bp-panel"
      class="bp-p"
      role="tabpanel"
      :aria-labelledby="`bp-tab-${shown}`"
    >
      <img
        :key="pick.championId"
        class="bp-art"
        :src="championSplash(pick.championId)"
        alt=""
        decoding="async"
      />
      <div class="bp-t">
        <span class="bp-role"
          ><RoleIcon :lane="roleOf(pick).lane" :size="15" />Best
          {{ roleOf(pick).label.toLowerCase() }} pick</span
        >
        <span class="bp-n"
          ><b>{{ pick.name }}</b
          ><TierChip :tier="pick.tier" large
        /></span>
        <span class="bp-w"
          ><span class="fg-l num">{{ pct1(pick.winRate) }}<span class="u">%</span></span
          ><span class="meta">win rate</span></span
        >
        <span v-if="also.length" class="bp-s"
          ><span class="meta">Also S+</span
          ><Link
            v-for="s in also"
            :key="s.championId"
            :href="championHref(s.slug, s.position)"
            :title="`${s.name}, ${pct1(s.winRate)}%`"
            :aria-label="`${s.name}, ${pct1(s.winRate)}% win rate`"
            prefetch
            ><img :src="champIcon(s.championId)" alt="" /></Link
        ></span>
        <Link class="btn sm bp-b" :href="championHref(pick.slug, pick.position)" prefetch
          >{{ pick.name }} build<Icon name="chevr" :size="14"
        /></Link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bp {
  border-radius: var(--r3);
  background: var(--d-sheen), var(--d-sf1);
  box-shadow: var(--d-lit), var(--d-drop);
  overflow: hidden;
}

/* ── The roles ── */
.bp-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 8px 0;
  border-bottom: 1px solid var(--line);
}
.bp-tabs button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 16px 0 10px;
  border: 0;
  border-radius: var(--r2) var(--r2) 0 0;
  background: none;
  font: inherit;
  color: var(--t3);
  cursor: pointer;
  transition: color var(--m) var(--ease);
}
.bp-tabs button::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 16px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background var(--m) var(--ease);
}
.bp-tabs button:hover,
.bp-tabs button.on {
  color: var(--t1);
}
.bp-tabs button.on::after {
  background: var(--v400);
}
.bp-tabs button:focus-visible {
  outline: 2px solid rgb(var(--v-rgb) / 0.6);
  outline-offset: -2px;
}
.bp-ti {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--s3);
  opacity: 0.7;
  transition: opacity var(--m) var(--ease);
}
.bp-tabs button.on .bp-ti,
.bp-tabs button:hover .bp-ti {
  opacity: 1;
}
.bp-ti img,
.bp-s img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.1);
}
.bp-tl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
}
.bp-tl :deep(svg) {
  opacity: 0.7;
}

/* ── The role on show ── */
.bp-p {
  position: relative;
  min-height: 300px;
}
/* The splash fades in from the right, never behind the words. */
.bp-art {
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
.bp-t {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  max-width: 440px;
  padding: 30px 32px 32px;
}
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
.bp-n {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}
.bp-n b {
  font-size: 34px;
  font-weight: 650;
  line-height: 1.08;
  letter-spacing: -0.025em;
  color: var(--t1);
}
.bp-w {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.bp-s {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bp-s .meta {
  margin-right: 2px;
}
.bp-s a {
  width: 28px;
  height: 28px;
  border-radius: var(--r2);
  overflow: hidden;
  background: var(--s3);
  box-shadow: 0 0 0 1px var(--line-2);
  transition: box-shadow var(--m) var(--ease);
}
.bp-s a:hover {
  box-shadow: 0 0 0 1px var(--v400);
}
.bp-b {
  margin-top: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .bp-art {
    animation: none;
  }
}

/* ── Touch: tabs and portraits big enough for a thumb ── */
@media (pointer: coarse) {
  .bp-s a {
    width: 36px;
    height: 36px;
  }
}

/* ── A tablet: the art keeps less of the sheet ── */
@media (max-width: 1023px) {
  .bp-art {
    width: 58%;
  }
  .bp-t {
    max-width: 380px;
  }
}

/* ── A phone: the portraits alone as tabs, the art above the words ── */
@media (max-width: 639px) {
  .bp-tabs {
    justify-content: space-between;
    padding: 6px 6px 0;
  }
  .bp-tabs button {
    flex: 1;
    justify-content: center;
    height: 56px;
    padding: 0;
  }
  .bp-tabs button::after {
    left: 18%;
    right: 18%;
  }
  .bp-ti {
    width: 36px;
    height: 36px;
  }
  .bp-tl {
    display: none;
  }
  .bp-p {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .bp-art {
    position: relative;
    width: 100%;
    height: 200px;
    -webkit-mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
    mask-image: linear-gradient(180deg, #000 55%, transparent 100%);
  }
  .bp-t {
    max-width: none;
    margin-top: -36px;
    padding: 0 18px 22px;
  }
  .bp-n b {
    font-size: 28px;
  }
}
</style>
