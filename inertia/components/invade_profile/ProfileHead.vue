<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import Glyph from '../ui/Glyph.vue'
import SocialIcon from '../pros/SocialIcon.vue'
import Logo from '../pros/Logo.vue'
import LeaguePlates from './LeaguePlates.vue'
import FollowButton from '../social/FollowButton.vue'
import { regionLabel } from '../../lib/assets.js'
import { countryName } from '../../lib/board.js'
import { roleLabel } from '../../lib/ladders.js'
import { shortCount } from '../../lib/skins.js'
import { LINK_NAMES, type ProfileBadge, type ProfileHead } from '../../lib/invade_profile.js'
import type { FollowState } from '../../lib/account_types.js'
import type { IconName } from '../../lib/icons.js'

/** Each badge's mark, in the person's accent; the Invade team's is Invade's own glyph. */
const BADGE_ICONS: Record<Exclude<ProfileBadge['kind'], 'team'>, IconName> = {
  founder: 'flag',
  plus: 'crown',
  beta: 'flask',
}

/**
 * The person: the backdrop from a skin they own (or their main champion's art), their avatar,
 * name, handle, followers, bio, badges and links, then their League accounts. The owner edits it
 * from here; a visitor follows and shares it.
 */
const props = defineProps<{ head: ProfileHead; editing: boolean; names: Record<number, string> }>()
const emit = defineEmits<{ edit: []; backdrop: [] }>()

const h = computed(() => props.head)
/** The visitor's follow, kept here so the count moves with the button. */
const follow = ref<FollowState>({ following: props.head.viewerFollows, followers: props.head.followers })
watch(
  () => props.head,
  (head) => (follow.value = { following: head.viewerFollows, followers: head.followers })
)
const meta = computed(() => {
  const pro = h.value.pro
  if (pro) {
    return [pro.realName, pro.country ? countryName(pro.country) : null].filter(Boolean).join(', ')
  }
  return [`@${h.value.handle}`, h.value.platform ? regionLabel(h.value.platform) : null]
    .filter(Boolean)
    .join(', ')
})
const proLinks = computed(() => {
  const socials = h.value.pro?.socials ?? {}
  return (['twitch', 'x', 'instagram'] as const).flatMap((kind) =>
    socials[kind] ? [{ kind, url: socials[kind] }] : []
  )
})
/** 1,204 as it is; 52,400 as "52.4k". */
const figure = (n: number) => (n < 10_000 ? n.toLocaleString('en-US') : shortCount(n))
/** Before any League account or skin: the first letter of the name, in the person's accent. */
const initial = computed(() => Array.from(h.value.name.trim())[0]?.toUpperCase() ?? '')

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
async function share() {
  try {
    await navigator.clipboard.writeText(`${location.origin}/u/${h.value.handle}`)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1800)
  } catch {
    /* The address is in the bar to copy by hand. */
  }
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <section class="pf-top" :aria-label="`${h.name}'s profile`">
    <div class="pf-bd" :class="{ empty: !h.backdrop }">
      <img v-if="h.backdrop" :src="h.backdrop.url" alt="" fetchpriority="high" />
      <button v-if="editing" type="button" class="btn sm pf-bd-edit" @click="emit('backdrop')">
        <Icon name="image" />Change backdrop
      </button>
    </div>
    <div class="pf-id">
      <span class="pf-av" :class="{ framed: h.frame }">
        <img v-if="h.avatarUrl" :src="h.avatarUrl" alt="" width="148" height="148" />
        <span v-else class="pf-av-initial" aria-hidden="true">{{ initial }}</span>
      </span>
      <div class="pf-who">
        <h1>
          {{ h.name
          }}<span v-if="h.pro" class="pf-ver" title="Verified pro"
            ><Icon name="verified" :size="28" /><span class="skn-vh">Verified pro</span></span
          >
        </h1>
        <p class="pf-meta">
          <span v-if="meta">{{ meta }}</span>
          <span class="pf-counts">
            <Link :href="`/u/${h.handle}/followers`"
              ><b class="num">{{ figure(follow.followers) }}</b>
              {{ follow.followers === 1 ? 'follower' : 'followers' }}</Link
            >
            <Link v-if="!h.pro || h.following" :href="`/u/${h.handle}/following`"
              ><b class="num">{{ figure(h.following) }}</b> following</Link
            >
          </span>
          <span v-if="h.followsViewer && !h.owner" class="pf-mutual">Follows you</span>
        </p>
        <p v-if="h.bio" class="pf-bio">{{ h.bio }}</p>
        <div v-if="h.badges.length || h.links.length || h.pro" class="pf-tags">
          <template v-if="h.pro">
            <Link v-if="h.pro.team" class="pf-badge" :href="`/team/${h.pro.team.slug}`"
              ><Logo :team="h.pro.team.id" :size="32" />{{ h.pro.team.name }}</Link
            >
            <span v-if="h.pro.role" class="pf-badge"
              ><Icon name="pro" :size="15" />{{ roleLabel(h.pro.role) }}</span
            >
            <Link v-if="h.pro.league" class="pf-badge" :href="`/league/${h.pro.league.slug}`"
              ><Icon name="trophy" :size="15" />{{ h.pro.league.code }}</Link
            >
          </template>
          <span v-for="b in h.badges" :key="b.kind" class="pf-badge"
            ><Glyph v-if="b.kind === 'team'" :h="15" /><Icon
              v-else
              :name="BADGE_ICONS[b.kind]"
              :size="15"
            />{{ b.label }}</span
          >
          <a
            v-for="l in h.links"
            :key="l.kind"
            class="pf-link"
            :href="l.url"
            target="_blank"
            rel="noopener nofollow me"
            :aria-label="`${h.name} on ${LINK_NAMES[l.kind]}`"
          >
            <Icon v-if="l.kind === 'youtube'" name="youtube" :size="17" />
            <SocialIcon v-else :name="l.kind" :size="16" />
          </a>
          <a
            v-for="l in proLinks"
            :key="l.kind"
            class="pf-link"
            :href="l.url"
            target="_blank"
            rel="noopener nofollow"
            :aria-label="`${h.name} on ${l.kind === 'x' ? 'X' : l.kind === 'twitch' ? 'Twitch' : 'Instagram'}`"
          >
            <SocialIcon :name="l.kind" :size="16" />
          </a>
        </div>
      </div>
      <div class="pf-acts">
        <button
          v-if="h.owner"
          type="button"
          class="btn"
          :aria-pressed="editing"
          @click="emit('edit')"
        >
          <Icon name="pencil" />{{ editing ? 'Editing' : 'Edit profile' }}
        </button>
        <FollowButton
          v-else
          kind="user"
          :id="h.id"
          :name="h.name"
          :state="follow"
          :follows-you="h.followsViewer"
          @change="(next) => (follow = next)"
        />
        <button
          type="button"
          class="btn ico"
          :aria-label="copied ? 'Link copied' : 'Copy the link to this profile'"
          @click="share"
        >
          <Icon :name="copied ? 'check' : 'share'" />
        </button>
      </div>
    </div>
    <LeaguePlates :plates="h.plates" :pro="h.pro?.accounts ?? null" :names="names" />
  </section>
</template>
