<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { Icon } from '@invadelol/ui'
import AccountMenu from './account/AccountMenu.vue'

/**
 * The header's two ways in, joined in one well: the desktop app, and signing in (the lit key,
 * carrying three champions from the sign-in page's wall). Signed in, the account menu follows.
 */
const page = usePage()
const onApp = computed(() => page.url.split('?')[0] === '/app')
const signedIn = computed(() => !!page.props.viewer)
const signin = computed(() =>
  page.url.startsWith('/signin') ? '/signin' : `/signin?next=${encodeURIComponent(page.url)}`
)
const FACES = [103, 222, 157]
</script>

<template>
  <div class="hc">
    <div class="hc-well">
      <Link
        href="/app"
        class="hc-key"
        :class="{ on: onApp }"
        :aria-current="onApp ? 'page' : undefined"
      >
        <Icon name="download" :size="14" /><span class="hc-label">App</span>
      </Link>
      <Link v-if="!signedIn" :href="signin" class="hc-key lit">
        Sign in
        <span class="hc-faces" aria-hidden="true"
          ><img v-for="c in FACES" :key="c" :src="`/cdn/champion/${c}.png`" alt=""
        /></span>
      </Link>
    </div>
    <AccountMenu v-if="signedIn" />
  </div>
</template>

<style scoped>
.hc {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hc-well {
  display: flex;
  gap: 3px;
  padding: 3px;
  background: var(--inset);
  border-radius: 7px;
  box-shadow: var(--inset-shadow);
}
.hc-key {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 13px;
  font: 600 13px var(--font);
  color: var(--text-2);
  text-decoration: none;
  border-radius: var(--r-sm);
  transition:
    color var(--t-fast),
    background-color var(--t-fast);
}
.hc-key:hover,
.hc-key.on {
  color: var(--text-1);
  background: var(--key);
  box-shadow: var(--key-shadow);
}
.hc-key.lit {
  gap: 9px;
  padding: 0 6px 0 14px;
  color: var(--on-brand);
  background: var(--primary);
  box-shadow: var(--primary-shadow);
}
.hc-key.lit:hover {
  background: var(--primary-hover);
}
/* Three champions from the sign-in wall; they part a little on hover. */
.hc-faces {
  display: flex;
}
.hc-faces img {
  width: 22px;
  height: 22px;
  object-fit: cover;
  border-radius: var(--r-xs);
  box-shadow: 0 0 0 2px var(--brand);
  transition: transform var(--t-slow) var(--ease);
}
.hc-faces img + img {
  margin-left: -8px;
}
.hc-key.lit:hover .hc-faces img:nth-child(1) {
  transform: translateX(-3px);
}
.hc-key.lit:hover .hc-faces img:nth-child(3) {
  transform: translateX(3px);
}

@media (prefers-reduced-motion: reduce) {
  .hc-faces img {
    transition: none;
  }
}
@media (max-width: 640px) {
  .hc-label {
    display: none;
  }
  .hc-key:not(.lit) {
    padding: 0 10px;
  }
  .hc-faces img + img {
    display: none;
  }
}
</style>
