<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'

defineProps<{ error: any }>()

function retry() {
  location.reload()
}
</script>

<template>
  <Head title="Something broke" />

  <AppHeader />

  <main class="mx-auto max-w-[760px] px-5 py-10">
    <div class="py-20 text-center sm:py-28">
      <p class="label">Error 500</p>
      <h1 class="display mt-4 text-[clamp(34px,6vw,52px)] text-ink">Something broke on our side</h1>
      <p class="mx-auto mt-4 max-w-[46ch] text-[14px] leading-relaxed text-ink-2">
        Try again in a moment. If it keeps happening, the data source is probably having a bad day.
      </p>
      <p
        v-if="error?.message"
        class="mx-auto mt-5 inline-block max-w-lg rounded-[7px] bg-sunken px-3 py-1.5 font-mono text-[11px] text-ink-3"
      >
        {{ error.message }}
      </p>
      <div class="mt-8 flex flex-wrap items-center justify-center gap-2">
        <button type="button" class="btn btn-primary !px-4 !py-2" @click="retry">Try again</button>
        <a href="/" class="btn !px-4 !py-2">Back to search</a>
      </div>
    </div>
  </main>
</template>
