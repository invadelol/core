<script setup lang="ts">
import { ProfileFavorites } from '@invadelol/ui'
import { useAccount, openAccountProfile } from '../../lib/account.js'

/**
 * The signed-in visitor's favorite players. `strip` sits above a match history and only shows
 * once there is someone in it; `list` is the full manager on /account.
 */
withDefaults(defineProps<{ layout?: 'strip' | 'list' }>(), { layout: 'strip' })
const newId = () => crypto.randomUUID()
const { viewer, state, busy, error, change } = useAccount()
const search = () => document.querySelector<HTMLInputElement>('header input')?.focus()
</script>

<template>
  <div
    v-if="viewer && (layout === 'list' || state.favorites.length)"
    class="pinned-profiles"
    :class="`pinned-${layout}`"
  >
    <ProfileFavorites
      :layout="layout"
      :folders="state.folders"
      :profiles="state.favorites"
      :busy="busy"
      :status="layout === 'list' ? (busy ? 'Saving…' : 'Synced') : ''"
      @open="openAccountProfile"
      @create="(name) => change({ type: 'createFolder', id: newId(), name })"
      @rename="(id, name) => change({ type: 'renameFolder', id, name })"
      @remove-folder="(id) => change({ type: 'deleteFolder', id })"
      @move="(puuid, folderId) => change({ type: 'moveFavorite', puuid, folderId })"
      @remove="(puuid) => change({ type: 'removeFavorite', puuid })"
      @search="search"
    />
    <p v-if="error" class="account-error" role="alert">{{ error }}</p>
  </div>
</template>

<style>
.pinned-strip {
  margin-top: 32px;
}
.account-error {
  margin-top: 12px;
  color: var(--warn);
  font-size: 12px;
}
</style>
