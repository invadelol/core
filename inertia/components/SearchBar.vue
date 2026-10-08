<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { CornerDownLeft, Search } from 'lucide-vue-next'
import { profileIcon, regionLabel } from '../lib/assets.js'

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

interface Entry {
  gameName: string
  tagLine: string
  direct: boolean
  icon?: number | null
  region?: string
  level?: number | null
}

const query = ref('')
const results = ref<Result[]>([])
const isLoading = ref(false)
const isOpen = ref(false)
const activeIndex = ref(0)
const input = ref<HTMLInputElement>()

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
const answered = new Map<string, Result[]>()

/** Kept small: a session's worth of prefixes, not an unbounded log. */
const MAX_REMEMBERED = 50

/** Short enough to feel like it is keeping up, long enough not to spam. */
const DEBOUNCE_MS = 120

/** "Faker#EUW" typed in full is a destination on its own, listed first. */
const typedTarget = computed(() => {
  const trimmed = query.value.trim()
  const hash = trimmed.indexOf('#')
  if (hash <= 0 || hash >= trimmed.length - 1) return null
  const gameName = trimmed.slice(0, hash).trim()
  const tagLine = trimmed.slice(hash + 1).trim()
  return gameName && tagLine ? { gameName, tagLine } : null
})

/** Flat list of everything selectable, so arrow keys have one index space. */
const entries = computed(() => {
  const list: Entry[] = []
  if (typedTarget.value) list.push({ ...typedTarget.value, direct: true })
  for (const r of results.value) {
    if (typedTarget.value && r.gameName === typedTarget.value.gameName) continue
    list.push({
      gameName: r.gameName,
      tagLine: r.tagLine,
      direct: false,
      icon: r.profileIconId,
      region: regionLabel(r.platform),
      level: r.summonerLevel,
    })
  }
  return list
})

const showDropdown = computed(() => isOpen.value && entries.value.length > 0)

watch(query, (value) => {
  clearTimeout(debounce)
  searchController?.abort()
  isLoading.value = false
  activeIndex.value = 0

  const trimmed = value.trim()
  if (trimmed.length < 2) {
    results.value = []
    isOpen.value = Boolean(typedTarget.value)
    return
  }
  isOpen.value = true

  // A query we have already answered needs no request and no debounce.
  const remembered = answered.get(trimmed.toLowerCase())
  if (remembered) {
    results.value = remembered
    return
  }

  debounce = setTimeout(() => search(trimmed), DEBOUNCE_MS)
})

async function search(q: string) {
  searchController = new AbortController()
  const { signal } = searchController
  isLoading.value = true
  try {
    const res = await fetch(`/api/summoners/search?q=${encodeURIComponent(q)}&limit=8`, { signal })
    if (res.ok) {
      const data: Result[] = await res.json()
      if (signal.aborted) return
      remember(q, data)
      results.value = data
    }
  } catch {
    // Leave the previous answer on screen: an empty list reads as "no such
    // player", which is not what a failed request means.
  } finally {
    if (!signal.aborted) isLoading.value = false
  }
}

function remember(q: string, data: Result[]) {
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
function warm(entry: { gameName: string; tagLine: string }) {
  try {
    router.prefetch(href(entry), { method: 'get' }, { cacheFor: '30s' })
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

onMounted(() => window.addEventListener('keydown', onHotkey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onHotkey)
  clearTimeout(debounce)
  searchController?.abort()
})

function go(entry: { gameName: string; tagLine: string }) {
  isOpen.value = false
  query.value = ''
  results.value = []
  input.value?.blur()
  router.visit(href(entry))
}

function highlight(index: number, entry: { gameName: string; tagLine: string }) {
  activeIndex.value = index
  warm(entry)
}

function move(delta: number) {
  if (!entries.value.length) return
  const next = activeIndex.value + delta
  activeIndex.value = (next + entries.value.length) % entries.value.length
  const entry = entries.value[activeIndex.value]
  if (entry) warm(entry)
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
    <div class="relative">
      <Search
        class="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-ink-3"
        :class="props.size === 'lg' ? 'left-4 h-[18px] w-[18px]' : 'left-2.5 h-[15px] w-[15px]'"
      />
      <input
        ref="input"
        v-model="query"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :autofocus="props.autofocus"
        :placeholder="props.size === 'lg' ? 'Search a Riot ID, e.g. Faker#KR1' : 'Search a player'"
        class="field search-input"
        @focus="isOpen = entries.length > 0"
        @blur="handleBlur"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="submit"
        @keydown.esc="isOpen = false"
      />

      <span
        v-if="isLoading"
        class="absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-line-2 border-t-ink-2"
      />
      <kbd
        v-else-if="!query"
        class="pointer-events-none absolute right-2.5 top-1/2 hidden h-[20px] -translate-y-1/2 items-center rounded-[4px] bg-control px-1.5 font-sans text-[11px] font-medium text-ink-3 sm:flex"
      >
        ⌘K
      </kbd>
    </div>

    <ul v-if="showDropdown" class="menu absolute z-50 mt-1.5 w-full p-1" role="listbox">
      <li
        v-for="(entry, index) in entries"
        :key="`${entry.gameName}-${entry.tagLine}-${index}`"
        class="menu-item cursor-pointer !min-h-[40px]"
        role="option"
        :aria-selected="index === activeIndex"
        :data-active="index === activeIndex"
        @mouseenter="highlight(index, entry)"
        @mousedown.prevent="go(entry)"
      >
        <img
          v-if="!entry.direct"
          :src="profileIcon(entry.icon)"
          alt=""
          width="28"
          height="28"
          decoding="async"
          class="result-icon h-7 w-7 shrink-0 rounded-[5px] object-cover"
          @load="shown"
        />
        <span v-else class="grid h-7 w-7 shrink-0 place-items-center text-ink-3">
          <CornerDownLeft :size="15" />
        </span>

        <span class="min-w-0 flex-1 truncate">
          <span v-if="entry.direct" class="text-ink-3">Go to </span>
          <span class="font-medium text-ink">{{ entry.gameName }}</span>
          <span class="text-ink-3">#{{ entry.tagLine }}</span>
        </span>

        <span v-if="!entry.direct" class="num shrink-0 text-[12px] text-ink-3">
          {{ entry.region }}<template v-if="entry.level"> · Lv {{ entry.level }}</template>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-sm .search-input {
  padding-left: 32px;
  padding-right: 44px;
}

/* The home search is the page's subject: taller, and set a size up. */
.search-lg .search-input {
  height: 52px;
  padding-left: 46px;
  padding-right: 56px;
  font-size: 16px;
  border-radius: var(--radius-md);
  background: var(--color-panel);
  box-shadow: var(--hi);
}

.search-lg .search-input:focus {
  box-shadow: var(--hi), var(--focus);
}

.search-lg kbd {
  right: 14px;
}

.result-icon {
  opacity: 0;
  transition: opacity var(--t-base) var(--ease);
}

.result-icon[data-loaded='true'] {
  opacity: 1;
}
</style>
