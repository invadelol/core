<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown, Search } from 'lucide-vue-next'

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
  active.value = Math.max(
    0,
    visible.value.findIndex((o) => o.value === model.value)
  )
  await nextTick()
  if (props.searchable) input.value?.focus()
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
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex h-[30px] w-full items-center gap-2 rounded-[7px] border bg-sunken px-2.5 text-[12px] font-medium transition-colors"
      :class="open ? 'border-line-2' : 'border-transparent hover:border-line-2'"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open = !open"
    >
      <span v-if="label" class="shrink-0 text-ink-3">{{ label }}</span>
      <img
        v-if="selected?.icon"
        :src="selected.icon"
        alt=""
        class="thumb h-[17px] w-[17px] rounded-[3px]"
      />
      <span class="min-w-0 flex-1 truncate text-left" :class="selected ? 'text-ink' : 'text-ink-3'">
        {{ selected?.label ?? placeholder }}
      </span>
      <ChevronDown
        :size="14"
        class="shrink-0 text-ink-3 transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <div
      v-if="open"
      class="menu absolute z-40 mt-1.5 max-h-[320px] overflow-hidden"
      :class="align === 'right' ? 'right-0' : 'left-0'"
      :style="{ width }"
    >
      <div v-if="searchable" class="border-b border-line p-2">
        <div class="relative">
          <Search
            :size="13"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            ref="input"
            v-model="query"
            class="field !py-1.5 !pl-7 !text-[12px]"
            :placeholder="searchPlaceholder ?? 'Filter…'"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="commit"
            @keydown.esc.prevent="open = false"
          />
        </div>
      </div>

      <div ref="list" role="listbox" class="max-h-[264px] overflow-y-auto py-1">
        <button
          v-for="(option, index) in visible"
          :key="String(option.value)"
          type="button"
          role="option"
          class="menu-item"
          :aria-selected="option.value === model"
          :data-active="index === active"
          @mouseenter="active = index"
          @click="choose(option.value)"
        >
          <img v-if="option.icon" :src="option.icon" alt="" class="thumb h-5 w-5 rounded-[5px]" />
          <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          <span v-if="option.meta" class="num shrink-0 text-[11px] text-ink-3">{{
            option.meta
          }}</span>
          <Check v-if="option.value === model" :size="13" class="shrink-0 text-ink" />
        </button>
        <p v-if="!visible.length" class="px-3 py-4 text-center text-[12px] text-ink-3">
          No champion matches “{{ query }}”.
        </p>
      </div>
    </div>
  </div>
</template>
