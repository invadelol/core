<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { queueName, type MatchSummary } from '@invadelol/ui/logic'
import { useFormat } from '@invadelol/ui'
import Icon from '../ui/Icon.vue'
import ScoreDial from '../ui/ScoreDial.vue'
import SaveStar from '../social/SaveStar.vue'
import { assetUrl, champIcon, championName, championSplash } from '../../lib/assets.js'
import { clipClock } from '../../lib/clips.js'
import { profilePath } from '../../lib/format.js'
import type { Clip, ClipMatch } from '../../lib/clip_types.js'
import type { IconName } from '../../lib/icons.js'

/**
 * The match a clip is from, beside it: the art of the champion played with the result and score,
 * the clip's player's line, both teams (a clapperboard on those who posted a clip of it), the
 * team gold lead as one violet line with the objectives above it and this clip's moment on it,
 * the game's other clips, and the way to the match page.
 */
const props = defineProps<{
  clip: Clip
  others: Clip[]
  card: ClipMatch
  /** The clip's player's line in the game. */
  game: MatchSummary
}>()

const { score100, ordinal, compact } = useFormat()
const me = computed(() => props.card.match.participants.find((p) => p.puuid === props.card.puuid)!)
const teams = computed(() => {
  const mine = me.value.teamId
  const side = (own: boolean) =>
    props.card.match.participants.filter((p) => (p.teamId === mine) === own)
  return [side(true), side(false)]
})
const score = computed(() => {
  const kills = (own: boolean) => teams.value[own ? 0 : 1].reduce((n, p) => n + p.kills, 0)
  return [kills(true), kills(false)]
})
const posted = computed(
  () => new Set([props.clip.championId, ...props.others.map((c) => c.championId)])
)
const length = computed(() => props.card.match.duration)
const matchHref = computed(
  () => `${profilePath(me.value.gameName, me.value.tagLine)}/match/${props.card.match.matchId}`
)
const when = computed(() =>
  new Date(Number(props.card.match.gameStartMs)).toLocaleString('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
)

/* ── The gold line ────────────────────────────────────────────────── */

const W = 360
const H = 120
const PAD = 10
const chart = computed(() => {
  const points = props.card.gold
  if (points.length < 2) return null
  const last = Math.max(...points.map(([m]) => m), 1)
  const top = Math.max(1000, ...points.map(([, g]) => Math.abs(g)))
  const x = (minute: number) => (minute / last) * W
  const y = (gold: number) => H / 2 - (gold / top) * (H / 2 - PAD)
  const line = points.map(([m, g], i) => `${i ? 'L' : 'M'}${x(m).toFixed(1)} ${y(g).toFixed(1)}`)
  const lead = (minute: number) => {
    const after = points.findIndex(([m]) => m >= minute)
    if (after <= 0) return points[Math.max(0, after)]?.[1] ?? 0
    const [m0, g0] = points[after - 1]
    const [m1, g1] = points[after]
    return g0 + ((g1 - g0) * (minute - m0)) / Math.max(1e-6, m1 - m0)
  }
  const dot = (ms: number) => {
    const minute = ms / 60_000
    return { x: x(minute), y: y(lead(minute)) }
  }
  return {
    path: line.join(' '),
    area: `${line.join(' ')} L${x(points.at(-1)![0]).toFixed(1)} ${H} L0 ${H} Z`,
    zero: y(0),
    end: points.at(-1)![1],
    marks: props.card.objectives.map((o) => ({ ...o, x: x(o.minute) })),
    here: dot(props.clip.startMs),
    others: props.others.map((c) => ({ id: c.id, champion: c.championId, ...dot(c.startMs) })),
    ticks: [0, 10, 20, 30, 40].filter((m) => m < last).map((m) => ({ m, x: x(m) })),
    last,
  }
})
const GLYPH: Record<string, IconName> = {
  dragon: 'riotDragon',
  baron: 'riotBaron',
  herald: 'riotHerald',
  grubs: 'riotGrubs',
  tower: 'riotTower',
  inhibitor: 'riotInhib',
}
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${compact(Math.abs(n))}`
</script>

<template>
  <aside class="card clp-match" aria-label="The match">
    <div class="clp-m-art">
      <img :src="championSplash(clip.championId)" alt="" />
      <SaveStar kind="match" :id="card.match.matchId" :puuid="card.puuid" label="this match" />
      <div class="clp-m-res">
        <span :class="game.win ? 'win' : 'loss'">{{ game.win ? 'Victory' : 'Defeat' }}</span>
        <b class="num">{{ score[0] }} <i>-</i> {{ score[1] }}</b>
      </div>
      <p class="clp-m-when meta">
        {{ queueName(card.match.queueId) }}, {{ clipClock(length * 1000) }}<br />{{ when }}
      </p>
    </div>

    <div class="clp-m-me">
      <ScoreDial
        :value="game.score ? score100(game.score.score) : null"
        size="sm"
        :place="game.score ? (game.score.tag === 'mvp' ? 'MVP' : ordinal(game.score.rank)) : ''"
      />
      <span class="clp-m-who">
        <b>{{ clip.author.name }}, {{ championName(clip.championId) }}</b>
        <span class="meta num"
          >{{ game.kills }} / {{ game.deaths }} / {{ game.assists }}, {{ game.cs }} CS,
          {{ compact(game.damage) }} damage</span
        >
      </span>
      <span class="clp-m-items">
        <img
          v-for="(id, i) in game.items.filter(Boolean).slice(0, 4)"
          :key="i"
          :src="assetUrl('item', id)"
          alt=""
        />
      </span>
    </div>

    <div class="clp-m-teams">
      <div v-for="(team, t) in teams" :key="t" class="clp-m-team" :class="{ them: t === 1 }">
        <span
          v-for="p in team"
          :key="p.puuid"
          class="clp-m-p"
          :class="{ me: p.puuid === card.puuid }"
          :title="championName(p.championId)"
        >
          <img :src="champIcon(p.championId)" :alt="championName(p.championId)" />
          <i v-if="posted.has(p.championId)" class="clp-m-clap"
            ><Icon name="film" :size="11"
          /></i>
        </span>
      </div>
    </div>

    <div v-if="chart" class="clp-m-gold">
      <p class="clp-m-gh">
        <span class="meta">Gold lead</span>
        <b class="num">{{ signed(chart.end) }}</b>
      </p>
      <div class="clp-m-marks" aria-hidden="true">
        <span
          v-for="(o, i) in chart.marks"
          :key="i"
          :class="{ ours: o.ours }"
          :style="{ left: `${(o.x / W) * 100}%` }"
          ><Icon :name="GLYPH[o.kind]" :size="13"
        /></span>
      </div>
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="clp-m-svg"
        role="img"
        aria-label="Team gold lead over the game"
      >
        <defs>
          <linearGradient id="clp-fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="var(--v500)" stop-opacity="0.28" />
            <stop offset="1" stop-color="var(--v500)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line :x1="0" :x2="W" :y1="chart.zero" :y2="chart.zero" class="clp-m-zero" />
        <path :d="chart.area" fill="url(#clp-fade)" />
        <path :d="chart.path" class="clp-m-line" />
        <circle :cx="chart.here.x" :cy="chart.here.y" r="6" class="clp-m-here" />
      </svg>
      <img
        v-for="o in chart.others"
        :key="o.id"
        class="clp-m-other"
        :src="champIcon(o.champion)"
        alt=""
        :style="{ left: `${(o.x / W) * 100}%`, top: `${(o.y / H) * 100}%` }"
      />
      <p class="clp-m-axis meta num">
        <span>0</span>
        <span v-for="t in chart.ticks.slice(1)" :key="t.m" :style="{ left: `${(t.x / W) * 100}%` }"
          >{{ t.m }} min</span
        >
        <span class="end">{{ clipClock(length * 1000) }}</span>
      </p>
    </div>

    <div v-if="others.length" class="clp-m-clips">
      <Link v-for="o in others.slice(0, 2)" :key="o.id" class="clp-m-clip" :href="`/clip/${o.id}`">
        <span class="clp-m-cover"><img :src="o.poster ?? ''" alt="" /></span>
        <b class="ell">{{ o.title }}</b>
        <span class="meta ell">{{ o.author.name }}, {{ clipClock(o.startMs) }}</span>
      </Link>
    </div>

    <Link class="btn clp-m-open" :href="matchHref"
      >Open the match<Icon name="arrow" :size="16"
    /></Link>
  </aside>
</template>
