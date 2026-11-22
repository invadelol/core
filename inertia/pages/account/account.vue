<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import CardHead from '../../components/ui/CardHead.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Segmented from '../../components/ui/Segmented.vue'
import Select from '../../components/ui/Select.vue'
import Icon from '../../components/ui/Icon.vue'
import AccountRow from '../../components/account/AccountRow.vue'
import DiscordMark from '../../components/header/DiscordMark.vue'
import GoogleMark from '../../components/header/GoogleMark.vue'
import { since } from '../../lib/ladders.js'
import { changeAccount, deleteAccount } from '../../lib/account.js'
import {
  ACCOUNT_LIMITS,
  type AccountChange,
  type AccountProvider,
  type InvadeAccountData,
} from '../../lib/account_types.js'
import '../../css/account.css'

/**
 * /account: the signed-in person's League accounts (proven by the desktop app; one is the main),
 * their favorite players sorted into folders, the desktop apps connected, how they sign in, and
 * the way out. Every change is saved at once and the page shows the account as the server
 * answered it.
 */
const props = defineProps<{
  account: InvadeAccountData
  providers: Record<AccountProvider, boolean>
  error: string | null
}>()

const account = shallowRef(props.account)
const busy = ref(false)
const notice = ref(
  props.error === 'taken' ? 'That account is already used by another Invade account.' : ''
)

async function apply(change: AccountChange) {
  busy.value = true
  notice.value = ''
  try {
    account.value = await changeAccount(change)
    return true
  } catch (error) {
    notice.value = error instanceof Error ? error.message : 'That did not go through.'
    return false
  } finally {
    busy.value = false
  }
}

const user = computed(() => account.value.user!)
const PROVIDERS: { key: AccountProvider; label: string }[] = [
  { key: 'discord', label: 'Discord' },
  { key: 'google', label: 'Google' },
]
const signedWith = computed(() =>
  PROVIDERS.filter((p) => user.value.providers.includes(p.key))
    .map((p) => p.label)
    .join(' and ')
)

/* ── League accounts ──────────────────────────────────────────────── */

const removing = ref<string | null>(null)
async function removeAccount(puuid: string) {
  if (await apply({ type: 'removeAccount', puuid })) removing.value = null
}

/* ── Favorites and folders ────────────────────────────────────────── */

const folder = ref<string>('all')
const folderOptions = computed(() => [
  { value: 'all', label: 'All', note: String(account.value.favorites.length) },
  ...account.value.folders.map((f) => ({
    value: f.id,
    label: f.name,
    note: String(account.value.favorites.filter((p) => p.folderId === f.id).length),
  })),
])
const current = computed(() => account.value.folders.find((f) => f.id === folder.value) ?? null)
const shown = computed(() =>
  current.value
    ? account.value.favorites.filter((p) => p.folderId === current.value!.id)
    : account.value.favorites
)
const moveOptions = computed(() => [
  { value: '', label: 'No folder' },
  ...account.value.folders.map((f) => ({ value: f.id, label: f.name })),
])

/** The folder name being typed: for a new folder, or the open one's new name. */
const editing = ref<'new' | 'rename' | null>(null)
const draft = ref('')
const field = ref<HTMLInputElement>()
async function edit(kind: 'new' | 'rename') {
  editing.value = kind
  draft.value = kind === 'rename' ? (current.value?.name ?? '') : ''
  await nextTick()
  field.value?.focus()
}
async function saveFolder() {
  const name = draft.value.trim()
  if (!name || !editing.value) return
  if (editing.value === 'new') {
    const id = crypto.randomUUID()
    if (await apply({ type: 'createFolder', id, name })) {
      editing.value = null
      folder.value = id
    }
  } else if (current.value && (await apply({ type: 'renameFolder', id: current.value.id, name }))) {
    editing.value = null
  }
}
async function dropFolder() {
  if (!current.value) return
  if (await apply({ type: 'deleteFolder', id: current.value.id })) folder.value = 'all'
}
const moveTo = (puuid: string, value: string) =>
  apply({ type: 'moveFavorite', puuid, folderId: value || null })

/* ── Apps, name, deletion ─────────────────────────────────────────── */

