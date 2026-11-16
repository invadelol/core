<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from '../ui/Icon.vue'
import RankEmblem from '../ui/RankEmblem.vue'
import { profileIcon, regionLabel } from '../../lib/assets.js'
import { regionFlag } from '../../lib/flags.js'
import { rankWords, since } from '../../lib/ladders.js'
import { MAX_PLAYERS, parseRiotIds, type RiotIdentity } from '../../lib/multisearch.js'
import { recentPlayers, type RecentPlayer } from '../../lib/recent.js'

/**
 * The multisearch's field: the lobby as chips, one per player, and a name being typed after them.
 * The name is completed from the players the site already stores (`/api/summoners/search`, no
 * Riot call), the ones searched before on this device first, those of the picked server next.
 * Enter adds the highlighted player (or scouts when nothing is typed), a comma moves on to the
 * next name, backspace in an empty field removes the last chip. A pasted lobby becomes chips at
 * once; a pasted name without its `#TAG` is offered to complete, one after the other.
 */
const props = withDefaults(
  defineProps<{
    /** The server picked beside the field (`euw`), or `auto`: its players come first. */
    region?: string
    /** What the page learnt of each chip (by `name#tag`, lower case): icon, rank, not found. */
    known?: Record<string, { icon?: number | null; tier?: string | null; missing?: boolean }>
  }>(),
  { region: 'auto', known: () => ({}) }
)
const chips = defineModel<RiotIdentity[]>({ required: true })
const emit = defineEmits<{
  /** Scout the chips: Enter with nothing typed, or the button. */
  submit: []
  /** A paste added chips and left nothing to complete (the page scouts them). */
  pasted: []
  /** The last name a paste left without a tag was just completed. */
  resolved: []
  /** A chip was taken out. */
  removed: [player: RiotIdentity]
}>()

interface Result {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number | null
  platform?: string
  summonerLevel?: number | null
}
interface Suggestion extends Result {
  /** When this device last searched them, and their rank then. */
  recent?: RecentPlayer
}

const input = ref<HTMLInputElement>()
const typed = ref('')
const focused = ref(false)
const results = ref<Result[]>([])
const loading = ref(false)
const active = ref(0)
/** Closed by Escape or a blur until the next keystroke. */
const dismissed = ref(true)
/** After a paste: the names left without a tag, completed one after the other. */
const pending = ref<string[]>([])
/** Icons of the players picked from the suggestions, until the page knows them. */
const picked = ref<Record<string, number | null>>({})
const listId = `ms-sug-${Math.random().toString(36).slice(2, 8)}`

const TAG = /^[\p{L}\p{N}]{2,5}$/u
const keyOf = (p: { gameName: string; tagLine: string }) =>
  `${p.gameName}#${p.tagLine}`.toLowerCase()

/** What is typed, as a name and a tag (null until a `#`). */
const parts = computed(() => {
  const text = typed.value.trim()
  const hash = text.indexOf('#')
  return {
    name: (hash >= 0 ? text.slice(0, hash) : text).trim(),
    tag: hash >= 0 ? text.slice(hash + 1).trim() : null,
  }
})
/** A whole Riot ID typed out. */
const whole = computed<RiotIdentity | null>(() => {
  const { name, tag } = parts.value
  return name.length >= 2 && tag !== null && TAG.test(tag)
    ? { gameName: name.replace(/\s+/g, ' '), tagLine: tag }
    : null
})
const term = computed(() => (parts.value.name.length >= 2 ? parts.value.name : ''))
const full = computed(() => chips.value.length >= MAX_PLAYERS)
/** Completing a name a paste left without its tag. */
const fixingName = ref(false)
const fixing = computed(() => fixingName.value && !!typed.value)

