<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  positionName,
  positionOf,
  rankFromCore,
  rankLabel,
  rankValue,
  type Position,
} from '@invadelol/ui/logic'
import Icon from './ui/Icon.vue'
import Select from './ui/Select.vue'
import { assetUrl, champIcon, profileIcon, regionLabel, skinSplash } from '../lib/assets.js'
import { isRemake } from '../lib/match.js'
import {
  CARD_COUNTS,
  CARD_QUEUES,
  FORMATS,
  LEDGER_DEFAULT,
  MAX_STATS,
  STATS,
  championLines,
  linesFor,
  record,
  windowLabel,
  type CardData,
  type CardFormat,
  type CardKind,
  type CardQueue,
  type CardRank,
  type StatKey,
} from '../lib/share_card.js'
import { drawCard, loadCardFonts, type CardInput } from '../lib/share_card_draw.js'
import type { Match, Rank, RanksPayload, StatsPayload, Summoner } from '../lib/types.js'

/**
 * Share this profile: the card on the left, ready cards to start from on the right (the last
 * games as a ledger, the rank with its LP line, a champion), then the games it counts, the
 * picture and, for the ledger, its lines in the player's order. Copy the image, download it,
 * or copy the link.
 */
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
const copied = ref<'' | 'link' | 'image'>('')
const busy = ref(false)
const url = ref('')

/* ── Options ─────────────────────────────────────────────────── */

const format = ref<CardFormat>('square')
const kind = ref<CardKind>('stats')
const queue = ref<CardQueue>(
  CARD_QUEUES.some((q) => q.value === props.queue) ? (props.queue as CardQueue) : 'all'
)
const count = ref<number>(30)
const chosen = ref<StatKey[]>([...LEDGER_DEFAULT])
const championId = ref(props.champion ?? 0)
/** Set once the viewer picks a picture, which then stays whatever the window holds. */
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
      /* No role then: the line is left out. */
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

/* ── What the cards say ──────────────────────────────────────── */

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

const rankRow = computed<Rank | null>(() => {
  const current = (props.ranks?.current ?? []).filter((r) => r.tier)
  const wanted = queue.value === 'flex' ? 'RANKED_FLEX_SR' : 'RANKED_SOLO_5x5'
  return (
    current.find((r) => r.queueType === wanted) ??
    current.find((r) => r.queueType === 'RANKED_SOLO_5x5' || r.queueType === 'RANKED_FLEX_SR') ??
    null
  )
})

const rank = computed<CardRank | null>(() => {
  const row = rankRow.value
  if (!row) return null
  return {
    name: rankLabel(rankFromCore(row), false),
    tier: row.tier.toLowerCase(),
    lp: row.leaguePoints,
    queue: row.queueType === 'RANKED_FLEX_SR' ? 'Flex' : 'Solo/Duo',
  }
})

const data = computed<CardData>(() => ({
  figures: payload.value?.global ?? null,
  role: role.value,
  rank: rank.value,
}))
const lines = computed(() => linesFor(data.value, chosen.value))

/** The LP at the end of each of the last 30 days, from the rank snapshots, and what it gained. */
const lpDays = computed(() => {
  const row = rankRow.value
  if (!row) return null
  const value = (r: Rank) => {
    const v = rankValue(rankFromCore(r))
    return v === null ? null : Math.round(v * 100)
  }
  const pts = (props.ranks?.history ?? [])
    .filter((r) => r.queueType === row.queueType && r.tier && r.fetchedAt)
    .map((r) => ({ t: new Date(r.fetchedAt!).getTime(), v: value(r) }))
    .filter((p): p is { t: number; v: number } => p.v !== null)
    .sort((a, b) => a.t - b.t)
  const now = value(row)
  if (now !== null) pts.push({ t: Date.now(), v: now })
  const DAY = 864e5
  const first = Date.now() - 29 * DAY
  const inside = pts.filter((p) => p.t >= first)
  if (inside.length < 2) return null
  let prev = pts.filter((p) => p.t < first).at(-1)?.v ?? inside[0].v
  const start = prev
  const days: number[] = []
  for (let i = 0; i < 30; i++) {
    const day = inside.filter((p) => p.t >= first + i * DAY && p.t < first + (i + 1) * DAY)
    if (day.length) prev = day.at(-1)!.v
    days.push(prev)
  }
  return { days, gain: days.at(-1)! - start }
})

