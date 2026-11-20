<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import Logo from '../pros/Logo.vue'
import MatchTime from '../pros/MatchTime.vue'
import { bestOfText, isLive, stageOf, teamName, type ProMatch } from '../../lib/pro_matches.js'
import { dayMonth } from '../../lib/esports_landing.js'

/**
 * One match, face to face at a landing's size: both teams' logos large, the score (or "vs" and
 * the time), the league and stage above, and Watch while it is live. The winner stays white, the
 * other team grey.
 */
const props = defineProps<{ match: ProMatch; leagues?: [string | null, string | null] }>()
const m = computed(() => props.match)
const stage = computed(() =>
  [stageOf(m.value)?.toLowerCase(), bestOfText(m.value)].filter(Boolean).join(', ')
)
const played = computed(() => m.value.status === 'finished' || isLive(m.value))
</script>

<template>
  <div class="el-mh">
    <span class="el-mh-top">
      <Logo v-if="m.league" :league="m.league.slug" :size="24" class="el-lg24" />
      <span>{{ m.league?.name ?? m.tournament }}</span
      ><span v-if="stage" class="t3">{{ stage }}</span>
    </span>
    <div class="el-mh-row">
      <component
        :is="m.teams[0].slug ? Link : 'span'"
        :href="m.teams[0].slug ? `/team/${m.teams[0].slug}` : undefined"
        class="el-mh-t r"
        :class="{ lost: m.winner === 2 }"
      >
        <span class="col">
          <span class="el-mh-n">{{ teamName(m.teams[0]) }}</span>
          <span v-if="leagues?.[0]" class="el-sub">{{ leagues[0] }}</span>
        </span>
        <Logo v-if="m.teams[0].id" :team="m.teams[0].id" :size="96" class="el-lg96" />
        <span v-else class="el-lg96 el-tbd"></span>
      </component>
      <div class="el-mh-s">
        <span v-if="played" class="el-mh-sc num"
          >{{ m.teams[0].score ?? 0 }}<i>–</i>{{ m.teams[1].score ?? 0 }}</span
        >
        <span v-else class="el-mh-sc vs">vs</span>
        <span v-if="isLive(m)" class="live">Live</span>
        <span v-else-if="m.status === 'finished'" class="el-sub">{{ dayMonth(m.at) }}</span>
        <span v-else class="el-sub"><MatchTime :at="m.at" /></span>
        <a
          v-if="m.stream && isLive(m)"
          class="btn pri"
          style="margin-top: 14px"
          :href="m.stream"
          target="_blank"
          rel="noreferrer"
          ><Icon name="play" />Watch</a
        >
      </div>
      <component
        :is="m.teams[1].slug ? Link : 'span'"
        :href="m.teams[1].slug ? `/team/${m.teams[1].slug}` : undefined"
        class="el-mh-t"
        :class="{ lost: m.winner === 1 }"
      >
        <Logo v-if="m.teams[1].id" :team="m.teams[1].id" :size="96" class="el-lg96" />
        <span v-else class="el-lg96 el-tbd"></span>
        <span class="col">
          <span class="el-mh-n">{{ teamName(m.teams[1]) }}</span>
          <span v-if="leagues?.[1]" class="el-sub">{{ leagues[1] }}</span>
        </span>
      </component>
    </div>
  </div>
</template>
