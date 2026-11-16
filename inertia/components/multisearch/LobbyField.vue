<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from '../ui/Icon.vue'
import { profileIcon, regionLabel } from '../../lib/assets.js'
import { regionFlag } from '../../lib/flags.js'

/**
 * The multisearch's field: a lobby's Riot IDs, split by commas or lines, with suggestions from
 * the players the site already stores (`/api/summoners/search`, no Riot call) for the name being
 * typed, in the header search's look. After a paste, a name without its `#TAG` is offered first:
 * pick the player and the next one follows, and the lobby is scouted again once none is left.
 */
const props = withDefaults(
  defineProps<{
    /** The server picked beside the field (`euw`), or `auto`: its players come first. */
    region?: string
    placeholder?: string
  }>(),
  { region: 'auto', placeholder: 'Name#TAG, Name#TAG…' }
)
const model = defineModel<string>({ required: true })
const emit = defineEmits<{
  /** A paste landed in the field (the page scouts it). */
  pasted: []
  /** Enter with no suggestion open. */
  submit: []
  /** The last name a paste left without a tag was just picked. */
  resolved: []
}>()

interface Result {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number | null
  platform?: string
  summonerLevel?: number | null
}

const input = ref<HTMLInputElement>()
const caret = ref(0)
const results = ref<Result[]>([])
const loading = ref(false)
const active = ref(0)
/** Closed by Escape or a blur until the next keystroke. */
const dismissed = ref(true)
/** After a paste: the names left without a tag are offered one after the other. */
const fixing = ref(false)
const listId = `ms-sug-${Math.random().toString(36).slice(2, 8)}`

interface Token {
  start: number
  end: number
  text: string
  name: string
  tag: string | null
}
const TAG = /^[\p{L}\p{N}]{2,5}$/u

/** The field's names, each with where it sits (commas and lines split them). */
const tokens = computed<Token[]>(() => {
  const out: Token[] = []
  const value = model.value
  let start = 0
  for (let i = 0; i <= value.length; i++) {
    if (i === value.length || /[,\n\r]/.test(value[i])) {
      const raw = value.slice(start, i)
      const lead = raw.length - raw.trimStart().length
      const text = raw.trim()
      const hash = text.indexOf('#')
      out.push({
        start: start + lead,
        end: start + lead + text.length,
        text,
        name: (hash >= 0 ? text.slice(0, hash) : text).trim(),
        tag: hash >= 0 ? text.slice(hash + 1).trim() : null,
      })
      start = i + 1
    }
  }
  return out
})
const complete = (t: Token) => t.tag !== null && TAG.test(t.tag)
const unresolved = computed(() => tokens.value.filter((t) => t.name.length >= 2 && t.tag === null))

/** The name the suggestions are for: the first untagged one after a paste, else the caret's. */
const target = computed<Token | null>(() => {
  if (fixing.value) return unresolved.value[0] ?? null
  return tokens.value.find((t) => caret.value >= t.start && caret.value <= t.end) ?? null
})
const term = computed(() => (target.value && target.value.name.length >= 2 ? target.value.name : ''))

/* ── Asking the site (debounced, one answer kept per name) ─────── */
const answered = new Map<string, Result[]>()
let debounce: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
watch(term, (q) => lookup(q))
/** The players stored under a name: kept, or asked after a short pause in typing. */
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

/** The server picked first, then the order the site keeps (most viewed); the lobby's own left out. */
const inRegion = (r: Result) =>
  props.region !== 'auto' && regionLabel(r.platform).toLowerCase() === props.region.toLowerCase()
const suggestions = computed(() => {
  const t = target.value
  if (!t) return []
  const tag = t.tag?.toLowerCase() ?? ''
  const taken = new Set(
    tokens.value.filter((x) => x !== t && complete(x)).map((x) => `${x.name}#${x.tag}`.toLowerCase())
  )
  const list = results.value.filter(
    (r) =>
      r.tagLine.toLowerCase().startsWith(tag) &&
      !taken.has(`${r.gameName}#${r.tagLine}`.toLowerCase())
  )
  // A name already written out whole, and the only one stored, needs nothing more.
  if (
    complete(t) &&
    list.length === 1 &&
    `${list[0].gameName}#${list[0].tagLine}`.toLowerCase() === t.text.toLowerCase()
  ) {
    return []
  }
  return [...list].sort((a, b) => Number(inRegion(b)) - Number(inRegion(a))).slice(0, 6)
})
// Nothing found: said once the site answered, and only for a name still missing its tag.
const open = computed(
  () =>
    !dismissed.value &&
    !!term.value &&
    (suggestions.value.length > 0 || (!loading.value && !!target.value && !complete(target.value)))
)
const heading = computed(() =>
  fixing.value && target.value ? `“${target.value.name}” has no tag: pick the player` : 'Players'
)

/** The typed part of a name, lit as the header's search does. */
function marked(name: string): [string, string, string] {
  const q = term.value
  const at = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (at < 0) return [name, '', '']
  return [name.slice(0, at), name.slice(at, at + q.length), name.slice(at + q.length)]
}

