<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import EmptyState from '../ui/EmptyState.vue'
import Stars from '../skins/Stars.vue'
import RarityGem from '../skins/RarityGem.vue'
import RatingBars from '../skins/RatingBars.vue'
import SkinPoster from '../skins/SkinPoster.vue'
import SkinCell from '../skins/SkinCell.vue'
import SkinReviewItem from '../skins/SkinReviewItem.vue'
import SkinListCard from '../skins/SkinListCard.vue'
import FavoriteFour from './FavoriteFour.vue'
import { since } from '../../lib/ladders.js'
import { RARITY_NAMES, gemUrl, skinPath } from '../../lib/skins.js'
import type { DiaryEntry, ProfileSkinsData, SkinRarity } from '../../lib/skin_types.js'

/**
 * The profile's Skins tab: the favourite four, the diary of purchases (read by the app), reviews;
 * beside them the collection by Riot's rarity, the ratings, the wishlist and the lists.
 */
const props = defineProps<{ skins: ProfileSkinsData; owner: boolean; signedIn: boolean }>()
const emit = defineEmits<{ change: [] }>()

const mounted = ref(false)
onMounted(() => (mounted.value = true))

/** The diary by month, newest first ("November 2026"). */
const months = computed(() => {
  const out: { label: string; entries: DiaryEntry[] }[] = []
  for (const entry of props.skins.diary) {
    const label = new Date(entry.purchasedAt).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const last = out.at(-1)
    if (last?.label === label) last.entries.push(entry)
    else out.push({ label, entries: [entry] })
  }
  return out
})
const day = (iso: string) => new Date(iso).getUTCDate()
const GEMS: SkinRarity[] = ['transcendent', 'exalted', 'ultimate', 'mythic', 'legendary', 'epic']
const gems = computed(() => {
  const by = props.skins.collection?.byRarity ?? {}
  const shown = GEMS.filter((r) => by[r])
  const other = (by.standard ?? 0) + (by.rare ?? 0)
  return { shown: shown.map((r) => ({ rarity: r, n: by[r]! })), other }
})
const readAgo = computed(() =>
  props.skins.collection && mounted.value
    ? `From the app, ${since(Date.parse(props.skins.collection.readAt))}`
    : 'From the app'
)
const nothing = computed(
  () =>
    !props.skins.favorites.length &&
    !props.skins.diary.length &&
    !props.skins.reviews.length &&
    !props.skins.collection &&
    !props.skins.ratings.count &&
    !props.skins.wishlistTotal &&
    !props.skins.lists.length
)
</script>

<template>
  <EmptyState
    v-if="nothing && !owner"
    title="No skins here yet"
    line="Ratings, reviews and the collection the Invade app reads show up here."
    icon="layers"
  />
  <div v-else class="skn-tab">
    <div class="skn-col">
      <section class="skn-sec" aria-labelledby="pf-fav4">
        <div class="skn-sh">
          <h2 id="pf-fav4">Favourite four</h2>
          <button v-if="owner" type="button" class="btn sm ghost" @click="emit('change')">
            <Icon name="pencil" :size="14" />Change
          </button>
        </div>
        <FavoriteFour v-if="skins.favorites.length" :skins="skins.favorites" rated />
        <p v-else class="pf-empty">
          {{ owner ? 'Pick the four skins that say who you are.' : 'No favourites picked yet.' }}
        </p>
      </section>

      <section v-if="skins.diary.length" class="skn-sec" aria-labelledby="pf-diary">
        <div class="skn-sh">
          <h2 id="pf-diary">Diary</h2>
          <span class="meta">Bought, from the app</span>
          <span class="meta num more">{{ skins.diaryTotal }} in all</span>
        </div>
        <ul class="skn-diary">
          <template v-for="m in months" :key="m.label">
            <li class="skn-dm">{{ m.label }}</li>
            <li v-for="e in m.entries" :key="e.skin.id">
              <Link :href="skinPath(e.skin.id)" class="skn-dr">
                <span class="skn-day num">{{ day(e.purchasedAt) }}</span>
                <SkinPoster :skin="e.skin" size="xs" />
                <span class="skn-dt">
                  <b>{{ e.skin.name }}</b>
                  <span
                    ><RarityGem :rarity="e.skin.rarity" :size="12" bare />{{
                      [e.skin.championName, ...e.skin.lines.map((l) => l.name)].join(', ')
                    }}</span
                  >
                </span>
                <Stars :value="e.rating" :size="12" prompt />
                <span class="skn-mks">
                  <Icon v-if="e.liked" name="heart" :size="14" /><span class="skn-vh">{{
                    e.liked ? 'Liked' : ''
                  }}</span>
                  <Icon v-if="e.reviewed" name="pencil" :size="14" /><span class="skn-vh">{{
                    e.reviewed ? 'Reviewed' : ''
                  }}</span>
                </span>
              </Link>
            </li>
          </template>
        </ul>
      </section>

      <section v-if="skins.reviews.length" class="skn-sec" aria-labelledby="pf-reviews">
        <div class="skn-sh">
          <h2 id="pf-reviews">Reviews</h2>
          <span class="n num">{{ skins.reviewsTotal }}</span>
        </div>
        <div class="skn-plain">
          <SkinReviewItem
            v-for="r in skins.reviews"
            :key="r.id"
            :review="r"
            :signed-in="signedIn"
            with-skin
            :with-author="false"
          />
        </div>
      </section>
    </div>

    <div class="skn-col">
      <section class="skn-sec" aria-labelledby="pf-collection">
        <div class="skn-sh">
          <h2 id="pf-collection">Collection</h2>
          <span class="meta more">{{ readAgo }}</span>
        </div>
        <div v-if="skins.collection" class="skn-coll">
          <div class="skn-cfig">
            <b class="num">{{ skins.collection.owned.toLocaleString('en-US') }}</b>
            <span class="num">of {{ skins.collection.total.toLocaleString('en-US') }} skins</span>
          </div>
          <div class="skn-gems">
            <span v-for="g in gems.shown" :key="g.rarity"
              ><img :src="gemUrl(g.rarity)!" alt="" width="15" height="15" /><b class="num">{{
                g.n
              }}</b
              >{{ RARITY_NAMES[g.rarity] }}</span
            >
            <span v-if="gems.other"
              ><b class="num">{{ gems.other }}</b
              >Other</span
            >
          </div>
        </div>
        <p v-else class="pf-empty">
          {{
            owner
              ? 'Open the Invade app with the League client signed in: it reads your skins.'
              : 'No collection from the Invade app yet.'
          }}
        </p>
        <RatingBars v-if="skins.ratings.count" :summary="skins.ratings" :height="64" />
      </section>

      <section v-if="skins.wishlistTotal" class="skn-sec" aria-labelledby="pf-wish">
        <div class="skn-sh">
          <h2 id="pf-wish">Wishlist</h2>
          <span class="n num">{{ skins.wishlistTotal }}</span>
        </div>
        <div class="skn-wish">
          <SkinCell v-for="s in skins.wishlist" :key="s.id" :skin="s" :note="s.championName" />
        </div>
      </section>

      <section v-if="skins.lists.length" class="skn-sec" aria-labelledby="pf-lists">
        <div class="skn-sh">
          <h2 id="pf-lists">Lists</h2>
          <span class="n num">{{ skins.lists.length }}</span>
        </div>
        <div class="skn-lists">
          <SkinListCard v-for="l in skins.lists" :key="l.id" :list="l" />
        </div>
      </section>
    </div>
  </div>
</template>