/** The champion card's champion: the picture's when it was played in the window, else the most played. */
const champ = computed(() => {
  const played = [...(payload.value?.champions ?? [])].sort((a, b) => b.games - a.games)
  return played.find((c) => c.championId === championId.value) ?? played[0] ?? null
})
const championName = (id: number) => allChampions.value.find((c) => c.id === id)?.name ?? ''

const statOptions = computed(() =>
  STATS.filter((s) => !chosen.value.includes(s.key) && (s.key !== 'rank' || rank.value)).map(
    (s) => ({ value: s.key, label: s.label })
  )
)
const adding = ref<StatKey | ''>('')
watch(adding, (key) => {
  if (!key) return
  if (chosen.value.length < MAX_STATS) chosen.value = [...chosen.value, key]
  adding.value = ''
})
const remove = (key: StatKey) => (chosen.value = chosen.value.filter((k) => k !== key))

/* Reordering: drag a line by its handle, or move it with the arrow keys. */
const dragging = ref<StatKey | null>(null)
function moveTo(key: StatKey, over: StatKey) {
  if (key === over) return
  const list = chosen.value.filter((k) => k !== key)
  list.splice(list.indexOf(over) + (chosen.value.indexOf(key) < chosen.value.indexOf(over) ? 1 : 0), 0, key)
  chosen.value = list
}
function nudge(key: StatKey, by: number) {
  const i = chosen.value.indexOf(key)
  const j = i + by
  if (j < 0 || j >= chosen.value.length) return
  const list = [...chosen.value]
  ;[list[i], list[j]] = [list[j], list[i]]
  chosen.value = list
}

const championOptions = computed(() => {
  const played = [...(payload.value?.champions ?? [])].sort((a, b) => b.games - a.games)
  const seen = new Set(played.map((c) => c.championId))
  const name = (id: number) => championName(id) || `Champion ${id}`
  const options = [
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
    options.unshift({ value: championId.value, label: name(championId.value), icon: champIcon(championId.value) })
  }
  return options
})

