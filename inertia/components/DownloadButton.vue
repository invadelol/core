<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import {
  DESKTOP_TARGETS,
  detectDesktopTarget,
  targetLabel,
  type DesktopPlatform,
} from '../lib/platform.js'

withDefaults(
  defineProps<{
    /** `header` is compact and hidden where the app cannot run; `hero` also lists the other builds. */
    variant?: 'header' | 'hero'
  }>(),
  { variant: 'header' }
)

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
  <template v-if="variant === 'header'">
    <!-- Rendered only once we know the computer, so the header never shifts or offers a useless button. -->
    <a
      v-if="target"
      :href="href(target)"
      class="btn btn-sm hidden shrink-0 sm:inline-flex"
      :title="`Download Invade for ${targetLabel(target)}`"
    >
      <Download :size="13" />Download
    </a>
  </template>

  <div v-else class="flex flex-col items-center gap-2">
    <a v-if="target" :href="href(target)" class="btn btn-primary">
      <Download :size="14" />Download Invade for {{ targetLabel(target) }}
    </a>
    <p v-else-if="checked" class="text-[12px] text-ink-3">
      Invade runs on Windows and macOS computers.
    </p>
    <p v-if="checked" class="text-[11.5px] text-ink-3">
      Also for
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