/* ── The field ─────────────────────────────────────────────────── */
function readCaret() {
  caret.value = input.value?.selectionStart ?? model.value.length
}
function onInput() {
  fixing.value = false
  dismissed.value = false
  readCaret()
}
function onPaste() {
  // The paste lands after this event: read the field once it has.
  setTimeout(() => {
    readCaret()
    fixing.value = unresolved.value.length > 0
    dismissed.value = !fixing.value
    emit('pasted')
  }, 0)
}
function move(delta: number) {
  if (!open.value || !suggestions.value.length) return
  active.value = (active.value + delta + suggestions.value.length) % suggestions.value.length
}
function onEnter() {
  const pick = open.value ? suggestions.value[active.value] : undefined
  if (pick) choose(pick)
  else emit('submit')
}
function onBlur() {
  // A click on a suggestion lands first (mousedown), so closing on blur loses nothing.
  dismissed.value = true
}

/** Writes the player in place of the name, then moves on (the next untagged name, or the end). */
async function choose(r: Result) {
  const t = target.value
  if (!t) return
  const id = `${r.gameName}#${r.tagLine}`
  const before = model.value.slice(0, t.start)
  let after = model.value.slice(t.end)
  const last = !after.trim()
  if (last) after = ', '
  model.value = before + id + after
  const at = before.length + id.length + (last ? 2 : 0)
  active.value = 0
  await nextTick()
  input.value?.focus()
  input.value?.setSelectionRange(at, at)
  caret.value = at
  // The next name may read the same ("see", "see"): show its players again.
  lookup(term.value)
  if (fixing.value) {
    if (!unresolved.value.length) {
      fixing.value = false
      dismissed.value = true
      emit('resolved')
    }
  } else {
    dismissed.value = true
  }
}

const activeId = computed(() =>
  open.value && suggestions.value.length ? `${listId}-${active.value}` : undefined
)
</script>

<template>
  <div class="ms-in">
    <label class="field">
      <Icon name="users" />
      <input
        ref="input"
        v-model="model"
        type="text"
        spellcheck="false"
        autocomplete="off"
        role="combobox"
        aria-label="Names"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="open ? listId : undefined"
        :aria-activedescendant="activeId"
        :placeholder="placeholder"
        @input="onInput"
        @paste="onPaste"
        @click="readCaret"
        @keyup.left="readCaret"
        @keyup.right="readCaret"
        @keyup.home="readCaret"
        @keyup.end="readCaret"
        @focus="readCaret"
        @blur="onBlur"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="dismissed = true"
      />
      <span v-if="loading && term" class="ms-spin" aria-hidden="true" />
    </label>

    <div v-if="open" :id="listId" class="panel ms-sug" role="listbox" :aria-label="heading">
      <div class="sg-h">{{ heading }}</div>
      <div
        v-for="(r, i) in suggestions"
        :id="`${listId}-${i}`"
        :key="r.puuid"
        class="sg-r"
        :class="{ act: i === active }"
        role="option"
        :aria-selected="i === active"
        @mouseenter="active = i"
        @mousedown.prevent="choose(r)"
      >
        <span class="fr s"><img :src="profileIcon(r.profileIconId)" alt="" decoding="async" /></span>
        <span class="sg-t">
          <b
            >{{ marked(r.gameName)[0] }}<mark>{{ marked(r.gameName)[1] }}</mark
            >{{ marked(r.gameName)[2] }} <span class="t3">#{{ r.tagLine }}</span></b
          >
          <span class="num"
            ><img
              v-if="r.platform"
              :src="regionFlag(r.platform)"
              alt=""
              width="16"
              height="11"
              style="border-radius: 2px"
            />{{ regionLabel(r.platform)
            }}<template v-if="r.summonerLevel">, level {{ r.summonerLevel }}</template></span
          >
        </span>
        <Icon name="plus" :size="14" class="ms-add" />
      </div>
      <p v-if="!suggestions.length" class="ms-none">
        No stored player named “{{ term }}”. Type the whole Name#TAG.
      </p>
      <div class="panel-f" aria-hidden="true">
        <span><span class="kbd">↑</span><span class="kbd">↓</span>move</span>
        <span><span class="kbd">Enter</span>add</span>
        <span><span class="kbd">Esc</span>close</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ms-in {
  position: relative;
  flex: 1;
  min-width: 0;
}
.ms-in .field {
  height: 46px;
}
.ms-sug {
  position: absolute;
  z-index: 40;
  top: 100%;
  left: 0;
  right: 0;
  padding-bottom: 0;
}
.ms-sug .panel-f {
  margin-top: 8px;
}
.ms-add {
  flex: none;
  margin-left: auto;
  color: var(--t3);
}
.sg-r.act .ms-add {
  color: var(--v200);
}
.ms-none {
  margin: 0;
  padding: 6px 18px 14px;
  font-size: 13px;
  color: var(--t3);
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
@media (max-width: 767px) {
  .ms-in {
    flex: 1 1 100%;
  }
  .ms-sug .panel-f {
    display: none;
  }
}
@keyframes ms-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
