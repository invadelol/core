<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Segmented from '../../components/ui/Segmented.vue'
import Stars from '../../components/skins/Stars.vue'
import StarInput from '../../components/skins/StarInput.vue'
import RarityGem from '../../components/skins/RarityGem.vue'
import RatingBars from '../../components/skins/RatingBars.vue'
import SkinCell from '../../components/skins/SkinCell.vue'
import SkinPoster from '../../components/skins/SkinPoster.vue'
import SkinReviewItem from '../../components/skins/SkinReviewItem.vue'
import SkinListCard from '../../components/skins/SkinListCard.vue'
import PersonAvatar from '../../components/skins/PersonAvatar.vue'
import ListMenu from '../../components/skins/ListMenu.vue'
import { champIcon } from '../../lib/assets.js'
import { patchName } from '../../lib/patch.js'
import { browserWrite } from '../../lib/browser_write.js'
import { signInHref } from '../../lib/account.js'
import { ordinal, posterUrl, skinPath, splashUrl, starsWords } from '../../lib/skins.js'
import { SKIN_LIMITS, type SkinPageData } from '../../lib/skin_types.js'
import '../../css/skins.css'

/**
 * `/skins/<id>`: one skin as players rate it. The poster and Riot's facts, the visitor's three
 * actions (wishlist, or Owned when the app read it in their collection; like; review), their
 * stars, everyone's ratings; the splash with its chromas; reviews; friends; its line; the lists it
 * is in; the champion's best rated skins.
 */
const props = defineProps<SkinPageData>()

const skin = computed(() => props.skin)
const signedIn = computed(() => props.viewer !== null)
const search = (q: string) => `/skins?q=${encodeURIComponent(q)}`

const wishedAt = ref(props.viewer?.wishedAt ?? null)
const liked = ref(props.viewer?.liked ?? false)
const rating = ref(props.viewer?.rating ?? null)
const owned = computed(() => props.viewer?.owned === true)
const error = ref('')

/** "On your wishlist since 12 Nov": drawn in the browser, in the visitor's own time. */
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const since = computed(() =>
  wishedAt.value && mounted.value
    ? new Date(wishedAt.value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''
)
const caption = computed(() => {
  if (!signedIn.value) return 'Sign in to rate, review and keep a wishlist.'
  if (owned.value) return 'In your collection, read by the Invade app.'
  if (wishedAt.value) return since.value ? `On your wishlist since ${since.value}` : ''
  if (props.viewer?.owned === null) return 'The skins you own come from the Invade app.'
  return ''
})

/** The histogram moves by one step under the visitor's own rating as they change it. */
const ratings = computed(() => {
  const histogram = [...props.ratings.histogram]
  const before = props.viewer?.rating ?? null
  if (before) histogram[before - 1]--
  if (rating.value) histogram[rating.value - 1]++
  const count = histogram.reduce((n, c) => n + c, 0)
  const sum = histogram.reduce((n, c, i) => n + c * (i + 1), 0)
  return {
    histogram,
    count,
    average: count ? Math.round((sum / count / 2) * 10) / 10 : null,
  }
})

function needSignIn() {
  if (signedIn.value) return false
  router.visit(signInHref())
  return true
}

async function act(change: () => void, undo: () => void, write: () => Promise<unknown>) {
  error.value = ''
  change()
  try {
    await write()
  } catch (failure) {
    undo()
    error.value = (failure as Error).message
  }
}

function toggleWish() {
  if (needSignIn()) return
  const before = wishedAt.value
  const on = !before
  return act(
    () => (wishedAt.value = on ? new Date().toISOString() : null),
    () => (wishedAt.value = before),
    () => browserWrite('PUT', `/api/skins/${skin.value.id}/wish`, { on })
  )
}

function toggleLike() {
  if (needSignIn()) return
  const on = !liked.value
  return act(
    () => (liked.value = on),
    () => (liked.value = !on),
    () => browserWrite('PUT', `/api/skins/${skin.value.id}/like`, { on })
  )
}

function rate(value: number | null) {
  if (needSignIn()) return
  const before = rating.value
  return act(
    () => (rating.value = value),
    () => (rating.value = before),
    () => browserWrite('PUT', `/api/skins/${skin.value.id}/rating`, { rating: value })
  )
}

/* ── The review editor ─────────────────────────────────────────── */
const editing = ref(false)
const draft = ref(props.viewer?.review?.body ?? '')
const saving = ref(false)
function openReview() {
  if (needSignIn()) return
  editing.value = !editing.value
}
async function saveReview(body: string) {
  saving.value = true
  error.value = ''
  try {
    await browserWrite('PUT', `/api/skins/${skin.value.id}/review`, { body })
    editing.value = false
    router.reload({ only: ['reviews', 'viewer'] })
  } catch (failure) {
    error.value = (failure as Error).message
  } finally {
    saving.value = false
  }
}

/* ── Share, lists ──────────────────────────────────────────────── */
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function share() {
  try {
    await navigator.clipboard.writeText(`${location.origin}${skinPath(skin.value.id)}`)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1800)
  } catch {
    /* The address is in the bar to copy by hand. */
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer))
const listing = ref(false)
function openLists() {
  if (needSignIn()) return
  listing.value = !listing.value
}

