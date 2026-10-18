<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import { Icon, type AccountProfile } from '@invadelol/ui'
import { useAccount, openAccountProfile } from '../../lib/account.js'
const { viewer, state } = useAccount()
const open = ref(false)
/** The account's picture: its main League account's icon (else the first one). */
const face = computed(() => {
  const a =
    state.value.accounts.find((p) => p.puuid === state.value.mainPuuid) ?? state.value.accounts[0]
  return a ? `/cdn/profile-icon/${a.profileIconId ?? 1}.png` : null
})
function leave(e: FocusEvent) {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) open.value = false
}
function pick(p: AccountProfile) {
  open.value = false
  openAccountProfile(p)
}
</script>
<template>
  <div v-if="viewer" class="account-menu" @keydown.esc="open = false" @focusout="leave">
    <button
      type="button"
      class="iv-btn ghost account-menu-trigger"
      :aria-expanded="open"
      aria-label="Your Invade account"
      @click="open = !open"
    >
      <img v-if="face" :src="face" alt="" class="account-face" /><Icon
        v-else
        name="user"
        :size="15"
      /><Icon name="down" :size="12" />
    </button>
    <div v-if="open" class="account-menu-popover">
      <div class="account-menu-who">
        <img v-if="face" :src="face" alt="" class="account-face lg" />
        <span
          ><b>{{ viewer.name }}</b
          ><small
            >Invade account · {{ viewer.provider === 'google' ? 'Google' : 'Discord' }}</small
          ></span
        >
      </div>
      <template v-if="state.accounts.length"
        ><span class="account-menu-label">Your League accounts</span
        ><button v-for="p in state.accounts" :key="p.puuid" type="button" @click="pick(p)">
          <img
            :src="`/cdn/profile-icon/${p.profileIconId ?? 1}.png`"
            alt=""
            width="28"
            height="28"
          /><span
            >{{ p.gameName }}<small>#{{ p.tagLine }}</small></span
          ><span v-if="state.mainPuuid === p.puuid" class="iv-badge brand">Main</span>
        </button></template
      ><Link href="/account" @click="open = false"
        ><Icon name="users" :size="14" />Your account</Link
      ><Link href="/account#favorites" @click="open = false"
        ><Icon name="star" :size="14" />Favorites</Link
      ><button type="button" @click="router.post('/signout')">
        <Icon name="external" :size="14" />Sign out
      </button>
    </div>
  </div>
  <Link v-else href="/signin" class="iv-btn">Sign in</Link>
</template>
<style>
.account-menu {
  position: relative;
}
.account-menu-trigger {
  gap: 5px;
  padding: 0 4px;
}
.account-face {
  display: block;
  width: 26px;
  height: 26px;
  object-fit: cover;
  border-radius: var(--r-sm);
}
.account-face.lg {
  width: 34px;
  height: 34px;
}
.account-menu-popover {
  position: absolute;
  z-index: 50;
  right: 0;
  top: calc(100% + 12px);
  width: 272px;
  padding: 8px;
  background: var(--solid-2);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
}
.account-menu-who {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 12px;
  border-bottom: 1px solid var(--line);
}
.account-menu-who b {
  font-size: 13px;
  font-weight: 600;
}
.account-menu-who small {
  display: block;
  margin-top: 3px;
  color: var(--text-3);
  font-size: 11px;
}
.account-menu-label {
  display: block;
  padding: 12px 8px 4px;
  color: var(--text-3);
  font-size: 11px;
}
.account-menu-popover > button,
.account-menu-popover > a {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 0;
  background: none;
  border-radius: var(--r-sm);
  font: 400 12px var(--font);
  color: var(--text-2);
  text-decoration: none;
  text-align: left;
}
.account-menu-popover > a:last-of-type {
  margin-bottom: 4px;
}
.account-menu-popover > button:last-child {
  margin-top: 4px;
  border-top: 1px solid var(--line);
  border-radius: 0 0 var(--r-sm) var(--r-sm);
  padding-top: 12px;
}
.account-menu-popover > button:hover,
.account-menu-popover > a:hover {
  background: var(--surface-2);
  color: var(--text-1);
}
.account-menu-popover img {
  border-radius: var(--r-sm);
}
.account-menu-popover > button small {
  margin-left: 3px;
  color: var(--text-3);
  font-size: 11px;
}
.account-menu-popover .iv-badge {
  margin-left: auto;
}
</style>
