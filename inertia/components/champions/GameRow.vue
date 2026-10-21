<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { championName, nameOf, regionLabel } from '../../lib/assets.js'
import {
  ago,
  champIconUrl,
  itemUrl,
  perkUrl,
  spellUrl,
  styleUrl,
  type ProGame,
} from '../../lib/champions.js'

/**
 * One ranked game as a row card with its result edge (DESIGN.md match row): who played (a pro on a
 * champion's page, the account on a pro's page), the score, runes and spells, items, the lane
 * opponent and when.
 */
const props = defineProps<{ game: ProGame; who: 'pro' | 'account' }>()
const kda = () =>
  ((props.game.kills + props.game.assists) / Math.max(1, props.game.deaths)).toFixed(1)
const minutes = () => Math.round(props.game.durationSec / 60)
</script>

<template>
  <div class="cs-game" :class="game.win ? 'w' : 'l'">
    <span class="who">
      <img :src="champIconUrl(game.champion)" :alt="championName(game.champion)" />
      <span v-if="who === 'pro' && game.pro" class="min-w-0">
        <Link :href="`/pro/${game.pro.slug}`"
          ><b>{{ game.pro.name }}</b></Link
        >
        <small>{{ game.pro.team?.name ?? 'No team' }} · {{ regionLabel(game.platform) }}</small>
      </span>
      <span v-else class="min-w-0">
        <b>{{ championName(game.champion) }}</b>
        <small>{{ game.account }}</small>
      </span>
    </span>
    <span class="kda"
      ><b>{{ game.kills }} / {{ game.deaths }} / {{ game.assists }}</b
      ><small>{{ kda() }} KDA · {{ game.cs }} CS</small></span
    >
    <span class="ld">
      <img class="round" :src="perkUrl(game.keystone)" :alt="nameOf('rune', game.keystone) ?? ''" />
      <img :src="spellUrl(game.spells[0])" alt="" />
      <img class="round" :src="styleUrl(game.secondaryStyle)" alt="" />
      <img :src="spellUrl(game.spells[1])" alt="" />
    </span>
    <span class="its">
      <template v-for="(id, i) in game.items" :key="i">
        <img
          v-if="id"
          :src="itemUrl(id)"
          :alt="nameOf('item', id) ?? ''"
          :title="nameOf('item', id) ?? ''"
          loading="lazy"
        />
        <i v-else />
      </template>
    </span>
    <span class="vs">
      <template v-if="game.opponent"
        >vs<img
          :src="champIconUrl(game.opponent)"
          :alt="championName(game.opponent)"
          :title="championName(game.opponent)"
      /></template>
    </span>
    <span class="when"
      ><b>{{ game.win ? 'Win' : 'Loss' }}</b
      >{{ minutes() }} min · {{ ago(game.startMs) }}</span
    >
  </div>
</template>
