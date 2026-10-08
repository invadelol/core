<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'

defineProps<{ error: any }>()

function retry() {
  location.reload()
}
</script>

<template>
  <Head title="Something broke" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="mx-auto w-full max-w-[560px] flex-1 px-5 pt-[clamp(56px,14vh,140px)] sm:px-6">
      <p class="num text-[13px] font-medium text-ink-3">500</p>
      <h1 class="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.012em] text-ink">
        Something broke on our side
      </h1>
      <p class="mt-3 text-[14px] leading-relaxed text-ink-2">
        Try again in a moment. If it keeps happening, Riot’s data is probably having a bad day.
      </p>
      <p
        v-if="error?.message"
        class="mt-4 rounded-[5px] bg-well px-3 py-2 font-mono text-[12px] text-ink-3"
      >
        {{ error.message }}
      </p>
      <div class="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-primary" @click="retry">Try again</button>
        <a href="/" class="btn">Back to search</a>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>
