<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { CornerDownLeft, Plus, Search, Users, X } from 'lucide-vue-next'
import { champIcon, profileIcon, regionLabel } from '../lib/assets.js'
import { championSlug } from '../lib/champions.js'
import TeamLogo from './champions/TeamLogo.vue'
import {
  MAX_PLAYERS,
  multisearchPath,
  parseRiotIds,
  type RiotIdentity,
} from '../lib/multisearch.js'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'lg'
    autofocus?: boolean
  }>(),
  { size: 'sm', autofocus: false }
)

interface Result {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number | null
  platform?: string
  summonerLevel?: number | null
}

/** A professional player or a team the search found (`/api/pros/search`). */
interface ProResult {
  slug: string
  name: string
  role: string | null
  staff: boolean
  team: { id: string; slug: string; name: string; shortName: string | null } | null
}
interface TeamResult {
  id: string
  slug: string
  name: string
  shortName: string | null
  region: string | null
  members: number
}

/** A pro's account among the players found: marked "Pro" with the pro's name. */
interface ProAccount {
  gameName: string
  tagLine: string
  platform: string
  slug: string
  name: string
}

interface Answer {
  players: Result[]
  pros: ProResult[]
  teams: TeamResult[]
  accounts: ProAccount[]
}

type Section = 'champions' | 'esports' | 'summoners'

interface Entry {
  gameName: string
  tagLine: string
  direct: boolean
  /** A pro, a team or a champion: the entry opens this page instead of a profile. */
  kind?: 'pro' | 'team' | 'champion'
  href?: string
  title?: string
  detail?: string
  team?: { id: string; name: string; shortName?: string | null } | null
  champion?: number
  icon?: number | null
  region?: string
  level?: number | null
  /** The pro this account belongs to. */
  proName?: string
  /** A pro's or staff member's word beside their name. */
  badge?: 'Pro' | 'Staff'
  /** Several Riot IDs pasted at once: the entry opens them side by side. */
  multi?: RiotIdentity[]
  /** The titled group the entry is listed under; a pasted lobby stands above them all. */
  section?: Section
}

const SECTION_LABELS: Record<Section, string> = {
  champions: 'Champions',
  esports: 'Esports',
  summoners: 'Summoners',
}

/** A player put on the list with "+": shown in the field with their icon, before the text. */
interface Picked extends RiotIdentity {
  icon?: number | null
}

const query = ref('')
const picked = ref<Picked[]>([])
const chips = ref<HTMLElement>()
const chipsWidth = ref(0)
const chipsOverflow = ref(false)
const results = ref<Result[]>([])
const pros = ref<ProResult[]>([])
const teams = ref<TeamResult[]>([])
const proAccounts = ref<ProAccount[]>([])
/** The pro behind a player found, by Riot ID and platform. */
const proOf = computed(() => {
  const map = new Map<string, string>()
  for (const a of proAccounts.value)
    map.set(`${a.platform}:${a.gameName}#${a.tagLine}`.toLowerCase(), a.name)
  return map
})

/** Champion names, fetched once the first time someone types. */
const championNames = ref<{ id: number; name: string }[]>([])
let championsAsked = false
function loadChampions() {
  if (championsAsked || typeof window === 'undefined') return
  championsAsked = true
  fetch('/cdn/names/champion')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : null))
    .then((json) => {
      if (json) championNames.value = playable(json)
      else championsAsked = false
    })
    .catch(() => (championsAsked = false))
}
/**
 * The champions anyone can pick, once each. The names map also holds the mode variants (Swarm,
 * Jade…), which reuse a champion's name under ids in the tens of thousands: Veigar came up twice.
 */
function playable(json: Record<string, string>) {
  const seen = new Set<string>()
  return Object.entries(json)
    .map(([id, name]) => ({ id: Number(id), name }))
    .filter((c) => Number.isInteger(c.id) && c.id > 0 && c.id < 10_000)
    .sort((a, b) => a.id - b.id)
    .filter((c) => {
      const key = c.name.toLowerCase()
      return !seen.has(key) && seen.add(key)
    })
}