const skinOptions = computed(() =>
  skins.value.length
    ? skins.value.map((s) => ({ value: s.num, label: s.num === 0 ? 'Default skin' : s.name }))
    : [{ value: 0, label: 'Default skin' }]
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

const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const tagLine = computed(() => {
  const region = regionLabel(props.profile.platform)
  return `#${props.profile.tagLine}${region ? ` · ${region}` : ''}`
})

/** Everything one card needs, images loaded. */
async function inputFor(k: CardKind, f: CardFormat): Promise<CardInput> {
  const total = payload.value?.global.total ?? 0
  const tiers = new Set<string>()
  if (rank.value) tiers.add(rank.value.tier)
  const c = champ.value
  const art = k === 'champion' && c ? c.championId : championId.value
  const artSkin = art === championId.value ? skin.value : 0
  const [icon, splash, ...emblems] = await Promise.all([
    k === 'champion' && c ? image(champIcon(c.championId)) : image(profileIcon(props.profile.profileIconId)),
    art ? image(skinSplash(art, artSkin)) : null,
    ...[...tiers].map((t) => image(assetUrl('rank', t))),
  ])
  const emblemMap = Object.fromEntries([...tiers].map((t, i) => [t, emblems[i]]))
  const name = props.profile.gameName
  if (k === 'ranked' && rank.value) {
    const row = rankRow.value!
    const games = row.losses === null ? 0 : row.wins + row.losses
    return {
      format: f,
      kind: k,
      title: name,
      subtitle: tagLine.value,
      icon,
      splash,
      kicker: `Ranked ${rank.value.queue}`,
      kickerRight: games ? `${row.wins}W ${row.losses}L · ${Math.round((row.wins / games) * 100)}%` : '',
      lines: [],
      emblems: emblemMap,
      ranked: { tier: rank.value.tier, name: rank.value.name, lp: rank.value.lp, days: lpDays.value?.days ?? [], gain: lpDays.value?.gain ?? 0 },
      date: today,
    }
  }
  if (k === 'champion' && c) {
    return {
      format: f,
      kind: k,
      title: championName(c.championId) || 'Champion',
      subtitle: `${name} #${props.profile.tagLine}`,
      icon,
      splash,
      kicker: 'Most played',
      kickerRight: total ? windowLabel(total, queue.value).replace('Last ', '').replace(/^\d+ games?, /, '') : '',
      lines: championLines(c),
      emblems: emblemMap,
      date: today,
    }
  }
  return {
    format: f,
    kind: 'stats',
    title: name,
    subtitle: tagLine.value,
    icon,
    splash,
    kicker: total ? windowLabel(total, queue.value) : 'No games in this window',
    kickerRight: total && payload.value ? record(payload.value.global.winrate, total) : '',
    lines: lines.value,
    emblems: emblemMap,
    date: today,
  }
}

const palette = () => {
  const style = getComputedStyle(probe.value!)
  return (token: string) => style.getPropertyValue(token).trim()
}

let drawn = 0
async function render() {
  const version = ++drawn
  const timer = setTimeout(() => (slowDraw.value = true), 200)
  const [input] = await Promise.all([inputFor(kind.value, format.value), loadCardFonts()])
  clearTimeout(timer)
  // A newer draw started meanwhile: let it land instead, in one go.
  if (version !== drawn || !canvas.value || !probe.value) return
  slowDraw.value = false
  const off = document.createElement('canvas')
  drawCard(off, input, palette())
  canvas.value.width = off.width
  canvas.value.height = off.height
  canvas.value.getContext('2d')!.drawImage(off, 0, 0)
}

/* The ready cards, drawn small as square cards. */
const kinds = computed(() =>
  (
    [
      { value: 'ranked', title: 'Ranked', sub: rank.value ? `${rank.value.name}${lpDays.value ? `, ${lpDays.value.gain >= 0 ? '+' : '−'}${Math.abs(lpDays.value.gain)} LP` : ''}` : '' },
      { value: 'stats', title: `Last ${payload.value?.global.total || count.value} games`, sub: `${lines.value.length} line${lines.value.length === 1 ? '' : 's'}` },
      { value: 'champion', title: champ.value ? championName(champ.value.championId) || 'Champion' : 'Champion', sub: champ.value ? `${champ.value.games} games, ${Math.round(champ.value.winrate * 100)}%` : '' },
    ] as Array<{ value: CardKind; title: string; sub: string }>
  ).filter((k) => (k.value === 'ranked' ? rank.value : k.value === 'champion' ? champ.value : true))
)
const thumbs = ref<Record<string, HTMLCanvasElement | null>>({})
let thumbVersion = 0
async function renderThumbs() {
  const version = ++thumbVersion
  await loadCardFonts()
  for (const k of kinds.value) {
    const input = await inputFor(k.value, 'square')
    if (version !== thumbVersion || !probe.value) return
    const el = thumbs.value[k.value]
    if (!el) continue
    const off = document.createElement('canvas')
    drawCard(off, input, palette())
    el.width = 276
    el.height = 276
    el.getContext('2d')!.drawImage(off, 0, 0, 276, 276)
  }
}
const setThumb = (k: string) => (el: unknown) => (thumbs.value[k] = (el as HTMLCanvasElement) ?? null)

watch([format, kind, championId, skin, lines, rank, lpDays, champ, () => payload.value?.global.total], () => void render())
watch([kinds, championId, skin, lines, lpDays, champ], () => void renderThumbs())
onMounted(() => {
  void render()
  void renderThumbs()
})

/* ── Actions ─────────────────────────────────────────────────── */

function flash(what: 'link' | 'image', text: string) {
  copied.value = what
  message.value = text
  setTimeout(() => (copied.value = ''), 2000)
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(url.value)
    flash('link', 'Link copied')
  } catch {
    message.value = 'Select and copy the link.'
  }
}

async function blob() {
  await render()
  return new Promise<Blob>((resolve, reject) =>
    canvas.value!.toBlob((b) => (b ? resolve(b) : reject(new Error())), 'image/png')
  )
}

async function copyImage() {
  busy.value = true
  message.value = ''
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob() })])
    flash('image', 'Image copied')
  } catch {
    message.value = 'This browser cannot copy images. Download it instead.'
  } finally {
    busy.value = false
  }
}

