<script setup lang="ts">
import { ref } from 'vue'
import { Check, Share2 } from 'lucide-vue-next'

/** Shares the page: the phone's own share sheet where there is one, else copies its address. */
const props = defineProps<{ title: string; url: string }>()
const copied = ref(false)

async function share() {
  if (
    typeof navigator !== 'undefined' &&
    'share' in navigator &&
    matchMedia('(pointer: coarse)').matches
  ) {
    await navigator.share({ title: props.title, url: props.url }).catch(() => {})
    return
  }
  await navigator.clipboard?.writeText(props.url).catch(() => {})
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}
</script>

<template>
  <button type="button" class="iv-btn sm" @click="share">
    <Check v-if="copied" :size="13" aria-hidden="true" /><Share2
      v-else
      :size="13"
      aria-hidden="true"
    />{{ copied ? 'Link copied' : 'Share' }}
  </button>
</template>