const champions = computed(() => {
  const q = typing.value.trim().toLowerCase()
  if (q.length < 2 || q.includes('#')) return []
  return championNames.value
    .filter(
      (c) =>
        c.name.toLowerCase().startsWith(q) ||
        championSlug(c.name).startsWith(q.replace(/\s+/g, '-'))
    )
    .slice(0, 3)
})
const isLoading = ref(false)
const isOpen = ref(false)
const activeIndex = ref(0)
const input = ref<HTMLInputElement>()
const list = ref<HTMLElement>()

let debounce: ReturnType<typeof setTimeout>
let searchController: AbortController | undefined

/**
 * Answers already fetched in this session.
 *
 * Typing forwards and then backspacing is the single most common thing anyone
 * does in a search box, and every one of those keystrokes used to be a fresh
 * request. Replaying from here makes going back through a query instant, and
 * it also lets a pending request paint its previous answer rather than
 * clearing the list to nothing.
 */
const answered = new Map<string, Answer>()

/** Kept small: a session's worth of prefixes, not an unbounded log. */
const MAX_REMEMBERED = 50

/** Short enough to feel like it is keeping up, long enough not to spam. */
const DEBOUNCE_MS = 120

/**
 * The list being built: players added with "+", then any typed before the last comma. The
 * search runs on what is typed after it.
 */
const lastComma = computed(() => query.value.lastIndexOf(','))
const listed = computed(() =>
  unique([
    ...picked.value,
    ...(lastComma.value < 0 ? [] : parseRiotIds(query.value.slice(0, lastComma.value))),
  ])
)
const typing = computed(() => query.value.slice(lastComma.value + 1))

/** "Faker#EUW" typed in full is a destination on its own, listed first. */
const typedTarget = computed(() => {
  const trimmed = typing.value.trim()
  const hash = trimmed.indexOf('#')
  if (hash <= 0 || hash >= trimmed.length - 1) return null
  const gameName = trimmed.slice(0, hash).trim()
  const tagLine = trimmed.slice(hash + 1).trim()
  return gameName && tagLine ? { gameName, tagLine } : null
})

/** A pasted lobby or list ("A#EUW, B#EUW"): more than one player is a multi search. */
const pastedPlayers = computed(() => {
  const players = unique([...picked.value, ...parseRiotIds(query.value)]).slice(0, MAX_PLAYERS)
  return players.length > 1 ? players : null
})

function unique(players: RiotIdentity[]) {
  const seen = new Set<string>()
  return players
    .filter((p) => {
      const key = `${p.gameName}#${p.tagLine}`.toLowerCase()
      return !seen.has(key) && seen.add(key)
    })
    .map(({ gameName, tagLine }) => ({ gameName, tagLine }))
}

/** The last name is a whole Riot ID: nothing left to look up, the list is the answer. */
const typingDone = computed(() => parseRiotIds(typing.value).length > 0)

/** Esports takes five rows at most: pros first, and teams keep two when both are found. */
const MAX_ESPORTS = 5

