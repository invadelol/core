<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import EmptyState from '../ui/EmptyState.vue'
import PersonAvatar from '../skins/PersonAvatar.vue'
import FriendRows from './FriendRows.vue'
import { queueName } from '@invadelol/ui/logic'
import { gameClock } from '../../lib/profile_view.js'
import type { FriendCard } from '../../lib/profile_types.js'

/**
 * The Friends tab: the friends in a game now on their champion's art with the game clock, then
 * every friend with their main account, rank, last champions and what they are doing.
 */
defineProps<{
  friends: FriendCard[]
  playingNow: FriendCard[]
  names: Record<number, string>
  owner: boolean
}>()

const now = ref<number | null>(null)
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  tick = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(tick))
</script>

<template>
  <div class="pf-col">
    <section v-if="playingNow.length" class="pf-sec" aria-labelledby="pf-playing">
      <div class="pf-hr">
        <h2 id="pf-playing" class="pf-h">
          Playing now<span class="n num">{{ playingNow.length }}</span>
        </h2>
      </div>
      <div class="pf-playing">
        <Link v-for="f in playingNow" :key="f.id" :href="`/u/${f.handle}`" class="pf-pc">
          <span class="pf-pcv">
            <img :src="`/cdn/centered/${f.live!.championId}.jpg?w=480`" alt="" loading="lazy" />
            <span v-if="now" class="pf-dur num">{{ gameClock(f.live!.startedAt, now) }}</span>
          </span>
          <span class="pf-fr">
            <PersonAvatar :src="f.avatarUrl" :size="32" />
            <span class="pf-frt">
              <b>{{ f.name }}</b>
              <span class="pf-st"
                >{{ names[f.live!.championId] ?? '' }}, {{ queueName(f.live!.queueId) }}</span
              >
            </span>
          </span>
          <span v-if="f.live!.with.length" class="pf-st">with {{ f.live!.with.join(', ') }}</span>
        </Link>
      </div>
    </section>

    <section class="pf-sec" aria-labelledby="pf-friends">
      <div class="pf-hr">
        <h2 id="pf-friends" class="pf-h">
          Friends<span class="n num">{{ friends.length }}</span>
        </h2>
        <span class="meta">You follow each other</span>
      </div>
      <FriendRows v-if="friends.length" :friends="friends" :names="names" rows />
      <EmptyState
        v-else
        compact
        title="No friends yet"
        :line="
          owner
            ? 'Friends are the people you follow who follow you back.'
            : 'Friends are the people who follow each other.'
        "
        icon="users"
      />
    </section>
  </div>
</template>
