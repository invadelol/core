<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import AccountHead from '../../components/account/AccountHead.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Segmented from '../../components/ui/Segmented.vue'
import Icon from '../../components/ui/Icon.vue'
import DiscordMark from '../../components/header/DiscordMark.vue'
import { SERVER } from '../../lib/board.js'
import { since } from '../../lib/ladders.js'
import { rankText } from '../../lib/account_format.js'
import { changeAccount, deleteAccount } from '../../lib/account.js'
import {
  ACCOUNT_LIMITS,
  type AccountSettings,
  type ClipAudience,
  type ClipComments,
  type InvadeAccountData,
  type SiteAccountOp,
} from '../../lib/account_types.js'
import '../../css/account.css'

/**
 * /account/settings: the League accounts the app proved (the main, which ones the profile shows,
 * "Not mine"), how the person signs in and their name, who may watch and comment on new clips and
 * what others may do with their name, the desktop apps connected, and deleting the account. Each
 * change is saved at once; the page shows the account as the server answered it.
 */
const props = defineProps<{ account: InvadeAccountData }>()

const account = shallowRef(props.account)
const busy = ref(false)
const notice = ref('')

async function apply(...ops: SiteAccountOp[]) {
  busy.value = true
  notice.value = ''
  try {
    account.value = await changeAccount(ops)
    return true
  } catch (error) {
    notice.value = error instanceof Error ? error.message : 'That did not go through.'
    return false
  } finally {
    busy.value = false
  }
}

const user = computed(() => account.value.user!)
const settings = computed(() => account.value.settings!)

/* ── League accounts ──────────────────────────────────────────────── */

const removing = ref<string | null>(null)
async function notMine(puuid: string) {
  if (await apply({ op: 'notMine', puuid })) removing.value = null
}
function accountLine(a: InvadeAccountData['accounts'][number]) {
  const parts = [rankText(a.tier, a.division) ?? 'Unranked', SERVER[a.platform] ?? a.platform]
  return a.puuid === account.value.mainPuuid ? ['Main', ...parts].join(', ') : parts.join(', ')
}

/* ── Name ─────────────────────────────────────────────────────────── */

const naming = ref(false)
const name = ref('')
const nameField = ref<HTMLInputElement>()
async function editName() {
  name.value = user.value.name
  naming.value = true
  await nextTick()
  nameField.value?.focus()
}
async function saveName() {
  if (await apply({ op: 'rename', name: name.value })) naming.value = false
}

/* ── Privacy ──────────────────────────────────────────────────────── */

const AUDIENCE: { value: ClipAudience; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'link', label: 'Link only' },
  { value: 'private', label: 'Only me' },
]
const COMMENTS: { value: ClipComments; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'game', label: 'This game' },
  { value: 'off', label: 'No one' },
]
const SWITCHES: {
  key: 'clipsOnProfile' | 'allowTags' | 'streamerMode'
  label: string
  line?: string
}[] = [
  { key: 'clipsOnProfile', label: 'Show my clips on my League profile' },
  { key: 'allowTags', label: 'Let others tag me in their clips' },
  {
    key: 'streamerMode',
    label: 'Follow League’s streamer mode',
    line: 'With Hide My Name on, your name stays off other players’ clips and comments',
  },
]
const set = (change: Partial<AccountSettings>) => apply({ op: 'settings', settings: change })

/* ── Apps and deletion ────────────────────────────────────────────── */

/** Seen in the last five minutes: online now. */
const ONLINE_MS = 5 * 60_000
function deviceLine(d: InvadeAccountData['devices'][number]) {
  const seen = d.lastSeenAt ? Date.parse(d.lastSeenAt) : null
  const when = !seen ? null : Date.now() - seen < ONLINE_MS ? 'online now' : since(seen)
  return when ? `Invade ${d.app}, ${when}` : `Invade ${d.app}`
}

const deleting = ref(false)
async function removeAll() {
  busy.value = true
  try {
    await deleteAccount()
    window.location.href = '/'
  } catch (error) {
    notice.value = error instanceof Error ? error.message : 'That did not go through.'
    busy.value = false
  }
}
</script>

