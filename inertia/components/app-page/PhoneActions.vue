<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { DISCORD_URL } from '../../lib/links.js'

/**
 * What a phone gets instead of the download, which it cannot run: the community, and this page's
 * link to open later on the computer. Shown in place of DownloadButtons by `.on-phone`
 * (app-page.css), so the server renders both and nothing moves when the page hydrates.
 */
const PAGE_URL = 'https://invade.lol/app'

const copied = ref(false)
const failed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

/** For browsers without the async clipboard (older, or not a secure context). */
function copyWithSelection(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  field.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  field.remove()
  return ok
}

async function copy() {
  let ok = false
  try {
    await navigator.clipboard.writeText(PAGE_URL)
    ok = true
  } catch {
    ok = copyWithSelection(PAGE_URL)
  }
  copied.value = ok
  failed.value = !ok
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    failed.value = false
  }, 2000)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="phone">
    <a
      :href="DISCORD_URL"
      target="_blank"
      rel="noreferrer"
      class="iv-btn primary lg"
      data-track="phone_discord"
    >
      Join the Discord
    </a>
    <button type="button" class="iv-btn lg" data-track="phone_copy_link" @click="copy">
      <!-- Every label in one cell, so the button keeps its width as the label changes. -->
      <span class="swap" aria-live="polite">
        <span :class="{ off: copied || failed }">Copy the link for your PC</span>
        <span :class="{ off: !copied }">Link copied</span>
        <span :class="{ off: !failed }">invade.lol/app</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.phone {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: min(100%, 280px);
}

.swap {
  display: grid;
  justify-items: center;
}

.swap > span {
  grid-area: 1 / 1;
}

.swap > .off {
  visibility: hidden;
}
</style>
