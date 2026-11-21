<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../../ui/Icon.vue'
import Frame from '../../ui/Frame.vue'
import CardHead from '../../ui/CardHead.vue'
import WinRate from '../../ui/WinRate.vue'
import FormStrip from '../../ui/FormStrip.vue'
import { champIcon, assetUrl } from '../../../lib/assets.js'
import type { ChampionNames, ProBuild } from './types.js'

/**
 * A pro's champions of the last 30 days (`list`), and how they play the one they play most
 * (`main`): core items, runes, spells, skill order and their last games on it.
 */
const props = withDefaults(
  defineProps<{
    builds: ProBuild[]
    names: ChampionNames
    pro: string
    base: string
    show?: 'both' | 'list' | 'main'
    limit?: number
  }>(),
  { show: 'both', limit: 6 }
)
const main = computed(() => props.builds[0] ?? null)
const nameOf = (id: number) => props.names[id]?.[0] ?? ''
const slugOf = (id: number) => props.names[id]?.[1] ?? String(id)
</script>

<template>
  <section v-if="show !== 'main' && builds.length" class="card pv-champs">
    <CardHead
      title="Champions"
      icon="grid"
      meta="30 days"
      :more="{ label: 'Builds', href: `${base}?tab=champions` }"
    />
    <Link
      v-for="b in builds.slice(0, limit)"
      :key="b.champion"
      class="pv-ch"
      :href="`/champions/${slugOf(b.champion)}`"
    >
      <Frame :src="champIcon(b.champion)" :width="32" size="xs" />
      <span class="col grow" style="min-width: 0">
        <span class="h5 ell">{{ nameOf(b.champion) }}</span>
        <span class="meta"
          >{{ b.games }} {{ b.games === 1 ? 'game' : 'games' }}, {{ b.kda.toFixed(2) }} KDA</span
        >
      </span>
      <WinRate :wins="b.wins" :games="b.games" :width="72" small end :record="false" />
    </Link>
  </section>

  <section v-if="show !== 'list' && main" class="card pv-main">
    <div class="card-h">
      <Frame :src="champIcon(main.champion)" :width="28" size="xs" />
      <h2 class="h3 ell">{{ pro }} on {{ nameOf(main.champion) }}</h2>
      <span class="meta" style="margin-left: auto">Most played</span>
    </div>
    <div v-if="main.core.length" class="pv-kv">
      <span class="lab">Core</span>
      <span class="pv-its">
        <img v-if="main.boots" :src="assetUrl('item', main.boots)" alt="" loading="lazy" /><img
          v-for="it in main.core"
          :key="it"
          :src="assetUrl('item', it)"
          alt=""
          loading="lazy"
        />
      </span>
    </div>
    <div v-if="main.keystone || main.spells" class="pv-kv">
      <span class="lab">Runes, spells</span>
      <span class="pv-its">
        <img v-if="main.keystone" class="r" :src="assetUrl('rune', main.keystone)" alt="" /><img
          v-if="main.secondaryStyle"
          class="r sm"
          :src="assetUrl('runeStyle', main.secondaryStyle)"
          alt=""
        /><img v-for="s in main.spells ?? []" :key="s" :src="assetUrl('spell', s)" alt="" />
      </span>
    </div>
    <div v-if="main.max.length" class="pv-kv">
      <span class="lab">Skills</span>
      <span class="h5">Max {{ main.max.join(', ') }}</span>
    </div>
    <div class="pv-kv">
      <span class="lab">Last games</span>
      <FormStrip :results="[...main.form].reverse()" small />
    </div>
    <Link class="more pv-more" :href="`/champions/${slugOf(main.champion)}`"
      >{{ nameOf(main.champion) }} page<Icon name="chevr"
    /></Link>
  </section>
</template>
