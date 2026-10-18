<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Icon, type AccountProfile } from '@invadelol/ui'
import { useAccount, openAccountProfile } from '../../lib/account.js'
defineProps<{ active: string }>()
const { viewer, state } = useAccount()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
function outside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
function leave(e: FocusEvent) {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) open.value = false
}
function pick(p: AccountProfile) {
  open.value = false
  openAccountProfile(p)
}
onMounted(() => window.addEventListener('pointerdown', outside))
onBeforeUnmount(() => window.removeEventListener('pointerdown', outside))
</script>
<template>
  <div
    v-if="viewer && state.accounts.length"
    ref="root"
    class="profile-switch"
    @keydown.esc="open = false"
    @focusout="leave"
  >
    <button
      type="button"
      class="profile-switch-trigger"
      aria-label="Your League accounts"
      title="Your League accounts"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="profile-switch-faces"
        ><img
          v-for="p in state.accounts.slice(0, 3)"
          :key="p.puuid"
          :src="`/cdn/profile-icon/${p.profileIconId ?? 1}.png`"
          width="22"
          height="22"
          alt="" /></span
      ><Icon name="down" :size="12" />
    </button>
    <div v-if="open" class="profile-switch-menu">
      <span class="profile-switch-label">Your League accounts</span>
      <button
        v-for="p in state.accounts"
        :key="p.puuid"
        type="button"
        :aria-current="p.puuid === active ? 'true' : undefined"
        @click="pick(p)"
      >
        <img :src="`/cdn/profile-icon/${p.profileIconId ?? 1}.png`" width="28" height="28" alt="" />
        <span
          ><b
            >{{ p.gameName }}<small>#{{ p.tagLine }}</small></b
          ><em>{{ p.platform.replace(/1$/, '') }}</em></span
        >
        <span v-if="state.mainPuuid === p.puuid" class="profile-switch-main">Main</span
        ><Icon v-if="p.puuid === active" name="check" :size="13" />
      </button>
      <Link href="/account" @click="open = false"
        ><Icon name="users" :size="13" />Manage accounts<Icon name="next" :size="12"
      /></Link>
    </div>
  </div>
</template>
<style scoped>
.profile-switch {
  position: relative;
}
.profile-switch-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 6px 0 4px;
  background: var(--btn);
  border: 0;
  border-radius: var(--r-sm);
  box-shadow: var(--btn-shadow);
  color: var(--text-3);
  cursor: pointer;
  transition:
    background-color var(--t-fast),
    color var(--t-fast);
}
.profile-switch-trigger:hover,
.profile-switch-trigger[aria-expanded='true'] {
  background: var(--btn-hover);
  color: var(--text-1);
}
.profile-switch-faces {
  display: flex;
}
.profile-switch-faces img {
  width: 22px;
  height: 22px;
  object-fit: cover;
  border-radius: var(--r-xs);
  box-shadow: 0 0 0 2px var(--solid-1);
}
.profile-switch-faces img + img {
  margin-left: -6px;
}
.profile-switch-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 276px;
  z-index: 50;
  padding: 6px;
  border-radius: var(--r-md);
  background: var(--solid-2);
  box-shadow: var(--shadow-2);
}
.profile-switch-label {
  display: block;
  padding: 8px;
  color: var(--text-3);
  font-size: 11px;
}
.profile-switch-menu > button,
.profile-switch-menu > a {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: var(--r-sm);
  background: none;
  color: var(--text-2);
  text-align: left;
  text-decoration: none;
  font: 400 12px var(--font);
  cursor: pointer;
}
.profile-switch-menu > button:hover,
.profile-switch-menu > a:hover {
  background: var(--glint);
  color: var(--text-1);
}
.profile-switch-menu img {
  border-radius: var(--r-sm);
}
.profile-switch-menu b {
  display: block;
  font-size: 12px;
  font-weight: 500;
}
.profile-switch-menu small {
  margin-left: 3px;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 400;
}
.profile-switch-menu em {
  display: block;
  font-size: 11px;
  color: var(--text-3);
  font-style: normal;
  margin-top: 2px;
}
.profile-switch-main {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-3);
}
.profile-switch-menu > button > .iv-icon {
  margin-left: auto;
  color: var(--brand-hi);
}
.profile-switch-menu > a {
  margin-top: 6px;
  border-top: 1px solid var(--line);
  border-radius: 0;
  padding-top: 12px;
}
.profile-switch-menu > a > .iv-icon:last-child {
  margin-left: auto;
}
</style>