/* ── Reviews ───────────────────────────────────────────────────── */
type Order = 'popular' | 'recent' | 'friends'
const order = ref<Order>('popular')
const orders = computed(() => [
  { value: 'popular' as const, label: 'Popular' },
  { value: 'recent' as const, label: 'Recent' },
  ...(signedIn.value ? [{ value: 'friends' as const, label: 'Friends' }] : []),
])
const shownReviews = computed(() => props.reviews[order.value])

const chromaNames = computed(() =>
  skin.value.chromas.map((c) => ({
    ...c,
    short: c.name.match(/\(([^)]+)\)\s*$/)?.[1] ?? c.name,
  }))
)
</script>

<template>
  <Head :title="skin.name" />
  <SiteLayout>
    <div class="wrap skn-wrap">
      <nav class="crumbs skn-crumbs" aria-label="Breadcrumb">
        <Link href="/skins">Skins</Link><Icon name="chevr" /><Link
          :href="search(skin.championName)"
          >{{ skin.championName }}</Link
        ><Icon name="chevr" /><span class="t1" aria-current="page">{{ skin.name }}</span>
      </nav>

      <section class="skn-hero lit-sheet">
        <Frame :src="posterUrl(skin)" class="skn-post" size="l" eager />
        <div class="skn-id">
          <h1 class="skn-name">{{ skin.name }}</h1>
          <div class="skn-tags">
            <Link class="skn-chip" :href="search(skin.championName)"
              ><img :src="champIcon(skin.championId)" alt="" width="18" height="18" />{{
                skin.championName
              }}</Link
            >
            <Link
              v-for="line in skin.lines"
              :key="line.id"
              class="skn-chip"
              :href="search(line.name)"
              >{{ line.name }}</Link
            >
            <span class="skn-chip"><RarityGem :rarity="skin.rarity" :size="15" /></span>
            <span v-if="skin.legacy" class="skn-chip">Legacy</span>
          </div>
          <p v-if="skin.description" class="skn-desc">{{ skin.description }}</p>
          <div class="skn-facts">
            <div v-if="skin.newIn">
              <span class="meta">New in</span><b class="num">Patch {{ patchName(skin.newIn) }}</b>
            </div>
            <div v-if="skin.chromas.length">
              <span class="meta">Chromas</span>
              <span class="skn-sws">
                <span
                  v-for="c in chromaNames"
                  :key="c.name"
                  class="skn-sw"
                  :title="c.short"
                  :style="{ background: c.colors[0] ?? 'var(--s4)' }"
                />
              </span>
            </div>
            <div v-if="place">
              <span class="meta">Among {{ skin.championName }} skins</span
              ><b class="num">{{ ordinal(place.rank) }} of {{ place.of }}</b>
            </div>
          </div>
          <div class="skn-btns">
            <button type="button" class="btn" @click="share">
              <Icon :name="copied ? 'check' : 'share'" />{{ copied ? 'Link copied' : 'Share' }}
            </button>
            <button
              type="button"
              class="btn ghost"
              :aria-expanded="listing"
              aria-haspopup="dialog"
              @click="openLists"
            >
              <Icon name="listPlus" />Add to a list
            </button>
            <ListMenu
              v-if="listing && viewer"
              :skin-id="skin.id"
              :lists="viewer.lists"
              @close="listing = false"
            />
          </div>
        </div>

        <div class="skn-side">
          <div class="skn-acts">
            <span v-if="owned" class="skn-act on owned"><Icon name="check" :size="18" />Owned</span>
            <button
              v-else
              type="button"
              class="skn-act"
              :class="{ on: wishedAt }"
              :aria-pressed="Boolean(wishedAt)"
              @click="toggleWish"
            >
              <Icon name="bookmark" :size="18" />Wishlist
            </button>
            <button
              type="button"
              class="skn-act"
              :class="{ on: liked }"
              :aria-pressed="liked"
              @click="toggleLike"
            >
              <Icon name="heart" :size="18" />Like
            </button>
            <button
              type="button"
              class="skn-act"
              :class="{ on: viewer?.review }"
              :aria-expanded="editing"
              @click="openReview"
            >
              <Icon name="pencil" :size="18" />Review
            </button>
          </div>
          <p v-if="caption" class="skn-src">{{ caption }}</p>
          <p v-if="error" class="skn-err" role="alert">{{ error }}</p>
          <form v-if="editing" class="skn-editor" @submit.prevent="saveReview(draft)">
            <label class="skn-vh" for="skn-review">Your review of {{ skin.name }}</label>
            <textarea
              id="skn-review"
              v-model="draft"
              :maxlength="SKIN_LIMITS.review"
              placeholder="What do you think of it?"
            />
            <div class="row">
              <span class="meta num">{{ draft.length }} / {{ SKIN_LIMITS.review }}</span>
              <button
                v-if="viewer?.review"
                type="button"
                class="btn sm ghost"
                :disabled="saving"
                @click="saveReview('')"
              >
                Delete
              </button>
              <button type="button" class="btn sm" @click="editing = false">Cancel</button>
              <button type="submit" class="btn sm" :disabled="saving || !draft.trim()">Save</button>
            </div>
          </form>
          <div class="skn-you">
            <span class="meta">Your rating</span>
            <StarInput :model-value="rating" :size="26" @update:model-value="rate" />
          </div>
          <div class="skn-rates-box">
            <div class="skn-rhd">
              <span class="meta">Ratings</span>
              <span class="meta num">{{ ratings.count.toLocaleString('en-US') }}</span>
            </div>
            <RatingBars :summary="ratings" :mine="rating" caption="average" />
          </div>
        </div>
      </section>

      <div class="skn-body">
        <div class="skn-main">
          <figure class="skn-splash">
            <Frame
              :src="splashUrl(skin)"
              class="skn-sp"
              size="l"
              :alt="`${skin.name}'s splash art`"
            />
            <figcaption class="skn-cap">
              <b>Splash art</b>
              <span v-if="chromaNames.length" class="skn-chs">
                <span v-for="c in chromaNames" :key="c.name" class="skn-ch"
                  ><span class="skn-sw" :style="{ background: c.colors[0] ?? 'var(--s4)' }" />{{
                    c.short
                  }}</span
                >
              </span>
            </figcaption>
          </figure>

          <section class="card skn-revs" aria-labelledby="skn-reviews">
            <div class="skn-card-h">
              <h2 id="skn-reviews">Reviews</h2>
              <span class="meta num">{{ reviews.total.toLocaleString('en-US') }}</span>
              <Segmented v-model="order" :options="orders" label="Order the reviews" />
            </div>
            <SkinReviewItem
              v-for="r in shownReviews"
              :key="r.id"
              :review="r"
              :signed-in="signedIn"
            />
            <p v-if="!shownReviews.length" class="skn-empty">
              {{
                order === 'friends'
                  ? 'None of your friends reviewed it yet.'
                  : 'Nobody reviewed it yet.'
              }}
            </p>
          </section>
        </div>

        <aside class="skn-aside">
          <section v-if="friends.length" class="card" aria-labelledby="skn-friends">
            <div class="skn-card-h">
              <h2 id="skn-friends">Friends</h2>
              <span class="meta num">{{ friends.length }}</span>
            </div>
            <Link
              v-for="f in friends"
              :key="f.person.id"
              :href="`/u/${f.person.handle}`"
              class="skn-fr"
            >
              <PersonAvatar :src="f.person.avatarUrl" :size="32" />
              <span class="skn-frt">
                <b>{{ f.person.name }}</b>
                <span>{{ f.owns ? 'Owns it' : f.wished ? 'On the wishlist' : 'Rated it' }}</span>
              </span>
              <Stars v-if="f.rating" :value="f.rating" :size="12" />
              <Icon v-else-if="f.wished" name="bookmark" :size="15" />
            </Link>
          </section>

          <section v-if="line && line.skins.length" class="card" aria-labelledby="skn-line">
            <div class="skn-card-h">
              <h2 id="skn-line">{{ line.name }}</h2>
              <Link class="more" :href="search(line.name)"
                >Skin line<Icon name="chevr" :size="14"
              /></Link>
            </div>
            <Link v-for="s in line.skins" :key="s.id" :href="skinPath(s.id)" class="skn-fr">
              <SkinPoster :skin="s" size="xs" />
              <span class="skn-frt">
                <b>{{ s.name }}</b>
                <span><RarityGem :rarity="s.rarity" :size="12" /></span>
              </span>
              <span v-if="s.average" class="skn-sv"
                ><Stars :value="Math.round(s.average * 2)" :size="11" /><span class="num">{{
                  s.average.toFixed(1)
                }}</span></span
              >
            </Link>
          </section>

          <section v-if="lists.length" class="card" aria-labelledby="skn-in-lists">
            <div class="skn-card-h">
              <h2 id="skn-in-lists">In lists</h2>
              <span class="meta num">{{ listsTotal.toLocaleString('en-US') }}</span>
            </div>
            <div class="skn-lists">
              <SkinListCard v-for="l in lists" :key="l.id" :list="l" />
            </div>
          </section>
        </aside>
      </div>

      <section class="skn-sec skn-bottom" aria-labelledby="skn-champion">
        <div class="skn-sh">
          <img class="skn-ci" :src="champIcon(skin.championId)" alt="" width="26" height="26" />
          <h2 id="skn-champion">{{ champion.name }} skins, best rated</h2>
          <span class="meta num">{{ champion.total }} skins</span>
          <Link class="more" :href="search(champion.name)"
            >All {{ champion.name }} skins<Icon name="chevr" :size="14"
          /></Link>
        </div>
        <div class="skn-row" style="--n: 8">
          <SkinCell
            v-for="(s, i) in champion.best"
            :key="s.id"
            :skin="s"
            :rank="s.average ? i + 1 : null"
            :here="s.id === skin.id"
          />
        </div>
      </section>
      <p class="skn-vh" aria-live="polite">
        {{ rating ? `Your rating: ${starsWords(rating)}` : '' }}
      </p>
    </div>
  </SiteLayout>
</template>
