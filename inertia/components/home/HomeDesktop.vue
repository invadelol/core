<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { ChevronRight } from 'lucide-vue-next'
import { Logo } from '@invadelol/ui'
</script>

<template>
  <!-- One line to the desktop app: no pitch, the page it opens has that. -->
  <Link href="/app" class="iv-panel desktop">
    <Logo :size="18" />
    <span class="min-w-0 flex-1 truncate">
      <span class="font-semibold text-ink">Invade for desktop</span>
      <span class="platforms text-ink-3"> · Windows and macOS</span>
    </span>
    <span class="flex shrink-0 items-center gap-1 font-medium text-ink-2">
      Get the app <ChevronRight :size="14" />
    </span>
  </Link>
</template>

<style scoped>
.desktop {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 14px 0 16px;
  font-size: 13px;
  transition: background-color var(--t-fast) var(--ease);
}

.desktop {
  container-type: inline-size;
}

/* The platforms only where the line has room for them (not on a phone, not in the rail). */
@container (max-width: 440px) {
  .platforms {
    display: none;
  }
}

.desktop:hover {
  background: var(--sheen), var(--surface-2);
}
</style>
