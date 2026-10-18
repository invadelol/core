<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { Icon } from '@invadelol/ui'
import AccountMenu from './account/AccountMenu.vue'

/**
 * The header's two ways in: the desktop app, and signing in (or the account, once signed in).
 * Three candidate designs, picked with `?hv=1|2|3` while we choose one (default 1).
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
/** The visitor's OS, for the App key's chip (after mount: the server can't know). */
const os = ref('')
onMounted(() => {
  const ua = navigator.userAgent
  os.value = /Mac/.test(ua) ? 'macOS' : /Win/.test(ua) ? 'Windows' : ''
})
const FACES = [103, 222, 157]
/** A real capture of the app (the /app page's), shown in miniature. */
const SHOT = '/app-page/home-1280.webp'
</script>

<template>
  <!-- 1 · Pictures: each button carries a small real picture. -->
  <div v-if="variant === 1" class="hc hc1">
    <Link
      href="/app"
      class="hc1-btn"
      :class="{ on: onApp }"
      :aria-current="onApp ? 'page' : undefined"
    >
      <span class="hc1-shot" aria-hidden="true"><img :src="SHOT" alt="" /></span>
      <span class="hc-label">Desktop app</span>
    </Link>
    <Link v-if="!signedIn" :href="signin" class="hc1-btn primary">
      <span class="hc1-faces" aria-hidden="true"
        ><img v-for="c in FACES" :key="c" :src="`/cdn/champion/${c}.png`" alt=""
      /></span>
      Sign in
    </Link>
    <AccountMenu v-else />
  </div>

  <!-- 2 · Joined: one well, two keys; signing in is the lit one. -->
  <div v-else-if="variant === 2" class="hc hc2">
    <div class="hc2-well">
      <Link
        href="/app"
        class="hc2-key"
        :class="{ on: onApp }"
        :aria-current="onApp ? 'page' : undefined"
      >
        <Icon name="download" :size="14" /><span class="hc-label">App</span>
      </Link>
      <Link v-if="!signedIn" :href="signin" class="hc2-key lit">
        Sign in<Icon name="next" :size="13" class="hc2-arrow" />
      </Link>
    </div>
    <AccountMenu v-if="signedIn" />
  </div>

  <!-- 3 · Keycaps: keys with a skirt that press down, like the search's ⌘K. -->
  <div v-else class="hc hc3">
    <Link
      href="/app"
      class="hc3-key"
      :class="{ on: onApp }"
      :aria-current="onApp ? 'page' : undefined"
    >
      <span class="hc-label">App</span>
      <kbd v-if="os" class="hc3-chip">{{ os }}</kbd>
    </Link>
    <Link v-if="!signedIn" :href="signin" class="hc3-key lit">Sign in</Link>
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

/* ── 1 · Pictures ───────────────────────────────────────────── */
.hc1-btn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 36px;
  padding: 0 14px 0 5px;
  font: 600 13px var(--font);
  color: var(--text-1);
  background: var(--btn);
  border-radius: var(--r-sm);
  box-shadow: var(--btn-shadow);
  transition: background-color var(--t-fast);
}
.hc1-btn:hover {
  background: var(--btn-hover);
}
.hc1-btn.on {
  box-shadow:
    var(--btn-shadow),
    inset 0 0 0 1px var(--brand-a28);
}
.hc1-btn.primary {
  color: var(--on-brand);
  background: var(--primary);
  box-shadow: var(--primary-shadow);
}
.hc1-btn.primary:hover {
  background: var(--primary-hover);
}
/* A window of the app, in miniature: its top-left corner, framed like a capture. */
.hc1-shot {
  position: relative;
  display: block;
  width: 40px;
  height: 26px;
  overflow: hidden;
  background: var(--ink-0);
  border-radius: var(--r-xs);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.1),
    var(--contact);
}
.hc1-shot img {
  position: absolute;
  top: 0;
  left: 0;
  width: 128px;
  max-width: none;
  transition: transform 600ms var(--ease-glide);
}
.hc1-btn:hover .hc1-shot img {
  transform: translate(-36px, -6px);
}
.hc1-faces {
  display: flex;
}
.hc1-faces img {
  width: 26px;
  height: 26px;
  object-fit: cover;
  border-radius: var(--r-xs);
  box-shadow: 0 0 0 2px var(--brand);
  transition: transform var(--t-slow) var(--ease);
}
.hc1-faces img + img {
  margin-left: -9px;
}
.hc1-btn:hover .hc1-faces img:nth-child(1) {
  transform: translateX(-3px);
}
.hc1-btn:hover .hc1-faces img:nth-child(3) {
  transform: translateX(3px);
}

