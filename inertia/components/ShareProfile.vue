<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Copy, Download, X } from 'lucide-vue-next'
import { championSplash, profileIcon, regionLabel } from '../lib/assets.js'
import type { GlobalStats, Summoner } from '../lib/types.js'

const props = defineProps<{ profile: Summoner; stats: GlobalStats | null; champion?: number }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()
const includeStats = ref(true)
const message = ref('')
const copied = ref(false)
const busy = ref(false)
const url = ref('')

const cells = computed(() => [
  { name: 'Win rate', value: `${Math.round((props.stats?.winrate ?? 0) * 100)}%` },
  { name: 'KDA', value: props.stats?.kda.toFixed(2) ?? '—' },
  { name: 'CS per minute', value: props.stats?.csMin.toFixed(1) ?? '—' },
])

onMounted(() => {
  url.value = `${location.origin}/${encodeURIComponent(`${props.profile.gameName}-${props.profile.tagLine}`)}`
  dialog.value?.showModal()
})

onBeforeUnmount(() => dialog.value?.close())

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
    message.value = 'Link copied'
    setTimeout(() => (copied.value = false), 2000)
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
    ctx.fillStyle = '#0d0e13'
    ctx.fillRect(0, 0, 1200, 630)
    /* The main champion on the right, faded into the ink: the same treatment as the profile. */
    if (props.champion) {
      const img = new Image()
      img.src = championSplash(props.champion)
      await img.decode()
      const w = 820
      const scale = Math.max(w / img.width, 630 / img.height)
      ctx.globalAlpha = 0.42
      ctx.drawImage(
        img,
        1200 - img.width * scale,
        (630 - img.height * scale) / 2.4,
        img.width * scale,
        img.height * scale
      )
      ctx.globalAlpha = 1
      const fade = ctx.createLinearGradient(380, 0, 900, 0)
      fade.addColorStop(0, 'rgba(13,14,19,1)')
      fade.addColorStop(1, 'rgba(13,14,19,0)')
      ctx.fillStyle = fade
      ctx.fillRect(0, 0, 1200, 630)
    }
    ctx.fillStyle = '#ececf3'
    ctx.font = '600 26px Archivo, Inter, sans-serif'
    ctx.fillText('invade.lol', 64, 80)
    ctx.font = '600 68px Archivo, Inter, sans-serif'
    ctx.fillText(props.profile.gameName, 64, 280)
    ctx.font = '500 28px Archivo, Inter, sans-serif'
    ctx.fillStyle = '#a6a7b8'
    ctx.fillText(`#${props.profile.tagLine}  ·  ${regionLabel(props.profile.platform)}`, 64, 326)
    if (includeStats.value && props.stats)
      cells.value.forEach((cell, i) => {
        ctx.fillStyle = '#ececf3'
        ctx.font = '700 56px Archivo, Inter, sans-serif'
        ctx.fillText(cell.value, 64 + i * 280, 470)
        ctx.fillStyle = '#a6a7b8'
        ctx.font = '500 22px Archivo, Inter, sans-serif'
        ctx.fillText(cell.name, 64 + i * 280, 506)
      })
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
    message.value = 'Could not create the image. You can still copy the link.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="share m-auto w-[min(560px,calc(100%-24px))] p-0 text-ink backdrop:bg-black/60"
    aria-labelledby="share-title"
    @cancel.prevent="emit('close')"
    @click="
      (e: MouseEvent) => {
        if (e.target === dialog) emit('close')
      }
    "
  >
    <div class="flex items-center px-5 pb-1 pt-4">
      <h2 id="share-title" class="text-[16px] font-semibold">Share this profile</h2>
      <button class="icon-btn ml-auto" aria-label="Close" @click="emit('close')">
        <X :size="16" />
      </button>
    </div>

    <div class="px-5 pb-5 pt-3">
      <!-- The card as it will be downloaded: always on night ink, like the image itself. -->
      <div
        class="relative isolate aspect-[1200/630] overflow-hidden rounded-[8px] bg-[#0d0e13] p-[5.3%] text-[#ececf3]"
      >
        <img
          v-if="champion"
          :src="championSplash(champion)"
          alt=""
          class="card-splash absolute inset-y-0 right-0 -z-10 h-full w-[68%] object-cover object-[60%_22%]"
        />

        <span class="block text-[clamp(11px,2.2vw,13px)] font-semibold">invade.lol</span>

        <div class="mt-[9%] flex items-center gap-3">
          <img
            :src="profileIcon(profile.profileIconId)"
            alt=""
            class="h-[clamp(36px,9vw,48px)] w-[clamp(36px,9vw,48px)] rounded-[8px]"
          />
          <div class="min-w-0">
            <h3 class="truncate text-[clamp(20px,5vw,30px)] font-semibold leading-none">
              {{ profile.gameName }}
            </h3>
            <p class="num mt-1 text-[12px] text-[#a6a7b8]">
              #{{ profile.tagLine }} · {{ regionLabel(profile.platform) }}
            </p>
          </div>
        </div>

        <div v-if="includeStats && stats" class="mt-[7%] flex gap-[8%]">
          <div v-for="cell in cells" :key="cell.name">
            <div class="fig text-[clamp(18px,4.4vw,26px)]">{{ cell.value }}</div>
            <div class="mt-1 text-[12px] text-[#a6a7b8]">{{ cell.name }}</div>
          </div>
        </div>
      </div>

      <label class="mt-4 flex items-center gap-2 text-[13px] text-ink-2">
        <input v-model="includeStats" type="checkbox" class="accent-[var(--color-brand)]" />
        Include performance statistics
      </label>

      <label class="mt-4 block">
        <span class="label">Profile link</span>
        <input
          :value="url"
          readonly
          class="field mt-1.5"
          @focus="(e) => (e.target as HTMLInputElement).select()"
        />
      </label>

      <div class="mt-5 flex flex-wrap items-center justify-end gap-2">
        <span v-if="message" class="mr-auto text-[12px] text-ink-2" role="status">{{
          message
        }}</span>
        <button class="btn" @click="copy">
          <Check v-if="copied" :size="13" />
          <Copy v-else :size="13" />
          Copy link
        </button>
        <button class="btn btn-primary" :disabled="busy" @click="download">
          <Download :size="13" />
          {{ busy ? 'Rendering…' : 'Download card' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* A dialog is a popover: opaque, a hairline border, the only kind of shadow. */
.share {
  background: var(--color-solid);
  border: 1px solid var(--color-line-2);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-e2);
}

.card-splash {
  opacity: 0.42;
  mask-image: linear-gradient(to right, transparent, #000 60%);
}
</style>