<template>
  <Head title="Account settings" />
  <SiteLayout>
    <div class="wrap ac-wrap">
      <AccountHead :account="account" active="settings" />
      <div class="ac-body">
        <p v-if="notice" class="ac-notice" role="alert">{{ notice }}</p>

        <section class="ac-set" aria-labelledby="ac-accounts">
          <h2 id="ac-accounts">League accounts</h2>
          <ul v-if="account.accounts.length" class="card ac-list">
            <li v-for="a in account.accounts" :key="a.puuid" class="ac-row stack">
              <span class="ac-row-t">
                <span class="h5"
                  ><span
                    >{{ a.gameName }}<small>#{{ a.tagLine }}</small></span
                  ></span
                >
                <span class="meta">{{ accountLine(a) }}</span>
              </span>
              <span class="ac-row-c">
                <template v-if="removing === a.puuid">
                  <span class="ac-ask">Not yours?</span>
                  <button type="button" class="btn sm" :disabled="busy" @click="notMine(a.puuid)">
                    Remove it
                  </button>
                  <button type="button" class="btn sm ghost" @click="removing = null">
                    Cancel
                  </button>
                </template>
                <template v-else>
                  <label class="ac-show">
                    On profile
                    <button
                      type="button"
                      class="switch"
                      :class="{ on: a.shown }"
                      role="switch"
                      :aria-checked="a.shown"
                      :aria-label="`Show ${a.gameName}#${a.tagLine} on my profile`"
                      :disabled="busy"
                      @click="apply({ op: 'show', puuid: a.puuid, shown: !a.shown })"
                    ></button>
                  </label>
                  <span v-if="a.puuid === account.mainPuuid" class="ac-quiet">Main</span>
                  <button
                    v-else
                    type="button"
                    class="btn sm"
                    :disabled="busy"
                    @click="apply({ op: 'main', puuid: a.puuid })"
                  >
                    Make main
                  </button>
                  <button type="button" class="btn sm" :disabled="busy" @click="removing = a.puuid">
                    Not mine
                  </button>
                </template>
              </span>
            </li>
          </ul>
          <div v-else class="card ac-card">
            <EmptyState
              icon="users"
              title="No League account yet"
              line="Connect the desktop app, then sign in to League: each account you play on joins this list."
            >
              <Link v-if="!account.devices.length" class="btn sm" href="/app" prefetch
                ><Icon name="download" />Get the app</Link
              >
            </EmptyState>
          </div>
        </section>

        <section class="ac-set" aria-labelledby="ac-signin">
          <h2 id="ac-signin">Sign-in</h2>
          <ul class="card ac-list">
            <li class="ac-row">
              <span class="ac-row-t">
                <span class="h5"><DiscordMark :size="18" />Discord</span>
                <span class="meta">{{ user.name }}</span>
              </span>
              <span class="ac-quiet">Connected</span>
            </li>
            <li class="ac-row">
              <form
                v-if="naming"
                class="ac-name-form"
                @submit.prevent="saveName"
                @keydown.esc="naming = false"
              >
                <label class="field">
                  <input
                    ref="nameField"
                    v-model="name"
                    :maxlength="ACCOUNT_LIMITS.displayName"
                    aria-label="Name"
                  />
                </label>
                <button type="submit" class="btn sm" :disabled="busy || !name.trim()">Save</button>
                <button type="button" class="btn sm ghost" @click="naming = false">Cancel</button>
              </form>
              <template v-else>
                <span class="ac-row-t">
                  <span class="h5">Name</span>
                  <span class="meta">{{ user.name }}</span>
                </span>
                <button type="button" class="btn sm" @click="editName">Edit</button>
              </template>
            </li>
          </ul>
        </section>

        <section class="ac-set" aria-labelledby="ac-privacy">
          <h2 id="ac-privacy">Privacy</h2>
          <ul class="card ac-list">
            <li class="ac-row stack">
              <span class="ac-row-t"><span class="h5">New clips can be watched by</span></span>
              <span class="ac-row-c">
                <Segmented
                  :model-value="settings.clipVisibility"
                  :options="AUDIENCE"
                  label="New clips can be watched by"
                  @update:model-value="(v) => set({ clipVisibility: v })"
                />
              </span>
            </li>
            <li class="ac-row stack">
              <span class="ac-row-t"><span class="h5">Who can comment</span></span>
              <span class="ac-row-c">
                <Segmented
                  :model-value="settings.clipComments"
                  :options="COMMENTS"
                  label="Who can comment"
                  @update:model-value="(v) => set({ clipComments: v })"
                />
              </span>
            </li>
            <li v-for="s in SWITCHES" :key="s.key" class="ac-row">
              <span :id="`ac-${s.key}`" class="ac-row-t">
                <span class="h5">{{ s.label }}</span>
                <span v-if="s.line" class="meta">{{ s.line }}</span>
              </span>
              <button
                type="button"
                class="switch"
                :class="{ on: settings[s.key] }"
                role="switch"
                :aria-checked="settings[s.key]"
                :aria-labelledby="`ac-${s.key}`"
                :disabled="busy"
                @click="set({ [s.key]: !settings[s.key] })"
              ></button>
            </li>
          </ul>
        </section>

        <section class="ac-set" aria-labelledby="ac-apps">
          <h2 id="ac-apps">Desktop app</h2>
          <ul v-if="account.devices.length" class="card ac-list">
            <li v-for="d in account.devices" :key="d.id" class="ac-row">
              <span class="ac-row-t">
                <span class="h5"
                  ><Icon :name="d.os === 'macos' ? 'laptop' : 'monitor'" />{{
                    d.os === 'macos' ? 'Mac' : 'Windows PC'
                  }}</span
                >
                <span class="meta">{{ deviceLine(d) }}</span>
              </span>
              <button
                type="button"
                class="btn sm"
                :disabled="busy"
                @click="apply({ op: 'disconnect', deviceId: d.id })"
              >
                Disconnect
              </button>
            </li>
          </ul>
          <div v-else class="card ac-card">
            <EmptyState
              icon="monitor"
              title="Not connected"
              line="In the app, choose Sign in: it opens a page here to connect it."
            >
              <Link class="btn sm" href="/app" prefetch><Icon name="download" />Get the app</Link>
            </EmptyState>
          </div>
        </section>

        <section class="ac-set" aria-labelledby="ac-delete">
          <h2 id="ac-delete">Delete the account</h2>
          <div class="card ac-del">
            <p class="meta">
              Your clips, favorites, follows, builds and the list of your League accounts are
              deleted. Your games and League profiles stay on invade.lol.
            </p>
            <div class="ac-del-acts">
              <button
                v-if="!deleting"
                type="button"
                class="btn sm ac-danger"
                @click="deleting = true"
              >
                Delete the account
              </button>
              <template v-else>
                <button type="button" class="btn sm ghost" @click="deleting = false">Cancel</button>
                <button
                  type="button"
                  class="btn sm ac-danger sure"
                  :disabled="busy"
                  @click="removeAll"
                >
                  Delete for good
                </button>
              </template>
            </div>
          </div>
        </section>
      </div>
    </div>
  </SiteLayout>
</template>