/* ── 2 · Joined ─────────────────────────────────────────────── */
.hc2-well {
  display: flex;
  gap: 3px;
  padding: 3px;
  background: var(--inset);
  border-radius: 7px;
  box-shadow: var(--inset-shadow);
}
.hc2-key {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 13px;
  font: 600 13px var(--font);
  color: var(--text-2);
  border-radius: var(--r-sm);
  transition:
    color var(--t-fast),
    background-color var(--t-fast);
}
.hc2-key:hover,
.hc2-key.on {
  color: var(--text-1);
  background: var(--key);
  box-shadow: var(--key-shadow);
}
.hc2-key.lit {
  padding: 0 12px 0 14px;
  color: var(--on-brand);
  background: var(--primary);
  box-shadow: var(--primary-shadow);
}
.hc2-key.lit:hover {
  background: var(--primary-hover);
}
.hc2-arrow {
  transition: transform var(--t-base) var(--ease);
}
.hc2-key.lit:hover .hc2-arrow {
  transform: translateX(2px);
}

/* ── 3 · Keycaps ────────────────────────────────────────────── */
.hc3 {
  gap: 10px;
  padding-bottom: 3px;
}
.hc3-key {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px;
  font: 600 13px var(--font);
  color: var(--text-1);
  background: var(--key);
  border-radius: var(--r-sm);
  /* The skirt: the key's side, 3px deep, then its contact shadow. */
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.1),
    0 3px 0 var(--solid-1),
    0 3px 0 1px rgb(0 0 0 / 0.35),
    0 6px 10px -2px rgb(0 0 0 / 0.5);
  transform: translateY(-1px);
  transition:
    transform 90ms var(--ease),
    box-shadow 90ms var(--ease),
    background-color var(--t-fast);
}
.hc3-key:hover {
  background: var(--btn-hover);
}
.hc3-key:active {
  transform: translateY(2px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 0 0 var(--solid-1),
    0 0 0 1px rgb(0 0 0 / 0.35),
    0 1px 2px rgb(0 0 0 / 0.5);
}
.hc3-key.on {
  color: var(--brand-hi);
}
.hc3-key.lit {
  color: var(--on-brand);
  background: var(--primary);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.25),
    0 3px 0 color-mix(in srgb, var(--brand) 55%, black),
    0 3px 0 1px rgb(0 0 0 / 0.3),
    0 8px 16px -4px rgb(var(--brand-rgb) / 0.45);
}
.hc3-key.lit:hover {
  background: var(--primary-hover);
}
.hc3-key.lit:active {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.2),
    0 0 0 color-mix(in srgb, var(--brand) 55%, black),
    0 0 0 1px rgb(0 0 0 / 0.3),
    0 2px 4px rgb(0 0 0 / 0.4);
}
.hc3-chip {
  height: 18px;
  padding: 0 5px;
  font: 600 10.5px/18px var(--font);
  color: var(--text-3);
  background: var(--inset);
  border-radius: var(--r-xs);
  box-shadow: var(--inset-shadow);
}

@media (prefers-reduced-motion: reduce) {
  .hc * {
    transition: none !important;
  }
}
@media (max-width: 640px) {
  .hc-label,
  .hc1-shot,
  .hc3-chip {
    display: none;
  }
  .hc1-btn:not(.primary) {
    padding: 0 10px;
  }
  .hc1-btn:not(.primary)::before,
  .hc3-key:not(.lit)::before {
    content: '';
    width: 16px;
    height: 16px;
    background: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 15V3'/%3E%3Cpath d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E")
      center / contain no-repeat;
  }
  .hc1-faces img + img {
    display: none;
  }
}
</style>
