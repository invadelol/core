<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { AccountRoster, Icon, Logo, useFormat } from '@invadelol/ui'
import type { InvadeAccountData } from '@invadelol/ui'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import PinnedProfiles from '../components/account/PinnedProfiles.vue'
import { useAccount, openAccountProfile } from '../lib/account.js'

/**
 * /account: the visitor's Invade account. The rail is the account itself (who, how they signed
 * in, the way out) and its sections; the feed holds the League accounts it owns, its favorite
 * players and the desktop apps connected to it. `pairingCode` comes from the app's "Connect
 * account": the page then asks to approve that app first.
 */
const props = defineProps<{ account: InvadeAccountData; pairingCode: string | null }>()
const { state, viewer, busy, error, change, load } = useAccount()
const { ago } = useFormat()
const current = computed(() => (state.value.user ? state.value : props.account))
const user = computed(() => current.value.user ?? viewer.value)
const provider = computed(() => (user.value?.provider === 'google' ? 'Google' : 'Discord'))

const SECTIONS = [
  { id: 'accounts', label: 'League accounts', icon: 'users' },
  { id: 'favorites', label: 'Favorites', icon: 'star' },
  { id: 'devices', label: 'Desktop app', icon: 'download' },
] as const
const section = ref<string>('accounts')
function jump(id: string) {
  section.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const osName = (os: string) =>
  os.toLowerCase() === 'macos' ? 'macOS' : os.toLowerCase() === 'windows' ? 'Windows' : os
const seen = (at: string | null) => (at ? `Active ${ago(Date.parse(at))}` : 'Not seen yet')
const unlinking = ref<string | null>(null)
async function unlink(id: string) {
  if (await change({ type: 'unlinkDevice', deviceId: id })) unlinking.value = null
}

/* Pairing: the desktop app asked to join this account. */
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
    if (!res.ok) throw new Error('This link expired. Choose Connect account in the app again.')
    approved.value = true
    await load(true)
  } catch (e) {
    pairError.value = e instanceof Error ? e.message : String(e)
  } finally {
    approving.value = false
  }
}

