<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { MatchRow } from '@invadelol/ui'
import { summaryOf } from '@invadelol/ui/logic'
import SiteLayout from '../../components/SiteLayout.vue'
import AccountHead from '../../components/account/AccountHead.vue'
import SaveStar from '../../components/social/SaveStar.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Segmented from '../../components/ui/Segmented.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import { champIcon, championName, profileIcon } from '../../lib/assets.js'
import { duration, profilePath } from '../../lib/format.js'
import { since } from '../../lib/ladders.js'
import { detailOf } from '../../lib/match.js'
import type { InvadeAccountData } from '../../lib/account_types.js'
import type { SavedItems, SavedMatch } from '../../lib/saved_types.js'
import '../../css/account.css'

/**
 * /account: the person's Favorites, private: the clips and matches they keep, the same as in the
 * app. People are followed, not kept here. A star lets an item go; it stays on the page until the
 * next visit, so a slip of the finger is one click to undo.
 */
const props = defineProps<{ account: InvadeAccountData; saved: SavedItems }>()

type Filter = 'all' | 'clips' | 'matches'
const filter = ref<Filter>('all')
const counts = computed(() => props.saved.counts)
const options = computed(() => [
  { value: 'all' as const, label: 'All', note: String(counts.value.clips + counts.value.matches) },
  { value: 'clips' as const, label: 'Clips', note: String(counts.value.clips) },
  { value: 'matches' as const, label: 'Matches', note: String(counts.value.matches) },
])

/** On All, each kind shows its newest few; its own tab shows them all. */
const PREVIEW = { clips: 6, matches: 4 }
const clips = computed(() =>
  filter.value === 'all' ? props.saved.clips.slice(0, PREVIEW.clips) : props.saved.clips
)
const matches = computed(() =>
  filter.value === 'all' ? props.saved.matches.slice(0, PREVIEW.matches) : props.saved.matches
)
const empty = computed(() => !props.saved.clips.length && !props.saved.matches.length)

const rows = computed(() =>
  matches.value.flatMap((m) => {
    const game = summaryOf(detailOf(m.match), m.puuid, m.match.matchId)
    return game ? [{ saved: m, game }] : []
  })
)
/**
 * The games' rows write their dates in the visitor's time zone: drawn once the page runs in the
 * browser, a skeleton before, so the server's render and the browser's agree.
 */
const ready = ref(false)
onMounted(() => (ready.value = true))
const matchHref = (m: SavedMatch) =>
  `${profilePath(m.gameName, m.tagLine)}/match/${m.match.matchId}`
</script>

<template>
  <Head title="Favorites" />
  <SiteLayout>
    <div class="wrap ac-wrap">
      <AccountHead :account="account" active="favorites" />
      <div class="ac-body">
        <EmptyState
          v-if="empty"
          icon="star"
          title="No favorites yet"
          line="Star a clip or a match, here or in the app, to keep it. People are followed from their profile."
        />
        <template v-else>
          <div class="ac-filter">
            <Segmented v-model="filter" :options="options" label="Favorites" />
            <span class="meta">Synced with the app</span>
          </div>

          <section
            v-if="filter !== 'matches' && clips.length"
            class="ac-sec"
            aria-labelledby="ac-clips"
          >
            <div class="ac-sec-h">
              <h2 id="ac-clips">Clips</h2>
              <span class="meta num">{{ counts.clips }}</span>
              <button
                v-if="filter === 'all' && saved.clips.length > clips.length"
                type="button"
                class="more"
                @click="filter = 'clips'"
              >
                All {{ counts.clips }}
              </button>
            </div>
            <div class="ac-clips">
              <article v-for="s in clips" :key="s.clip.id" class="ac-clip">
                <Link class="ac-cover" :href="s.clip.url" :aria-label="s.clip.title">
                  <img v-if="s.clip.poster" :src="s.clip.poster" alt="" loading="lazy" />
                  <img class="ac-champ" :src="champIcon(s.clip.championId)" alt="" />
                  <span class="ac-len num">{{
                    duration(Math.round(s.clip.durationMs / 1000))
                  }}</span>
                </Link>
                <SaveStar kind="clip" :id="s.clip.id" :label="`the clip ${s.clip.title}`" />
                <Link class="ac-clip-t ell" :href="s.clip.url">{{ s.clip.title }}</Link>
                <span class="ac-by">
                  <img :src="profileIcon(s.player.profileIconId)" alt="" />
                  <span class="ell"
                    ><Link :href="s.player.href">{{ s.player.gameName }}</Link
                    >, {{ championName(s.clip.championId) }},
                    {{ since(Date.parse(s.clip.postedAt)) }}</span
                  >
                </span>
              </article>
            </div>
          </section>

          <section
            v-if="filter !== 'clips' && rows.length"
            class="ac-sec"
            aria-labelledby="ac-matches"
          >
            <div class="ac-sec-h">
              <h2 id="ac-matches">Matches</h2>
              <span class="meta num">{{ counts.matches }}</span>
              <button
                v-if="filter === 'all' && saved.matches.length > matches.length"
                type="button"
                class="more"
                @click="filter = 'matches'"
              >
                All {{ counts.matches }}
              </button>
            </div>
            <Skeleton v-if="!ready" :rows="rows.length" />
            <ul v-else class="ac-matches">
              <li v-for="{ saved: m, game } in rows" :key="m.match.matchId" class="ac-match">
                <Link class="ac-match-who" :href="profilePath(m.gameName, m.tagLine)"
                  >{{ m.gameName }}<span>#{{ m.tagLine }}</span></Link
                >
                <div class="iv-pf-match">
                  <MatchRow
                    :game="game"
                    :score="game.score"
                    :puuid="m.puuid"
                    @toggle="router.visit(matchHref(m))"
                  />
                </div>
              </li>
            </ul>
          </section>

          <EmptyState
            v-if="filter === 'clips' && !clips.length"
            icon="film"
            title="No clips kept"
            line="Star a clip on its page to keep it here."
          />
          <EmptyState
            v-if="filter === 'matches' && !rows.length"
            icon="star"
            title="No matches kept"
            line="Star a game in a match list or on its page to keep it here."
          />
        </template>
      </div>
    </div>
  </SiteLayout>
</template>
