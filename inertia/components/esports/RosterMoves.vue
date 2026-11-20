<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import Logo from '../pros/Logo.vue'
import ProPic from '../pros/ProPic.vue'
import { laneOf } from '../../lib/ladders.js'
import { dayMonth, names, type RosterMove, type TeamTag } from '../../lib/esports_landing.js'

/**
 * Roster moves, one per row like a transfers table: the day, the player (or the players who left
 * one team that day) with their faces, and the move from one team to the other. A side the data
 * does not hold (where they came from, where they play now) is a dash.
 */
defineProps<{ moves: RosterMove[] }>()

const sides = (m: RosterMove): [TeamTag | null, TeamTag | null] =>
  m.kind === 'joined' ? [m.other, m.team] : [m.team, m.other]
</script>

<template>
  <div class="el-mv">
    <div
      v-for="m in moves"
      :key="`${m.at}${m.team.id}${m.kind}${m.players[0]?.slug}`"
      class="el-mvr"
    >
      <span class="el-mvd num">{{ dayMonth(m.at) }}</span>
      <span class="el-mvp">
        <span class="el-faces">
          <span v-for="p in m.players.slice(0, 3)" :key="p.slug" class="el-face"
            ><ProPic :slug="p.slug" :photo="p.photo" :team="m.team" :size="32"
          /></span>
        </span>
        <span class="col" style="min-width: 0">
          <component
            :is="m.players.length === 1 ? Link : 'span'"
            :href="m.players.length === 1 ? `/pro/${m.players[0].slug}` : undefined"
            class="el-nm ell"
            >{{ names(m.players) }}</component
          >
          <span v-if="m.players.length === 1 && laneOf(m.players[0].role)" class="el-sub">
            <RoleIcon :lane="laneOf(m.players[0].role)!" :size="12" />{{
              m.kind === 'joined' ? 'Joined' : 'Left'
            }}
          </span>
          <span v-else class="el-sub">{{ m.kind === 'joined' ? 'Joined' : 'Left' }}</span>
        </span>
      </span>
      <span class="el-mvt">
        <template v-for="(t, i) in sides(m)" :key="i">
          <Link v-if="t" :href="`/team/${t.slug}`" class="el-tm"
            ><Logo :team="t.id" :size="20" /><span class="ell">{{ t.name }}</span></Link
          >
          <span v-else class="el-tm el-none">–</span>
          <svg
            v-if="i === 0"
            class="el-arr"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </template>
      </span>
    </div>
  </div>
</template>
