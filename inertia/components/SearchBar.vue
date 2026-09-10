<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { Search } from 'lucide-vue-next'
import { profileIcon } from '../lib/assets.js'

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
}

const query = ref('')
const results = ref<Result[]>([])
const isLoading = ref(false)
const isOpen = ref(false)
const activeIndex = ref(0)

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
  const list: Array<{ gameName: string; tagLine: string; direct: boolean; icon?: number | null }> =
    []
  if (typedTarget.value) list.push({ ...typedTarget.value, direct: true })
  for (const r of results.value) {
    if (typedTarget.value && r.gameName === typedTarget.value.gameName) continue
    list.push({ gameName: r.gameName, tagLine: r.tagLine, direct: false, icon: r.profileIconId })
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

onBeforeUnmount(() => {
  clearTimeout(debounce)
  searchController?.abort()
})

function go(entry: { gameName: string; tagLine: string }) {
  isOpen.value = false
  query.value = ''
  results.value = []
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

function submit() {
  const entry = entries.value[activeIndex.value]
  if (entry) go(entry)
}
</script>

<template>
  <div class="relative w-full">
    <div class="relative">
      <Search
        class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
        :class="props.size === 'lg' ? 'w-[18px] h-[18px]' : 'w-4 h-4'"
      />
      <input
        v-model="query"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :autofocus="props.autofocus"
        :placeholder="
          props.size === 'lg' ? 'Search a summoner, e.g. Faker#KR1' : 'Search a summoner'
        "
        class="w-full rounded-lg border border-line-strong bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink transition-colors"
        :class="
          props.size === 'lg' ? 'pl-11 pr-11 py-3.5 text-[0.9375rem]' : 'pl-9 pr-9 py-2 text-sm'
        "
        @focus="isOpen = entries.length > 0"
        @blur="handleBlur"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="submit"
        @keydown.esc="isOpen = false"
      />
      <span
        v-if="isLoading"
        class="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-[1.5px] border-line-strong border-t-ink animate-spin"
      />
    </div>

    <ul
      v-if="showDropdown"
      class="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-[0_8px_24px_rgb(16_18_29_/_0.08)]"
    >
      <li
        v-for="(entry, index) in entries"
        :key="`${entry.gameName}-${entry.tagLine}-${index}`"
        class="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors"
        :class="index === activeIndex ? 'bg-[#f6f6f8]' : ''"
        @mouseenter="highlight(index, entry)"
        @mousedown.prevent="go(entry)"
      >
        <img
          v-if="!entry.direct"
          :src="profileIcon(entry.icon)"
          alt=""
          width="28"
          height="28"
          loading="lazy"
          decoding="async"
          class="thumb h-7 w-7 rounded-full"
        />
        <span
          v-else
          class="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-3"
        >
          <Search class="h-3.5 w-3.5" />
        </span>

        <span class="min-w-0 flex-1 truncate text-[0.8125rem]">
          <span class="font-medium text-ink">{{ entry.gameName }}</span>
          <span class="text-ink-3">#{{ entry.tagLine }}</span>
        </span>

        <span v-if="entry.direct" class="label">Go</span>
      </li>
    </ul>
  </div>
</template>