/* ── Asking the site (debounced, one answer kept per name) ─────── */
const answered = new Map<string, Result[]>()
let debounce: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
watch(term, (q) => lookup(q))
function lookup(q: string) {
  clearTimeout(debounce)
  controller?.abort()
  loading.value = false
  active.value = 0
  if (!q) {
    results.value = []
    return
  }
  const kept = answered.get(q.toLowerCase())
  if (kept) {
    results.value = kept
    return
  }
  loading.value = true
  debounce = setTimeout(() => search(q), 140)
}
async function search(q: string) {
  controller = new AbortController()
  const { signal } = controller
  try {
    const res = await fetch(`/api/summoners/search?q=${encodeURIComponent(q)}&limit=8`, { signal })
    if (!res.ok) return
    const data: Result[] = await res.json()
    if (signal.aborted) return
    answered.set(q.toLowerCase(), data)
    if (term.value.toLowerCase() === q.toLowerCase()) results.value = data
  } catch {
    // Keep what was shown: an empty list would read as "no such player".
  } finally {
    if (!signal.aborted) loading.value = false
  }
}
onBeforeUnmount(() => {
  clearTimeout(debounce)
  controller?.abort()
})

/** The players this device searched before (lib/recent.ts), read once the page is in the browser. */
const recents = ref<RecentPlayer[]>([])
onMounted(() => {
  recents.value = recentPlayers().filter((p) => !p.pro && !p.champion && p.tagLine)
})

const inRegion = (r: Result) =>
  props.region !== 'auto' && regionLabel(r.platform).toLowerCase() === props.region.toLowerCase()
/** Searched before first, then the picked server, then the order the site keeps (most viewed). */
const suggestions = computed<Suggestion[]>(() => {
  const q = term.value.toLowerCase()
  if (!q) return []
  const tag = parts.value.tag?.toLowerCase() ?? ''
  const taken = new Set(chips.value.map(keyOf))
  const seen = new Map(recents.value.map((p) => [keyOf(p), p]))
  const fits = (p: { gameName: string; tagLine: string }) =>
    p.tagLine.toLowerCase().startsWith(tag) && !taken.has(keyOf(p))
  const list: Suggestion[] = results.value
    .filter(fits)
    .map((r) => ({ ...r, recent: seen.get(keyOf(r)) }))
  // Searched before but not among the stored answer yet (or older than the cache): offered too.
  const listed = new Set(list.map(keyOf))
  for (const p of recents.value) {
    if (listed.has(keyOf(p)) || !fits(p) || !p.gameName.toLowerCase().startsWith(q)) continue
    list.push({
      puuid: keyOf(p),
      gameName: p.gameName,
      tagLine: p.tagLine,
      profileIconId: p.profileIconId,
      platform: p.platform,
      summonerLevel: p.level ?? null,
      recent: p,
    })
  }
  // A name already written out whole, and the only one stored, needs nothing more.
  if (whole.value && list.length === 1 && keyOf(list[0]) === keyOf(whole.value)) return []
  const rank = (s: Suggestion) => (s.recent ? 2 : 0) + (inRegion(s) ? 1 : 0)
  return [...list].sort((a, b) => rank(b) - rank(a)).slice(0, 6)
})
// Nothing found: said once the site answered, and only for a name still missing its tag.
const open = computed(
  () =>
    focused.value &&
    !dismissed.value &&
    !!term.value &&
    !full.value &&
    (suggestions.value.length > 0 || (!loading.value && !whole.value))
)
const heading = computed(() =>
  fixing.value && parts.value.name
    ? `“${parts.value.name}” has no tag: pick the player`
    : props.region === 'auto'
      ? 'Players'
      : `Players on ${props.region.toUpperCase()} first`
)

/** The typed part of a name, lit as the header's search does. */
function marked(name: string): [string, string, string] {
  const q = term.value
  const at = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (at < 0) return [name, '', '']
  return [name.slice(0, at), name.slice(at, at + q.length), name.slice(at + q.length)]
}
const rankLine = (s: Suggestion) => {
  const r = s.recent?.rank
  return r ? `${rankWords(r.tier, r.division)}, ${r.leaguePoints} LP` : null
}