/** Everything selectable, grouped by section; `entries` flattens it so arrow keys have one index space. */
const groups = computed(() => {
  const top: Entry[] = []
  const bySection: Record<Section, Entry[]> = { champions: [], esports: [], summoners: [] }

  if (pastedPlayers.value) {
    top.push({ gameName: '', tagLine: '', direct: true, multi: pastedPlayers.value })
    if (typingDone.value) return [{ section: null, entries: top }]
  }
  if (typedTarget.value) bySection.summoners.push({ ...typedTarget.value, direct: true })
  if (!pastedPlayers.value) {
    for (const c of champions.value) {
      bySection.champions.push({
        gameName: c.name,
        tagLine: '',
        direct: false,
        kind: 'champion',
        href: `/champions/${championSlug(c.name)}`,
        title: c.name,
        detail: 'Champion',
        champion: c.id,
      })
    }
    const teamRows = Math.min(teams.value.length, Math.max(2, MAX_ESPORTS - pros.value.length))
    for (const p of pros.value.slice(0, MAX_ESPORTS - teamRows)) {
      bySection.esports.push({
        gameName: p.name,
        tagLine: '',
        direct: false,
        kind: 'pro',
        href: `/pro/${p.slug}`,
        title: p.name,
        detail: [
          p.team?.name,
          p.role && !p.staff ? p.role.charAt(0) + p.role.slice(1).toLowerCase() : null,
        ]
          .filter(Boolean)
          .join(' · '),
        team: p.team,
        badge: p.staff ? 'Staff' : 'Pro',
      })
    }
    for (const t of teams.value.slice(0, teamRows)) {
      bySection.esports.push({
        gameName: t.name,
        tagLine: '',
        direct: false,
        kind: 'team',
        href: `/team/${t.slug}`,
        title: t.name,
        detail: [t.shortName, t.region].filter(Boolean).join(' · '),
        team: t,
      })
    }
  }
  for (const r of results.value) {
    if (typedTarget.value && r.gameName === typedTarget.value.gameName) continue
    bySection.summoners.push({
      gameName: r.gameName,
      tagLine: r.tagLine,
      direct: false,
      icon: r.profileIconId,
      region: regionLabel(r.platform),
      level: r.summonerLevel,
      proName: proOf.value.get(`${r.platform}:${r.gameName}#${r.tagLine}`.toLowerCase()),
    })
  }

  // A whole Riot ID typed is a player's: their section leads, so Enter opens them.
  const order: Section[] = typedTarget.value
    ? ['summoners', 'champions', 'esports']
    : ['champions', 'esports', 'summoners']
  const list: { section: Section | null; entries: Entry[] }[] = []
  if (top.length) list.push({ section: null, entries: top })
  for (const section of order) {
    if (bySection[section].length) list.push({ section, entries: bySection[section] })
  }
  return list
})

const entries = computed(() => groups.value.flatMap((g) => g.entries))

/** Where each group starts in `entries`, for the rows' flat index. */
const offsets = computed(() => {
  let at = 0
  return groups.value.map((g) => {
    const start = at
    at += g.entries.length
    return start
  })
})

const showDropdown = computed(() => isOpen.value && entries.value.length > 0)

watch(query, (value) => {
  clearTimeout(debounce)
  searchController?.abort()
  isLoading.value = false
  activeIndex.value = 0

  const trimmed = typing.value.trim()
  if (pastedPlayers.value && typingDone.value) {
    results.value = []
    isOpen.value = true
    return
  }
  if (trimmed.length < 2) {
    results.value = []
    pros.value = []
    teams.value = []
    proAccounts.value = []
    isOpen.value = Boolean(typedTarget.value || pastedPlayers.value)
    return
  }
  isOpen.value = true
  loadChampions()

  // A query we have already answered needs no request and no debounce.
  const remembered = answered.get(trimmed.toLowerCase())
  if (remembered) {
    results.value = remembered.players
    pros.value = remembered.pros
    teams.value = remembered.teams
    proAccounts.value = remembered.accounts
    return
  }

  debounce = setTimeout(() => search(trimmed), DEBOUNCE_MS)
})

