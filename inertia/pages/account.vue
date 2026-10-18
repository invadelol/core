<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import { AccountRoster, Icon } from '@invadelol/ui'
import type { InvadeAccountData } from '@invadelol/ui'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import ProfileHeader from '../components/ProfileHeader.vue'
import ProfileNav from '../components/ProfileNav.vue'
import PinnedProfiles from '../components/account/PinnedProfiles.vue'
import { useAccount, openAccountProfile } from '../lib/account.js'
const props = defineProps<{ account: InvadeAccountData; pairingCode: string | null }>()
const { state, viewer, busy, error, change, load } = useAccount()
const current = computed(() => (state.value.user ? state.value : props.account))
const main = computed(() => current.value.accounts.find((a) => a.puuid === current.value.mainPuuid))
const mainProfile = computed(() => (main.value ? { ...main.value, summonerLevel: null } : null))
const slug = computed(() => (main.value ? main.value.gameName + '-' + main.value.tagLine : ''))
const info = ref(false),
  help = ref<HTMLDialogElement | null>(null),
  approved = ref(false),
  pairError = ref(''),
  approving = ref(false)
watch(info, (value) => {
  if (value) help.value?.showModal()
  else help.value?.close()
})
async function approve() {
  approving.value = true
  try {
    const res = await fetch('/api/account/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ code: props.pairingCode }),
    })
    if (!res.ok) throw new Error('This connection link expired. Start again in the desktop app.')
    approved.value = true
    await load(true)
  } catch (e) {
    pairError.value = String(e)
  } finally {
    approving.value = false
  }
}
</script>
<template>
  <Head title="Your accounts" />
  <div class="account-page">
    <AppHeader />
    <main class="page profile-account-page">
      <div class="profile-account-grid">
        <aside class="rail min-w-0">
          <ProfileHeader
            v-if="mainProfile"
            :summoner="mainProfile"
            :view-count="null"
            :is-syncing="false"
            :sync-message="null"
            :last-game-ms="null"
            account-mode
            @view="main && openAccountProfile(main)"
          />
          <section v-else class="iv-panel account-session-empty">
            <Icon name="user" :size="28" />
            <h1>{{ current.user?.name || viewer?.name }}</h1>
            <p>Invade account</p>
          </section>
          <ProfileNav v-if="mainProfile" class="mt-4" :slug="slug" section="account" manage />
          <div class="account-session">
            <span class="account-session-avatar">{{ (current.user?.name || 'A').slice(0, 1) }}</span
            ><span
              ><b>{{ current.user?.name }}</b
              ><small
                >Signed in with
                {{ current.user?.provider === 'google' ? 'Google' : 'Discord' }}</small
              ></span
            >
          </div>
        </aside>
        <div class="min-w-0 account-feed">
          <section v-if="pairingCode" class="iv-panel account-pair">
            <div>
              <h2>{{ approved ? 'Desktop connected' : 'Connect the desktop app?' }}</h2>
              <p>
                {{
                  approved
                    ? 'You can return to Invade.'
                    : 'Use this Invade account in the app and sync your profiles and folders.'
                }}
              </p>
              <p v-if="pairError" class="account-error" role="alert">{{ pairError }}</p>
            </div>
            <button
              v-if="!approved"
              type="button"
              class="iv-btn primary"
              :disabled="approving"
              @click="approve"
            >
              Connect app
            </button>
          </section>
          <AccountRoster
            :accounts="current.accounts"
            :main-puuid="current.mainPuuid"
            :busy="busy"
            @main="(puuid) => change({ type: 'main', puuid })"
            @open="openAccountProfile"
            @verify="info = true"
          />
          <PinnedProfiles />
          <section class="iv-panel account-connected">
            <header class="section">
              <h2>Desktop app</h2>
              <span class="meta">{{ current.devices.length ? 'Connected' : 'Not connected' }}</span>
            </header>
            <div v-for="device in current.devices" :key="device.id" class="account-device">
              <Icon name="globe" :size="20" />
              <div>
                <b
                  >Invade on
                  {{
                    device.os === 'macos'
                      ? 'macOS'
                      : device.os === 'windows'
                        ? 'Windows'
                        : device.os
                  }}</b
                ><small>Favorites and folders sync automatically.</small>
              </div>
              <button
                type="button"
                class="iv-btn ghost sm"
                :disabled="busy"
                @click="change({ type: 'unlinkDevice', deviceId: device.id })"
              >
                Unlink
              </button>
            </div>
            <div v-if="!current.devices.length" class="account-device">
              <div>
                <b>Bring your account into the app</b
                ><small>Open Invade → Accounts → Connect account.</small>
              </div>
              <a href="/app" class="iv-btn sm">Get the app<Icon name="external" :size="12" /></a>
            </div>
          </section>
          <p v-if="error" class="account-error" role="alert">{{ error }}</p>
        </div>
      </div>
      <dialog
        ref="help"
        class="account-help"
        @cancel="info = false"
        @click="
          (e) => {
            if (e.target === e.currentTarget) info = false
          }
        "
      >
        <div class="account-help-inner">
          <button
            type="button"
            class="iv-btn ghost icon-only close"
            aria-label="Close"
            @click="info = false"
          >
            <Icon name="x" :size="16" />
          </button>
          <h2>Add a League account</h2>
          <p>Invade verifies the account signed in to your League client.</p>
          <ol>
            <li>
              <span>1</span>
              <div>
                Connect your Invade account<small
                  >Open Accounts in the desktop app, then Connect account.</small
                >
              </div>
            </li>
            <li>
              <span>2</span>
              <div>Sign in to League<small>Use the main or smurf you want to add.</small></div>
            </li>
            <li>
              <span>3</span>
              <div>
                Add the detected account<small
                  >In the app, choose Add account. It will appear here.</small
                >
              </div>
            </li>
          </ol>
          <a href="/app" class="iv-btn">Get the desktop app<Icon name="next" :size="14" /></a>
        </div>
      </dialog>
    </main>
    <SiteFooter />
  </div>
