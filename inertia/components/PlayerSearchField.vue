<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CornerDownLeft, Search } from 'lucide-vue-next'
import { profileIcon } from '../lib/assets.js'

/**
 * The same typeahead the header uses, but it hands the choice back instead of
 * navigating. Typing a full Riot ID is still a valid answer, so a complete
 * "Name#Tag" is always offered first even when nothing is stored for it.
 */
withDefaults(defineProps<{ placeholder?: string; busy?: boolean }>(), {
  placeholder: 'Search a Riot ID',
})

const emit = defineEmits<{ select: [value: { gameName: string; tagLine: string }] }>()

interface Result {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number | null
}

const query = ref('')
const results = ref<Result[]>([])
const loading = ref(false)
const open = ref(false)
const active = ref(0)

let debounce: ReturnType<typeof setTimeout>
let closing: ReturnType<typeof setTimeout>
let controller: AbortController | undefined
const answered = new Map<string, Result[]>()
/** Set while the field writes its own value, so picking does not reopen it. */
let echoing = false

const typed = computed(() => {
  const trimmed = query.value.trim()
  const hash = trimmed.indexOf('#')
  if (hash <= 0 || hash >= trimmed.length - 1) return null
  const gameName = trimmed.slice(0, hash).trim()
  const tagLine = trimmed.slice(hash + 1).trim()
  return gameName && tagLine ? { gameName, tagLine } : null
})

const entries = computed(() => {
  const list: Array<{ gameName: string; tagLine: string; direct: boolean; icon?: number | null }> =
    []
  if (typed.value) list.push({ ...typed.value, direct: true })
  for (const r of results.value) {
    if (typed.value && r.gameName === typed.value.gameName) continue
    list.push({ gameName: r.gameName, tagLine: r.tagLine, direct: false, icon: r.profileIconId })
  }
  return list
})

watch(query, (value) => {
  if (echoing) {
    echoing = false
    return
  }
  clearTimeout(debounce)
  controller?.abort()
  loading.value = false
  active.value = 0

  const trimmed = value.trim()
  if (trimmed.length < 2) {
    results.value = []
    open.value = Boolean(typed.value)
    return
  }
  open.value = true

  const remembered = answered.get(trimmed.toLowerCase())
  if (remembered) {
    results.value = remembered
    return
  }
  debounce = setTimeout(() => search(trimmed), 120)
})

async function search(q: string) {
  controller = new AbortController()
  const { signal } = controller
  loading.value = true
  try {
    const res = await fetch(`/api/summoners/search?q=${encodeURIComponent(q)}&limit=8`, { signal })
    if (res.ok) {
      const data: Result[] = await res.json()
      if (signal.aborted) return
      answered.set(q.toLowerCase(), data)
      results.value = data
    }
  } catch {
    // Keep the previous answer: an empty list would read as "no such player".
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

onBeforeUnmount(() => {
  clearTimeout(debounce)
  clearTimeout(closing)
  controller?.abort()
})

/* A click on a suggestion blurs the input before it lands, so the list has to
   outlive the blur by a moment. `setTimeout` resolves against the component in
   a template expression, not the window, so it cannot be inlined there. */
function closeSoon() {
  clearTimeout(closing)
  closing = setTimeout(() => (open.value = false), 150)
}

function choose(entry: { gameName: string; tagLine: string }) {
  echoing = true
  query.value = `${entry.gameName}#${entry.tagLine}`
  open.value = false
  results.value = []
  emit('select', entry)
}

function move(delta: number) {
  if (!entries.value.length) return
  active.value = (active.value + delta + entries.value.length) % entries.value.length
}

function submit() {
  const entry = entries.value[active.value]
  if (entry) choose(entry)
}
</script>

<template>
  <div class="relative min-w-[220px] flex-1">
    <div class="relative">
      <Search
        :size="14"
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
      />
      <input
        v-model="query"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :placeholder="placeholder"
        class="field !h-9 !py-0 !pl-9 !pr-9 !text-[13px]"
        @focus="open = entries.length > 0"
        @blur="closeSoon"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="submit"
        @keydown.esc="open = false"
      />
      <span
        v-if="loading || busy"
        class="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-[1.5px] border-line-2 border-t-ink"
      />
    </div>

    <ul v-if="open && entries.length" class="menu absolute z-40 mt-1.5 w-full py-1">
      <li
        v-for="(entry, index) in entries"
        :key="`${entry.gameName}-${entry.tagLine}-${index}`"
        class="menu-item cursor-pointer"
        :data-active="index === active"
        @mouseenter="active = index"
        @mousedown.prevent="choose(entry)"
      >
        <img
          v-if="!entry.direct"
          :src="profileIcon(entry.icon)"
          alt=""
          width="24"
          height="24"
          loading="lazy"
          class="thumb h-6 w-6 rounded-[6px]"
        />
        <span
          v-else
          class="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-sunken text-ink-3"
        >
          <Search :size="12" />
        </span>
        <span class="min-w-0 flex-1 truncate">
          <span class="font-semibold text-ink">{{ entry.gameName }}</span>
          <span class="text-ink-3">#{{ entry.tagLine }}</span>
        </span>
        <CornerDownLeft v-if="index === active" :size="12" class="shrink-0 text-ink-4" />
      </li>
    </ul>
  </div>
</template>
