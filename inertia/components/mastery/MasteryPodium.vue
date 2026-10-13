<script setup lang="ts">
import { computed } from 'vue'
import { championName, championSplash } from '../../lib/assets.js'
import { compact, timeAgo } from '../../lib/format.js'
import type { ChampionMastery } from '../../lib/types.js'
import MasteryCrest from './MasteryCrest.vue'

/**
 * The three champions with the most points, as a podium: second on the left, first in the
 * middle and raised, third on the right. Each stands on a plain step of the sheet's material.
 */
const props = defineProps<{ top: ChampionMastery[] }>()

const places = computed(() =>
  props.top.slice(0, 3).map((entry, index) => ({ entry, place: index + 1 }))
)
</script>

<template>
  <ol class="ms-podium" aria-label="Most mastery">
    <li
      v-for="{ entry, place } in places"
      :key="entry.championId"
      class="ms-place"
      :data-place="place"
    >
      <div class="ms-figure">
        <div class="ms-art">
          <img
            :src="championSplash(entry.championId)"
            :alt="`${championName(entry.championId)} splash art`"
            decoding="async"
          />
        </div>
        <MasteryCrest class="ms-place-crest" :level="entry.championLevel" :size="64" />
      </div>

      <div class="ms-who">
        <h3 class="ms-name">{{ championName(entry.championId) }}</h3>
        <p class="ms-points num">
          <span class="iv-fig">{{ compact(entry.championPoints) }}</span>
          <span class="iv-unit">points</span>
        </p>
        <p class="ms-meta num">
          <span>Level {{ entry.championLevel }}</span>
          <span class="ms-sep" aria-hidden="true">·</span>
          <span>{{ timeAgo(entry.lastPlayTime) }}</span>
        </p>
      </div>

      <div class="ms-step">
        <span class="iv-fig" :aria-label="`Place ${place}`">{{ place }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.ms-podium {
  display: grid;
  grid-template-columns: 1fr 1.16fr 1fr;
  align-items: end;
  max-width: 760px;
  margin-inline: auto;
}

.ms-place {
  --step: 34px;
  --art: 168px;
  --crest: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  grid-row: 1;
  min-width: 0;
  text-align: center;
}

.ms-place[data-place='1'] {
  --step: 70px;
  --art: 204px;
  --crest: 72px;
  grid-column: 2;
}

.ms-place[data-place='2'] {
  --step: 50px;
  grid-column: 1;
}

.ms-place[data-place='3'] {
  grid-column: 3;
}

.ms-figure {
  position: relative;
  width: min(var(--art), calc(100% - 20px));
}

.ms-art {
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: var(--r-md);
  background: var(--well);
  box-shadow: var(--portrait);
}

.ms-art > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 28%;
}

.ms-figure :deep(.ms-place-crest) {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: var(--crest) !important;
  height: var(--crest) !important;
  transform: translate(-50%, 46%);
  filter: drop-shadow(var(--contact));
}

.ms-who {
  width: 100%;
  min-width: 0;
  padding: calc(var(--crest) * 0.5 + 6px) 10px 0;
}

.ms-name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: -0.005em;
  color: var(--text-1);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ms-points {
  margin-top: 6px;
  color: var(--text-1);
  white-space: nowrap;
}

.ms-points > .iv-fig {
  font-size: 22px;
}

.ms-meta {
  margin-top: 6px;
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
}

.ms-sep {
  margin-inline: 5px;
  color: var(--text-4);
}

.ms-place[data-place='1'] .ms-name {
  font-size: 16px;
  line-height: 20px;
}

.ms-place[data-place='1'] .ms-points > .iv-fig {
  font-size: 30px;
}

/* The step: the sheet's material raised, lit along its top edge, rising from the sheet's floor. */
.ms-step {
  display: flex;
  justify-content: center;
  width: 100%;
  height: var(--step);
  margin-top: 16px;
  padding-top: 9px;
  background: var(--sheen), var(--surface-2);
  border-radius: var(--r-md) var(--r-md) 0 0;
  box-shadow: var(--hi);
}

.ms-step > .iv-fig {
  font-size: 18px;
  color: var(--text-3);
}

.ms-place[data-place='1'] .ms-step > .iv-fig {
  font-size: 22px;
  color: var(--text-2);
}

@media (max-width: 30rem) {
  .ms-place {
    --step: 26px;
    --crest: 44px;
  }

  .ms-place[data-place='1'] {
    --step: 52px;
    --crest: 52px;
  }

  .ms-place[data-place='2'] {
    --step: 38px;
  }

  .ms-figure {
    width: calc(100% - 12px);
  }

  .ms-who {
    padding-inline: 4px;
  }

  .ms-name,
  .ms-place[data-place='1'] .ms-name {
    font-size: 13px;
    line-height: 17px;
  }

  .ms-points > .iv-fig {
    font-size: 17px;
  }

  .ms-place[data-place='1'] .ms-points > .iv-fig {
    font-size: 22px;
  }

  .ms-points .iv-unit {
    display: none;
  }

  .ms-meta {
    font-size: 11px;
    line-height: 15px;
  }

  .ms-meta > span {
    display: block;
  }

  .ms-meta > .ms-sep {
    display: none;
  }

  .ms-step {
    margin-top: 12px;
    padding-top: 6px;
  }
}
</style>
