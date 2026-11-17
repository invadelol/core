<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { rankFromCore, rankLabel } from '@invadelol/ui/logic'
import Icon from './ui/Icon.vue'
import Select from './ui/Select.vue'
import { champIcon, profileIcon } from '../lib/assets.js'
import {
  CARD_COUNTS,
  CARD_DEFAULTS,
  CARD_QUEUES,
  FORMATS,
  MAX_STATS,
  STATS,
  cardImagePath,
  cardPagePath,
  record,
  type CardFormat,
  type CardKind,
  type CardQueue,
  type CardSettings,
  type StatKey,
} from '../lib/share_card.js'
import type { RanksPayload, StatsPayload, Summoner } from '../lib/types.js'

/**
 * Share this profile. It opens simple: the card, three ready cards to pick from, the link and the
 * image. "Customize" opens the rest (the games counted, the picture, the figures and their order).
 * The card is drawn on the server from its link, so the link shared is the card, and it keeps
 * showing the player's figures of the day wherever it was posted.
 */
const props = defineProps<{
  profile: Summoner
  stats: StatsPayload | null
  ranks?: RanksPayload | null
  champion?: number
  /** The profile's queue filter, the card's first queue when it offers it. */
  queue?: string
}>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()
const message = ref('')
const copied = ref<'' | 'link' | 'image'>('')
const busy = ref(false)
const customizing = ref(false)
const origin = ref('')

/* ── The card's settings ─────────────────────────────────────── */

const format = ref<CardFormat>('wide')
const kind = ref<CardKind>('stats')
const queue = ref<CardQueue>(
  CARD_QUEUES.some((q) => q.value === props.queue) ? (props.queue as CardQueue) : 'all'
)
const count = ref<number>(CARD_DEFAULTS.count)
const lines = ref<StatKey[]>([...CARD_DEFAULTS.lines])
/** 0: the most played champion of the window, decided by the server each time. */
const championId = ref(props.champion ?? 0)
const skin = ref(0)

const settings = (k: CardKind = kind.value, f: CardFormat = format.value): CardSettings => ({
  kind: k,
  format: f,
  queue: queue.value,
  count: count.value,
  lines: lines.value,
  champion: championId.value,
  skin: skin.value,
})
const slug = computed(() => `${props.profile.gameName}-${props.profile.tagLine}`)