/* ── Chips ─────────────────────────────────────────────────────── */
/**
 * Adds players after the chips, once each, up to ten; returns how many went in. One write per
 * call: the model only reads back the new list once the page has re-rendered.
 */
function add(players: RiotIdentity[], icon?: number | null) {
  const next = [...chips.value]
  let added = 0
  for (const player of players) {
    if (next.length >= MAX_PLAYERS || next.some((c) => keyOf(c) === keyOf(player))) continue
    next.push(player)
    added++
    if (icon !== undefined) picked.value = { ...picked.value, [keyOf(player)]: icon }
  }
  if (added) chips.value = next
  return added
}
function remove(index: number) {
  const [gone] = chips.value.slice(index, index + 1)
  if (!gone) return
  chips.value = chips.value.filter((_, i) => i !== index)
  emit('removed', gone)
  input.value?.focus()
}
const iconOf = (c: RiotIdentity) => props.known[keyOf(c)]?.icon ?? picked.value[keyOf(c)] ?? null
const tierOf = (c: RiotIdentity) => props.known[keyOf(c)]?.tier ?? null
const missing = (c: RiotIdentity) => props.known[keyOf(c)]?.missing === true

/** Moves on: the next name a paste left without a tag, or an empty field. */
async function next() {
  const [name, ...rest] = pending.value
  pending.value = rest
  typed.value = name ?? ''
  fixingName.value = !!name
  active.value = 0
  dismissed.value = !name
  await nextTick()
  input.value?.focus()
}

async function choose(s: Suggestion) {
  add([{ gameName: s.gameName, tagLine: s.tagLine }], s.profileIconId)
  const wasFixing = fixingName.value
  await next()
  if (wasFixing && !fixingName.value) emit('resolved')
}

/* ── The keys ──────────────────────────────────────────────────── */
function onInput() {
  dismissed.value = false
  // A comma typed or pasted mid-name: the same as the key.
  if (typed.value.includes(',')) {
    const [first, ...rest] = typed.value.split(',')
    typed.value = first
    void commit().then(() => {
      typed.value = rest.join(',').trimStart()
    })
  }
}
/** Adds what is typed: the highlighted suggestion, or the whole Riot ID written out. */
async function commit() {
  const pick = open.value ? suggestions.value[active.value] : undefined
  if (pick) return choose(pick)
  if (whole.value) {
    add([whole.value])
    return next()
  }
}
function onEnter() {
  if (!typed.value.trim()) return emit('submit')
  const before = chips.value.length
  void commit().then(() => {
    // Enter on a name that cannot be added (no tag, nothing found) scouts what is there.
    if (chips.value.length === before && !open.value) emit('submit')
  })
}
/** A comma moves on to the next name; backspace in an empty field takes the last chip out. */
function onKey(event: KeyboardEvent) {
  if (event.key === ',') {
    event.preventDefault()
    void commit()
    return
  }
  if (event.key !== 'Backspace') return
  const el = event.target as HTMLInputElement
  if (typed.value || el.selectionStart !== 0 || !chips.value.length) return
  event.preventDefault()
  remove(chips.value.length - 1)
}
function move(delta: number) {
  if (!open.value || !suggestions.value.length) return
  active.value = (active.value + delta + suggestions.value.length) % suggestions.value.length
}
function onBlur() {
  focused.value = false
  // A click on a suggestion lands first (mousedown), so closing on blur loses nothing.
  dismissed.value = true
}

/**
 * A paste: every Riot ID in it becomes a chip (a list, an op.gg address, the lobby chat); the
 * names without a tag are kept to complete. A single name with no comma or line is typed as is.
 */
function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!/[,\n\r#]/.test(text)) return
  event.preventDefault()
  const added = add(parseRiotIds(text))
  const untagged = text
    .split(/[,\n\r]+/)
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter((t) => t.length >= 2 && t.length <= 16 && !t.includes('#'))
  const room = MAX_PLAYERS - chips.value.length - added
  pending.value = untagged.slice(0, Math.max(0, room))
  if (pending.value.length) void next()
  else {
    typed.value = ''
    if (added) emit('pasted')
  }
}

