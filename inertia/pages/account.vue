<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { AccountRoster, Icon, useFormat } from '@invadelol/ui'
import type { InvadeAccountData } from '@invadelol/ui'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import PinnedProfiles from '../components/account/PinnedProfiles.vue'
import { useAccount, openAccountProfile } from '../lib/account.js'

/**
 * /account: the visitor's Invade account. The rail says who is signed in; the feed holds its
 * League accounts, favorite players and connected apps. `pairingCode` comes from the app's
 * Connect button: the page asks to approve that app first.
 */
const props = defineProps<{ account: InvadeAccountData; pairingCode: string | null }>()
const { state, viewer, busy, error, change, load } = useAccount()
const { ago } = useFormat()
const current = computed(() => (state.value.user ? state.value : props.account))
const user = computed(() => current.value.user ?? viewer.value)
const provider = computed(() => (user.value?.provider === 'google' ? 'Google' : 'Discord'))
/** The account's picture: its main League account's icon (else the first one). */
const face = computed(() => {
  const a =
    current.value.accounts.find((p) => p.puuid === current.value.mainPuuid) ??
    current.value.accounts[0]
  return a ? `/cdn/profile-icon/${a.profileIconId ?? 1}.png` : null
})
const osName = (os: string) =>
  os.toLowerCase() === 'macos' ? 'macOS' : os.toLowerCase() === 'windows' ? 'Windows' : os

const approved = ref(false)
const pairError = ref('')
const approving = ref(false)
async function approve() {
  approving.value = true
  pairError.value = ''
  try {
    const res = await fetch('/api/account/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ code: props.pairingCode }),
    })
    if (!res.ok) throw new Error('This link has expired. Start again from the app.')
    approved.value = true
    await load(true)
  } catch (e) {
    pairError.value = e instanceof Error ? e.message : String(e)
  } finally {
    approving.value = false
  }
}

const info = ref(false)
const help = ref<HTMLDialogElement | null>(null)
watch(info, (value) => (value ? help.value?.showModal() : help.value?.close()))
</script>

<template>
  <Head title="Your account" />
  <div class="account-page">
    <AppHeader />
    <main class="page account-main">
      <div class="account-grid">
        <aside class="iv-panel account-id">
          <img v-if="face" :src="face" alt="" class="account-face" width="72" height="72" />
          <span v-else class="account-face empty"><Icon name="user" :size="28" /></span>
          <h1>{{ user?.name }}</h1>
          <p>Signed in with {{ provider }}</p>
          <button type="button" class="iv-btn sm" @click="router.post('/signout')">Sign out</button>
        </aside>

        <div class="account-feed">
          <section v-if="pairingCode" class="iv-panel iv-pf-panel account-pair">
            <p v-if="approved">
              <Icon name="check" :size="14" />The app is connected. You can go back to it.
            </p>
            <template v-else>
              <p>Connect Invade on this computer to this account?</p>
              <button
                type="button"
                class="iv-btn primary sm"
                :disabled="approving"
                @click="approve"
              >
                Connect
              </button>
            </template>
            <small v-if="pairError" class="account-error" role="alert">{{ pairError }}</small>
          </section>

          <AccountRoster
            id="accounts"
            :accounts="current.accounts"
            :main-puuid="current.mainPuuid"
            :busy="busy"
            @main="(puuid) => change({ type: 'main', puuid })"
            @open="openAccountProfile"
            @verify="info = true"
          />

          <PinnedProfiles id="favorites" layout="list" />

          <section class="iv-panel iv-pf-panel">
            <header class="iv-panel-head">
              <h3>Desktop app</h3>
              <span class="meta">{{ current.devices.length }}</span>
            </header>
            <ul v-if="current.devices.length" class="account-devices">
              <li v-for="d in current.devices" :key="d.id">
                <span>
                  <b>Invade on {{ osName(d.os) }}</b>
                  <small
                    >{{ d.app ? `Version ${d.app}` : '' }}{{ d.app && d.lastSeenAt ? ' · ' : ''
                    }}{{ d.lastSeenAt ? `Seen ${ago(Date.parse(d.lastSeenAt))}` : '' }}</small
                  >
                </span>
                <button
                  type="button"
                  class="iv-btn ghost sm"
                  :disabled="busy"
                  @click="change({ type: 'unlinkDevice', deviceId: d.id })"
                >
                  Disconnect
                </button>
              </li>
            </ul>
            <p v-else class="iv-pf-note">No app connected. <a href="/app">Get the app</a></p>
          </section>

          <p v-if="error" class="account-error" role="alert">{{ error }}</p>
        </div>
      </div>

      <dialog
        ref="help"
        class="account-help"
        aria-labelledby="account-help-title"
        @cancel="info = false"
        @click="(e) => e.target === e.currentTarget && (info = false)"
      >
        <div class="account-help-inner">
          <h2 id="account-help-title">Add a League account</h2>
          <ol>
            <li>Open Invade on your computer, connected to this account.</li>
            <li>Sign in to League with the account.</li>
            <li>In Invade → Accounts, choose Link.</li>
          </ol>
          <div class="account-help-actions">
            <button type="button" class="iv-btn ghost" @click="info = false">Close</button>
            <a href="/app" class="iv-btn">Get the app</a>
          </div>
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
.account-main {
  flex: 1;
  padding-top: 24px;
  padding-bottom: 64px;
}
.account-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 32px;
  align-items: start;
}
@media (min-width: 1280px) {
  .account-grid {
    grid-template-columns: 316px minmax(0, 1fr);
  }
}
.account-id {
  padding: 20px;
}
.account-face {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: var(--r-md);
}
.account-face.empty {
  color: var(--text-3);
  background: var(--surface-2);
}
.account-id h1 {
  margin-top: 16px;
  font-size: 22px;
  font-weight: 600;
  line-height: 28px;
  letter-spacing: -0.012em;
  color: var(--text-1);
  overflow-wrap: anywhere;
}
.account-id p {
  margin: 2px 0 16px;
  font-size: 12.5px;
  color: var(--text-3);
}
.account-feed {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.account-feed > section {
  scroll-margin-top: 80px;
}
.account-pair {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.account-pair p {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-1);
}
.account-devices {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.account-devices li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
}
.account-devices li + li {
  border-top: 1px solid var(--line);
}
.account-devices span {
  display: grid;
  gap: 1px;
}
.account-devices b {
  font-size: 13px;
  font-weight: 600;
}
.account-devices small {
  font-size: 11.5px;
  color: var(--text-3);
}
.iv-pf-note a {
  color: var(--text-1);
}
.account-error {
  width: 100%;
  font-size: 12px;
  color: var(--warn);
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
  background: rgb(0 0 0 / 0.6);
  border: 0;
  color: var(--text-1);
}
.account-help[open] {
  display: grid;
  place-items: center;
}
.account-help-inner {
  width: 100%;
  max-width: 400px;
  padding: 20px;
  background: var(--solid-2);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-3);
}
.account-help h2 {
  font-size: 16px;
  font-weight: 600;
}
.account-help ol {
  display: grid;
  gap: 8px;
  margin: 14px 0 20px;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-2);
}
.account-help-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 1023px) {
  .account-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .account-id {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    column-gap: 14px;
    padding: 16px;
  }
  .account-face {
    grid-row: span 2;
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
  .account-id h1 {
    margin: 0;
    font-size: 18px;
  }
  .account-id p {
    margin: 0;
    grid-column: 2;
  }
  .account-id .iv-btn {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
}
</style>