/* How to add an account: the proof comes from the app. */
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
        <!-- The rail: the Invade account and its sections. -->
        <aside class="account-rail">
          <section class="iv-panel lit-sheet account-id">
            <span class="account-mono" aria-hidden="true">{{
              (user?.name || 'A').slice(0, 1).toUpperCase()
            }}</span>
            <h1>{{ user?.name }}</h1>
            <p>Invade account · {{ provider }}</p>
            <dl>
              <div>
                <dt>League accounts</dt>
                <dd class="tabular">{{ current.accounts.length }}</dd>
              </div>
              <div>
                <dt>Favorites</dt>
                <dd class="tabular">{{ current.favorites.length }}</dd>
              </div>
            </dl>
          </section>
          <nav class="account-nav" aria-label="Account sections">
            <a
              v-for="s in SECTIONS"
              :key="s.id"
              :href="`#${s.id}`"
              :class="{ on: section === s.id }"
              @click.prevent="jump(s.id)"
              ><Icon :name="s.icon" :size="15" />{{ s.label }}</a
            >
          </nav>
          <button type="button" class="account-signout" @click="router.post('/signout')">
            <Icon name="external" :size="14" />Sign out
          </button>
        </aside>

        <div class="account-feed">
          <!-- The app asked to join: approve first. -->
          <section
            v-if="pairingCode"
            class="iv-panel lit-sheet account-pair"
            :class="{ done: approved }"
          >
            <div class="account-pair-art" aria-hidden="true">
              <span class="account-pair-app"><Logo :size="22" /></span>
              <span class="account-pair-join"><i /><i /><i /></span>
              <span class="account-mono sm">{{
                (user?.name || 'A').slice(0, 1).toUpperCase()
              }}</span>
            </div>
            <div class="account-pair-copy">
              <h2>{{ approved ? 'The app is connected' : 'Connect the desktop app?' }}</h2>
              <p>
                {{
                  approved
                    ? 'You can go back to Invade. Your accounts and favorites are there now.'
                    : `Invade on this computer will use ${user?.name}’s League accounts, favorites and folders.`
                }}
              </p>
              <p v-if="pairError" class="account-error" role="alert">{{ pairError }}</p>
            </div>
            <button
              v-if="!approved"
              type="button"
              class="iv-btn primary lg"
              :disabled="approving"
              @click="approve"
            >
              {{ approving ? 'Connecting…' : 'Connect' }}
            </button>
            <Icon v-else name="check" :size="22" class="account-pair-ok" />
          </section>

          <section id="accounts" class="account-section">
            <header class="section">
              <h2>League accounts</h2>
              <span class="meta">Your main one opens first, here and in the app</span>
            </header>
            <AccountRoster
              :accounts="current.accounts"
              :main-puuid="current.mainPuuid"
              :busy="busy"
              @main="(puuid) => change({ type: 'main', puuid })"
              @open="openAccountProfile"
              @verify="info = true"
            />
          </section>

          <section id="favorites" class="account-section">
            <header class="section">
              <h2>Favorites</h2>
              <span class="meta">Star a player on their profile to add them</span>
            </header>
            <PinnedProfiles layout="list" />
          </section>

          <section id="devices" class="account-section">
            <header class="section">
              <h2>Desktop app</h2>
            </header>
            <div class="iv-panel account-devices">
              <div v-for="d in current.devices" :key="d.id" class="account-device">
                <span class="account-device-mark"><Logo :size="18" /></span>
                <div>
                  <b>Invade on {{ osName(d.os) }}</b>
                  <small
                    >{{ d.app ? `Version ${d.app} · ` : ''
                    }}<span class="account-live">{{ seen(d.lastSeenAt) }}</span></small
                  >
                </div>
                <template v-if="unlinking === d.id">
                  <span class="account-device-ask"
                    >It stops syncing until you connect it again.</span
                  >
                  <button type="button" class="iv-btn ghost sm" @click="unlinking = null">
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="iv-btn danger sm"
                    :disabled="busy"
                    @click="unlink(d.id)"
                  >
                    Disconnect
                  </button>
                </template>
                <button v-else type="button" class="iv-btn ghost sm" @click="unlinking = d.id">
                  Disconnect
                </button>
              </div>
              <div v-if="!current.devices.length" class="account-device empty">
                <span class="account-device-mark"><Icon name="download" :size="16" /></span>
                <div>
                  <b>No app connected yet</b>
                  <small>In Invade, open Accounts and choose Connect account.</small>
                </div>
                <a href="/app" class="iv-btn sm">Get the app</a>
              </div>
            </div>
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
          <button
            type="button"
            class="iv-btn ghost icon-only account-help-close"
            aria-label="Close"
            @click="info = false"
          >
            <Icon name="x" :size="16" />
          </button>
          <h2 id="account-help-title">Add a League account</h2>
          <p>
            Only the app can see which account is signed in to your League client. That’s the proof
            it’s yours.
          </p>
          <ol>
            <li>
              <span>1</span>
              <div>
                Open Invade on your computer<small
                  >Connected to this account: Accounts → Connect account.</small
                >
              </div>
            </li>
            <li>
              <span>2</span>
              <div>Sign in to League with the account<small>Your main or a smurf.</small></div>
            </li>
            <li>
              <span>3</span>
              <div>Choose Link next to it<small>It shows up here right after.</small></div>
            </li>
          </ol>
          <div class="account-help-actions">
            <a href="/app" class="iv-btn primary">Get the desktop app</a>
            <button type="button" class="iv-btn ghost" @click="info = false">I have it</button>
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
  padding-bottom: 72px;
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

