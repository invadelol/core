<script setup lang="ts">
/** Map objectives as line glyphs (24 × 24, 1.8 stroke), the desktop app's set. */
defineProps<{ name: 'tower' | 'inhib' | 'dragon' | 'grubs' | 'herald' | 'baron'; size?: number }>()
const P: Record<string, string> = {
  tower:
    '<path d="M7 21h10"/><path d="M8.5 21V11h7v10"/><path d="M6.5 11h11l-1.2-4.5H7.7z"/><path d="M9.5 6.5V3h5v3.5"/>',
  inhib: '<path d="M12 2.8 18.5 12 12 21.2 5.5 12z"/><path d="M12 7.5 15.2 12 12 16.5 8.8 12z"/>',
  dragon:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  grubs:
    '<path d="M6 15a6 6 0 0 0 12 0c0-3.3-2.7-7-6-7s-6 3.7-6 7z"/><path d="M9 8 7.5 4.5"/><path d="M15 8l1.5-3.5"/><path d="M6.3 13H3"/><path d="M17.7 13H21"/><path d="M12 12v9"/>',
  herald:
    '<path d="M2 12.3a1 1 0 0 1 0-.7 10.8 10.8 0 0 1 20 0 1 1 0 0 1 0 .7 10.8 10.8 0 0 1-20 0"/><circle cx="12" cy="12" r="3"/>',
  baron:
    '<path d="M11.6 3.3a.5.5 0 0 1 .8 0l3 5.6a1 1 0 0 0 1.5.3l4.3-3.7a.5.5 0 0 1 .8.5l-2.8 10.3a1 1 0 0 1-1 .7H5.8a1 1 0 0 1-1-.7L2 6a.5.5 0 0 1 .8-.5l4.3 3.7a1 1 0 0 0 1.5-.3z"/><path d="M5 21h14"/>',
}
</script>

<template>
  <svg
    :width="size ?? 14"
    :height="size ?? 14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="P[name]"
  />
</template>
