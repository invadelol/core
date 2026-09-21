<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { MatchTag } from '../lib/match_tags.js'

const props = defineProps<{ tags: MatchTag[] }>()
const id = useId()
const showAll = ref(false)
const selected = ref<string | null>(null)
const visible = computed(() => (showAll.value ? props.tags : props.tags.slice(0, 4)))
const active = computed(() => visible.value.find((tag) => tag.id === selected.value))
const toneClass: Record<MatchTag['tone'], string> = {
  positive: 'bg-win',
  negative: 'bg-loss',
  neutral: 'bg-ink-3',
  gold: 'bg-gold',
}
</script>

<template>
  <div v-if="tags.length" class="pb-2.5 pl-3.5 pr-3 sm:pl-4" aria-label="Match highlights">
    <div :id="`${id}-tags`" class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="tag in visible"
        :key="tag.id"
        type="button"
        class="inline-flex min-h-6 items-center gap-1.5 rounded-[3px] bg-raised px-2 py-1 text-[10.5px] font-medium leading-none text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
        :class="{ 'ring-1 ring-line-2': active?.id === tag.id }"
        :aria-expanded="active?.id === tag.id"
        :aria-controls="`${id}-explanation`"
        :title="tag.description"
        @click="selected = selected === tag.id ? null : tag.id"
      >
        <span
          class="h-1 w-1 shrink-0 rounded-full"
          :class="toneClass[tag.tone]"
          aria-hidden="true"
        />
        {{ tag.label }}
      </button>
      <button
        v-if="tags.length > 4"
        type="button"
        class="min-h-6 rounded-[3px] px-1.5 py-1 text-[10.5px] font-medium leading-none text-ink-2 transition-colors hover:bg-raised hover:text-ink"
        :aria-expanded="showAll"
        :aria-controls="`${id}-tags`"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show less' : `+${tags.length - 4} more` }}
      </button>
    </div>
    <p
      v-show="active"
      :id="`${id}-explanation`"
      class="mt-2 max-w-[80ch] text-[11px] leading-relaxed text-ink-2"
      aria-live="polite"
    >
      <span class="font-semibold">{{ active?.label }}.</span> {{ active?.description }}
    </p>
  </div>
</template>
