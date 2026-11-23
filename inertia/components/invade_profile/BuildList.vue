<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import Frame from '../ui/Frame.vue'
import { assetUrl, champIcon } from '../../lib/assets.js'
import type { ProfileBuild } from '../../lib/profile_types.js'

/**
 * Builds made in the app (or saved from a link): the champion, the name, the route of items, the
 * max order, how often it was opened and imported. `compact` is the Overview's one-line version.
 */
withDefaults(
  defineProps<{ builds: ProfileBuild[]; names: Record<number, string>; compact?: boolean }>(),
  { compact: false }
)

const copied = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
async function copy(build: ProfileBuild) {
  try {
    await navigator.clipboard.writeText(new URL(build.url, location.origin).href)
    copied.value = build.id
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = null), 1800)
  } catch {
    /* The build's page has its address to copy by hand. */
  }
}
onBeforeUnmount(() => clearTimeout(timer))
const route = (b: ProfileBuild) => [
  ...b.items.start.slice(0, 2),
  ...(b.items.boots ? [b.items.boots] : []),
  ...b.items.core,
  ...b.items.later,
]
const usage = (b: ProfileBuild) =>
  b.shared
    ? `Opened ${b.opens.toLocaleString('en-US')} times, ${b.imports.toLocaleString('en-US')} imports`
    : 'Not shared'
</script>

<template>
  <div v-if="compact" class="pf-brows">
    <Link v-for="b in builds" :key="b.id" :href="b.url" class="pf-mini-build">
      <Frame :src="champIcon(b.championId)" :width="40" size="s" />
      <span class="col" style="gap: 2px; min-width: 0">
        <b class="ell">{{ b.name }}</b>
        <span class="meta">Imported {{ b.imports.toLocaleString('en-US') }} times</span>
      </span>
      <span class="pf-route" aria-hidden="true">
        <img
          v-for="id in [...b.items.core, ...b.items.later].slice(0, 5)"
          :key="id"
          :src="assetUrl('item', id)"
          alt=""
        />
      </span>
    </Link>
  </div>
  <div v-else class="card pf-brows">
    <article v-for="b in builds" :key="b.id" class="pf-build">
      <Frame :src="champIcon(b.championId)" :width="48" size="s" />
      <span class="pf-bt">
        <Link :href="b.url"
          ><b>{{ b.name }}</b></Link
        >
        <span class="meta">{{
          b.savedFrom ? `by ${b.savedFrom.name}` : `${names[b.championId] ?? ''}, ${b.lane}`
        }}</span>
      </span>
      <span class="pf-bacts">
        <button type="button" class="btn sm" @click="copy(b)">
          <Icon :name="copied === b.id ? 'check' : 'link'" :size="15" />{{
            copied === b.id ? 'Copied' : 'Copy link'
          }}
        </button>
      </span>
      <span class="pf-route">
        <template v-for="(id, i) in route(b)" :key="`${id}-${i}`">
          <img :src="assetUrl('item', id)" alt="" loading="lazy" />
        </template>
        <span
          v-if="b.skillOrder"
          class="pf-skill"
          :aria-label="`Max ${b.skillOrder.split('').join(', ')}`"
        >
          <template v-for="(k, i) in b.skillOrder.split('')" :key="k"
            ><Icon v-if="i" name="chevr" :size="12" class="chev" /><span class="kbd">{{
              k
            }}</span></template
          >
        </span>
      </span>
      <span class="pf-bstat">{{ b.savedFrom ? 'Saved from a link' : usage(b) }}</span>
    </article>
  </div>
</template>
