<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import Frame from '../../ui/Frame.vue'
import RankEmblem from '../../ui/RankEmblem.vue'
import ProPic from '../../pros/ProPic.vue'
import { champIcon, championName, championSplash, profileIcon } from '../../../lib/assets.js'
import { laneOf, n, roleLabel } from '../../../lib/ladders.js'
import { ord, type TopPlayer } from './types.js'

/**
 * A podium per role, in lane order: each role's first before the art of the champion they play
 * most, with their place on the whole ladder, then its second and third in a line each. The
 * ladder's own first three read from the places.
 */
defineProps<{ groups: { role: string; players: TopPlayer[] }[] }>()
</script>

<template>
  <div class="trl">
    <div v-for="g in groups" :key="g.role" class="trl-col">
      <span class="trl-h"
        ><RoleIcon v-if="laneOf(g.role)" :lane="laneOf(g.role)!" :size="15" />{{
          roleLabel(g.role)
        }}</span
      >
      <template v-if="g.players[0]">
        <Link class="trl-one" :href="g.players[0].href">
          <Frame
            class="trl-art"
            :src="
              g.players[0].champions[0] ? championSplash(g.players[0].champions[0].champion) : null
            "
            stage
          >
            <span v-if="g.players[0].pro" class="trl-pic pro"
              ><ProPic
                :slug="g.players[0].pro.slug"
                :photo="g.players[0].pro.photo"
                :team="g.players[0].pro.team"
                :size="96"
                position="50% 6%"
            /></span>
            <span v-else class="trl-pic"><img :src="profileIcon(g.players[0].icon)" alt="" /></span>
            <span class="trl-no" :class="{ top: g.players[0].place <= 3 }"
              >{{ g.players[0].place }}<sup>{{ ord(g.players[0].place) }}</sup></span
            >
          </Frame>
          <span class="trl-b">
            <span class="h4 ell"
              ><span :data-riot="g.players[0].riot ? '' : undefined">{{
                g.players[0].name
              }}</span></span
            >
            <span class="row" style="gap: 6px"
              ><RankEmblem :tier="g.players[0].tier" :size="20" /><span class="h5 num">{{
                g.players[0].lp === null ? '-' : `${n(g.players[0].lp)} LP`
              }}</span></span
            >
            <span v-if="g.players[0].champions[0]" class="meta row trl-main"
              ><Frame :src="champIcon(g.players[0].champions[0].champion)" :width="18" size="xs" />
              <span class="ell"
                >{{ championName(g.players[0].champions[0].champion) }},
                {{ g.players[0].champions[0].games }}
                {{ g.players[0].champions[0].games === 1 ? 'game' : 'games' }}</span
              ></span
            >
          </span>
        </Link>
        <Link v-for="p in g.players.slice(1)" :key="p.place" class="trl-r" :href="p.href">
          <span class="trl-rn num"
            >{{ p.place }}<sup>{{ ord(p.place) }}</sup></span
          >
          <span v-if="p.pro" class="trl-face"
            ><ProPic :slug="p.pro.slug" :photo="p.pro.photo" :team="p.pro.team" :size="24"
          /></span>
          <img v-else class="trl-face" :src="profileIcon(p.icon)" alt="" />
          <span class="h5 ell grow"
            ><span :data-riot="p.riot ? '' : undefined">{{ p.name }}</span></span
          >
          <span class="meta num">{{ p.lp === null ? '-' : n(p.lp) }}</span>
        </Link>
      </template>
      <span v-else class="meta trl-none">No {{ roleLabel(g.role).toLowerCase() }} yet</span>
    </div>
  </div>
</template>
