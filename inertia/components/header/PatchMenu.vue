<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import MenuArt from './MenuArt.vue'
import { champIcon } from '../../lib/assets.js'
import type { NavPatchNotes } from '../../lib/home.js'
import { NEW_DAWN_LINK } from '../../lib/site_nav.js'

/**
 * The Patch pill's menu: New Dawn first (Riot's 2027 update, with its own picture), then every
 * patch the site has notes for, newest first, each led by the portrait of the champion its notes
 * buffed the most, with how many champions and items changed. Until the menus' data lands it
 * lists the newest patch alone.
 */
const props = defineProps<{
  notes: NavPatchNotes[] | null
  /** The newest patch the statistics read ("26.22"), when known. */
  patch: string | null
  path: string
}>()
defineEmits<{ close: [] }>()

const nd = NEW_DAWN_LINK
const ndOn = computed(() => nd.here(props.path))

const rows = computed(() => {
  const list: (NavPatchNotes | { patch: string; published?: undefined; buff?: undefined })[] = props
    .notes?.length
    ? props.notes
    : props.patch
      ? [{ patch: props.patch }]
      : []
  return list.map((n) => ({
    patch: n.patch,
    href: `/patch/${n.patch}`,
    buff: n.buff ?? null,
    line:
      n.published !== undefined
        ? `${n.champions} ${n.champions === 1 ? 'champion' : 'champions'}, ${n.items} ${n.items === 1 ? 'item' : 'items'}`
        : 'Patch notes',
    on: props.path === `/patch/${n.patch}`,
  }))
})
</script>

<template>
  <div class="hx-menu dm pm">
    <div class="dm-l">
      <Link
        class="dm-r pm-r pm-nd"
        :class="{ on: ndOn }"
        :href="nd.href"
        :aria-current="ndOn ? 'page' : undefined"
        prefetch
        @click="$emit('close')"
      >
        <span class="dm-i"><MenuArt :name="nd.art" :size="56" /></span>
        <span class="dm-t"
          ><b>{{ nd.label }}</b
          ><span>{{ nd.line }}</span></span
        >
        <span class="pm-rv">{{ nd.note }}</span>
      </Link>
      <div class="dm-sep" role="separator" />
      <Link
        v-for="(r, i) in rows"
        :key="r.patch"
        class="dm-r pm-r"
        :class="{ on: r.on, new: i === 0 }"
        :href="r.href"
        :aria-current="r.on ? 'page' : undefined"
        prefetch
        @click="$emit('close')"
      >
        <span v-if="r.buff" class="pm-c" :title="`Biggest buff: ${r.buff.name}`"
          ><span class="pm-p"
            ><img :src="champIcon(r.buff.id)" :alt="`Biggest buff: ${r.buff.name}`" /></span
          ><i class="pm-up" aria-hidden="true"><Icon name="up" :size="10" :stroke-width="2.2" /></i
        ></span>
        <span v-else class="pm-c" aria-hidden="true"><Icon name="news" :size="18" /></span>
        <span class="dm-t"
          ><b>Patch {{ r.patch }}</b
          ><span>{{ r.line }}</span></span
        >
        <span v-if="i === 0" class="pm-new">Newest</span>
      </Link>
    </div>
  </div>
</template>
