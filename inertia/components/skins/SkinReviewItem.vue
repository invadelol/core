<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import Stars from './Stars.vue'
import SkinPoster from './SkinPoster.vue'
import PersonAvatar from './PersonAvatar.vue'
import { browserWrite } from '../../lib/browser_write.js'
import { signInHref } from '../../lib/account.js'
import { since } from '../../lib/ladders.js'
import { skinPath } from '../../lib/skins.js'
import type { SkinReview } from '../../lib/skin_types.js'

/**
 * One review: who wrote it (unless it sits on its author's own profile), which skin (`withSkin`,
 * away from the skin's page), their stars, "Owns it" when the app read it in their collection,
 * the text, and its likes. A like is the visitor's; signed out it leads to sign in.
 */
const props = withDefaults(
  defineProps<{
    review: SkinReview
    withSkin?: boolean
    withAuthor?: boolean
    signedIn: boolean
  }>(),
  { withSkin: false, withAuthor: true }
)

const liked = ref(props.review.liked)
const likes = ref(props.review.likes)
const error = ref('')
/** "2 days": drawn once the page is in the browser, in the visitor's own time. */
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const when = computed(() => (mounted.value ? since(Date.parse(props.review.createdAt)) : ''))
const profile = computed(() =>
  props.review.author.handle ? `/u/${props.review.author.handle}` : null
)

async function toggle() {
  if (!props.signedIn) return router.visit(signInHref())
  const on = !liked.value
  liked.value = on
  likes.value += on ? 1 : -1
  error.value = ''
  try {
    await browserWrite('PUT', `/api/skin-reviews/${props.review.id}/like`, { on })
  } catch (failure) {
    liked.value = !on
    likes.value += on ? -1 : 1
    error.value = (failure as Error).message
  }
}
</script>

<template>
  <article class="skn-rv" :class="{ 'with-skin': withSkin }">
    <Link v-if="withSkin" :href="skinPath(review.skin.id)" class="skn-rv-pic" tabindex="-1">
      <SkinPoster :skin="review.skin" size="xs" />
    </Link>
    <PersonAvatar v-else :src="review.author.avatarUrl" :size="40" />
    <div class="skn-rb">
      <Link v-if="withSkin" :href="skinPath(review.skin.id)" class="skn-rvt">{{
        review.skin.name
      }}</Link>
      <div class="skn-rh">
        <template v-if="withAuthor">
          <component :is="profile ? Link : 'span'" :href="profile ?? undefined" class="skn-rvn">{{
            review.author.name
          }}</component>
          <span v-if="review.author.tag" class="skn-tag">#{{ review.author.tag }}</span>
        </template>
        <Stars v-if="review.rating" :value="review.rating" :size="12" />
        <span v-if="review.owns" class="skn-own">Owns it</span>
        <span class="skn-when">{{ when }}</span>
      </div>
      <p class="skn-rt">{{ review.body }}</p>
      <div class="skn-ra">
        <button
          type="button"
          class="skn-like"
          :class="{ on: liked }"
          :aria-pressed="liked"
          :aria-label="`Like this review, ${likes} likes`"
          @click="toggle"
        >
          <Icon name="heart" :size="14" /><span class="num">{{
            likes.toLocaleString('en-US')
          }}</span>
        </button>
        <span v-if="error" class="skn-err" role="alert">{{ error }}</span>
      </div>
    </div>
  </article>
</template>
