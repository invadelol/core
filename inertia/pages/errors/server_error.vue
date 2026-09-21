<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'

defineProps<{ error: any }>()
</script>

<template>
  <Head title="Something broke" />

  <AppHeader />

  <main class="mx-auto max-w-[760px] px-4 py-10">
    <div class="py-24 text-center">
      <p class="label">500</p>
      <h1 class="mt-2 text-[20px] font-semibold text-ink">Something broke on our side</h1>
      <p class="mx-auto mt-2 max-w-md text-[13px] text-ink-2">
        Try again in a moment. If it keeps happening, the data source is probably having a bad day.
      </p>
      <p v-if="error?.message" class="mx-auto mt-4 max-w-lg font-mono text-[11px] text-ink-3">
        {{ error.message }}
      </p>
      <a href="/" class="btn btn-primary mt-6">Back to search</a>
    </div>
  </main>
</template>
