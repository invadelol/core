<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { X, Copy, Download, Check } from 'lucide-vue-next'
import { championSplash, profileIcon } from '../lib/assets.js'
import type { Summoner, GlobalStats } from '../lib/types.js'
const props = defineProps<{ profile: Summoner; stats: GlobalStats | null; champion?: number }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const includeStats = ref(true)
const message = ref('')
const busy = ref(false)
const url = ref('')
const cells = computed(() => [
  { name: 'WIN RATE', value: `${Math.round((props.stats?.winrate ?? 0) * 100)}%` },
  { name: 'KDA', value: props.stats?.kda.toFixed(2) ?? '—' },
  { name: 'CS / MIN', value: props.stats?.csMin.toFixed(1) ?? '—' },
])
onMounted(() => {
  url.value = `${location.origin}/${encodeURIComponent(`${props.profile.gameName}-${props.profile.tagLine}`)}`
  dialog.value?.showModal()
})
onBeforeUnmount(() => dialog.value?.close())
async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    message.value = 'Link copied'
  } catch {
    message.value = 'Select and copy the link below.'
  }
}
async function download() {
  busy.value = true
  message.value = ''
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#161c27'
    ctx.fillRect(0, 0, 1200, 630)
    if (props.champion) {
      const img = new Image()
      img.src = championSplash(props.champion)
      await img.decode()
      const scale = Math.max(1200 / img.width, 630 / img.height)
      ctx.drawImage(
        img,
        (1200 - img.width * scale) / 2,
        (630 - img.height * scale) / 2,
        img.width * scale,
        img.height * scale
      )
    }
    const shade = ctx.createLinearGradient(0, 0, 1200, 630)
    shade.addColorStop(0, 'rgba(12,18,30,.68)')
    shade.addColorStop(1, 'rgba(12,18,30,.95)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, 1200, 630)
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 24px Inter, sans-serif'
    ctx.fillText('invade.lol', 64, 74)
    ctx.font = '600 64px Inter, sans-serif'
    ctx.fillText(props.profile.gameName, 64, 270)
    ctx.font = '28px Inter, sans-serif'
    ctx.fillStyle = '#c5cbd5'
    ctx.fillText(`#${props.profile.tagLine}  ·  ${props.profile.platform}`, 64, 320)
    if (includeStats.value && props.stats)
      cells.value.forEach((cell, i) => {
        ctx.fillStyle = '#ffffff'
        ctx.font = '600 48px Inter, sans-serif'
        ctx.fillText(cell.value, 64 + i * 300, 460)
        ctx.fillStyle = '#c5cbd5'
        ctx.font = '18px Inter, sans-serif'
        ctx.fillText(cell.name, 64 + i * 300, 497)
      })
    ctx.font = '18px Inter, sans-serif'
    ctx.fillStyle = '#c5cbd5'
    ctx.fillText('YOUR GAME. A CLEARER PICTURE.', 64, 578)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error())), 'image/png')
    )
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `${props.profile.gameName}-invade.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
    message.value = 'Card downloaded'
  } catch {
    message.value = 'Could not create the image. You can still copy your profile link.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <dialog
    ref="dialog"
    class="share-dialog"
    aria-labelledby="share-title"
    @cancel.prevent="emit('close')"
    @click="
      (e: MouseEvent) => {
        if (e.target === dialog) emit('close')
      }
    "
  >
    <div class="share-dialog-head">
      <div>
        <span class="eyebrow">MADE TO BE SHARED</span>
        <h2 id="share-title">Your game, on a card.</h2>
      </div>
      <button class="icon-button" aria-label="Close share dialog" @click="emit('close')">
        <X :size="20" />
      </button>
    </div>
    <div
      class="share-preview"
      :style="
        champion
          ? {
              backgroundImage: `linear-gradient(90deg,rgba(12,18,30,.86),rgba(12,18,30,.5)),url(${championSplash(champion)})`,
            }
          : {}
      "
    >
      <strong class="share-brand">invade<span>.lol</span></strong>
      <div class="share-player">
        <img :src="profileIcon(profile.profileIconId)" alt="" />
        <div>
          <h3>{{ profile.gameName }}</h3>
          <p>#{{ profile.tagLine }} · {{ profile.platform }}</p>
        </div>
      </div>
      <div v-if="includeStats && stats" class="share-stats">
        <div v-for="cell in cells" :key="cell.name">
          <strong>{{ cell.value }}</strong
          ><span>{{ cell.name }}</span>
        </div>
      </div>
      <span class="share-tagline">YOUR GAME. A CLEARER PICTURE.</span>
    </div>
    <label class="share-option"
      ><input v-model="includeStats" type="checkbox" /> Include performance statistics</label
    ><label class="share-link"
      >Profile link<input
        :value="url"
        readonly
        @focus="($event.target as HTMLInputElement).select()"
    /></label>
    <div class="share-dialog-actions">
      <span role="status">{{ message }}</span
      ><button class="btn" @click="copy">
        <Check v-if="message === 'Link copied'" :size="14" /><Copy v-else :size="14" /> Copy link</button
      ><button class="btn btn-primary" :disabled="busy" @click="download">
        <Download :size="14" />{{ busy ? 'Creating…' : 'Download card' }}
      </button>
    </div>
  </dialog>
</template>
