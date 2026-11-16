<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'

interface Option<V> {
  value: V
  label: string
  /** Optional square art shown before the label (champion, role, queue). */
  icon?: string
  /** Right-aligned qualifier, e.g. a game count. */
  meta?: string
}

const props = withDefaults(
  defineProps<{
    options: ReadonlyArray<Option<T>>
    /** Shown before the value, so the control reads as a sentence. */
    label?: string
    placeholder?: string
    /** Adds a filter box once the list is long enough to need one. */
    searchable?: boolean
    searchPlaceholder?: string
    width?: string
    align?: 'left' | 'right'
  }>(),
  { placeholder: 'Any', searchable: false, width: '15rem', align: 'left' }
)

const model = defineModel<T>({ required: true })

const open = ref(false)
/** Opens upwards when the list would run past the bottom of the screen (a sticky side bar). */
const up = ref(false)
/** The list's height, to fit the room on the side it opens. */
const listMax = ref(280)
const query = ref('')
const active = ref(0)
const root = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
const list = ref<HTMLElement>()

const selected = computed(() => props.options.find((o) => o.value === model.value))

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

watch(open, async (isOpen) => {
  if (!isOpen) {
    query.value = ''
    return
  }
  const box = root.value?.getBoundingClientRect()
  if (box) {
    const extra = (props.searchable ? 52 : 0) + 14
    const want = Math.min(280, props.options.length * 36 + 8)
    const below = window.innerHeight - box.bottom - extra
    const above = box.top - extra
    up.value = below < want && above > below
    listMax.value = Math.max(120, Math.min(280, up.value ? above : below))
  }
  active.value = Math.max(
    0,
    visible.value.findIndex((o) => o.value === model.value)
  )
  await nextTick()
  // On a touch screen the keyboard would cover the list before anyone asked to type.
  if (props.searchable && !matchMedia('(pointer: coarse)').matches) input.value?.focus()
  scrollToActive()
})

watch(query, () => (active.value = 0))

function scrollToActive() {
  const node = list.value?.children[active.value] as HTMLElement | undefined
  node?.scrollIntoView({ block: 'nearest' })
}

function move(delta: number) {
  if (!visible.value.length) return
  active.value = (active.value + delta + visible.value.length) % visible.value.length
  void nextTick(scrollToActive)
}

function choose(value: T) {
  model.value = value
  open.value = false
}

function commit() {
  const option = visible.value[active.value]
  if (option) choose(option.value)
}

function onOutside(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside))
</script>

<template>
  <div ref="root" class="vb sel-root relative" @keydown.esc="open = false">
    <button
      type="button"
      class="sel w-full"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open = !open"
    >
      <span v-if="label" class="k">{{ label }}</span>
      <img v-if="selected?.icon" :src="selected.icon" alt="" class="sel-ic" />
      <span class="min-w-0 flex-1 truncate text-left" :class="{ t3: !selected }">
        {{ selected?.label ?? placeholder }}
      </span>
      <Icon name="chev" :size="14" class="sel-chev" :class="{ 'rotate-180': open }" />
    </button>

    <div
      v-if="open"
      class="sel-pop absolute z-40 max-h-[340px] overflow-hidden"
      :class="[align === 'right' ? 'right-0' : 'left-0', up ? 'bottom-full mb-1.5' : 'mt-1.5']"
      :style="{ width: `min(${width}, calc(100vw - 32px))` }"
    >
      <div v-if="searchable" class="sel-q">
        <label class="field">
          <Icon name="search" :size="15" />
          <input
            ref="input"
            v-model="query"
            :placeholder="searchPlaceholder ?? 'Filter…'"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="commit"
            @keydown.esc.prevent="open = false"
          />
        </label>
      </div>

      <div
        ref="list"
        role="listbox"
        class="overflow-y-auto p-1"
        :style="{ maxHeight: `${listMax}px` }"
      >
        <button
          v-for="(option, index) in visible"
          :key="String(option.value)"
          type="button"
          role="option"
          class="sel-o"
          :aria-selected="option.value === model"
          :data-active="index === active"
          @mouseenter="active = index"
          @click="choose(option.value)"
        >
          <img v-if="option.icon" :src="option.icon" alt="" class="sel-ic" />
          <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          <span v-if="option.meta" class="sel-m num">{{ option.meta }}</span>
          <Icon v-if="option.value === model" name="check" :size="14" class="sel-ck" />
        </button>
        <p v-if="!visible.length" class="sel-none">Nothing matches “{{ query }}”.</p>
      </div>
    </div>
  </div>
</template>
