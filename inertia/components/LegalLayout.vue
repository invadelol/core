<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import SiteFooter from './SiteFooter.vue'

/** The privacy policy and the legal notice: the site's header and footer around one column of text. */
defineProps<{ title: string; updated?: string | null }>()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main
      class="legal mx-auto w-full max-w-[calc(65ch+3rem)] flex-1 px-4 pt-[clamp(32px,9vh,96px)] sm:px-6"
    >
      <h1 class="text-[28px] font-semibold leading-tight tracking-[-0.012em] text-ink">
        {{ title }}
      </h1>
      <p v-if="updated" class="mt-2 text-[13px] text-ink-3">Last updated {{ updated }}</p>
      <div class="mt-6">
        <slot />
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.legal :deep(h2) {
  margin-top: 36px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-1);
  scroll-margin-top: 80px;
}

.legal :deep(p),
.legal :deep(li) {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-2);
}

.legal :deep(p) {
  margin-top: 12px;
}

.legal :deep(ul) {
  margin-top: 12px;
  padding-left: 1.25rem;
  list-style: disc;
}

.legal :deep(li + li) {
  margin-top: 6px;
}

.legal :deep(li::marker) {
  color: var(--text-4);
}

.legal :deep(strong) {
  font-weight: 600;
  color: var(--text-1);
}

.legal :deep(a) {
  color: var(--text-1);
  text-decoration: underline;
  text-decoration-color: var(--line-3);
  text-underline-offset: 2px;
  overflow-wrap: anywhere;
  transition: text-decoration-color 0.15s;
}

.legal :deep(a:hover) {
  text-decoration-color: currentColor;
}

.legal :deep(.fine) {
  margin-top: 36px;
  font-size: 12px;
  color: var(--text-3);
}
</style>