const activeId = computed(() =>
  open.value && suggestions.value.length ? `${listId}-${active.value}` : undefined
)
const placeholder = computed(() =>
  chips.value.length ? (full.value ? '' : 'Add a player') : 'Name#TAG, or paste the lobby'
)
const capacity = computed(() => (chips.value.length > 5 ? MAX_PLAYERS : 5))
</script>

<template>
  <div class="ms-box">
    <div class="ms-f" :class="{ focus: focused }" @mousedown.self.prevent="input?.focus()">
      <span class="ms-ic" aria-hidden="true"><Icon name="users" :size="18" /></span>
      <div class="ms-chips" @mousedown.self.prevent="input?.focus()">
        <span
          v-for="(c, i) in chips"
          :key="keyOf(c)"
          class="ms-chip"
          :class="{ miss: missing(c) }"
          :title="missing(c) ? 'Not found on this server' : undefined"
        >
          <img v-if="iconOf(c) !== null" class="pi" :src="profileIcon(iconOf(c))" alt="" />
          <span v-else class="pi e" aria-hidden="true" />
          <span class="ms-cn">{{ c.gameName }}</span
          ><span class="t3">#{{ c.tagLine }}</span>
          <RankEmblem v-if="tierOf(c)" :tier="tierOf(c)" :size="16" />
          <button type="button" :aria-label="`Remove ${c.gameName}`" @click="remove(i)">
            <Icon name="x" :size="13" />
          </button>
        </span>
        <input
          ref="input"
          v-model="typed"
          class="ms-typed"
          type="text"
          spellcheck="false"
          autocomplete="off"
          role="combobox"
          aria-label="Players"
          aria-autocomplete="list"
          :aria-expanded="open"
          :aria-controls="open ? listId : undefined"
          :aria-activedescendant="activeId"
          :placeholder="placeholder"
          @input="onInput"
          @paste="onPaste"
          @focus="focused = true"
          @blur="onBlur"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="onEnter"
          @keydown="onKey"
          @keydown.esc="dismissed = true"
        />
        <span v-if="loading && term" class="ms-spin" aria-hidden="true" />
      </div>
      <span v-if="chips.length" class="ms-n">{{ chips.length }} of {{ capacity }}</span>
      <slot />
    </div>

    <div v-if="open" :id="listId" class="panel ms-sg" role="listbox" :aria-label="heading">
      <div class="sg-h">{{ heading }}</div>
      <div
        v-for="(s, i) in suggestions"
        :id="`${listId}-${i}`"
        :key="s.puuid"
        class="sg-r"
        :class="{ act: i === active }"
        role="option"
        :aria-selected="i === active"
        @mouseenter="active = i"
        @mousedown.prevent="choose(s)"
      >
        <img class="ms-pi" :src="profileIcon(s.profileIconId)" alt="" decoding="async" />
        <span class="sg-t ms-sgt">
          <b
            >{{ marked(s.gameName)[0] }}<mark>{{ marked(s.gameName)[1] }}</mark
            >{{ marked(s.gameName)[2] }} <span class="t3">#{{ s.tagLine }}</span></b
          >
          <span v-if="rankLine(s)" class="num"
            ><RankEmblem :tier="s.recent!.rank!.tier" :size="15" />{{ rankLine(s)
            }}<template v-if="s.summonerLevel"
              ><span class="t4">·</span>Level {{ s.summonerLevel }}</template
            ></span
          >
          <span v-else class="num"
            ><img
              v-if="s.platform"
              :src="regionFlag(s.platform)"
              alt=""
              width="16"
              height="11"
              style="border-radius: 2px"
            />{{ regionLabel(s.platform)
            }}<template v-if="s.summonerLevel">, level {{ s.summonerLevel }}</template></span
          >
        </span>
        <span v-if="s.recent" class="ms-rec"
          ><Icon name="clock" :size="13" />Searched {{ since(s.recent.at) }}</span
        >
        <span v-if="i === active" class="ms-add" :class="{ r: s.recent }">Enter</span>
      </div>
      <p v-if="!suggestions.length" class="ms-none">
        No stored player named “{{ term }}”. Type the whole Name#TAG.
      </p>
      <div class="panel-f" aria-hidden="true">
        <span><span class="kbd">↑</span><span class="kbd">↓</span>move</span>
        <span><span class="kbd">Enter</span>add</span>
        <span><span class="kbd">,</span>next name</span>
        <span><span class="kbd">⌫</span>remove the last</span>
        <span v-if="region !== 'auto'" style="margin-left: auto"
          >Searching {{ region.toUpperCase() }} first</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.ms-box {
  position: relative;
  z-index: 4;
}
.ms-f {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 10px 12px 10px 18px;
  border-radius: 14px;
  background: var(--s1);
  box-shadow: inset 0 0 0 1px var(--line-2);
  cursor: text;
  transition: box-shadow 160ms var(--ease);
}
.ms-f.focus {
  box-shadow:
    inset 0 0 0 2px var(--v400),
    0 0 0 4px rgb(var(--v-rgb) / 0.12);
}
.ms-ic {
  display: flex;
  color: var(--t3);
}
.ms-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  font-size: 15px;
}
.ms-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  height: 36px;
  padding: 0 6px 0 5px;
  border-radius: 9px;
  background: var(--s3);
  box-shadow: inset 0 0 0 1px var(--line-2);
  font-size: 14px;
  font-weight: 650;
  white-space: nowrap;
  cursor: default;
}
.ms-chip.miss {
  box-shadow: inset 0 0 0 1px rgb(var(--loss-rgb) / 0.6);
}
.ms-chip .pi {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 6px;
  object-fit: cover;
}
.ms-chip .pi.e {
  background: var(--well);
  box-shadow: inset 0 0 0 1px var(--line);
}
.ms-cn {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ms-chip .t3 {
  margin-left: -5px;
  font-weight: 600;
}
.ms-chip button {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 5px;
  color: var(--t3);
}
.ms-chip button:hover {
  background: var(--s4);
  color: var(--t1);
}
.ms-typed {
  flex: 1;
  min-width: 140px;
  height: 36px;
  padding: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--t1);
}
.ms-typed::placeholder {
  color: var(--t3);
  font-weight: 500;
}
.ms-n {
  font-size: 13px;
  font-weight: 650;
  color: var(--t3);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.ms-sg {
  position: absolute;
  z-index: 40;
  top: 100%;
  left: 0;
  width: min(560px, 100%);
  padding-bottom: 0;
}
.ms-sg {
  text-align: left;
}
.ms-sg .sg-r {
  cursor: pointer;
}
.ms-pi {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
}
.ms-sgt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
}
.ms-sgt > span {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t3);
  white-space: nowrap;
}
.ms-rec {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--t3);
  white-space: nowrap;
}
.ms-add {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--v200);
}
.ms-add.r {
  margin-left: 10px;
}
.ms-none {
  margin: 0;
  padding: 6px 18px 14px;
  font-size: 13px;
  color: var(--t3);
}
.ms-sg .panel-f {
  margin-top: 8px;
}
.ms-spin {
  width: 14px;
  height: 14px;
  flex: none;
  border: 1.5px solid var(--line-2);
  border-top-color: var(--t1);
  border-radius: 50%;
  animation: ms-spin 0.8s linear infinite;
}
@keyframes ms-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 767px) {
  .ms-f {
    flex-wrap: wrap;
    min-height: 0;
    padding: 10px 12px;
    border-radius: 12px;
  }
  .ms-ic {
    display: none;
  }
  .ms-chips {
    flex: 1 1 100%;
  }
  .ms-chip {
    height: 32px;
    font-size: 13px;
  }
  .ms-chip .pi {
    width: 22px;
    height: 22px;
  }
  .ms-typed {
    min-width: 120px;
  }
  .ms-rec,
  .ms-sg .panel-f {
    display: none;
  }
}
</style>
