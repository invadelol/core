<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { Icon, Logo } from '@invadelol/ui'
import AccountMenu from './account/AccountMenu.vue'

/**
 * The header's two ways in: the desktop app, and signing in (the account menu once signed in).
 * Three candidate designs, picked with `?hv=1|2|3` while we choose (default 1).
 */
const page = usePage()
const onApp = computed(() => page.url.split('?')[0] === '/app')
const signedIn = computed(() => !!page.props.viewer)
const variant = computed(() => {
  const v = new URLSearchParams(page.url.split('?')[1] ?? '').get('hv')
  return v === '2' || v === '3' ? Number(v) : 1
})
const signin = computed(() =>
  page.url.startsWith('/signin') ? '/signin' : `/signin?next=${encodeURIComponent(page.url)}`
)
/** The visitor's OS (after mount: the server can't know). */
const os = ref<'mac' | 'win' | ''>('')
onMounted(() => {
  const ua = navigator.userAgent
  os.value = /Mac/.test(ua) ? 'mac' : /Win/.test(ua) ? 'win' : ''
})
const osName = computed(() =>
  os.value === 'mac' ? 'macOS' : os.value === 'win' ? 'Windows' : 'desktop'
)
</script>

<template>
  <!-- 1 · Store badges: two lines, a tile on the left. -->
  <div v-if="variant === 1" class="hc hc1">
    <Link
      href="/app"
      class="hc1-badge"
      :class="{ on: onApp }"
      :aria-current="onApp ? 'page' : undefined"
    >
      <span class="hc1-tile"><Logo :size="15" /></span>
      <span class="hc1-text"
        ><small>Free for {{ osName }}</small
        ><b>Desktop app</b></span
      >
    </Link>
    <Link v-if="!signedIn" :href="signin" class="hc1-badge lit">
      <span class="hc1-tile"><img :src="'/cdn/champion/103.png'" alt="" /></span>
      <span class="hc1-text"><small>Your accounts</small><b>Sign in</b></span>
    </Link>
    <AccountMenu v-else />
  </div>

  <!-- 2 · Slots: a tile and a word, like an inventory. -->
  <div v-else-if="variant === 2" class="hc hc2">
    <Link
      href="/app"
      class="hc2-item"
      :class="{ on: onApp }"
      :aria-current="onApp ? 'page' : undefined"
    >
      <span class="hc2-key"><Logo :size="15" /></span><span class="hc-label">App</span>
    </Link>
    <Link v-if="!signedIn" :href="signin" class="hc2-item signin">
      <span class="hc2-slot"
        ><Icon name="user" :size="15" /><img :src="'/cdn/champion/103.png'" alt=""
      /></span>
      Sign in
    </Link>
    <AccountMenu v-else />
  </div>

  <!-- 3 · Brand marks: your OS on the app, the providers on sign in. -->
  <div v-else class="hc hc3">
    <Link
      href="/app"
      class="hc3-btn"
      :class="{ on: onApp }"
      :aria-current="onApp ? 'page' : undefined"
    >
      <svg
        v-if="os === 'mac'"
        width="14"
        height="16"
        viewBox="0 0 384 512"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
        />
      </svg>
      <svg
        v-else-if="os === 'win'"
        width="14"
        height="14"
        viewBox="0 0 448 512"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"
        />
      </svg>
      <Icon v-else name="download" :size="14" />
      <span class="hc-label">Download</span>
    </Link>
    <Link v-if="!signedIn" :href="signin" class="hc3-btn lit">
      Sign in
      <span class="hc3-marks" aria-hidden="true">
        <i
          ><svg width="11" height="9" viewBox="0 0 127 96" fill="#5865f2">
            <path
              d="M107.7 8.1a105.2 105.2 0 0 0-26-8.1 72.1 72.1 0 0 0-3.3 6.8 97.7 97.7 0 0 0-29 0A73 73 0 0 0 46 0a105 105 0 0 0-26 8.1C3.5 32.7-1 56.7 1.3 80.3a106 106 0 0 0 32 16.2 79 79 0 0 0 6.6-10.7 68 68 0 0 1-10.4-5c.9-.6 1.7-1.3 2.5-1.9a75 75 0 0 0 63.3 0c.8.6 1.7 1.3 2.5 1.9a68 68 0 0 1-10.4 5A79 79 0 0 0 94 96.5a106 106 0 0 0 32-16.2c2.7-27.3-4.6-51-18.3-72.2ZM42.5 65.8c-6.2 0-11.3-5.7-11.3-12.7 0-7 5-12.7 11.3-12.7 6.3 0 11.4 5.7 11.3 12.7 0 7-5 12.7-11.3 12.7Zm41.9 0c-6.2 0-11.3-5.7-11.3-12.7 0-7 5-12.7 11.3-12.7 6.3 0 11.4 5.7 11.3 12.7 0 7-5 12.7-11.3 12.7Z"
            /></svg></i
        ><i
          ><svg width="10" height="10" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
            /></svg
        ></i>
      </span>
    </Link>
    <AccountMenu v-else />
  </div>
