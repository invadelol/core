<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { Icon } from '@invadelol/ui'
import AccountMenu from './account/AccountMenu.vue'

/**
 * The header's two ways in: download the desktop app (with the visitor's OS mark), and sign in
 * (carrying the Discord and Google marks it offers). Signed in, the account menu takes its place.
 */
const page = usePage()
const onApp = computed(() => page.url.split('?')[0] === '/app')
const signedIn = computed(() => !!page.props.viewer)
const signin = computed(() =>
  page.url.startsWith('/signin') ? '/signin' : `/signin?next=${encodeURIComponent(page.url)}`
)
/** The visitor's OS (after mount: the server can't know). */
const os = ref<'mac' | 'win' | ''>('')
onMounted(() => {
  const ua = navigator.userAgent
  os.value = /Mac/.test(ua) ? 'mac' : /Win/.test(ua) ? 'win' : ''
})
</script>

<template>
  <!-- Your OS on the app, the providers on sign in. -->
  <div class="hc">
    <Link
      href="/app"
      class="hc-btn"
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
    <Link v-if="!signedIn" :href="signin" class="hc-btn lit">
      Sign in
      <span class="hc-marks" aria-hidden="true">
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

.hc-btn {
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
.hc-btn:hover {
  background: var(--btn-hover);
}
.hc-btn.lit {
  gap: 10px;
  padding: 0 7px 0 14px;
  color: var(--on-brand);
  background: var(--primary);
  box-shadow: var(--primary-shadow);
}
.hc-btn.lit:hover {
  background: var(--primary-hover);
}
.hc-marks {
  display: flex;
}
.hc-marks i {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--brand);
}
.hc-marks i + i {
  margin-left: -5px;
}

@media (prefers-reduced-motion: reduce) {
  .hc * {
    transition: none !important;
  }
}
@media (max-width: 640px) {
  .hc-label {
    display: none;
  }
  .hc-btn:not(.lit) {
    padding: 0 10px;
  }
}
</style>
