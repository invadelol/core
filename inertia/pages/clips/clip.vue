<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { summaryOf } from '@invadelol/ui/logic'
import { useFormat } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Glyph from '../../components/ui/Glyph.vue'
import Icon from '../../components/ui/Icon.vue'
import ScoreDial from '../../components/ui/ScoreDial.vue'
import Select from '../../components/ui/Select.vue'
import ClipPlayer from '../../components/clips/ClipPlayer.vue'
import ClipComments from '../../components/clips/ClipComments.vue'
import ClipMatchCard from '../../components/clips/ClipMatchCard.vue'
import FollowButton from '../../components/social/FollowButton.vue'
import SaveStar from '../../components/social/SaveStar.vue'
import { championName, profileIcon } from '../../lib/assets.js'
import { since } from '../../lib/ladders.js'
import { detailOf } from '../../lib/match.js'
import { signInHref, useViewer } from '../../lib/account.js'
import { VISIBILITY_WORDS, clipApi, clipClock } from '../../lib/clips.js'
import type { FollowState } from '../../lib/account_types.js'
import type { Clip, ClipComment, ClipMatch, ClipVisibility } from '../../lib/clip_types.js'
import '../../css/clips.css'

/**
 * /clip/:id: a clip on its own page. The video with what happened in it (Riot's events at their
 * game times, each kill's damage recap) and its comments on one playhead; under it the title, who
 * posted it and the clip's controls, the match it is from (beside, on a wide screen), then the
 * conversation.
 */
const props = defineProps<{
  clip: Clip
  match: ClipMatch | null
  others: Clip[]
  comments: ClipComment[]
  canComment: boolean
  follow: FollowState
}>()

const { viewer } = useViewer()
const { score100, ordinal } = useFormat()
const clip = shallowRef(props.clip)
const now = ref(0)
const player = ref<InstanceType<typeof ClipPlayer>>()
const comments = shallowRef(props.comments)
const problem = ref('')

const who = computed(() => clip.value.author)
const account = computed(() => who.value.account)
const face = computed(
  () => who.value.avatarUrl ?? (account.value ? profileIcon(account.value.profileIconId) : null)
)
/** The clip's player's line in the game (its score, KDA), when the game is stored. */
const game = computed(() =>
  props.match
    ? summaryOf(detailOf(props.match.match), props.match.puuid, props.match.match.matchId)
    : null
)
const line = computed(() => {
  const kda = game.value
    ? `, ${game.value.kills} / ${game.value.deaths} / ${game.value.assists}`
    : ''
  return `${championName(clip.value.championId)}${kda}, ${since(Date.parse(clip.value.postedAt))}`
})
const dial = computed(() => {
  const score = game.value?.score
  if (!score) return null
  return {
    value: score100(score.score),
    place: score.tag === 'mvp' ? 'MVP' : ordinal(score.rank),
  }
})

/* ── Its owner's controls, and everyone's GG and share ─────────────── */

const AUDIENCE = (Object.keys(VISIBILITY_WORDS) as ClipVisibility[]).map((value) => ({
  value,
  label: VISIBILITY_WORDS[value],
}))
function failed(error: unknown) {
  problem.value = error instanceof Error ? error.message : 'That did not go through.'
}
async function setVisibility(visibility: ClipVisibility) {
  problem.value = ''
  try {
    clip.value = await clipApi.update(clip.value.id, { visibility })
  } catch (error) {
    failed(error)
  }
}
async function gg() {
  if (!viewer.value) return router.visit(signInHref())
  problem.value = ''
  try {
    const answer = await clipApi.gg(clip.value.id, !clip.value.ggByViewer)
    clip.value = { ...clip.value, ...answer }
  } catch (error) {
    failed(error)
  }
}
const copied = ref(false)
async function share() {
  try {
    await navigator.clipboard.writeText(clip.value.url)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    // The address bar still has it.
  }
}
const menu = ref(false)
const asking = ref(false)
async function pin() {
  menu.value = false
  try {
    await clipApi.pin(clip.value.id, !clip.value.pinned)
    clip.value = { ...clip.value, pinned: !clip.value.pinned }
  } catch (error) {
    failed(error)
  }
}
async function remove() {
  try {
    await clipApi.remove(clip.value.id)
    router.visit(`/u/${who.value.handle}`)
  } catch (error) {
    failed(error)
  }
}

