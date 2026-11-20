<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Logo from '../pros/Logo.vue'
import ProPic from '../pros/ProPic.vue'
import Frame from '../ui/Frame.vue'
import RankEmblem from '../ui/RankEmblem.vue'
import { n } from '../../lib/ladders.js'
import type { LineupCard } from '../../lib/esports_landing.js'

/**
 * Pros as a line-up of tall portraits: the photo on the violet stage with their league's crest in
 * its corner, then their name, team, rank and LP.
 */
defineProps<{ cards: LineupCard[] }>()
</script>

<template>
  <div class="el-lu" :style="{ '--n': cards.length }">
    <Link v-for="c in cards" :key="c.slug" :href="`/pro/${c.slug}`" class="el-lu-c">
      <Frame stage height="100%" class="el-lu-f"
        ><ProPic :slug="c.slug" :photo="c.photo" :team="c.team" :size="240" position="50% 0" eager
      /></Frame>
      <Logo
        v-if="c.league"
        :league="c.league.slug"
        :size="24"
        :alt="c.league.code"
        class="el-lu-lg"
      />
      <span class="el-lu-n ell">{{ c.name }}</span>
      <span v-if="c.team" class="el-sub"
        ><Logo class="el-tl" :team="c.team.id" :size="16" /><span class="ell">{{
          c.team.name
        }}</span></span
      >
      <span class="el-lu-lp">
        <RankEmblem :tier="c.tier" :size="20" />
        <span class="el-v num">{{ n(c.lp) }}</span>
        <span class="el-sub">LP</span>
      </span>
    </Link>
  </div>
</template>