async function download() {
  busy.value = true
  message.value = ''
  try {
    const href = URL.createObjectURL(await blob())
    const link = document.createElement('a')
    link.href = href
    link.download = `${props.profile.gameName}-invade-${kind.value}-${format.value}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    message.value = 'Card downloaded'
  } catch {
    message.value = 'Could not create the image. You can still copy the link.'
  } finally {
    busy.value = false
  }
}

const shortUrl = computed(() => url.value.replace(/^https?:\/\//, ''))
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

    <div class="sh-h">
      <Icon name="share" :size="16" />
      <h2 id="share-title" class="h3">Share this profile</h2>
      <span class="sh-who meta"
        ><img :src="profileIcon(profile.profileIconId)" alt="" />{{ profile.gameName }}
        <span class="t4">#{{ profile.tagLine }}</span></span
      >
      <div class="seg sh-fmt" role="group" aria-label="Format">
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
      <button type="button" class="btn ghost ico sm" aria-label="Close" @click="emit('close')">
        <Icon name="x" />
      </button>
    </div>

    <div class="sh-body">
      <!-- The card itself: the canvas the copy and the download save. -->
      <div class="sh-prev" :class="format">
        <canvas ref="canvas" role="img" :aria-label="`Share card for ${profile.gameName}`" :class="{ slow }" />
      </div>

      <div class="sh-ctl">
        <section>
          <div class="sh-gh">
            <span class="lab">Ready cards</span>
            <span class="meta">From your last {{ payload?.global.total || count }} games</span>
          </div>
          <div class="sh-gal">
            <button
              v-for="k in kinds"
              :key="k.value"
              type="button"
              class="sh-g"
              :class="{ on: kind === k.value }"
              :aria-pressed="kind === k.value"
              @click="kind = k.value"
            >
              <canvas :ref="setThumb(k.value)" aria-hidden="true" />
              <b>{{ k.title }}</b>
              <span>{{ k.sub }}</span>
            </button>
          </div>
        </section>

        <div class="sh-opts">
          <div class="col" style="gap: 20px; min-width: 0">
            <section>
              <div class="sh-gh">
                <span class="lab">Games</span>
                <span v-if="payload?.global.total" class="meta num"
                  >{{ payload.global.total }} games, {{ record(payload.global.winrate, payload.global.total) }}</span
                >
              </div>
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
            </section>

            <section>
              <div class="sh-gh"><span class="lab">Picture</span></div>
              <div class="col" style="gap: 6px">
                <Select
                  v-model="championId"
                  @update:model-value="pickedChampion"
                  :options="championOptions"
                  searchable
                  search-placeholder="Find a champion"
                  width="17rem"
                />
                <Select
                  v-if="championId"
                  v-model="skin"
                  :options="skinOptions"
                  :searchable="skinOptions.length > 8"
                  search-placeholder="Find a skin"
                  width="17rem"
                />
              </div>
            </section>
          </div>

          <section v-if="kind === 'stats'">
            <div class="sh-gh">
              <span class="lab">Lines</span>
              <span class="meta num">{{ chosen.length }} of {{ MAX_STATS }}</span>
            </div>
            <ol class="sh-lines">
              <li
                v-for="key in chosen"
                :key="key"
                class="sh-line"
                :class="{ drag: dragging === key }"
                draggable="true"
                @dragstart="dragging = key"
                @dragend="dragging = null"
                @dragover.prevent="dragging && moveTo(dragging, key)"
              >
                <button
                  type="button"
                  class="sh-hd"
                  :aria-label="`Move ${STATS.find((s) => s.key === key)?.label}`"
                  title="Drag, or use the arrow keys"
                  @keydown.up.prevent="nudge(key, -1)"
                  @keydown.down.prevent="nudge(key, 1)"
                >
                  <i /><i /><i />
                </button>
                <span class="ell">{{ STATS.find((s) => s.key === key)?.label }}</span>
                <b class="num">{{ lines.find((l) => l.key === key)?.value ?? '–' }}</b>
                <button
                  type="button"
                  class="sh-rm"
                  :aria-label="`Remove ${STATS.find((s) => s.key === key)?.label}`"
                  @click="remove(key)"
                >
                  <Icon name="x" :size="13" />
                </button>
              </li>
            </ol>
            <Select
              v-if="chosen.length < MAX_STATS && statOptions.length"
              v-model="adding"
              :options="statOptions"
              placeholder="Add a line"
              width="15rem"
              class="sh-add"
            />
          </section>
        </div>
      </div>
    </div>

    <div class="sh-foot">
      <label class="field sh-link">
        <Icon name="external" />
        <input
          :value="shortUrl"
          readonly
          aria-label="Profile link"
          @focus="(e) => (e.target as HTMLInputElement).select()"
        />
        <button type="button" class="sh-cp" @click="copyLink">
          <Icon :name="copied === 'link' ? 'check' : 'share'" :size="14" />{{ copied === 'link' ? 'Copied' : 'Copy link' }}
        </button>
      </label>
      <span v-if="message" class="meta sh-msg" role="status">{{ message }}</span>
      <div class="row sh-acts">
        <button type="button" class="btn" :disabled="busy" @click="copyImage">
          <Icon :name="copied === 'image' ? 'check' : 'layers'" />{{ copied === 'image' ? 'Copied' : 'Copy image' }}
        </button>
        <button type="button" class="btn pri" :disabled="busy" @click="download">
          <Icon name="download" />{{ busy ? 'Rendering…' : 'Download PNG' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* A dialog is a popover: opaque, a hairline border, the only kind of shadow. */
.share {
  width: min(1100px, calc(100% - 24px));
  margin: auto;
  padding: 0;
  color: var(--t1);
  background: var(--s1);
  border: 1px solid var(--line-2);
  border-radius: var(--r3);
  box-shadow: var(--drop);
}
.share::backdrop {
  background: rgb(0 0 0 / 0.62);
}
@media (min-width: 900px) {
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
.sh-h {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 14px 20px;
  border-bottom: 1px solid var(--line);
}
.sh-h > .i {
  color: var(--v300);
}
.sh-who {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 6px;
  font-weight: 600;
}
.sh-who img {
  width: 18px;
  height: 18px;
  border-radius: 5px;
}
.sh-fmt {
  margin-left: auto;
}
.sh-body {
  display: grid;
  grid-template-columns: 440px minmax(0, 1fr);
  gap: 24px;
  padding: 20px;
}
.sh-prev {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: 440px;
}
.sh-prev canvas {
  max-width: 100%;
  max-height: min(560px, calc(100dvh - 230px));
  border-radius: 12px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.06), 0 10px 30px rgb(0 0 0 / 0.45);
  transition: opacity 160ms var(--ease);
}
.sh-prev.wide {
  align-items: center;
}
.sh-prev canvas.slow {
  opacity: 0.85;
}
.sh-ctl {
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-width: 0;
}
.sh-gh {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.sh-gal {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.sh-g {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 6px 8px;
  border-radius: 12px;
  text-align: left;
  transition: background 160ms var(--ease);
}
.sh-g:hover {
  background: rgb(255 255 255 / 0.03);
}
.sh-g canvas {
  width: 100%;
  aspect-ratio: 1;
  margin-bottom: 4px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08), 0 2px 6px rgb(0 0 0 / 0.5);
}
.sh-g b {
  font-size: 13px;
  font-weight: 700;
  color: var(--t2);
}
.sh-g span {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--t3);
}
.sh-g.on {
  background: var(--key, var(--s2));
  box-shadow: var(--key-sh, none), inset 0 0 0 1px rgb(var(--v-rgb) / 0.5);
}
.sh-g.on b {
  color: var(--t1);
}
.sh-opts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
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
.sh-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sh-line {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto 22px;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 6px 0 4px;
  border-radius: 8px;
  background: var(--well, var(--s2));
  box-shadow: inset 0 0 0 1px var(--line);
  font-size: 13px;
  font-weight: 600;
  color: var(--t2);
}
.sh-line.drag {
  opacity: 0.5;
}
.sh-line b {
  color: var(--t1);
  font-weight: 700;
}
.sh-hd {
  display: grid;
  grid-template-columns: 3px 3px;
  gap: 3px;
  justify-content: center;
  height: 24px;
  align-content: center;
  cursor: grab;
}
.sh-hd i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--t4);
  box-shadow: 6px 0 0 var(--t4);
}
.sh-rm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--t3);
}
.sh-rm:hover {
  color: var(--t1);
  background: rgb(255 255 255 / 0.06);
}
.sh-add {
  margin-top: 6px;
}
.sh-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid var(--line);
}
.sh-link {
  flex: 0 1 380px;
  min-width: 0;
  height: 38px;
}
.sh-link input {
  min-width: 0;
  color: var(--t2);
}
.sh-cp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  font-size: 13px;
  font-weight: 650;
  color: var(--v200);
}
.sh-msg {
  margin-left: 4px;
}
.sh-acts {
  gap: 8px;
  margin-left: auto;
}
@media (max-width: 899px) {
  .sh-body,
  .sh-opts {
    grid-template-columns: minmax(0, 1fr);
  }
  .sh-prev {
    min-height: 0;
  }
  .sh-prev canvas {
    max-height: 56vh;
  }
  .sh-fmt {
    order: 5;
    width: 100%;
  }
  .sh-h {
    flex-wrap: wrap;
  }
  .sh-foot {
    flex-wrap: wrap;
  }
  .sh-link {
    flex: 1 1 100%;
  }
}
</style>
