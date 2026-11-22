<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import RankEmblem from '../ui/RankEmblem.vue'
import { profileIcon } from '../../lib/assets.js'
import { SERVER, tierColor, tierName } from '../../lib/board.js'
import { profilePath } from '../../lib/format.js'
import { signInHref } from '../../lib/account.js'
import type { Viewer } from '../../lib/account_types.js'

/**
 * The end of the header for accounts: "Sign in" for a visitor; for a signed-in person their main
 * League account's icon, which opens their menu: who they are (the main account and its rank),
 * then their profile, favorites, League accounts, the desktop app and Sign out.
 */
const page = usePage()
const viewer = computed(() => (page.props as { viewer?: Viewer | null }).viewer ?? null)
const main = computed(() => viewer.value?.main ?? null)
const path = computed(() => page.url)

const open = ref(false)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()

const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
const rank = computed(() => {
  const m = main.value
  if (!m?.tier) return null
  return `${tierName(m.tier)}${APEX.has(m.tier) || !m.division ? '' : ` ${m.division}`}`
})
const rankLine = computed(() => {
  const m = main.value
  if (!m) return null
  const server = SERVER[m.platform] ?? m.platform
  return m.tier && m.lp !== null ? `${m.lp} LP, ${server}` : server
})

function toggle() {
  open.value = !open.value
  if (open.value) nextTick(() => root.value?.querySelector<HTMLElement>('.am-r')?.focus())
}

function close(focus = false) {
  open.value = false
  if (focus) button.value?.focus()
}

function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close()
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true)
}
function onFocusOut(event: FocusEvent) {
  const to = event.relatedTarget as Node | null
  if (open.value && to && !root.value?.contains(to)) close()
}

watch(open, (on) => {
  if (on) {
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKey)
  }
})
watch(path, () => close())
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Link
    v-if="!viewer"
    class="btn sm hx-signin"
    :href="signInHref(path)"
    data-track="header_sign_in"
    >Sign in</Link
  >
  <div v-else ref="root" class="hx-acct" @focusout="onFocusOut">
    <button
      ref="button"
      type="button"
      class="hx-me"
      :class="{ open }"
      :aria-label="`Account, ${viewer.name}`"
      aria-haspopup="true"
      :aria-expanded="open"
      aria-controls="hx-menu-account"
      @click="toggle"
    >
      <img v-if="main" class="av" :src="profileIcon(main.profileIconId)" alt="" width="30" height="30" />
      <span v-else class="av none"><Icon name="user" :size="16" /></span>
      <Icon name="chev" :size="13" />
    </button>

    <div v-if="open" id="hx-menu-account" class="hx-menu dm am">
      <div class="am-id">
        <img v-if="main" :src="profileIcon(main.profileIconId)" alt="" width="40" height="40" />
        <span v-else class="av none"><Icon name="user" :size="18" /></span>
        <span class="am-who">
          <b v-if="main" class="ell">{{ main.gameName }}<small>#{{ main.tagLine }}</small></b>
          <b v-else class="ell">{{ viewer.name }}</b>
          <span v-if="main" class="am-rk">
            <RankEmblem :tier="main.tier" :size="16" />
            <span :style="tierColor(main.tier)">{{ rank ?? 'Unranked' }}</span>
            <span class="q num">{{ rankLine }}</span>
          </span>
        </span>
      </div>
      <div class="am-l">
        <Link
          v-if="main"
          class="am-r"
          :href="profilePath(main.gameName, main.tagLine)"
          prefetch
          @click="close()"
          ><Icon name="user" :size="16" />My profile</Link
        >
        <Link class="am-r" href="/account#favorites" @click="close()"
          ><Icon name="star" :size="16" />Favorites<span class="end num">{{
            viewer.favorites
          }}</span></Link
        >
        <Link class="am-r" href="/account#accounts" @click="close()"
          ><Icon name="users" :size="16" />League accounts<span class="end num">{{
            viewer.accounts
          }}</span></Link
        >
        <Link class="am-r" href="/account#apps" @click="close()"
          ><Icon name="download" :size="16" />Desktop app<span class="end">{{
            viewer.apps ? 'Connected' : 'Not connected'
          }}</span></Link
        >
        <Link class="am-r" href="/account" @click="close()"
          ><Icon name="settings" :size="16" />Account</Link
        >
      </div>
      <form class="am-l am-foot" method="post" action="/signout">
        <button type="submit" class="am-r"><Icon name="logout" :size="16" />Sign out</button>
      </form>
    </div>
  </div>
</template>