</template>

<style scoped>
.hc {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hc a {
  text-decoration: none;
}

/* ── 1 · Store badges ───────────────────────────────────────── */
.hc1-badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 40px;
  padding: 0 14px 0 5px;
  color: var(--text-1);
  background: var(--btn);
  border-radius: var(--r-md);
  box-shadow: var(--btn-shadow);
  transition: background-color var(--t-fast);
}
.hc1-badge:hover {
  background: var(--btn-hover);
}
.hc1-badge.lit {
  color: var(--on-brand);
  background: var(--primary);
  box-shadow: var(--primary-shadow);
}
.hc1-badge.lit:hover {
  background: var(--primary-hover);
}
.hc1-tile {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  overflow: hidden;
  background: var(--ink-0);
  border-radius: var(--r-sm);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
}
.hc1-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hc1-text {
  display: grid;
  line-height: 1.1;
}
.hc1-text small {
  font-size: 10.5px;
  font-weight: 500;
  opacity: 0.7;
}
.hc1-text b {
  font-size: 13.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

/* ── 2 · Slots ──────────────────────────────────────────────── */
.hc2 {
  gap: 4px;
}
.hc2-item {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 40px;
  padding: 0 12px 0 5px;
  font: 600 13px var(--font);
  color: var(--text-1);
  border-radius: var(--r-md);
  transition: background-color var(--t-fast);
}
.hc2-item:hover,
.hc2-item.on {
  background: var(--surface-2);
}
.hc2-key,
.hc2-slot {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-sm);
}
.hc2-key {
  background: var(--key);
  box-shadow: var(--key-shadow);
}
/* An empty profile slot, lit violet from inside; a champion takes it on hover. */
.hc2-slot {
  overflow: hidden;
  color: var(--brand-hi);
  background: var(--well);
  box-shadow:
    var(--inset-shadow),
    inset 0 0 0 1px var(--brand-a28),
    inset 0 -8px 14px -6px rgb(var(--brand-rgb) / 0.45);
}
.hc2-slot img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.15);
  transition:
    opacity var(--t-slow) var(--ease),
    transform var(--t-slow) var(--ease);
}
.hc2-item.signin:hover .hc2-slot img {
  opacity: 1;
  transform: none;
}
.hc2-item.signin {
  color: var(--brand-hi);
}

/* ── 3 · Brand marks ────────────────────────────────────────── */
.hc3-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 13px;
  font: 600 13px var(--font);
  color: var(--text-1);
  background: var(--btn);
  border-radius: var(--r-sm);
  box-shadow: var(--btn-shadow);
  transition: background-color var(--t-fast);
}
.hc3-btn:hover {
  background: var(--btn-hover);
}
.hc3-btn.lit {
  gap: 10px;
  padding: 0 7px 0 14px;
  color: var(--on-brand);
  background: var(--primary);
  box-shadow: var(--primary-shadow);
}
.hc3-btn.lit:hover {
  background: var(--primary-hover);
}
.hc3-marks {
  display: flex;
}
.hc3-marks i {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--brand);
}
.hc3-marks i + i {
  margin-left: -5px;
}

@media (prefers-reduced-motion: reduce) {
  .hc * {
    transition: none !important;
  }
}
@media (max-width: 640px) {
  .hc-label,
  .hc1-text small {
    display: none;
  }
  .hc1-badge:not(.lit) .hc1-text {
    display: none;
  }
  .hc1-badge:not(.lit) {
    padding: 0 5px;
  }
  .hc2-item:not(.signin) {
    padding: 0 5px;
  }
  .hc3-btn:not(.lit) {
    padding: 0 10px;
  }
}
</style>
