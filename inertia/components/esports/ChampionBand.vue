<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Logo from '../pros/Logo.vue'
import ProPic from '../pros/ProPic.vue'
import { teamName } from '../../lib/pro_matches.js'
import { dayMonth, type LastEvent } from '../../lib/esports_landing.js'

/**
 * The last international event's champion, between seasons: the event as the section's title,
 * then the champion's crest and name, the final's score against the runner-up and its day, and
 * the five who won it (their starters that day), each a link to their page.
 */
const props = defineProps<{ event: LastEvent }>()
const title = computed(() =>
  [props.event.league?.code ?? props.event.league?.name, props.event.year].filter(Boolean).join(' ')
)
const final = computed(() => {
  const f = props.event.final
  const me = f.teams[0].id === props.event.champion.id ? 0 : 1
  return { won: f.teams[me].score ?? 0, lost: f.teams[1 - me].score ?? 0, them: f.teams[1 - me] }
})
</script>

<template>
  <section class="sec">
    <div class="sec-h">
      <Logo v-if="event.league" :league="event.league.slug" :size="24" class="el-lg24" />
      <h2 class="h2">{{ title }}</h2>
    </div>
    <div class="card lit el-evb">
      <Link :href="`/team/${event.champion.slug}`" class="el-evb-t">
        <Logo :team="event.champion.id" :size="72" class="el-lg64" />
        <span class="col">
          <span class="el-sub">Champions</span>
          <span class="el-d2">{{ event.champion.name }}</span>
          <span class="el-sub el-evb-s"
            >Final <b class="num">{{ final.won }}–{{ final.lost }}</b
            ><Logo v-if="final.them.id" :team="final.them.id" :size="16" class="el-tl" />{{
              teamName(final.them)
            }}, {{ dayMonth(event.final.at) }}</span
          >
        </span>
      </Link>
      <div v-if="event.lineup.length" class="el-evb-f">
        <Link v-for="m in event.lineup" :key="m.slug" :href="`/pro/${m.slug}`" class="el-evb-p">
          <span class="el-pf56"
            ><ProPic :slug="m.slug" :photo="m.photo" :team="{ id: event.champion.id }" :size="64"
          /></span>
          <span class="el-nm ell">{{ m.name }}</span>
        </Link>
      </div>
    </div>
  </section>
</template>