const OS: Record<string, string> = { windows: 'Windows', macos: 'macOS' }

const naming = ref(false)
const name = ref('')
async function saveName() {
  if (await apply({ type: 'rename', name: name.value })) naming.value = false
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
  <Head title="Account" />
  <SiteLayout>
    <div class="wrap">
      <Masthead title="Account" :meta="`${user.name}, signed in with ${signedWith}`">
        <template #end>
          <form method="post" action="/signout">
            <button type="submit" class="btn sm"><Icon name="logout" />Sign out</button>
          </form>
        </template>
      </Masthead>

      <p v-if="notice" class="ac-err ac-notice" role="alert">{{ notice }}</p>

      <div class="ac-grid">
        <div class="ac-main">
          <section id="accounts" class="card ac-card">
            <CardHead
              title="League accounts"
              icon="users"
              :meta="account.accounts.length ? String(account.accounts.length) : null"
            />
            <template v-if="account.accounts.length">
              <AccountRow v-for="p in account.accounts" :key="p.puuid" :profile="p">
                <template v-if="removing === p.puuid">
                  <span class="ac-ask">Remove it?</span>
                  <button
                    type="button"
                    class="btn sm"
                    :disabled="busy"
                    @click="removeAccount(p.puuid)"
                  >
                    Remove
                  </button>
                  <button type="button" class="btn sm ghost" @click="removing = null">
                    Cancel
                  </button>
                </template>
                <template v-else>
                  <span v-if="p.puuid === account.mainPuuid" class="ac-main-tag">Main</span>
                  <button
                    v-else
                    type="button"
                    class="btn sm ghost ac-reveal"
                    :disabled="busy"
                    @click="apply({ type: 'main', puuid: p.puuid })"
                  >
                    Make main
                  </button>
                  <button
                    type="button"
                    class="btn sm ico ghost ac-reveal"
                    :aria-label="`Not mine: remove ${p.gameName}#${p.tagLine}`"
                    title="Not mine"
                    :disabled="busy"
                    @click="removing = p.puuid"
                  >
                    <Icon name="x" />
                  </button>
                </template>
              </AccountRow>
              <p class="ac-foot">
                Sign in to League with Invade open and the account joins this list.
              </p>
            </template>
            <EmptyState
              v-else
              icon="users"
              title="No League account yet"
              line="Connect the desktop app, then sign in to League: each account you play on joins this list."
            >
              <Link v-if="!account.devices.length" class="btn sm" href="/app" prefetch
                ><Icon name="download" />Get the app</Link
              >
            </EmptyState>
          </section>

          <section id="favorites" class="card ac-card">
            <CardHead
              title="Favorites"
              icon="star"
              :meta="account.favorites.length ? String(account.favorites.length) : null"
            >
              <button
                type="button"
                class="btn sm ghost"
                :disabled="busy || account.folders.length >= ACCOUNT_LIMITS.folders"
                @click="edit('new')"
              >
                <Icon name="plus" />New folder
              </button>
            </CardHead>

            <form
              v-if="editing"
              class="ac-form"
              @submit.prevent="saveFolder"
              @keydown.esc="editing = null"
            >
              <label class="field">
                <Icon name="layers" />
                <input
                  ref="field"
                  v-model="draft"
                  :maxlength="ACCOUNT_LIMITS.folderName"
                  :aria-label="editing === 'new' ? 'New folder name' : 'Folder name'"
                  placeholder="Folder name"
                />
              </label>
              <button type="submit" class="btn sm" :disabled="busy || !draft.trim()">
                {{ editing === 'new' ? 'Create' : 'Save' }}
              </button>
              <button type="button" class="btn sm ghost" @click="editing = null">Cancel</button>
            </form>

            <div v-if="account.folders.length" class="ac-folders">
              <div class="ac-seg">
                <Segmented v-model="folder" :options="folderOptions" label="Folders" />
              </div>
              <span v-if="current && !editing" class="ac-folder-acts">
                <button type="button" class="btn sm ghost" :disabled="busy" @click="edit('rename')">
                  Rename
                </button>
                <button type="button" class="btn sm ghost" :disabled="busy" @click="dropFolder">
                  Delete folder
                </button>
              </span>
            </div>

            <template v-if="shown.length">
              <AccountRow v-for="p in shown" :key="p.puuid" :profile="p">
                <Select
                  v-if="account.folders.length"
                  class="ac-move"
                  :model-value="p.folderId ?? ''"
                  :options="moveOptions"
                  width="12rem"
                  align="right"
                  @update:model-value="(v: string) => moveTo(p.puuid, v)"
                />
                <button
                  type="button"
                  class="ac-star on"
                  :aria-label="`Remove ${p.gameName}#${p.tagLine} from favorites`"
                  title="Remove from favorites"
                  :disabled="busy"
                  @click="apply({ type: 'removeFavorite', puuid: p.puuid })"
                >
                  <Icon name="star" :size="16" />
                </button>
              </AccountRow>
            </template>
            <EmptyState
              v-else-if="account.favorites.length"
              icon="layers"
              title="This folder is empty"
              line="Move a player here from All."
            />
            <EmptyState
              v-else
              icon="star"
              title="No favorite players yet"
              line="Star a player on their profile to keep them here and in the app."
            />
          </section>
        </div>

        <aside class="ac-side">
          <section id="apps" class="card ac-card">
            <CardHead title="Desktop app" icon="download" />
            <template v-if="account.devices.length">
              <div v-for="d in account.devices" :key="d.id" class="ac-line">
                <span class="ac-line-t">
                  <b>{{ OS[d.os] ?? d.os }}</b>
                  <span
                    >Invade {{ d.app
                    }}<template v-if="d.lastSeenAt"
                      >, seen {{ since(Date.parse(d.lastSeenAt)) }}</template
                    ></span
                  >
                </span>
                <button
                  type="button"
                  class="btn sm ghost"
                  :disabled="busy"
                  @click="apply({ type: 'unlinkDevice', deviceId: d.id })"
                >
                  Disconnect
                </button>
              </div>
            </template>
            <EmptyState
              v-else
              icon="download"
              title="Not connected"
              line="In the app, choose Sign in under your profile picture."
            />
          </section>

          <section class="card ac-card">
            <CardHead title="Sign-in" icon="user" />
            <div v-for="p in PROVIDERS" :key="p.key" class="ac-line">
              <span class="ac-line-t ac-prov">
                <DiscordMark v-if="p.key === 'discord'" :size="18" />
                <GoogleMark v-else :size="16" />
                <b>{{ p.label }}</b>
              </span>
              <span v-if="user.providers.includes(p.key)" class="ac-quiet">Connected</span>
              <a
                v-else-if="providers[p.key]"
                class="btn sm ghost"
                :href="`/auth/${p.key}?next=/account`"
                >Add</a
              >
            </div>
            <div class="ac-line">
              <span v-if="!naming" class="ac-line-t">
                <b>Name</b>
                <span>{{ user.name }}</span>
              </span>
              <form
                v-else
                class="ac-form ac-form-in"
                @submit.prevent="saveName"
                @keydown.esc="naming = false"
              >
                <label class="field">
                  <input
                    v-model="name"
                    :maxlength="ACCOUNT_LIMITS.displayName"
                    aria-label="Name"
                    autofocus
                  />
                </label>
                <button type="submit" class="btn sm" :disabled="busy || !name.trim()">Save</button>
              </form>
              <button
                v-if="!naming"
                type="button"
                class="btn sm ghost"
                @click="((name = user.name), (naming = true))"
              >
                Edit
              </button>
            </div>
          </section>

          <section class="card ac-card">
            <CardHead title="Delete account" />
            <p class="ac-text">
              Your favorites, folders and the list of your League accounts go. Your games and
              profiles stay on invade.lol.
            </p>
            <div class="ac-del">
              <button v-if="!deleting" type="button" class="btn sm" @click="deleting = true">
                Delete account
              </button>
              <template v-else>
                <button type="button" class="btn sm ac-danger" :disabled="busy" @click="removeAll">
                  Delete for good
                </button>
                <button type="button" class="btn sm ghost" @click="deleting = false">Cancel</button>
              </template>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </SiteLayout>
</template>
