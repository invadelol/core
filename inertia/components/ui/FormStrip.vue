<script setup lang="ts">
/**
 * The last games as a strip of marks, oldest on the left (Violet line): blue for a win,
 * red for a loss.
 */
defineProps<{ results: boolean[]; tall?: boolean }>()
</script>

<template>
  <span
    class="rd-form"
    :class="{ tall }"
    :aria-label="`${results.filter(Boolean).length} wins in the last ${results.length} games`"
  >
    <i v-for="(win, i) in results" :key="i" :class="{ w: win }" aria-hidden="true" />
  </span>
</template>

<style>
.rd-form {
  display: inline-flex;
  gap: 2px;
}
.rd-form i {
  width: 7px;
  height: 14px;
  border-radius: 2px;
  background: rgb(var(--loss-rgb) / 0.75);
}
.rd-form i.w {
  background: var(--win);
}
.rd-form.tall {
  display: flex;
  gap: 3px;
}
.rd-form.tall i {
  flex: 1;
  width: auto;
  height: 18px;
}
</style>
