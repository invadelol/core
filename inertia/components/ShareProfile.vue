<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  positionName,
  positionOf,
  rankFromCore,
  rankLabel,
  type Position,
} from '@invadelol/ui/logic'
import Icon from './ui/Icon.vue'
import Select from './ui/Select.vue'
import { champIcon, profileIcon, regionLabel, skinSplash } from '../lib/assets.js'
import { isRemake } from '../lib/match.js'
import {
  CARD_COUNTS,
  CARD_QUEUES,
  DEFAULT_STATS,
  FORMATS,
  MAX_STATS,
  STATS,
  cellsFor,
  windowLabel,
  type CardData,
  type CardFormat,
  type CardQueue,
  type CardRank,
  type StatKey,
} from '../lib/share_card.js'
import { drawCard, loadCardFonts } from '../lib/share_card_draw.js'
import type { Match, RanksPayload, StatsPayload, Summoner } from '../lib/types.js'

const props = defineProps<{
  profile: Summoner
  /** What the profile already shows: drawn until the card's own window has loaded. */
  stats: StatsPayload | null
  ranks?: RanksPayload | null
  champion?: number
  /** The profile's queue filter, the card's first queue when it offers it. */
  queue?: string
}>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()
const canvas = ref<HTMLCanvasElement>()
/** An `.iv-dark` node: the card is night ink in every theme, so its colours are the dark tokens. */
const probe = ref<HTMLElement>()
const message = ref('')
const copied = ref(false)
const busy = ref(false)
const url = ref('')

/* ── Options ─────────────────────────────────────────────────── */

const format = ref<CardFormat>('wide')
const queue = ref<CardQueue>(
  CARD_QUEUES.some((q) => q.value === props.queue) ? (props.queue as CardQueue) : 'all'
)
const count = ref<number>(30)
const chosen = ref<StatKey[]>([...DEFAULT_STATS])
const championId = ref(props.champion ?? 0)
/** Set once the viewer picks a background, which then stays whatever the window holds. */
let championPicked = false
const pickedChampion = () => (championPicked = true)
const skin = ref(0)

const formats = Object.entries(FORMATS) as Array<[CardFormat, (typeof FORMATS)[CardFormat]]>

/* ── Data ────────────────────────────────────────────────────── */

const payload = shallowRef<StatsPayload | null>(props.stats)
const roleMatches = shallowRef<Match[] | null>(null)
/** Only an answer (or art) slower than 200 ms dims the card it will replace. */
const slowData = ref(false)
const slowDraw = ref(false)
const slow = computed(() => slowData.value || slowDraw.value)
const skins = shallowRef<Array<{ num: number; name: string }>>([])
const allChampions = shallowRef<Array<{ id: number; name: string }>>([])

const base = computed(() => `/api/summoners/puuid/${props.profile.puuid}`)
const typeParam = computed(() => (queue.value === 'all' ? '' : `&type=${queue.value}`))

let statsController: AbortController | undefined
watch(
  [queue, count],
  async () => {
    statsController?.abort()
    const controller = (statsController = new AbortController())
    const timer = setTimeout(() => (slowData.value = true), 200)
    try {
      const res = await fetch(`${base.value}/stats?count=${count.value}${typeParam.value}`, {
        signal: controller.signal,
      })
      if (res.ok) {
        payload.value = (await res.json()) as StatsPayload
        // No main champion from the profile yet: the most played of the window, until one is picked.
        const top = [...payload.value.champions].sort((a, b) => b.games - a.games)[0]
        if (!championId.value && !championPicked && top) championId.value = top.championId
      }
    } catch {
      /* The last answer stays on the card. */
    } finally {
      clearTimeout(timer)
      if (!controller.signal.aborted) slowData.value = false
    }
  },
  { immediate: true }
)

let roleController: AbortController | undefined
const wantsRole = computed(() => chosen.value.includes('role'))
watch(
  [queue, count, wantsRole],
  async () => {
    if (!wantsRole.value) return
    roleController?.abort()
    const controller = (roleController = new AbortController())
    try {
      const n = Math.min(count.value, 100)
      const res = await fetch(`${base.value}/matches?count=${n}${typeParam.value}&view=summary`, {
        signal: controller.signal,
      })
      if (res.ok) roleMatches.value = (await res.json()) as Match[]
    } catch {
      /* No role then: the cell is left out. */
    }
  },
  { immediate: true }
)

