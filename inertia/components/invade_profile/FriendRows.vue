<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import RankEmblem from '../ui/RankEmblem.vue'
import PersonAvatar from '../skins/PersonAvatar.vue'
import { champIcon } from '../../lib/assets.js'
import { tierColor } from '../../lib/board.js'
import { rankWords, since } from '../../lib/ladders.js'
import { gameClock } from '../../lib/profile_view.js'
import type { FriendCard } from '../../lib/profile_types.js'

/**
 * Friends (both follow each other), as the Overview's showcase (`grid`: name and what they play)
 * or the Friends tab's rows (their main account, rank, last champions and status). A friend in a
 * game wears their champion on their face and the game clock runs.
 */
const props = withDefaults(
  defineProps<{ friends: FriendCard[]; names: Record<number, string>; rows?: boolean }>(),
  { rows: false }
)

const now = ref<number | null>(null)
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  if (props.friends.some((f) => f.live)) tick = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(tick))

function status(f: FriendCard) {
  if (f.live) {
    const clock = now.value ? `, ${gameClock(f.live.startedAt, now.value)}` : ''
    return `${props.names[f.live.championId] ?? ''}${clock}`
  }
  if (f.lastGame) {
    const ago = now.value ? `, ${since(Date.parse(f.lastGame.endedAt), now.value)}` : ''
    return `${props.names[f.lastGame.championId] ?? ''}${ago}`
  }
  return ''
}
const shown = computed(() => props.friends)
</script>

<template>
  <div v-if="!rows" class="pf-frs">
    <Link v-for="f in shown" :key="f.id" :href="`/u/${f.handle}`" class="pf-fr">
      <span class="pf-fav">
        <PersonAvatar :src="f.avatarUrl" :size="40" />
        <img
          v-if="f.live"
          class="live-champ"
          :src="champIcon(f.live.championId)"
          alt=""
          width="20"
          height="20"
        />
      </span>
      <span class="pf-frt">
        <b>{{ f.name }}<small v-if="f.isViewer">You</small></b>
        <span class="pf-st" :class="{ playing: f.live }"
          ><Icon v-if="f.live" name="live" :size="13" />{{ status(f) }}</span
        >
      </span>
    </Link>
  </div>
  <div v-else class="pf-ftab">
    <div v-for="f in shown" :key="f.id" class="pf-frow">
      <Link :href="`/u/${f.handle}`" class="pf-fr">
        <span class="pf-fav">
          <PersonAvatar :src="f.avatarUrl" :size="40" />
          <img
            v-if="f.live"
            class="live-champ"
            :src="champIcon(f.live.championId)"
            alt=""
            width="20"
            height="20"
          />
        </span>
        <span class="pf-frt">
          <b
            >{{ f.main ? f.main.gameName : f.name
            }}<small v-if="f.main">#{{ f.main.tagLine }}</small></b
          >
          <span v-if="f.main?.tier" class="pf-st" :style="tierColor(f.main.tier)"
            ><RankEmblem :tier="f.main.tier" :size="16" />{{
              rankWords(f.main.tier, f.main.division)
            }}</span
          >
        </span>
      </Link>
      <span class="pf-ch">
        <img
          v-for="c in f.recentChampions"
          :key="c"
          :src="champIcon(c)"
          :alt="names[c] ?? ''"
          width="26"
          height="26"
          loading="lazy"
        />
      </span>
      <span class="pf-st" :class="{ playing: f.live }"
        ><Icon v-if="f.live" name="live" :size="13" />{{ status(f) }}</span
      >
    </div>
  </div>
</template>
