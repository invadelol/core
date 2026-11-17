<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { queueName } from '@invadelol/ui/logic'
import Icon from '../ui/Icon.vue'
import ScoreDial from '../ui/ScoreDial.vue'
import { assetUrl, champIcon, championName } from '../../lib/assets.js'
import { isRemake, scoreLobby } from '../../lib/match.js'
import { compact, profilePath } from '../../lib/format.js'
import type { Match } from '../../lib/types.js'

/**
 * A profile's games as lit rows (`.mrow.mr`), under the day they were played with that day's
 * record: champion with level, spells and runes; queue, result and length; KDA with its ratio and
 * kill share; CS a minute and damage; items in a well with a badge when the game earned one; the
 * lane opponent; the Invade score with the place in the lobby; the LP the game moved.
 */
const props = defineProps<{ matches: Match[]; puuid: string; gameName: string; tagLine: string }>()

const DAY = 86_400_000
const midnight = (ms: number) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function dayLabel(ms: number, now = Date.now()) {
  const diff = Math.round((midnight(now) - midnight(ms)) / DAY)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const d = new Date(ms)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  })
}

const PLACES = ['MVP', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
const QUEUE: Record<number, string> = { 420: 'Ranked Solo', 440: 'Ranked Flex' }

function row(m: Match) {
  const me = m.participants.find((p) => p.puuid === props.puuid)
  if (!me) return null
  const remake = isRemake(m)
  const minutes = Math.max(1, m.duration / 60)
  const team = m.participants.filter((p) => p.teamId === me.teamId)
  const teamKills = team.reduce((s, p) => s + p.kills, 0)
  const scores = scoreLobby(m)
  const mine = scores[props.puuid]?.score ?? null
  const order = Object.values(scores)
    .map((s) => s.score)
    .sort((a, b) => b - a)
  const rank = mine === null ? -1 : order.indexOf(mine)
  const place = remake || rank < 0 ? '' : rank === 0 ? (me.win ? 'MVP' : 'ACE') : PLACES[rank]
  const opponent =
    me.position && me.position !== 'Invalid'
      ? m.participants.find((p) => p.teamId !== me.teamId && p.position === me.position)
      : undefined
  const top = (key: 'totalDamageDealtToChampions' | 'visionScore' | 'assists') =>
    m.participants.every((p) => (p[key] ?? 0) <= (me[key] ?? 0)) && (me[key] ?? 0) > 0
  const badge = remake
    ? ''
    : top('totalDamageDealtToChampions')
      ? 'Most damage'
      : top('visionScore')
        ? 'Best vision'
        : top('assists')
          ? 'Most assists'
          : ''
  const items = me.items.slice(0, 6)
  while (items.length < 6) items.push(0)
  return {
    me,
    cls: remake ? 'r' : me.win ? 'w' : 'l',
    res: remake ? 'Remake' : me.win ? 'Win' : 'Loss',
    queue: QUEUE[m.queueId] ?? queueName(m.queueId),
    dur: `${Math.floor(m.duration / 60)}:${String(m.duration % 60).padStart(2, '0')}`,
    ratio: me.deaths ? ((me.kills + me.assists) / me.deaths).toFixed(2) : 'Perfect',
    csm: (me.cs / minutes).toFixed(1),
    dmg: compact(me.totalDamageDealtToChampions ?? 0),
    kp: teamKills ? Math.round(((me.kills + me.assists) / teamKills) * 100) : 0,
    items,
    trinket: me.items[6] ?? 0,
    badge,
    opponent,
    score: remake ? null : mine,
    place,
    lp: m.lpChange ?? null,
  }
}

const groups = computed(() => {
  const out: {
    label: string
    rows: Array<{ m: Match; r: NonNullable<ReturnType<typeof row>> }>
    wins: number
    losses: number
    lp: number | null
  }[] = []
  for (const m of props.matches) {
    const r = row(m)
    if (!r) continue
    const label = dayLabel(Number(m.gameStartMs))
    let g = out.at(-1)
    if (g?.label !== label) {
      g = { label, rows: [], wins: 0, losses: 0, lp: null }
      out.push(g)
    }
    g.rows.push({ m, r })
    if (r.cls === 'w') g.wins++
    if (r.cls === 'l') g.losses++
    if (r.lp !== null) g.lp = (g.lp ?? 0) + r.lp
  }
  return out
})
const signedLp = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`
const href = (m: Match) => `${profilePath(props.gameName, props.tagLine)}/match/${m.matchId}`
</script>

<template>
  <div v-for="g in groups" :key="g.label" class="mh-grp">
    <div class="mh-day">
      <span class="lab">{{ g.label }}</span>
      <span class="meta num"
        >{{ g.wins }}W {{ g.losses }}L<template v-if="g.lp !== null">
          · {{ signedLp(g.lp) }} LP</template
        ></span
      >
    </div>
    <div class="mh-list">
      <Link
        v-for="{ m, r } in g.rows"
        :key="m.matchId"
        class="mrow mr"
        :class="r.cls"
        :href="href(m)"
      >
        <div class="ch">
          <img
            class="por"
            :src="champIcon(r.me.championId)"
            :alt="championName(r.me.championId)"
            width="48"
            height="48"
          />
          <span class="lv num">{{ r.me.champLevel }}</span>
          <div class="sp">
            <img v-for="s in r.me.spells.slice(0, 2)" :key="s" :src="assetUrl('spell', s)" alt="" />
          </div>
          <div class="sp">
            <img
              v-if="r.me.perks?.keystone"
              class="rn"
              :src="assetUrl('rune', r.me.perks.keystone)"
              alt=""
            />
            <img
              v-if="r.me.perks?.sub"
              class="rn sub"
              :src="assetUrl('runeStyle', r.me.perks.sub)"
              alt=""
            />
          </div>
        </div>
        <div class="col mr-q" style="gap: 4px; min-width: 0">
          <span class="q ell">{{ r.queue }}</span>
          <span class="rs meta"
            ><b>{{ r.res }}</b> · {{ r.dur }}</span
          >
        </div>
        <div class="col" style="gap: 4px; min-width: 0">
          <span class="kda"
            >{{ r.me.kills }}<span class="s">/</span><span class="dd">{{ r.me.deaths }}</span
            ><span class="s">/</span>{{ r.me.assists }}</span
          >
          <span class="meta ell">{{ r.ratio }} KDA · {{ r.kp }}% KP</span>
        </div>
        <div class="col mr-cs" style="gap: 4px; min-width: 0">
          <span class="h5 num">{{ r.csm }} <span class="meta">CS/min</span></span>
          <span class="meta num">{{ r.dmg }} dmg</span>
        </div>
        <div class="its">
          <div>
            <template v-for="(it, i) in r.items" :key="i">
              <img v-if="it" :src="assetUrl('item', it)" alt="" />
              <span v-else class="e" />
            </template>
            <img v-if="r.trinket" class="tr" :src="assetUrl('item', r.trinket)" alt="" />
            <span v-else class="e tr" />
          </div>
          <span v-if="r.badge" class="bdg">{{ r.badge }}</span>
        </div>
        <div class="vs">
          <template v-if="r.opponent"
            >vs<img
              class="pic"
              :src="champIcon(r.opponent.championId)"
              :alt="championName(r.opponent.championId)"
              :title="`Against ${championName(r.opponent.championId)}`"
          /></template>
        </div>
        <ScoreDial :value="r.score" size="sm" :place="r.place" />
        <span class="lp num" :class="r.lp === null ? '' : r.lp > 0 ? 'wn' : 'ls'">{{
          r.lp === null ? '' : signedLp(r.lp)
        }}</span>
        <Icon name="chevr" :size="14" class="cv" />
      </Link>
    </div>
  </div>
</template>
