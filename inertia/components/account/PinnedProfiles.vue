<script setup lang="ts">
import { ProfileFavorites } from '@invadelol/ui'
import { useAccount, openAccountProfile } from '../../lib/account.js'
const newId = () => crypto.randomUUID()
const { viewer, state, busy, error, change } = useAccount()
const search = () => document.querySelector<HTMLInputElement>('header input')?.focus()
</script>
<template>
  <div v-if="viewer" class="pinned-profiles">
    <ProfileFavorites
      :folders="state.folders"
      :profiles="state.favorites"
      :busy="busy"
      :status="busy ? 'Saving…' : 'Synced'"
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
.pinned-profiles {
  margin-top: 24px;
}
.account-error {
  margin-top: 12px;
  color: var(--warn);
  font-size: 12px;
}
</style>
