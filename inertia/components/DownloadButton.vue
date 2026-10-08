<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import {
  DESKTOP_TARGETS,
  detectDesktopTarget,
  targetLabel,
  type DesktopPlatform,
} from '../lib/platform.js'

/** Null until the browser is inspected (and on computers the app does not run on). */
const target = ref<DesktopPlatform | null>(null)
const checked = ref(false)

onMounted(async () => {
  target.value = await detectDesktopTarget()
  checked.value = true
})

const href = (id: DesktopPlatform) => `/download/${id}`
</script>

<template>
  <div class="flex flex-col items-start gap-2.5">
    <a v-if="target" :href="href(target)" class="btn btn-primary btn-lg">
      <Download :size="15" />Download for {{ targetLabel(target) }}
    </a>
    <a v-else-if="checked" href="#download" class="btn btn-primary btn-lg">
      <Download :size="15" />Download
    </a>
    <span v-else class="block h-[36px]" aria-hidden="true" />
    <p v-if="checked" class="text-[12.5px] text-ink-3">
      <template v-if="!target">Invade runs on Windows and macOS computers. </template>
      <template v-else>Also for </template>
      <template
        v-for="(other, index) in DESKTOP_TARGETS.filter((t) => t.id !== target)"
        :key="other.id"
      >
        <a :href="href(other.id)" class="underline underline-offset-2 hover:text-ink">{{
          other.label
        }}</a
        ><template v-if="index < DESKTOP_TARGETS.length - (target ? 2 : 1)">, </template>
      </template>
    </p>
  </div>
</template>