/* Rail */
.account-rail {
  position: sticky;
  top: 80px;
  display: grid;
  gap: 16px;
}
.account-id {
  padding: 20px;
}
.account-mono {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  font-size: 24px;
  font-weight: 650;
  color: var(--on-brand);
  background: var(--primary);
  border-radius: var(--r-md);
  box-shadow: var(--primary-shadow);
}
.account-mono.sm {
  width: 40px;
  height: 40px;
  font-size: 17px;
}
.account-id h1 {
  margin-top: 16px;
  font-size: 22px;
  font-weight: 650;
  line-height: 28px;
  letter-spacing: -0.015em;
  color: var(--text-1);
  overflow-wrap: anywhere;
}
.account-id > p {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--text-3);
}
.account-id dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.account-id dt {
  font-size: 12px;
  color: var(--text-3);
}
.account-id dd {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 700;
  font-stretch: var(--fig);
  color: var(--text-1);
}
.account-nav {
  display: grid;
  gap: 2px;
}
.account-nav a,
.account-signout {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 10px;
  font: 500 13px var(--font);
  color: var(--text-2);
  text-decoration: none;
  background: none;
  border: 0;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition:
    color var(--t-fast),
    background-color var(--t-fast);
}
.account-nav a .iv-icon,
.account-signout .iv-icon {
  color: var(--text-3);
}
.account-nav a:hover,
.account-signout:hover {
  color: var(--text-1);
  background: var(--surface-1);
}
.account-nav a.on {
  color: var(--text-1);
  background: var(--brand-a08);
}
.account-nav a.on .iv-icon {
  color: var(--brand-hi);
}
.account-signout {
  width: 100%;
  margin-top: 4px;
  padding-top: 12px;
  height: 46px;
  border-top: 1px solid var(--line);
  border-radius: 0;
  color: var(--text-3);
}
.account-signout:hover {
  background: none;
}

/* Feed */
.account-feed {
  display: grid;
  gap: 40px;
  min-width: 0;
}
.account-section {
  scroll-margin-top: 80px;
}
.account-section > .section {
  margin-bottom: 12px;
}

.account-pair {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px;
}
.account-pair-art {
  display: flex;
  align-items: center;
  gap: 10px;
}
.account-pair-app {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  background: var(--key);
  border-radius: var(--r-md);
  box-shadow: var(--key-shadow);
}
.account-pair-join {
  display: flex;
  gap: 4px;
}
.account-pair-join i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--brand-hi);
  opacity: 0.5;
}
.account-pair.done .account-pair-join i {
  opacity: 1;
}
.account-pair-copy {
  flex: 1;
  min-width: 0;
}
.account-pair h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
.account-pair p {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-2);
}
.account-pair-ok {
  color: var(--win);
}

.account-devices {
  padding: 4px 16px;
}
.account-device {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
}
.account-device + .account-device {
  border-top: 1px solid var(--line);
}
.account-device-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  color: var(--text-3);
  background: var(--key);
  border-radius: var(--r-sm);
  box-shadow: var(--key-shadow);
}
.account-device > div {
  flex: 1;
  min-width: 0;
}
.account-device b {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.account-device small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
}
.account-live::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 5px;
  vertical-align: 1px;
  border-radius: 50%;
  background: var(--win);
}
.account-device-ask {
  font-size: 12px;
  color: var(--text-3);
}

/* Help dialog */
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
  position: relative;
  width: 100%;
  max-width: 440px;
  padding: 28px;
  background: var(--solid-1);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-3), var(--lit);
}
.account-help-close {
  position: absolute;
  top: 12px;
  right: 12px;
}
.account-help h2 {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.015em;
}
.account-help-inner > p {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
}
.account-help ol {
  display: grid;
  gap: 0;
  margin: 24px 0;
  padding: 0;
  list-style: none;
}
.account-help li {
  position: relative;
  display: flex;
  gap: 14px;
  padding-bottom: 18px;
  font-size: 13.5px;
  font-weight: 500;
}
.account-help li:not(:last-child)::before {
  content: '';
  position: absolute;
  top: 28px;
  bottom: 4px;
  left: 12px;
  width: 1px;
  background: var(--line-2);
}
.account-help li > span {
  display: grid;
  place-items: center;
  flex: none;
  width: 25px;
  height: 25px;
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-hi);
  background: var(--brand-a16);
  border-radius: var(--r-sm);
}
.account-help small {
  display: block;
  margin-top: 3px;
  font-size: 12.5px;
  font-weight: 400;
  color: var(--text-3);
}
.account-help-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 1023px) {
  .account-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .account-rail {
    position: static;
  }
  .account-nav {
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .account-nav a {
    white-space: nowrap;
  }
  .account-signout {
    display: none;
  }
  .account-feed {
    gap: 32px;
  }
}
@media (max-width: 560px) {
  .account-pair {
    flex-wrap: wrap;
  }
  .account-pair .iv-btn {
    width: 100%;
  }
  .account-device {
    flex-wrap: wrap;
    padding: 12px 0;
  }
  .account-device > div {
    min-width: 160px;
  }
}
</style>