watch(
  championId,
  async (id, before) => {
    if (before !== undefined) skin.value = 0
    skins.value = []
    if (!id) return
    try {
      const res = await fetch(`/cdn/skins/${id}`)
      if (res.ok && championId.value === id) skins.value = await res.json()
    } catch {
      /* The base art only. */
    }
  },
  { immediate: true }
)

onMounted(async () => {
  url.value = `${location.origin}/${encodeURIComponent(`${props.profile.gameName}-${props.profile.tagLine}`)}`
  dialog.value?.showModal()
  try {
    const res = await fetch('/cdn/names/champion')
    if (!res.ok) return
    const names = (await res.json()) as Record<string, string>
    allChampions.value = Object.entries(names)
      .map(([id, name]) => ({ id: Number(id), name }))
      // Mode variants reuse a name under ids in the tens of thousands.
      .filter((c) => c.id > 0 && c.id < 10_000)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    /* The player's own champions stay offered. */
  }
})

onBeforeUnmount(() => {
  statsController?.abort()
  roleController?.abort()
  dialog.value?.close()
})

/* ── What the card says ──────────────────────────────────────── */

const role = computed<CardData['role']>(() => {
  const counts = new Map<Position, number>()
  let total = 0
  for (const match of roleMatches.value ?? []) {
    if (isRemake(match)) continue
    const lane = positionOf(
      match.participants.find((p) => p.puuid === props.profile.puuid)?.position
    )
    if (!lane) continue
    counts.set(lane, (counts.get(lane) ?? 0) + 1)
    total++
  }
  const [lane, games] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? []
  return lane && games ? { name: positionName(lane), share: games / total } : null
})

const rank = computed<CardRank | null>(() => {
  const current = (props.ranks?.current ?? []).filter((r) => r.tier)
  const wanted = queue.value === 'flex' ? 'RANKED_FLEX_SR' : 'RANKED_SOLO_5x5'
  const row =
    current.find((r) => r.queueType === wanted) ??
    current.find((r) => r.queueType === 'RANKED_SOLO_5x5' || r.queueType === 'RANKED_FLEX_SR')
  if (!row) return null
  const parsed = rankFromCore(row)
  return {
    name: rankLabel(parsed, false),
    tier: row.tier.toLowerCase(),
    lp: row.leaguePoints,
    queue: row.queueType === 'RANKED_FLEX_SR' ? 'Flex' : 'Solo/Duo',
  }
})

const cells = computed(() =>
  cellsFor(
    { figures: payload.value?.global ?? null, role: role.value, rank: rank.value },
    chosen.value
  )
)

const statOptions = computed(() =>
  STATS.map((stat) => ({
    ...stat,
    disabled:
      (stat.key === 'rank' && !rank.value) ||
      (!chosen.value.includes(stat.key) && chosen.value.length >= MAX_STATS),
  }))
)

function toggle(key: StatKey, on: boolean) {
  chosen.value = on ? [...chosen.value, key] : chosen.value.filter((k) => k !== key)
}

const championOptions = computed(() => {
  const played = [...(payload.value?.champions ?? [])].sort((a, b) => b.games - a.games)
  const seen = new Set(played.map((c) => c.championId))
  const named = new Map(allChampions.value.map((c) => [c.id, c.name]))
  const name = (id: number) => named.get(id) ?? `Champion ${id}`
  const options = [
    { value: 0, label: 'No art' },
    ...played.map((c) => ({
      value: c.championId,
      label: name(c.championId),
      icon: champIcon(c.championId),
      meta: `${c.games}`,
    })),
    ...allChampions.value
      .filter((c) => !seen.has(c.id))
      .map((c) => ({ value: c.id, label: c.name, icon: champIcon(c.id) })),
  ]
  // The profile's main champion may have left the window: keep it offered.
  if (championId.value && !options.some((o) => o.value === championId.value)) {
    options.splice(1, 0, {
      value: championId.value,
      label: name(championId.value),
      icon: champIcon(championId.value),
    })
  }
  return options
})

