<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Check, Copy, Download, X } from 'lucide-vue-next'
import {
  positionName,
  positionOf,
  rankFromCore,
  rankLabel,
  type Position,
} from '@invadelol/ui/logic'
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
    class="share m-auto w-[min(880px,calc(100%-24px))] p-0 text-ink backdrop:bg-black/60"
    aria-labelledby="share-title"
    @cancel.prevent="emit('close')"
    @click="
      (e: MouseEvent) => {
        if (e.target === dialog) emit('close')
      }
    "
  >
    <div ref="probe" class="iv-dark pointer-events-none absolute h-0 w-0 overflow-hidden" />

    <div class="flex items-center px-5 pb-1 pt-4">
      <h2 id="share-title" class="text-[16px] font-semibold">Share this profile</h2>
      <button class="iv-btn ghost icon-only ml-auto" aria-label="Close" @click="emit('close')">
        <X :size="16" />
      </button>
    </div>

    <div class="grid gap-5 px-5 pt-3 md:grid-cols-[minmax(0,1fr)_288px]">
      <!-- The card itself: the canvas the download saves. -->
      <div class="preview flex items-center justify-center rounded-[8px] p-3 md:h-[452px]">
        <canvas
          ref="canvas"
          role="img"
          :aria-label="`Share card for ${profile.gameName}`"
          class="max-h-[56vh] max-w-full rounded-[8px] transition-opacity md:max-h-full"
          :class="slow ? 'opacity-85' : ''"
        />
      </div>

      <div class="flex min-w-0 flex-col gap-3.5">
        <div>
          <span class="label">Format</span>
          <div class="iv-seg mt-1.5 flex w-full" role="group" aria-label="Format">
            <button
              v-for="[key, spec] in formats"
              :key="key"
              type="button"
              class="flex-1"
              :class="{ on: format === key }"
              @click="format = key"
            >
              {{ spec.label }}
            </button>
          </div>
        </div>

        <div>
          <span class="label">Background</span>
          <div class="mt-1.5 flex flex-col gap-1.5">
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
          <span class="label">Games</span>
          <div class="iv-seg mt-1.5 flex w-full" role="group" aria-label="Queue">
            <button
              v-for="q in CARD_QUEUES"
              :key="q.value"
              type="button"
              class="min-w-0 flex-auto !px-1.5"
              :class="{ on: queue === q.value }"
              @click="queue = q.value"
            >
              {{ q.short }}
            </button>
          </div>
          <div class="iv-seg mt-1.5 flex w-full" role="group" aria-label="Recent games counted">
            <button
              v-for="n in CARD_COUNTS"
              :key="n"
              type="button"
              class="num flex-1"
              :class="{ on: count === n }"
              :aria-label="`Last ${n} games`"
              @click="count = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <fieldset>
          <legend class="label">Statistics</legend>
          <div class="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
            <label
              v-for="stat in statOptions"
              :key="stat.key"
              class="flex min-w-0 items-center gap-2 py-0.5 text-[12.5px]"
              :class="stat.disabled ? 'text-ink-4' : 'text-ink-2'"
            >
              <input
                type="checkbox"
                class="shrink-0 accent-brand"
                :checked="chosen.includes(stat.key)"
                :disabled="stat.disabled"
                @change="toggle(stat.key, ($event.target as HTMLInputElement).checked)"
              />
              <span class="truncate">{{ stat.label }}</span>
            </label>
          </div>
        </fieldset>
      </div>
    </div>

    <div class="px-5 pb-5">
      <label class="mt-4 block">
        <span class="label">Profile link</span>
        <input
          :value="url"
          readonly
          class="field mt-1.5"
          @focus="(e) => (e.target as HTMLInputElement).select()"
        />
      </label>

      <div class="mt-5 flex flex-wrap items-center justify-end gap-2">
        <span v-if="message" class="mr-auto text-[12px] text-ink-2" role="status">{{
          message
        }}</span>
        <button class="iv-btn" @click="copy">
          <Check v-if="copied" :size="13" />
          <Copy v-else :size="13" />
          Copy link
        </button>
        <button class="iv-btn primary" :disabled="busy" @click="download">
          <Download :size="13" />
          {{ busy ? 'Rendering…' : 'Download card' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* A dialog is a popover: opaque, a hairline border, the only kind of shadow. */
.share {
  background: var(--solid-1);
  border: 1px solid var(--line-2);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-3);
}

/* Wide enough for both columns, the menus may open past the dialog's edge; narrower, it scrolls. */
@media (min-width: 768px) {
  .share {
    overflow: visible;
  }
}

/* The card sits in a well, so every format reads at its own shape. */
.preview {
  background: var(--inset);
  box-shadow: var(--inset-shadow);
}

fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
</style>
