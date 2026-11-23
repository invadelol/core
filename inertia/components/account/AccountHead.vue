<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import Tabs from '../ui/Tabs.vue'
import { profileIcon } from '../../lib/assets.js'
import type { InvadeAccountData } from '../../lib/account_types.js'

/**
 * The head of the private account: the person's picture, "Account", who is signed in and that
 * only they see the page, their profile; then the two tabs, Favorites and Settings.
 */
const props = defineProps<{ account: InvadeAccountData; active: 'favorites' | 'settings' }>()

const user = computed(() => props.account.user!)
/** Their profile picture, or their main account's icon (shown to them even when hidden). */
const avatar = computed(() => {
  if (user.value.avatarUrl) return user.value.avatarUrl
  const main = props.account.accounts.find((a) => a.puuid === props.account.mainPuuid)
  return main ? profileIcon(main.profileIconId) : null
})
const tabs = computed(() => [
  { key: 'favorites', label: 'Favorites', href: '/account' },
  { key: 'settings', label: 'Settings', href: '/account/settings' },
])
</script>

<template>
  <header class="ac-h">
    <img v-if="avatar" class="ac-av" :src="avatar" alt="" width="64" height="64" />
    <span v-else class="ac-av none"><Icon name="user" :size="28" /></span>
    <div class="ac-who">
      <h1>Account</h1>
      <span class="meta">{{ user.name }}, signed in with Discord. Only you see this page.</span>
    </div>
    <Link class="btn" :href="`/u/${user.handle}`"><Icon name="user" :size="15" />My profile</Link>
  </header>
  <Tabs class="ac-tabs" :items="tabs" :active="active" label="Account" />
</template>