const skinOptions = computed(() =>
  skins.value.length
    ? skins.value.map((s) => ({ value: s.num, label: s.num === 0 ? 'Default' : s.name }))
    : [{ value: 0, label: 'Default' }]
)

/* ── Drawing ─────────────────────────────────────────────────── */

const images = new Map<string, Promise<HTMLImageElement | null>>()
function image(src: string) {
  let pending = images.get(src)
  if (!pending) {
    pending = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })
    images.set(src, pending)
  }
  return pending
}

let drawn = 0
async function render() {
  const version = ++drawn
  const timer = setTimeout(() => (slowDraw.value = true), 200)
  const [icon, splash] = await Promise.all([
    image(profileIcon(props.profile.profileIconId)),
    championId.value ? image(skinSplash(championId.value, skin.value)) : null,
    loadCardFonts(),
  ])
  clearTimeout(timer)
  // A newer draw started meanwhile: let it land instead, in one go.
  if (version !== drawn || !canvas.value || !probe.value) return
  slowDraw.value = false
  const style = getComputedStyle(probe.value)
  const total = payload.value?.global.total ?? 0
  const off = document.createElement('canvas')
  drawCard(
    off,
    {
      format: format.value,
      name: props.profile.gameName,
      tag: props.profile.tagLine,
      region: regionLabel(props.profile.platform),
      icon,
      splash,
      window: total ? windowLabel(total, queue.value) : '',
      cells: cells.value,
    },
    (token) => style.getPropertyValue(token).trim()
  )
  canvas.value.width = off.width
  canvas.value.height = off.height
  canvas.value.getContext('2d')!.drawImage(off, 0, 0)
}

watch([format, championId, skin, cells, () => payload.value?.global.total], () => void render())
onMounted(() => void render())

/* ── Actions ─────────────────────────────────────────────────── */

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
    message.value = 'Link copied'
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    message.value = 'Select and copy the link below.'
  }
}

