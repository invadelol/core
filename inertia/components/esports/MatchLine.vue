<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import MatchTime from '../pros/MatchTime.vue'
import { isLive, stageLine, teamLabel, type ProMatch } from '../../lib/pro_matches.js'
import { leagueLogo } from '../../lib/board.js'

/**
 * One pro match on a line (`.lrow`): the league, both teams with their logos, the score once it
 * started (the winner white, the other grey) or its time, and a Watch link while it is live.
 */
defineProps<{ match: ProMatch; league?: boolean }>()
const logo = (t: ProMatch['teams'][number]) => (t.id ? `/cdn/team/${t.id}?s=48` : null)
</script>

<template>
  <div class="lrow es-ml">
    <img
      v-if="league && match.league"
      class="es-lg"
      :src="leagueLogo(match.league.slug, 40)"
      :alt="match.league.code"
      :title="match.league.name"
    />
    <span class="es-t r">
      <component
        :is="match.teams[0].slug ? Link : 'span'"
        :href="match.teams[0].slug ? `/team/${match.teams[0].slug}` : undefined"
        class="h5 ell"
        :class="{ t3: match.winner === 2 }"
        >{{ teamLabel(match.teams[0]) }}</component
      >
      <img v-if="logo(match.teams[0])" :src="logo(match.teams[0])!" alt="" />
      <i v-else></i>
    </span>
    <span class="es-sc">
      <template v-if="match.status === 'finished' || isLive(match)">
        <b class="num">{{ match.teams[0].score ?? 0 }} – {{ match.teams[1].score ?? 0 }}</b>
        <span v-if="isLive(match)" class="live">Live</span>
        <span v-else class="meta">{{ stageLine(match) || 'Final' }}</span>
      </template>
      <template v-else>
        <MatchTime :at="match.at" />
        <span class="meta">{{
          match.status === 'postponed' ? 'Postponed' : stageLine(match)
        }}</span>
      </template>
    </span>
    <span class="es-t">
      <img v-if="logo(match.teams[1])" :src="logo(match.teams[1])!" alt="" />
      <i v-else></i>
      <component
        :is="match.teams[1].slug ? Link : 'span'"
        :href="match.teams[1].slug ? `/team/${match.teams[1].slug}` : undefined"
        class="h5 ell"
        :class="{ t3: match.winner === 1 }"
        >{{ teamLabel(match.teams[1]) }}</component
      >
    </span>
    <a
      v-if="isLive(match) && match.stream"
      class="btn sm es-w"
      :href="match.stream"
      target="_blank"
      rel="noreferrer"
      >Watch</a
    >
  </div>
</template>
