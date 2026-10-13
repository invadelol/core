<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ObjectiveIcon, type ObjectiveIconName } from '@invadelol/ui'

/**
 * Two sides of one thing, per game: your side's part in violet from the left, theirs in quiet
 * ink from the right, meeting where the split is. Used for what the two teams took.
 */
defineProps<{
  rows: Array<{ key: string; icon: ObjectiveIconName; label: string; you: number; them: number }>
  /** Names of the two sides. */
  sides: [string, string]
}>()

const ready = ref(false)
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (ready.value = true))))

const share = (you: number, them: number) => (you + them > 0 ? (you / (you + them)) * 100 : 50)
</script>

<template>
  <div class="lv-tug">
    <div class="lv-tug-sides">
      <span>{{ sides[0] }}</span>
      <span>{{ sides[1] }}</span>
    </div>
    <div v-for="row in rows" :key="row.key" class="lv-tug-row">
      <span class="lv-tug-icon" :title="row.label"
        ><ObjectiveIcon :name="row.icon" :size="18"
      /></span>
      <span class="lv-tug-value num">{{ row.you.toFixed(1) }}</span>
      <span
        class="lv-tug-bar"
        :aria-label="`${row.label}: ${row.you.toFixed(1)} against ${row.them.toFixed(1)} a game`"
      >
        <i class="you" :style="{ width: ready ? `${share(row.you, row.them)}%` : '50%' }" />
      </span>
      <span class="lv-tug-value them num">{{ row.them.toFixed(1) }}</span>
    </div>
  </div>
</template>

<style scoped>
.lv-tug {
  display: grid;
  gap: 10px;
}

.lv-tug-sides {
  display: flex;
  justify-content: space-between;
  padding: 0 40px 0 66px;
  font-size: 12px;
  color: var(--text-3);
}

.lv-tug-row {
  display: grid;
  grid-template-columns: 26px 32px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 8px;
}

.lv-tug-icon {
  display: grid;
  place-items: center;
  color: var(--text-2);
}

.lv-tug-value {
  font-size: 14px;
  font-weight: 650;
  text-align: right;
  color: var(--text-1);
}

.lv-tug-value.them {
  text-align: left;
  font-weight: 500;
  color: var(--text-3);
}

.lv-tug-bar {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--surface-3);
}

.lv-tug-bar .you {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px 0 0 4px;
  background: var(--brand);
  box-shadow: 2px 0 0 var(--solid-1);
  transition: width 1100ms var(--ease-glide);
}

@media (prefers-reduced-motion: reduce) {
  .lv-tug-bar .you {
    transition: none;
  }
}
</style>