async function search(q: string) {
  searchController = new AbortController()
  const { signal } = searchController
  isLoading.value = true
  try {
    // Players, and pros and teams, side by side: neither waits for the other to fail.
    const [res, proRes] = await Promise.all([
      fetch(`/api/summoners/search?q=${encodeURIComponent(q)}&limit=8`, { signal }),
      fetch(`/api/pros/search?q=${encodeURIComponent(q)}`, { signal }).catch(() => null),
    ])
    if (res.ok) {
      const data: Result[] = await res.json()
      const found: { pros: ProResult[]; teams: TeamResult[]; accounts?: ProAccount[] } = proRes?.ok
        ? await proRes.json()
        : { pros: [], teams: [] }
      if (signal.aborted) return
      remember(q, {
        players: data,
        pros: found.pros ?? [],
        teams: found.teams ?? [],
        accounts: found.accounts ?? [],
      })
      results.value = data
      pros.value = found.pros ?? []
      teams.value = found.teams ?? []
      proAccounts.value = found.accounts ?? []
    }
  } catch {
    // Leave the previous answer on screen: an empty list reads as "no such
    // player", which is not what a failed request means.
  } finally {
    if (!signal.aborted) isLoading.value = false
  }
}

function remember(q: string, data: Answer) {
  answered.set(q.toLowerCase(), data)
  if (answered.size > MAX_REMEMBERED) {
    answered.delete(answered.keys().next().value!)
  }
}

/**
 * Warms the page behind a highlighted result.
 *
 * By the time the click lands, the server render and its analytics preloads
 * have usually already happened, so the profile appears immediately.
 */
function warm(entry: Entry | { gameName: string; tagLine: string }) {
  if ('multi' in entry && entry.multi) return
  try {
    router.prefetch(
      'href' in entry && entry.href ? entry.href : href(entry),
      { method: 'get' },
      { cacheFor: '30s' }
    )
  } catch {
    // Prefetching is an optimisation; never let it break navigation.
  }
}

function href(entry: { gameName: string; tagLine: string }) {
  return `/${encodeURIComponent(`${entry.gameName}-${entry.tagLine}`)}`
}

/** ⌘K / Ctrl-K puts the caret here from anywhere on the page. */
function onHotkey(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    input.value?.focus()
    input.value?.select()
  }
}

/** The narrowest phones have room for a short placeholder only. */
const tight = ref(false)

onMounted(() => {
  window.addEventListener('keydown', onHotkey)
  tight.value = window.matchMedia('(max-width: 359px)').matches
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onHotkey)
  clearTimeout(debounce)
  searchController?.abort()
  chipsObserver?.disconnect()
})

function go(entry: Entry) {
  isOpen.value = false
  query.value = ''
  picked.value = []
  results.value = []
  input.value?.blur()
  router.visit(entry.multi ? multisearchPath(entry.multi) : (entry.href ?? href(entry)))
}

function isListed(entry: Entry) {
  const key = `${entry.gameName}#${entry.tagLine}`.toLowerCase()
  return listed.value.some((p) => `${p.gameName}#${p.tagLine}`.toLowerCase() === key)
}

function canAdd(entry: Entry) {
  return !entry.multi && !entry.kind && listed.value.length < MAX_PLAYERS && !isListed(entry)
}

/** "+" puts the player in the field, icon first, and empties the text for the next name. */
async function add(entry: Entry) {
  picked.value = [
    ...picked.value,
    { gameName: entry.gameName, tagLine: entry.tagLine, icon: entry.icon },
  ]
  query.value = ''
  await nextTick()
  input.value?.focus()
  const el = chips.value
  if (el) {
    chipsObserver?.observe(el.lastElementChild!)
    el.scrollTo({ left: el.scrollWidth })
  }
}

function remove(index: number) {
  picked.value = picked.value.filter((_, i) => i !== index)
  input.value?.focus()
}

/** Backspace in an empty field takes the last player back off the list. */
function onBackspace(event: KeyboardEvent) {
  const el = input.value
  if (!picked.value.length || !el || el.selectionStart !== 0 || el.selectionEnd !== 0) return
  event.preventDefault()
  picked.value = picked.value.slice(0, -1)
}