</template>
<style scoped>
.account-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.profile-account-page {
  flex: 1;
  padding-top: 24px;
  padding-bottom: 64px;
}
.profile-account-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 32px;
  align-items: start;
}
.account-feed {
  display: grid;
  align-content: start;
  gap: 24px;
}
.account-feed :deep(.pinned-profiles) {
  margin-top: 0;
}
.account-session {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  padding: 16px 4px;
  border-top: 1px solid var(--line);
}
.account-session-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: var(--brand-a08);
  border-radius: var(--r-sm);
  color: var(--brand-hi);
  font-size: 12px;
}
.account-session b {
  display: block;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 500;
}
.account-session small {
  display: block;
  margin-top: 2px;
  color: var(--text-3);
  font-size: 11px;
}
.account-session-empty {
  padding: 20px;
}
.account-session-empty h1 {
  font-size: 22px;
  font-weight: 600;
  margin: 16px 0 4px;
}
.account-session-empty p {
  font-size: 12px;
  color: var(--text-3);
}
.account-connected {
  padding: 16px;
}
.account-connected .section {
  margin-bottom: 16px;
}
.account-connected h2 {
  font-size: 14px;
}
.account-device {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.account-device > .iv-icon {
  color: var(--text-3);
  flex: none;
}
.account-device > div {
  flex: 1;
}
.account-device b {
  font-size: 13px;
  font-weight: 500;
}
.account-device small {
  display: block;
  margin-top: 3px;
  color: var(--text-3);
  font-size: 12px;
}
.account-pair {
  padding: 20px;
  display: flex;
  gap: 16px;
  align-items: center;
}
.account-pair > div {
  flex: 1;
}
.account-pair h2 {
  font-size: 16px;
  font-weight: 600;
}
.account-pair p {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 6px;
}
.account-help {
  position: fixed;
  inset: 0;
  z-index: 60;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 20px;
  background: rgb(0 0 0/0.65);
  border: 0;
  color: var(--text-1);
}
.account-help[open] {
  display: grid;
  place-items: center;
}
.account-help-inner {
  position: relative;
  max-width: 420px;
  width: 100%;
  padding: 28px;
  background: var(--solid-1);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-3);
}
.account-help .close {
  position: absolute;
  right: 12px;
  top: 12px;
}
.account-help h2 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.account-help p {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-3);
  line-height: 1.6;
}
.account-help ol {
  list-style: none;
  padding: 0;
  margin: 24px 0;
  display: grid;
  gap: 20px;
}
.account-help li {
  display: flex;
  gap: 12px;
  font-size: 13px;
}
.account-help li > span {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: var(--r-sm);
  background: var(--surface-3);
  color: var(--text-2);
  font-size: 12px;
}
.account-help small {
  display: block;
  margin-top: 4px;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.6;
}
@media (min-width: 1280px) {
  .profile-account-grid {
    grid-template-columns: 316px minmax(0, 1fr);
  }
}
@media (max-width: 1023px) {
  .profile-account-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .account-session {
    margin-top: 12px;
    padding: 12px 4px;
  }
  .profile-account-page {
    padding-top: 20px;
  }
}
@media (max-width: 480px) {
  .account-device {
    flex-wrap: wrap;
  }
  .account-device > div {
    min-width: 180px;
  }
}
</style>