/** Inertia writes the title into `<title>` as it is: a clip's title never closes that tag. */
const title = computed(() => clip.value.title.replace(/</g, '‹').replace(/>/g, '›'))
const moment = computed(() =>
  clip.value.moment
    ? `${clip.value.moment}, ${clipClock(clip.value.momentAt ?? clip.value.startMs)}`
    : `At ${clipClock(clip.value.startMs)} in the game`
)
</script>

<template>
  <Head :title="title" />
  <SiteLayout>
    <div class="wrap cp">
      <ClipPlayer ref="player" :clip="clip" :comments="comments" @time="now = $event" />

      <div class="clp-grid">
        <div class="clp-head">
          <h1 class="clp-title">{{ clip.title }}</h1>
          <p class="clp-moment"><Icon name="swords" :size="15" />{{ moment }}</p>
          <div class="clp-facts">
            <Select
              v-if="clip.mine"
              class="clp-aud"
              :model-value="clip.visibility"
              :options="AUDIENCE"
              width="14rem"
              @update:model-value="(v: ClipVisibility) => setVisibility(v)"
            />
            <span class="meta num">{{ clip.views.toLocaleString('en-US') }} views</span>
          </div>

          <div class="clp-by">
            <Link class="clp-who" :href="`/u/${who.handle}`">
              <img v-if="face" class="clp-av lg" :src="face" alt="" />
              <span v-else class="clp-av lg none"><Icon name="user" :size="18" /></span>
              <span class="clp-who-t">
                <b
                  >{{ account ? account.gameName : who.name
                  }}<small v-if="account">#{{ account.tagLine }}</small></b
                >
                <span class="meta num">{{ line }}</span>
              </span>
            </Link>
            <ScoreDial
              v-if="dial"
              class="clp-by-dial"
              :value="dial.value"
              :place="dial.place"
              size="sm"
            />
            <span class="clp-acts">
              <FollowButton
                v-if="!clip.mine"
                kind="user"
                :id="who.id"
                :name="who.name"
                :state="follow"
                small
              />
              <button
                type="button"
                class="btn sm clp-gg-btn"
                :class="{ on: clip.ggByViewer }"
                :aria-pressed="clip.ggByViewer"
                :disabled="clip.mine"
                :title="clip.mine ? 'GGs from the people who watch it' : undefined"
                @click="gg"
              >
                GG <span class="num">{{ clip.gg }}</span>
              </button>
              <SaveStar v-if="!clip.mine" kind="clip" :id="clip.id" label="this clip" />
              <button
                type="button"
                class="btn sm clp-share"
                :aria-label="copied ? 'Link copied' : 'Share'"
                @click="share"
              >
                <Icon :name="copied ? 'check' : 'share'" /><span>{{
                  copied ? 'Link copied' : 'Share'
                }}</span>
              </button>
              <span v-if="clip.mine" class="clp-menu">
                <button
                  type="button"
                  class="btn sm ico"
                  aria-label="More"
                  aria-haspopup="menu"
                  :aria-expanded="menu"
                  @click="menu = !menu"
                >
                  <Icon name="more" />
                </button>
                <span v-if="menu" class="dm clp-dm" role="menu">
                  <button type="button" class="dm-r" role="menuitem" @click="pin">
                    {{ clip.pinned ? 'Unpin from my profile' : 'Pin to my profile' }}
                  </button>
                  <button
                    v-if="!asking"
                    type="button"
                    class="dm-r danger"
                    role="menuitem"
                    @click="asking = true"
                  >
                    Delete the clip
                  </button>
                  <button v-else type="button" class="dm-r danger" role="menuitem" @click="remove">
                    Delete for good, with its comments
                  </button>
                </span>
              </span>
            </span>
          </div>
          <p v-if="problem" class="clp-err" role="alert">{{ problem }}</p>
        </div>

        <ClipMatchCard
          v-if="match && game"
          :clip="clip"
          :others="others"
          :card="match"
          :game="game"
        />

        <div class="clp-talk">
          <ClipComments
            :clip="clip"
            :comments="comments"
            :can-comment="canComment"
            :now="now"
            @seek="player?.seek($event)"
            @change="comments = $event"
          />
          <Link v-if="!viewer" class="card cl-app" href="/app" prefetch data-track="clip_get_app">
            <Glyph :h="22" />
            <span class="cl-app-t">
              <b>Recorded with Invade</b>
              <span>Free for Windows and macOS</span>
            </span>
            <Icon name="chevr" />
          </Link>
        </div>
      </div>
    </div>
  </SiteLayout>
</template>