/** The image, debounced while the player is still clicking through the options. */
const imageUrl = ref(cardImagePath(slug.value, settings()))
const loading = ref(true)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => cardImagePath(slug.value, settings()),
  (next) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (next === imageUrl.value) return
      loading.value = true
      imageUrl.value = next
    }, 250)
  }
)
const thumbUrl = (k: CardKind) => cardImagePath(slug.value, settings(k, 'square'))
const pageUrl = computed(() => `${origin.value}${cardPagePath(slug.value, settings())}`)
const shownUrl = computed(() => pageUrl.value.replace(/^https?:\/\//, ''))

/* ── What the options and ready cards say ────────────────────── */

const payload = shallowRef<StatsPayload | null>(props.stats)
const allChampions = shallowRef<Array<{ id: number; name: string }>>([])
const skins = shallowRef<Array<{ num: number; name: string }>>([])

let statsController: AbortController | undefined
watch(
  [queue, count],
  async () => {
    statsController?.abort()
    const controller = (statsController = new AbortController())
    const type = queue.value === 'all' ? '' : `&type=${queue.value}`
    try {
      const res = await fetch(
        `/api/summoners/puuid/${props.profile.puuid}/stats?count=${count.value}${type}`,
        { signal: controller.signal }
      )
      if (res.ok) payload.value = (await res.json()) as StatsPayload
    } catch {
      /* The last answer stays. */
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
  origin.value = location.origin
  dialog.value?.showModal()
  try {
    const res = await fetch('/cdn/names/champion')
    if (!res.ok) return
    const names = (await res.json()) as Record<string, string>
    allChampions.value = Object.entries(names)
      .map(([id, name]) => ({ id: Number(id), name }))
      .filter((c) => c.id > 0 && c.id < 10_000)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    /* The player's own champions stay offered. */
  }
})

onBeforeUnmount(() => {
  statsController?.abort()
  clearTimeout(timer)
  dialog.value?.close()
})

const championName = (id: number) => allChampions.value.find((c) => c.id === id)?.name ?? ''
const played = computed(() =>
  [...(payload.value?.champions ?? [])].sort((a, b) => b.games - a.games)
)
const rankRow = computed(() => {
  const current = (props.ranks?.current ?? []).filter((r) => r.tier)
  const wanted = queue.value === 'flex' ? 'RANKED_FLEX_SR' : 'RANKED_SOLO_5x5'
  return (
    current.find((r) => r.queueType === wanted) ??
    current.find((r) => r.queueType === 'RANKED_SOLO_5x5' || r.queueType === 'RANKED_FLEX_SR') ??
    null
  )
})

const kinds = computed(() => {
  const total = payload.value?.global.total ?? 0
  const champ = played.value.find((c) => c.championId === championId.value) ?? played.value[0]
  const list: Array<{ value: CardKind; title: string; sub: string }> = [
    {
      value: 'stats',
      title: total ? `Last ${total} games` : 'Last games',
      sub: total && payload.value ? record(payload.value.global.winrate, total) : '',
    },
  ]
  if (rankRow.value)
    list.push({
      value: 'ranked',
      title: 'Ranked',
      sub: `${rankLabel(rankFromCore(rankRow.value), false)}, ${rankRow.value.leaguePoints} LP`,
    })
  if (champ)
    list.push({
      value: 'champion',
      title: championName(champ.championId) || 'Champion',
      sub: `${champ.games} games, ${Math.round(champ.winrate * 100)}%`,
    })
  return list
})
const loadedThumbs = ref<Record<string, boolean>>({})

/* ── Customize ───────────────────────────────────────────────── */

const formats = Object.entries(FORMATS) as Array<[CardFormat, (typeof FORMATS)[CardFormat]]>
// The main role needs every game's lane: the card leaves it out.
const offered = computed(() =>
  STATS.filter((s) => s.key !== 'role' && (s.key !== 'rank' || rankRow.value))
)
const labelOf = (key: StatKey) => STATS.find((s) => s.key === key)?.label ?? key
const addOptions = computed(() =>
  offered.value
    .filter((s) => !lines.value.includes(s.key))
    .map((s) => ({ value: s.key, label: s.label }))
)
const adding = ref<StatKey | ''>('')
watch(adding, (key) => {
  if (!key) return
  if (lines.value.length < MAX_STATS) lines.value = [...lines.value, key]
  adding.value = ''
})
const remove = (key: StatKey) => {
  if (lines.value.length > 1) lines.value = lines.value.filter((k) => k !== key)
}
const dragging = ref<StatKey | null>(null)
function moveTo(key: StatKey, over: StatKey) {
  if (key === over) return
  const to = lines.value.indexOf(over)
  const list = lines.value.filter((k) => k !== key)
  list.splice(to, 0, key)
  lines.value = list
}
function nudge(key: StatKey, by: number) {
  const i = lines.value.indexOf(key)
  const j = i + by
  if (j < 0 || j >= lines.value.length) return
  const list = [...lines.value]
  ;[list[i], list[j]] = [list[j], list[i]]
  lines.value = list
}

const championOptions = computed(() => {
  const seen = new Set(played.value.map((c) => c.championId))
  return [
    { value: 0, label: 'Most played' },
    ...played.value.map((c) => ({
      value: c.championId,
      label: championName(c.championId) || `Champion ${c.championId}`,
      icon: champIcon(c.championId),
      meta: `${c.games}`,
    })),
    ...allChampions.value
      .filter((c) => !seen.has(c.id))
      .map((c) => ({ value: c.id, label: c.name, icon: champIcon(c.id) })),
  ]
})
const skinOptions = computed(() =>
  skins.value.length
    ? skins.value.map((s) => ({ value: s.num, label: s.num === 0 ? 'Default skin' : s.name }))
    : [{ value: 0, label: 'Default skin' }]
)

/* ── Actions ─────────────────────────────────────────────────── */

function flash(what: 'link' | 'image', text: string) {
  copied.value = what
  message.value = text
  setTimeout(() => (copied.value = ''), 2000)
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(pageUrl.value)
    flash('link', 'Link copied')
  } catch {
    message.value = 'Select and copy the link.'
  }
}

async function image() {
  const res = await fetch(cardImagePath(slug.value, settings()))
  if (!res.ok) throw new Error()
  return res.blob()
}

async function copyImage() {
  busy.value = true
  message.value = ''
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': image() })])
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
    const href = URL.createObjectURL(await image())
    const link = document.createElement('a')
    link.href = href
    link.download = `${props.profile.gameName}-invade-${kind.value}-${format.value}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    message.value = 'Card downloaded'
  } catch {
    message.value = 'Could not get the image. You can still copy the link.'
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
      <div class="sh-prev" :class="format">
        <img
          :src="imageUrl"
          :alt="`Share card for ${profile.gameName}`"
          :class="{ slow: loading }"
          @load="loading = false"
          @error="loading = false"
        />
      </div>

      <!-- At first: the ready cards and nothing else to decide. -->
      <div v-if="!customizing" class="sh-ctl">
        <section>
          <div class="sh-gh"><span class="lab">Ready cards</span></div>
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
              <span class="sh-th" :class="{ ready: loadedThumbs[k.value] }"
                ><img
                  :src="thumbUrl(k.value)"
                  alt=""
                  loading="lazy"
                  @load="loadedThumbs[k.value] = true"
              /></span>
              <b>{{ k.title }}</b>
              <span class="sh-sub">{{ k.sub }}</span>
            </button>
          </div>
        </section>
        <button type="button" class="btn sh-cz" @click="customizing = true">
          <Icon name="sliders" />Customize<span class="meta">games, picture, figures</span>
        </button>
      </div>

      <!-- Customize: everything else. -->
      <div v-else class="sh-ctl">
        <div class="sh-gh">
          <button type="button" class="btn ghost sm sh-back" @click="customizing = false">
            <Icon name="back" />Ready cards
          </button>
        </div>
        <section>
          <div class="sh-gh">
            <span class="lab">Games</span>
            <span v-if="payload?.global.total" class="meta num"
              >{{ payload.global.total }},
              {{ record(payload.global.winrate, payload.global.total) }}</span
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
              :options="championOptions"
              searchable
              search-placeholder="Find a champion"
              width="18rem"
            />
            <Select
              v-if="championId"
              v-model="skin"
              :options="skinOptions"
              :searchable="skinOptions.length > 8"
              search-placeholder="Find a skin"
              width="18rem"
            />
          </div>
        </section>
        <section v-if="kind === 'stats'">
          <div class="sh-gh">
            <span class="lab">Figures</span>
            <span class="meta num">{{ lines.length }} of {{ MAX_STATS }}</span>
          </div>
          <ol class="sh-lines">
            <li
              v-for="key in lines"
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
                :aria-label="`Move ${labelOf(key)}`"
                title="Drag, or use the arrow keys"
                @keydown.up.prevent="nudge(key, -1)"
                @keydown.down.prevent="nudge(key, 1)"
              >
                <i /><i /><i />
              </button>
              <span class="ell">{{ labelOf(key) }}</span>
              <button
                type="button"
                class="sh-rm"
                :disabled="lines.length === 1"
                :aria-label="`Remove ${labelOf(key)}`"
                @click="remove(key)"
              >
                <Icon name="x" :size="13" />
              </button>
            </li>
          </ol>
          <Select
            v-if="lines.length < MAX_STATS && addOptions.length"
            v-model="adding"
            :options="addOptions"
            placeholder="Add a figure"
            width="15rem"
            class="sh-add"
          />
        </section>
      </div>
    </div>

    <div class="sh-foot">
      <label class="field sh-link">
        <Icon name="external" />
        <input
          :value="shownUrl"
          readonly
          aria-label="Link to this card"
          @focus="(e) => (e.target as HTMLInputElement).select()"
        />
        <button type="button" class="sh-cp" @click="copyLink">
          <Icon :name="copied === 'link' ? 'check' : 'share'" :size="14" />{{
            copied === 'link' ? 'Copied' : 'Copy link'
          }}
        </button>
      </label>
      <span v-if="message" class="meta sh-msg" role="status">{{ message }}</span>
      <div class="row sh-acts">
        <button type="button" class="btn" :disabled="busy" @click="copyImage">
          <Icon :name="copied === 'image' ? 'check' : 'layers'" />{{
            copied === 'image' ? 'Copied' : 'Copy image'
          }}
        </button>
        <button type="button" class="btn pri" :disabled="busy" @click="download">
          <Icon name="download" />{{ busy ? 'Preparing…' : 'Download PNG' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.share {
  width: min(1060px, calc(100% - 24px));
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
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  padding: 20px;
}
.sh-prev {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 380px;
}
.sh-prev img {
  max-width: 100%;
  max-height: min(520px, calc(100dvh - 240px));
  border-radius: 12px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.06),
    0 10px 30px rgb(0 0 0 / 0.45);
  transition: opacity 160ms var(--ease);
}
.sh-prev img.slow {
  opacity: 0.6;
}
.sh-ctl {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sh-g {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 14px;
  align-items: center;
  padding: 8px;
  border-radius: 12px;
  text-align: left;
  transition: background 160ms var(--ease);
}
.sh-g:hover {
  background: rgb(255 255 255 / 0.03);
}
.sh-th {
  grid-row: span 2;
  width: 64px;
  height: 64px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--s3);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.08),
    0 2px 6px rgb(0 0 0 / 0.5);
}
.sh-th img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 200ms var(--ease);
}
.sh-th.ready img {
  opacity: 1;
}
.sh-g b {
  align-self: end;
  font-size: 14px;
  font-weight: 700;
  color: var(--t2);
}
.sh-sub {
  align-self: start;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t3);
}
.sh-g.on {
  background: var(--key, var(--s2));
  box-shadow:
    var(--key-sh, 0 0 0 0 transparent),
    inset 0 0 0 1px rgb(var(--v-rgb) / 0.5);
}
.sh-g.on b {
  color: var(--t1);
}
.sh-cz {
  justify-content: flex-start;
  height: 44px;
}
.sh-cz .meta {
  margin-left: auto;
  font-size: 12px;
}
.sh-back {
  margin-left: -8px;
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
  grid-template-columns: 18px minmax(0, 1fr) 22px;
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
.sh-hd {
  display: grid;
  gap: 3px;
  justify-content: center;
  align-content: center;
  height: 24px;
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
.sh-rm:hover:not(:disabled) {
  color: var(--t1);
  background: rgb(255 255 255 / 0.06);
}
.sh-rm:disabled {
  opacity: 0.3;
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
  flex: 0 1 460px;
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
.sh-acts {
  gap: 8px;
  margin-left: auto;
}
@media (max-width: 899px) {
  .sh-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .sh-prev {
    min-height: 0;
  }
  .sh-prev img {
    max-height: 56vh;
  }
  .sh-h,
  .sh-foot {
    flex-wrap: wrap;
  }
  .sh-fmt {
    order: 5;
    width: 100%;
  }
  .sh-link {
    flex: 1 1 100%;
  }
}
</style>
