<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Stars from '../../components/skins/Stars.vue'
import RarityGem from '../../components/skins/RarityGem.vue'
import SkinCell from '../../components/skins/SkinCell.vue'
import SkinPoster from '../../components/skins/SkinPoster.vue'
import SkinReviewItem from '../../components/skins/SkinReviewItem.vue'
import SkinListCard from '../../components/skins/SkinListCard.vue'
import PersonAvatar from '../../components/skins/PersonAvatar.vue'
import { patchName } from '../../lib/patch.js'
import { since } from '../../lib/ladders.js'
import { skinPath } from '../../lib/skins.js'
import type { RatedSkin, SkinsHubData } from '../../lib/skin_types.js'
import '../../css/skins.css'

/**
 * `/skins`: what players rate this week (the most rated skins, the most liked reviews, what friends
 * did), the newest skins, popular lists, the best rated of all time; and the search (`?q=`) over
 * every skin's name, champion and line.
 */
const props = defineProps<SkinsHubData & { query: string; results: RatedSkin[] | null }>()

const page = usePage()
const signedIn = computed(() => Boolean((page.props as { viewer?: unknown }).viewer))
const q = ref(props.query)
function submit() {
  const value = q.value.trim()
  router.get('/skins', value ? { q: value } : {}, { preserveScroll: false })
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const week = computed(() => {
  const from = new Date(props.week.from)
  const to = new Date(props.week.to)
  const sameMonth = from.getUTCMonth() === to.getUTCMonth()
  return sameMonth
    ? `${from.getUTCDate()} to ${day(props.week.to)}`
    : `${day(props.week.from)} to ${day(props.week.to)}`
})
/** "2 days ago": in the visitor's own time, once in the browser. */
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const ago = (iso: string) => (mounted.value ? since(Date.parse(iso)) : '')
const VERB = { rated: 'rated', reviewed: 'reviewed', wished: 'added to the wishlist' } as const
</script>

<template>
  <Head title="Skins" />
  <SiteLayout>
    <div class="wrap skn-wrap">
      <header class="skn-hubh">
        <h1 class="skn-h1">Skins</h1>
        <form class="skn-search" role="search" @submit.prevent="submit">
          <Icon name="search" />
          <label class="skn-vh" for="skn-q">Search a skin, a line or a champion</label>
          <input
            id="skn-q"
            v-model="q"
            type="search"
            maxlength="60"
            placeholder="Search a skin, a line or a champion"
            autocomplete="off"
          />
        </form>
      </header>

      <section v-if="results" class="skn-sec" aria-labelledby="skn-results">
        <div class="skn-sh">
          <h2 id="skn-results">“{{ query }}”</h2>
          <span class="meta num"
            >{{ results.length }} {{ results.length === 1 ? 'skin' : 'skins' }}</span
          >
          <Link class="more" href="/skins">Back to skins<Icon name="chevr" :size="14" /></Link>
        </div>
        <div v-if="results.length" class="skn-row" style="--n: 8">
          <SkinCell v-for="s in results" :key="s.id" :skin="s" />
        </div>
        <EmptyState
          v-else
          title="No skin by that name"
          line="Try a champion, a skin line or part of a skin's name."
          icon="search"
        />
      </section>

      <template v-else>
        <section class="skn-sec" aria-labelledby="skn-popular">
          <div class="skn-sh">
            <h2 id="skn-popular">Popular this week</h2>
            <span class="meta">Most rated, {{ week }}</span>
          </div>
          <div class="skn-row" style="--n: 7">
            <SkinCell v-for="s in popular" :key="s.id" :skin="s" />
          </div>
        </section>

        <div class="skn-hub-grid">
          <div class="skn-main">
            <section class="card" aria-labelledby="skn-week-reviews">
              <div class="skn-card-h"><h2 id="skn-week-reviews">Popular reviews this week</h2></div>
              <SkinReviewItem
                v-for="r in reviews"
                :key="r.id"
                :review="r"
                :signed-in="signedIn"
                with-skin
              />
              <p v-if="!reviews.length" class="skn-empty">No reviews this week yet.</p>
            </section>

            <section v-if="activity.length" class="card" aria-labelledby="skn-friends-week">
              <div class="skn-card-h"><h2 id="skn-friends-week">Friends this week</h2></div>
              <div
                v-for="a in activity"
                :key="`${a.person.id}${a.kind}${a.skin.id}`"
                class="skn-fw"
              >
                <PersonAvatar :src="a.person.avatarUrl" :size="28" />
                <span class="skn-fwt"
                  ><Link :href="`/u/${a.person.handle}`"
                    ><b>{{ a.person.name }}</b></Link
                  >
                  {{ VERB[a.kind] }}
                  <Link :href="skinPath(a.skin.id)"
                    ><b>{{ a.skin.name }}</b></Link
                  ></span
                >
                <Stars v-if="a.rating && a.kind !== 'wished'" :value="a.rating" :size="12" />
                <Icon v-else-if="a.kind === 'wished'" name="bookmark" :size="15" />
                <span class="meta">{{ ago(a.at) }}</span>
                <Link :href="skinPath(a.skin.id)" tabindex="-1" aria-hidden="true">
                  <SkinPoster :skin="a.skin" size="xxs" />
                </Link>
              </div>
            </section>
          </div>

          <aside class="skn-aside">
            <section v-if="newest.length" class="card" aria-labelledby="skn-new">
              <div class="skn-card-h"><h2 id="skn-new">New skins</h2></div>
              <Link v-for="s in newest" :key="s.id" :href="skinPath(s.id)" class="skn-new">
                <SkinPoster :skin="s" size="xs" />
                <span class="skn-frt">
                  <b>{{ s.name }}</b>
                  <span><RarityGem :rarity="s.rarity" :size="12" /></span>
                </span>
                <span class="meta num">Patch {{ patchName(s.newIn) }}</span>
              </Link>
            </section>

            <section v-if="lists.length" class="card" aria-labelledby="skn-lists">
              <div class="skn-card-h"><h2 id="skn-lists">Popular lists</h2></div>
              <div class="skn-lists">
                <SkinListCard v-for="l in lists" :key="l.id" :list="l" />
              </div>
            </section>
          </aside>
        </div>

        <section v-if="topRated.length" class="skn-sec skn-bottom" aria-labelledby="skn-top">
          <div class="skn-sh">
            <h2 id="skn-top">Top rated</h2>
            <span class="meta num">All time, {{ total.toLocaleString('en-US') }} skins</span>
          </div>
          <div class="skn-row" style="--n: 8">
            <SkinCell v-for="(s, i) in topRated" :key="s.id" :skin="s" :rank="i + 1" />
          </div>
        </section>
      </template>
    </div>
  </SiteLayout>
</template>
