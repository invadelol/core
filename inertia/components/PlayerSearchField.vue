<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './ui/Icon.vue'
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
  <div class="psf">
    <label class="field">
      <Icon name="search" />
      <input
        v-model="query"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :placeholder="placeholder"
        :aria-label="placeholder"
        @focus="open = entries.length > 0"
        @blur="closeSoon"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="submit"
        @keydown.esc="open = false"
      />
      <span v-if="loading || busy" class="psf-spin" aria-hidden="true" />
    </label>

    <ul v-if="open && entries.length" class="sel-pop psf-pop" role="listbox">
      <li
        v-for="(entry, index) in entries"
        :key="`${entry.gameName}-${entry.tagLine}-${index}`"
        class="sel-o"
        role="option"
        :aria-selected="index === active"
        :data-active="index === active"
        @mouseenter="active = index"
        @mousedown.prevent="choose(entry)"
      >
        <img v-if="!entry.direct" :src="profileIcon(entry.icon)" alt="" class="psf-ic" />
        <span v-else class="psf-ic psf-go"><Icon name="arrow" :size="14" /></span>
        <span class="ell">
          <span v-if="entry.direct" class="t3">Compare with </span>
          <span class="t1">{{ entry.gameName }}</span>
          <span class="t3">#{{ entry.tagLine }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.psf {
  position: relative;
  flex: 1;
  min-width: 220px;
}
.psf-spin {
  width: 14px;
  height: 14px;
  flex: none;
  border: 1.5px solid var(--line-2);
  border-top-color: var(--t1);
  border-radius: 50%;
  animation: psf-spin 0.8s linear infinite;
}
@keyframes psf-spin {
  to {
    transform: rotate(360deg);
  }
}
.psf-pop {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  width: 100%;
  margin: 0;
  padding: 6px;
  list-style: none;
}
.psf-pop .sel-o {
  cursor: pointer;
}
.psf-ic {
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 5px;
}
.psf-go {
  display: grid;
  place-items: center;
  color: var(--t3);
}
</style>
