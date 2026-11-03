<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Icon, RoleIcon } from '@invadelol/ui'
import type { SiteNav } from '../../lib/home.js'
import ThemeChoice from './ThemeChoice.vue'
import { prefetchOnTouch } from './prefetch.js'
import { ROLE_LINKS, SECTIONS, type SectionKey } from './sections.js'

/**
 * The phone's menu, under the bar: the search, the four sections as an accordion (the current
 * one open), the theme and the desktop app. The page under it holds still (the header locks the
 * scroll); Tab stays inside it and the bar's close button.
 */
const props = defineProps<{
  nav: SiteNav | null
  path: string
  search: boolean
  closeButton: HTMLElement | null
}>()
const emit = defineEmits<{ close: [focusButton?: boolean]; search: [] }>()

const here = SECTIONS.find((s) => s.here(props.path))?.key ?? null
const opened = ref<SectionKey | null>(here)
const sheet = ref<HTMLElement>()

const sections = computed(() =>
  SECTIONS.map((s) => ({
    ...s,
    items: s.links.flatMap((l) => {
      const line = l.line(props.nav)
      return line === null ? [] : [{ ...l, text: l.title?.(props.nav) ?? l.label, line }]
    }),
  }))
)

function toggle(key: SectionKey) {
  opened.value = opened.value === key ? null : key
}

const focusables = () => [
  ...(sheet.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []),
]

onMounted(() => focusables()[0]?.focus({ preventScroll: true }))

/** Tab past the last control comes back to the bar's close button, and Shift+Tab the other way. */
function onKey(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const list = focusables()
  const first = list[0]
  const last = list[list.length - 1]
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    props.closeButton?.focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    props.closeButton?.focus()
  }
}
</script>

<template>
  <nav ref="sheet" class="sh-sheet" aria-label="Menu" @keydown="onKey">
    <div class="scroll">
      <button v-if="search" type="button" class="sh-msearch" @click="emit('search')">
        <Icon name="search" :size="18" />Player, champion or pro
      </button>

      <div v-for="s in sections" :key="s.key" class="sh-acc">
        <button
          type="button"
          class="sh-acc-h"
          :class="{ open: opened === s.key }"
          :aria-expanded="opened === s.key"
          :aria-controls="`sh-acc-${s.key}`"
          @click="toggle(s.key)"
        >
          <span class="ic"><Icon :name="s.icon" :size="18" /></span>{{ s.label
          }}<span class="chev"><Icon name="down" :size="16" /></span>
        </button>
        <div v-if="opened === s.key" :id="`sh-acc-${s.key}`" class="sh-acc-b">
          <Link
            v-for="l in s.items"
            :key="l.href"
            :href="l.href"
            :data-track="`mobile_${s.key}_${l.label.toLowerCase().replace(/\W+/g, '_')}`"
            @touchstart.passive="prefetchOnTouch(l.href)"
          >
            {{ l.text }}<small>{{ l.line }}</small>
          </Link>
          <div v-if="s.key === 'champions'" class="roles">
            <Link
              v-for="r in ROLE_LINKS"
              :key="r.href"
              :href="r.href"
              :aria-label="`${r.label} tier list`"
              data-track="mobile_champions_role"
            >
              <RoleIcon :lane="r.lane" :size="18" />
            </Link>
          </div>
        </div>
      </div>
    </div>

    <div class="foot">
      <div class="theme"><span>Theme</span><ThemeChoice /></div>
      <Link href="/app" class="iv-btn primary" data-track="mobile_get_app">
        <Icon name="download" :size="16" />Get the desktop app
      </Link>
    </div>
  </nav>
</template>
