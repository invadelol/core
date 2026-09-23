<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Copy, Download, X } from 'lucide-vue-next'
import { championSplash, profileIcon } from '../lib/assets.js'
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
    ctx.fillStyle = '#0a0b0e'
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
    shade.addColorStop(0, 'rgba(8,9,14,.82)')
    shade.addColorStop(1, 'rgba(8,9,14,.96)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, 1200, 630)
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 26px Archivo, Inter, sans-serif'
    ctx.fillText('invade.lol', 64, 78)
    ctx.font = '700 72px Archivo, Inter, sans-serif'
    ctx.fillText(props.profile.gameName, 64, 280)
    ctx.font = '500 28px Archivo, Inter, sans-serif'
    ctx.fillStyle = '#9aa1b2'
    ctx.fillText(`#${props.profile.tagLine}  ·  ${props.profile.platform}`, 64, 328)
    if (includeStats.value && props.stats)
      cells.value.forEach((cell, i) => {
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 56px Archivo, Inter, sans-serif'
        ctx.fillText(cell.value, 64 + i * 300, 470)
        ctx.fillStyle = '#a8adb9'
        ctx.font = '700 17px Archivo, Inter, sans-serif'
        ctx.fillText(cell.name, 64 + i * 300, 505)
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
    class="card m-auto w-[min(560px,calc(100%-24px))] p-0 text-ink shadow-e2 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    aria-labelledby="share-title"
    @cancel.prevent="emit('close')"
    @click="
      (e: MouseEvent) => {
        if (e.target === dialog) emit('close')
      }
    "
  >
    <div class="section items-center !py-2.5 !pr-2.5">
      <h2 id="share-title">Share this profile</h2>
      <button class="icon-btn ml-auto" aria-label="Close" @click="emit('close')">
        <X :size="16" />
      </button>
    </div>

    <div>
      <div class="relative isolate overflow-hidden rounded-[8px] border border-line p-5 text-white">
        <img
          v-if="champion"
          :src="championSplash(champion)"
          alt=""
          class="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_22%]"
        />
        <div
          class="absolute inset-0 -z-10"
          style="background: linear-gradient(100deg, rgb(10 11 14 / 0.92), rgb(10 11 14 / 0.62))"
        />

        <span class="display text-[15px]">invade<span class="text-white/45">.lol</span></span>

        <div class="mt-6 flex items-center gap-4">
          <img
            :src="profileIcon(profile.profileIconId)"
            alt=""
            class="h-14 w-14 rounded-[8px] ring-2 ring-white/15"
          />
          <div class="min-w-0">
            <h3 class="display truncate text-[28px] leading-[0.95]">{{ profile.gameName }}</h3>
            <p class="num mt-1 text-[11.5px] text-white/60">
              #{{ profile.tagLine }} · {{ profile.platform }}
            </p>
          </div>
        </div>

        <div v-if="includeStats && stats" class="mt-6 flex gap-10">
          <div v-for="cell in cells" :key="cell.name">
            <div class="stat text-[28px]">{{ cell.value }}</div>
            <div class="label mt-1.5 !text-white/55">{{ cell.name }}</div>
          </div>
        </div>
      </div>

      <label class="mt-4 flex items-center gap-2 text-[12.5px] text-ink-2">
        <input v-model="includeStats" type="checkbox" class="accent-[var(--color-ink)]" />
        Include performance statistics
      </label>

      <label class="mt-4 block">
        <span class="label">Profile link</span>
        <input
          :value="url"
          readonly
          class="field mt-1.5 !text-[12px]"
          @focus="(e) => (e.target as HTMLInputElement).select()"
        />
      </label>

      <div class="mt-5 flex flex-wrap items-center justify-end gap-2">
        <span v-if="message" class="mr-auto text-[11.5px] text-ink-2" role="status">{{
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
