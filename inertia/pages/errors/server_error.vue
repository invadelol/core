<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'

defineProps<{ error: any }>()
</script>

<template>
  <Head title="Something broke" />

  <AppHeader />

  <main class="mx-auto max-w-[1180px] px-4 py-6">
    <div class="card px-6 py-20 text-center">
      <p class="label">500</p>
      <h1 class="mt-2 text-[1.25rem] font-semibold text-ink">Something broke on our side</h1>
      <p class="mx-auto mt-2 max-w-md text-[0.8125rem] text-ink-2">
        Try again in a moment. If it keeps happening, the data source is probably having a bad day.
      </p>
      <p v-if="error?.message" class="mx-auto mt-4 max-w-lg font-mono text-[0.6875rem] text-ink-3">
        {{ error.message }}
      </p>
      <a href="/" class="btn mt-6">Back to search</a>
    </div>
  </main>
</template>
