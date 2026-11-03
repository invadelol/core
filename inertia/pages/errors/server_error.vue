<script setup lang="ts">
import ErrorPage from '../../components/ErrorPage.vue'

/** What the server may tell (see `publicError`): never a stack, a message only when it is meant for people. */
defineProps<{ error?: { status: number; message: string | null } }>()

function retry() {
  location.reload()
}
</script>

<template>
  <ErrorPage
    :status="error?.status ?? 500"
    title="Something broke on our side"
    line="Try again in a moment. If it keeps happening, Riot’s data is probably having a bad day."
    :message="error?.message"
  >
    <div class="acts">
      <button type="button" class="iv-btn primary" @click="retry">Try again</button>
    </div>
  </ErrorPage>
</template>
