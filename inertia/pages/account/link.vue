<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AuthScene from '../../components/account/AuthScene.vue'
import DiscordMark from '../../components/header/DiscordMark.vue'
import Glyph from '../../components/ui/Glyph.vue'
import Icon from '../../components/ui/Icon.vue'
import { profileIcon } from '../../lib/assets.js'
import { approveLink } from '../../lib/account.js'
import type { Viewer } from '../../lib/account_types.js'

/**
 * /account/link/:code: the desktop app opened this one-time link to connect itself. Nothing to
 * read or type: the page names the computer and the account, and connects only when the person
 * presses Connect. "This is not me" signs out and comes back here for another account.
 */
const props = defineProps<{
  code: string
  pairing: {
    os: string
    app: string
    expired: boolean
    approved: boolean
    linkedElsewhere: boolean
  } | null
  account: Viewer | null
}>()

const done = ref(props.pairing?.approved ?? false)
const busy = ref(false)
const error = ref('')

const state = computed(() => {
  if (done.value) return 'done'
  if (!props.pairing || props.pairing.expired) return 'expired'
  if (props.pairing.linkedElsewhere) return 'taken'
  return 'ask'
})

const mac = computed(() => props.pairing?.os === 'macos')
const device = computed(() => (mac.value ? 'Mac' : 'Windows PC'))
const avatar = computed(() => {
  const me = props.account
  if (!me) return null
  return me.avatarUrl ?? (me.main ? profileIcon(me.main.profileIconId) : null)
})
const notMe = computed(() => `/signin?next=${encodeURIComponent(`/account/link/${props.code}`)}`)

async function connect() {
  busy.value = true
  error.value = ''
  try {
    await approveLink(props.code)
    done.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'That did not go through.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Head :title="state === 'done' ? 'Connected' : `Connect this ${mac ? 'Mac' : 'PC'}`" />
  <AuthScene :mood="state === 'done' ? 'done' : 'ask'">
    <template v-if="state === 'ask' || state === 'done'">
      <h1 class="au-h">
        {{ state === 'done' ? 'Connected' : `Connect this ${mac ? 'Mac' : 'PC'}?` }}
      </h1>
      <p v-if="state === 'done'" class="au-sub">You can go back to the app.</p>
      <div class="au-pair">
        <div class="au-end">
          <span class="au-pc">
            <Icon :name="mac ? 'laptop' : 'monitor'" :size="40" :stroke-width="1.5" />
            <Glyph :h="13" />
          </span>
          <b>{{ device }}</b>
          <span>Invade {{ pairing!.app }}</span>
        </div>
        <span class="au-tie" :class="{ on: state === 'done' }">
          <i v-if="state === 'ask'"></i>
          <b v-else><Icon name="check" :size="14" :stroke-width="2.6" /></b>
        </span>
        <div class="au-end">
          <span class="au-me">
            <img v-if="avatar" :src="avatar" alt="" />
            <span v-else class="au-none"><Icon name="user" :size="36" :stroke-width="1.5" /></span>
            <span class="au-dc"><DiscordMark :size="15" mono /></span>
          </span>
          <b class="ell">{{ account?.name }}</b>
          <span>Signed in with Discord</span>
        </div>
      </div>
      <template v-if="state === 'ask'">
        <div class="au-btns">
          <button type="button" class="btn lg pri au-b" :disabled="busy" @click="connect">
            Connect
          </button>
        </div>
        <p v-if="error" class="au-err" role="alert">{{ error }}</p>
        <form method="post" action="/signout">
          <input type="hidden" name="next" :value="notMe" />
          <button type="submit" class="au-not">This is not me</button>
        </form>
      </template>
      <template v-else>
        <div class="au-btns">
          <Link class="btn lg pri au-b" :href="`/u/${account?.handle}`">Go to my profile</Link>
        </div>
        <Link class="au-not" href="/account/settings">Account settings</Link>
      </template>
    </template>
    <template v-else-if="state === 'taken'">
      <h1 class="au-h">This app is on another account</h1>
      <p class="au-sub">Disconnect it from the account it uses first, then try again.</p>
      <div class="au-btns">
        <Link class="btn lg au-b" href="/account/settings">Account settings</Link>
      </div>
    </template>
    <template v-else>
      <h1 class="au-h">This link has expired</h1>
      <p class="au-sub">Links last ten minutes and work once. Start again from the app.</p>
      <div class="au-btns">
        <Link class="btn lg au-b" href="/account/settings">Account settings</Link>
      </div>
    </template>
  </AuthScene>
</template>