async function download() {
  busy.value = true
  message.value = ''
  try {
    await render()
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.value!.toBlob((b) => (b ? resolve(b) : reject(new Error())), 'image/png')
    )
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `${props.profile.gameName}-invade-${format.value}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    message.value = 'Card downloaded'
  } catch {
    message.value = 'Could not create the image. You can still copy the link.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="share"
    aria-labelledby="share-title"
    @cancel.prevent="emit('close')"
    @click="
      (e: MouseEvent) => {
        if (e.target === dialog) emit('close')
      }
    "
  >
    <!-- Reads the dark theme's tokens for the card, whatever the page's theme. -->
    <div ref="probe" class="iv-dark sh-probe" />

    <div class="card-h sh-h">
      <Icon name="share" :size="16" />
      <h2 id="share-title" class="h3">Share this profile</h2>
      <button type="button" class="btn ghost ico sm sh-x" aria-label="Close" @click="emit('close')">
        <Icon name="x" />
      </button>
    </div>

    <div class="sh-body">
      <!-- The card itself: the canvas the download saves. -->
      <div class="well sh-prev">
        <canvas
          ref="canvas"
          role="img"
          :aria-label="`Share card for ${profile.gameName}`"
          :class="{ slow }"
        />
      </div>

      <div class="sh-ctl">
        <div>
          <span class="lab">Format</span>
          <div class="seg sh-seg" role="group" aria-label="Format">
            <button
              v-for="[key, spec] in formats"
              :key="key"
              type="button"
              :class="{ on: format === key }"
              :aria-pressed="format === key"
              @click="format = key"
            >
              {{ spec.label }}
            </button>
          </div>
        </div>

        <div>
          <span class="lab">Background</span>
          <div class="col sh-sels">
            <Select
              v-model="championId"
              @update:model-value="pickedChampion"
              :options="championOptions"
              searchable
              search-placeholder="Find a champion"
              width="16rem"
              align="right"
            />
            <Select
              v-if="championId"
              v-model="skin"
              :options="skinOptions"
              :searchable="skinOptions.length > 8"
              search-placeholder="Find a skin"
              width="16rem"
              align="right"
            />
          </div>
        </div>

        <div>
          <span class="lab">Games</span>
          <div class="seg sh-seg" role="group" aria-label="Queue">
            <button
              v-for="q in CARD_QUEUES"
              :key="q.value"
              type="button"
              :class="{ on: queue === q.value }"
              :aria-pressed="queue === q.value"
              @click="queue = q.value"
            >
              {{ q.short }}
            </button>
          </div>
          <div class="seg sh-seg" role="group" aria-label="Recent games counted">
            <button
              v-for="n in CARD_COUNTS"
              :key="n"
              type="button"
              class="num"
              :class="{ on: count === n }"
              :aria-pressed="count === n"
              :aria-label="`Last ${n} games`"
              @click="count = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <fieldset>
          <legend class="lab">Statistics</legend>
          <div class="sh-stats">
            <label
              v-for="stat in statOptions"
              :key="stat.key"
              class="chk"
              :class="{ off: stat.disabled }"
            >
              <input
                type="checkbox"
                :checked="chosen.includes(stat.key)"
                :disabled="stat.disabled"
                @change="toggle(stat.key, ($event.target as HTMLInputElement).checked)"
              />
              <span class="ell">{{ stat.label }}</span>
            </label>
          </div>
        </fieldset>
      </div>
    </div>

    <div class="sh-foot">
      <label class="col" style="gap: 8px">
        <span class="lab">Profile link</span>
        <span class="field">
          <Icon name="share" />
          <input
            :value="url"
            readonly
            aria-label="Profile link"
            @focus="(e) => (e.target as HTMLInputElement).select()"
          />
        </span>
      </label>

      <div class="row sh-acts">
        <span v-if="message" class="meta sh-msg" role="status">{{ message }}</span>
        <button type="button" class="btn" @click="copy">
          <Icon :name="copied ? 'check' : 'share'" />Copy link
        </button>
        <button type="button" class="btn pri" :disabled="busy" @click="download">
          <Icon name="download" />{{ busy ? 'Rendering…' : 'Download card' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* A dialog is a popover: opaque, a hairline border, the only kind of shadow. */
.share {
  width: min(880px, calc(100% - 24px));
  margin: auto;
  padding: 0;
  color: var(--t1);
  background: var(--s1);
  border: 1px solid var(--line-2);
  border-radius: var(--r3);
  box-shadow: var(--drop);
}
.share::backdrop {
  background: rgb(0 0 0 / 0.6);
}
/* Wide enough for both columns, the menus may open past the dialog's edge; narrower, it scrolls. */
@media (min-width: 768px) {
  .share {
    overflow: visible;
  }
}
.sh-probe {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
.sh-x {
  margin-left: auto;
}
.sh-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 288px;
  gap: 20px;
  padding: 4px 20px 0;
}
.sh-prev {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 452px;
  padding: 12px;
}
.sh-prev canvas {
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--r2);
  transition: opacity 160ms var(--ease);
}
.sh-prev canvas.slow {
  opacity: 0.85;
}
.sh-ctl {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.sh-ctl .lab {
  display: block;
  margin-bottom: 8px;
}
.sh-seg {
  display: flex;
  width: 100%;
}
.sh-seg + .sh-seg {
  margin-top: 6px;
}
.sh-seg > * {
  flex: 1 1 0;
  justify-content: center;
  min-width: 0;
  padding: 0 6px;
}
.sh-sels {
  gap: 6px;
}
fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.sh-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}
.sh-stats .chk {
  min-width: 0;
  font-size: 12.5px;
}
.sh-stats .chk.off {
  color: var(--t3);
}
.sh-stats input {
  flex: none;
  accent-color: var(--v500);
}
.sh-foot {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}
.sh-acts {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.sh-msg {
  margin-right: auto;
}
@media (max-width: 767px) {
  .sh-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .sh-prev {
    height: auto;
  }
  .sh-prev canvas {
    max-height: 56vh;
  }
}
</style>
