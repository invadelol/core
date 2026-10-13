<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { ChampIcon, PerfDial, useFormat, useNames } from '@invadelol/ui'
import { queueName, queueShort } from '@invadelol/ui/logic'
import HomeRank from './HomeRank.vue'
import { profilePath } from '../../lib/format.js'
import { regionLabel } from '../../lib/assets.js'
import type { BestGame } from '../../lib/home.js'

/** The best scores of the last day, one line per player, each opening the game. */
defineProps<{ games: BestGame[] }>()

const { ago, kdaRatio, mmss, pct, score100 } = useFormat()
const { itemIcon, itemName } = useNames()

const href = (b: BestGame) =>
  `${profilePath(b.player.gameName, b.player.tagLine)}/match/${encodeURIComponent(b.matchId)}`
</script>

<template>
  <section aria-labelledby="best-title">
    <div class="section">
      <h2 id="best-title">Best games</h2>
      <span class="meta">Last 24 h</span>
    </div>

    <ol class="list iv-panel home-sheet overflow-hidden">
      <li v-for="b in games" :key="b.matchId + b.player.gameName" class="best">
        <Link :href="href(b)" class="row" :class="b.game.win ? 'win' : 'loss'">
          <span class="dial">
            <PerfDial
              v-if="b.game.score"
              :score="score100(b.game.score.score)"
              :rank="b.game.score.rank"
              :tag="b.game.score.tag"
            />
          </span>

          <ChampIcon :id="b.game.championId" :size="40" :level="b.game.level" class="champ" />

          <span class="who min-w-0">
            <span class="block truncate text-[13.5px] leading-[18px]">
              <span class="font-semibold text-ink">{{ b.player.gameName }}</span>
              <span class="text-ink-3">#{{ b.player.tagLine }}</span>
            </span>
            <span class="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] leading-4">
              <HomeRank :rank="b.player.rank" :lp="false" />
              <span class="shrink-0 text-ink-3" :class="{ region: b.player.rank }">{{
                regionLabel(b.player.platform)
              }}</span>
            </span>
          </span>

          <span class="game min-w-0">
            <span class="block truncate text-[13px] font-semibold leading-[18px] text-ink">
              <span class="hidden md:inline">{{ queueName(b.game.queueId) }}</span>
              <span class="md:hidden">{{ queueShort(b.game.queueId) }}</span>
            </span>
            <span class="mt-0.5 block text-[12px] leading-4 text-ink-3">
              {{ b.game.win ? 'Win' : 'Loss' }} · {{ mmss(b.game.duration) }}
            </span>
          </span>

          <span class="kda">
            <span class="num block text-[13.5px] font-semibold leading-[18px] text-ink">
              {{ b.game.kills }}<i>/</i>{{ b.game.deaths }}<i>/</i>{{ b.game.assists }}
            </span>
            <span class="num mt-0.5 block text-[12px] leading-4 text-ink-3">
              {{ kdaRatio(b.game.kills, b.game.deaths, b.game.assists) }} KDA<template
                v-if="b.game.score?.kp != null"
              >
                · {{ pct(b.game.score.kp) }} KP</template
              >
            </span>
          </span>

          <span class="items" aria-hidden="true">
            <template v-for="(id, i) in b.game.items.slice(0, 6)" :key="i">
              <img v-if="id" :src="itemIcon(id)" :title="itemName(id)" alt="" loading="lazy" />
              <i v-else />
            </template>
          </span>

          <span class="when num text-[12px] text-ink-3">{{ ago(b.game.creation) }}</span>
        </Link>
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* The list is its own size container: it shows what fits its width, on the page or in a column. */
.list {
  container-type: inline-size;
}

.best + .best {
  border-top: 1px solid var(--line);
}

.row {
  display: grid;
  grid-template-columns: 44px 40px minmax(0, 1fr) auto;
  grid-template-areas: 'dial champ who kda';
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 10px 14px 10px 16px;
}

/* The result as the app's match rows show it: an edge and a soft tint from the left. */
.row.win {
  --tint: var(--win-rgb);
}

.row.loss {
  --tint: var(--loss-rgb);
}

/* An inset pill, so the edge never bends around the panel's rounded corners. */
.row {
  position: relative;
}

.row::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 14px;
  width: 3px;
  border-radius: 3px;
  background: rgb(var(--tint) / 0.85);
}

.row.plain::before {
  content: none;
}

.row {
  --row: transparent;
  background:
    linear-gradient(
      90deg,
      rgb(var(--tint) / var(--home-tint)),
      rgb(var(--tint) / var(--home-tint-far)) 34%,
      rgb(var(--tint) / 0) 66%
    ),
    var(--row);
}

.row.plain {
  background: var(--row);
}

.row:hover {
  --row: var(--surface-2);
}

.dial {
  grid-area: dial;
  display: flex;
  justify-content: center;
}

.champ {
  grid-area: champ;
}

.who {
  grid-area: who;
}

.game,
.items,
.when,
.region {
  display: none;
}

.kda {
  grid-area: kda;
  text-align: right;
}

.kda i {
  margin: 0 2px;
  font-style: normal;
  color: var(--text-4);
}

.items {
  grid-area: items;
  gap: 2px;
  padding: 2px;
  border-radius: var(--r-sm);
  background: var(--inset);
  box-shadow: var(--inset-shadow);
}

.items > img,
.items > i {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  background: var(--well);
}

@container (min-width: 600px) {
  .row {
    grid-template-columns: 44px 40px minmax(0, 1.4fr) minmax(0, 1fr) 124px;
    grid-template-areas: 'dial champ who game kda';
    gap: 16px;
    padding-right: 18px;
  }

  .game {
    display: block;
    grid-area: game;
  }

  .region {
    display: inline;
  }

  .kda {
    text-align: left;
  }
}

@container (min-width: 760px) {
  .row {
    grid-template-columns: 44px 40px minmax(0, 1.4fr) minmax(0, 1fr) 124px 64px;
    grid-template-areas: 'dial champ who game kda when';
  }

  .when {
    display: block;
    grid-area: when;
    text-align: right;
  }
}

@container (min-width: 940px) {
  .row {
    grid-template-columns: 44px 40px minmax(0, 1.4fr) minmax(0, 1fr) 124px auto 64px;
    grid-template-areas: 'dial champ who game kda items when';
  }

  .items {
    display: flex;
  }
}
</style>