/** The text starts after the players: the field's left padding follows their width. */
let chipsObserver: ResizeObserver | undefined
watch(chips, (el) => {
  chipsObserver?.disconnect()
  chipsWidth.value = 0
  if (!el) return
  chipsObserver = new ResizeObserver(() => {
    chipsWidth.value = el.offsetWidth
    chipsOverflow.value = el.scrollWidth > el.clientWidth
  })
  chipsObserver.observe(el)
  for (const chip of el.children) chipsObserver.observe(chip)
})

function highlight(index: number, entry: Entry) {
  activeIndex.value = index
  warm(entry)
}

function move(delta: number) {
  if (!entries.value.length) return
  const next = activeIndex.value + delta
  activeIndex.value = (next + entries.value.length) % entries.value.length
  const entry = entries.value[activeIndex.value]
  if (entry) warm(entry)
  // The list scrolls on a short screen: the row the keys reach stays in sight.
  nextTick(() =>
    list.value
      ?.querySelector(`[data-index="${activeIndex.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  )
}

function handleBlur() {
  // Let a click on a result land before the list unmounts.
  setTimeout(() => (isOpen.value = false), 150)
}

/** Icons fade in once they have loaded, so a slow one never shows as an empty square. */
function shown(event: Event) {
  ;(event.target as HTMLImageElement).dataset.loaded = 'true'
}

function submit() {
  const entry = entries.value[activeIndex.value]
  if (entry) go(entry)
}
</script>

<template>
  <div class="search relative w-full" :class="`search-${props.size}`">
    <div class="relative" :style="{ '--chips': chipsWidth ? `${chipsWidth + 6}px` : '0px' }">
      <Search
        class="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-ink-3"
        :class="props.size === 'lg' ? 'left-4 h-[18px] w-[18px]' : 'left-2.5 h-[15px] w-[15px]'"
      />
      <div v-if="picked.length" ref="chips" class="chips" :data-overflow="chipsOverflow">
        <button
          v-for="(player, index) in picked"
          :key="`${player.gameName}#${player.tagLine}`"
          type="button"
          class="chip"
          :title="`Remove ${player.gameName}#${player.tagLine}`"
          @mousedown.prevent="remove(index)"
        >
          <img :src="profileIcon(player.icon)" alt="" width="16" height="16" class="chip-icon" />
          <span class="chip-name truncate">{{ player.gameName }}</span>
          <X :size="11" class="chip-x" />
        </button>
      </div>
      <input
        ref="input"
        v-model="query"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :autofocus="props.autofocus"
        :placeholder="
          picked.length
            ? 'Add another player'
            : props.size === 'lg'
              ? tight
                ? 'Search a Riot ID'
                : 'Search a Riot ID, e.g. Faker#KR1'
              : tight
                ? 'Search'
                : 'Search a player, pro or champion'
        "
        class="field search-input"
        @focus="isOpen = entries.length > 0"
        @blur="handleBlur"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="submit"
        @keydown.esc="isOpen = false"
        @keydown.backspace="onBackspace"
      />

      <span
        v-if="isLoading"
        class="absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-line-2 border-t-ink-2"
      />
      <kbd
        v-else-if="!query && !picked.length"
        class="pointer-events-none absolute right-2.5 top-1/2 hidden h-[20px] -translate-y-1/2 items-center rounded-[4px] bg-control px-1.5 font-sans text-[11px] font-medium text-ink-3 sm:flex"
      >
        ⌘K
      </kbd>
    </div>

    <!-- In the header of a phone the field is narrow: the list takes the screen's width. -->
    <div
      v-if="showDropdown"
      ref="list"
      class="menu results absolute z-50 mt-1.5 w-full"
      :class="
        props.size === 'sm' ? 'max-sm:fixed max-sm:inset-x-2 max-sm:top-[54px] max-sm:w-auto' : ''
      "
      role="listbox"
    >
      <div
        v-for="(group, g) in groups"
        :key="group.section ?? 'top'"
        class="group"
        role="group"
        :aria-labelledby="group.section ? `search-${group.section}` : undefined"
      >
        <div v-if="group.section" :id="`search-${group.section}`" class="group-label">
          {{ SECTION_LABELS[group.section] }}
        </div>
        <div
          v-for="(entry, i) in group.entries"
          :key="`${entry.kind ?? 'player'}-${entry.gameName}-${entry.tagLine}-${i}`"
          class="menu-item result cursor-pointer"
          role="option"
          :data-index="offsets[g] + i"
          :aria-selected="offsets[g] + i === activeIndex"
          :data-active="offsets[g] + i === activeIndex"
          @mouseenter="highlight(offsets[g] + i, entry)"
          @mousedown.prevent="go(entry)"
        >
          <span v-if="entry.multi" class="glyph">
            <Users :size="15" />
          </span>
          <img
            v-else-if="entry.kind === 'champion' && entry.champion"
            :src="champIcon(entry.champion)"
            alt=""
            width="28"
            height="28"
            class="result-icon portrait-28"
            @load="shown"
          />
          <TeamLogo
            v-else-if="entry.kind && entry.team"
            :team="entry.team"
            :size="28"
            class="result-logo"
          />
          <span v-else-if="entry.kind" class="glyph initials">
            {{ entry.title?.slice(0, 2).toUpperCase() }}
          </span>
          <img
            v-else-if="!entry.direct"
            :src="profileIcon(entry.icon)"
            alt=""
            width="28"
            height="28"
            decoding="async"
            class="result-icon portrait-28"
            @load="shown"
          />
          <span v-else class="glyph">
            <CornerDownLeft :size="15" />
          </span>

          <span v-if="entry.multi" class="min-w-0 flex-1 truncate">
            <span class="font-medium text-ink"
              >Search {{ entry.multi.length }} players together</span
            >
          </span>
          <span v-else-if="entry.kind" class="min-w-0 flex-1 truncate">
            <span class="font-medium text-ink">{{ entry.title }}</span>
            <span v-if="entry.badge" class="pro-word">{{ entry.badge }}</span>
          </span>
          <span v-else class="min-w-0 flex-1 truncate">
            <span v-if="entry.direct" class="text-ink-3">Go to </span>
            <span v-if="entry.proName" class="pro-word lead">Pro</span>
            <span class="font-medium text-ink">{{ entry.gameName }}</span>
            <span class="text-ink-3">#{{ entry.tagLine }}</span>
          </span>

          <span v-if="entry.kind && entry.kind !== 'champion'" class="meta truncate">
            {{ entry.detail }}
          </span>
          <span v-else-if="!entry.kind && !entry.direct" class="meta num">
            <template v-if="entry.proName">{{ entry.proName }} · </template>{{ entry.region
            }}<template v-if="entry.level"> · Lv {{ entry.level }}</template>
          </span>

          <button
            v-if="canAdd(entry)"
            type="button"
            class="add"
            aria-label="Add to lobby"
            @mousedown.prevent.stop="add(entry)"
          >
            <Plus :size="14" :stroke-width="2.25" />
            <span class="add-tip" aria-hidden="true">Add to lobby</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The results: titled sections, a hairline between them; a short screen scrolls the list. */
.results {
  max-height: min(560px, calc(100dvh - 120px));
  padding: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.group + .group {
  margin: 4px -4px 0;
  padding: 4px 4px 0;
  border-top: 1px solid var(--line);
}

.group-label {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  user-select: none;
}

.result {
  min-height: 40px;
}

.result .meta {
  flex-shrink: 0;
  max-width: 50%;
  font-size: 12px;
  color: var(--text-3);
}

.glyph {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  color: var(--text-3);
}

.glyph.initials {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface-2);
  border-radius: var(--r-sm);
}

.portrait-28 {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  object-fit: cover;
  background: var(--well);
  box-shadow: var(--portrait-sm);
}

/* A logo is drawn on transparency: it sits in a well, inset so its edges breathe. */
.result-logo {
  background: var(--well);
  box-shadow: var(--portrait-sm);
}

.result-logo :deep(img) {
  padding: 3px;
}

/* Before a long Riot ID, so the truncation never hides it. */
.pro-word.lead {
  margin: 0 6px 0 0;
}
.pro-word {
  display: inline-flex;
  align-items: center;
  height: 16px;
  margin-left: 6px;
  padding: 0 5px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-1);
  vertical-align: 1px;
  background: var(--surface-4);
  border-radius: var(--r-xs);
}

.search-sm .search-input {
  padding-left: calc(32px + var(--chips));
  padding-right: 44px;
}

/* Players on the list sit in the field, left of the text; the oldest scroll out under a fade. */
.chips {
  position: absolute;
  top: 50%;
  left: 30px;
  z-index: 10;
  display: flex;
  gap: 4px;
  max-width: calc(100% - 140px);
  overflow-x: auto;
  scrollbar-width: none;
  transform: translateY(-50%);
}

.chips[data-overflow='true'] {
  mask-image: linear-gradient(to right, transparent, #000 12px);
}

.chips::-webkit-scrollbar {
  display: none;
}

.chip {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  max-width: 132px;
  height: 22px;
  padding: 0 5px 0 3px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-1);
  background: var(--btn);
  border-radius: var(--r-sm);
  box-shadow: var(--btn-shadow);
  transition: background-color var(--t-fast) var(--ease);
}

.chip:hover {
  background: var(--btn-hover);
}

.chip-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 3px;
  object-fit: cover;
}

.chip-x {
  flex-shrink: 0;
  color: var(--text-3);
}

.chip:hover .chip-x {
  color: var(--text-1);
}

/* The header's field is narrow: its players are their icons, the name in the title. */
.search-sm .chip {
  gap: 3px;
  height: 20px;
  padding: 0 3px 0 2px;
}

.search-sm .chip-name {
  display: none;
}

.search-lg .chips {
  left: 42px;
}

.search-lg .chip {
  height: 28px;
  font-size: 13px;
}

.search-lg .chip-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

/* No ⌘K on a phone: the placeholder takes its room. */
@media (max-width: 39.99rem) {
  .search-sm .search-input {
    padding-right: 12px;
  }

  .search-lg .search-input {
    padding-right: 16px;
  }
}

/* The home search is the page's subject: taller, and set a size up. */
.search-lg .search-input {
  height: 52px;
  padding-left: calc(46px + var(--chips));
  padding-right: 56px;
  font-size: 16px;
  border-radius: var(--r-md);
  background: var(--surface-1);
  box-shadow: var(--hi);
}

.search-lg .search-input:focus {
  box-shadow: var(--hi), var(--focus);
}

.search-lg kbd {
  right: 14px;
}

.add {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-right: -4px;
  border-radius: var(--r-sm);
  color: var(--text-3);
  transition:
    background-color var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease);
}

.add:hover,
.add:focus-visible {
  background: var(--btn-hover);
  color: var(--text-1);
}

/* Left of the button, inside the row: the list clips anything that leaves it. */
.add-tip {
  position: absolute;
  top: 50%;
  right: calc(100% + 6px);
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  color: var(--text-1);
  background: var(--solid-2);
  border: 1px solid var(--line-2);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-2);
  pointer-events: none;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 120ms var(--ease);
}

.add:hover .add-tip,
.add:focus-visible .add-tip {
  opacity: 1;
}

@media (pointer: coarse) {
  .add {
    width: 32px;
    height: 32px;
  }

  .add-tip {
    display: none;
  }
}

.result-icon {
  opacity: 0;
  transition: opacity var(--t-base) var(--ease);
}

.result-icon[data-loaded='true'] {
  opacity: 1;
}
</style>
