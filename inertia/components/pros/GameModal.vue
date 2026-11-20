<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import Frame from '../ui/Frame.vue'
import GameDetail from '../profile/GameDetail.vue'
import { champIcon } from '../../lib/assets.js'
import type { Match } from '../../lib/types.js'

/**
 * A pro's game opened over their page: the profile's game detail (scoreboard, breakdown, chart,
 * timeline, build) in a dialog, with the game's line on top. Escape, a click outside and the
 * close button close it (the page decides what closing does to the address).
 */
defineProps<{
  /** The stored game, and the pro's side in it. */
  game: { match: Match; puuid: string; gameName: string; tagLine: string }
  /** Its line in the pro's list: champion, result, score and length (the date is under it). */
  line: {
    champion: number
    championName: string
    win: boolean
    kills: number
    deaths: number
    assists: number
    duration: string
  }
  pro: string
}>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <dialog
    ref="dialog"
    class="gm"
    aria-labelledby="gm-title"
    @cancel.prevent="emit('close')"
    @click="(e: MouseEvent) => e.target === dialog && emit('close')"
  >
    <div class="gm-h">
      <Frame :src="champIcon(line.champion)" :width="36" size="xs" :alt="line.championName" />
      <span class="col" style="min-width: 0">
        <h2 id="gm-title" class="h4 ell">{{ pro }}, {{ line.championName }}</h2>
        <span class="meta ell"
          ><span :class="line.win ? 'wn' : 'ls'">{{ line.win ? 'Win' : 'Loss' }}</span>
          {{ line.kills }}/{{ line.deaths }}/{{ line.assists }}, {{ line.duration }}</span
        >
      </span>
      <button type="button" class="btn ghost ico gm-x" aria-label="Close" @click="emit('close')">
        <Icon name="x" />
      </button>
    </div>
    <GameDetail
      :match="game.match"
      :puuid="game.puuid"
      :game-name="game.gameName"
      :tag-line="game.tagLine"
    />
  </dialog>
</template>

<style scoped>
.gm {
  width: min(1180px, calc(100% - 32px));
  max-height: calc(100dvh - 48px);
  margin: auto;
  padding: 0;
  overflow: auto;
  overscroll-behavior: contain;
  color: var(--t1);
  background: var(--s1);
  border: 1px solid var(--line-2);
  border-radius: var(--r3);
  box-shadow: var(--drop);
}
.gm::backdrop {
  background: rgb(0 0 0 / 0.62);
}
.gm-h {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px 14px 18px;
  background: var(--s1);
  border-bottom: 1px solid var(--line);
}
.gm-h .wn {
  color: var(--win);
}
.gm-h .ls {
  color: var(--loss);
}
.gm-x {
  margin-left: auto;
  flex: none;
}
.gm :deep(.iv-md) {
  background: none;
  border-radius: 0;
}
@media (max-width: 640px) {
  .gm {
    width: calc(100% - 16px);
    max-height: calc(100dvh - 16px);
  }
  .gm-h {
    padding: 10px 8px 10px 12px;
  }
  .gm :deep(.iv-md) {
    padding: 0 10px 12px;
  }
}
</style>
