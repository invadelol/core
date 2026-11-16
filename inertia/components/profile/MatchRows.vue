<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Frame from '../ui/Frame.vue'
import ScoreDial from '../ui/ScoreDial.vue'
import { assetUrl, champIcon, championName } from '../../lib/assets.js'
import { isRemake, scoreLobby } from '../../lib/match.js'
import { profilePath } from '../../lib/format.js'
import type { Match } from '../../lib/types.js'

/**
 * A profile's games as the board's rows (`.mrow.pm`), under the day they were played ("Today",
 * "Yesterday", the weekday this week, then dates): result, champion with spells and runes, KDA,
 * farm and kill share, items, both teams, the Invade score and the LP the game moved.
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
  if (diff < 7) return 'This week'
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}
const groups = computed(() => {
  const out: { label: string; rows: Match[] }[] = []
  for (const m of props.matches) {
    const label = dayLabel(Number(m.gameStartMs))
    const last = out.at(-1)
    if (last?.label === label) last.rows.push(m)
    else out.push({ label, rows: [m] })
  }
  return out
})

function row(m: Match) {
  const me = m.participants.find((p) => p.puuid === props.puuid)
  if (!me) return null
  const remake = isRemake(m)
  const minutes = Math.max(1, m.duration / 60)
  const teamKills = m.participants
    .filter((p) => p.teamId === me.teamId)
    .reduce((s, p) => s + p.kills, 0)
  const scores = scoreLobby(m)
  const mine = scores[props.puuid]?.score ?? null
  const best = Object.values(scores).reduce((a, s) => Math.max(a, s.score), 0)
  const at = new Date(Number(m.gameStartMs))
  const label = dayLabel(at.getTime())
  return {
    me,
    cls: remake ? 'r' : me.win ? 'w' : 'l',
    res: remake ? 'Remake' : me.win ? 'Win' : 'Loss',
    when:
      label === 'Today' || label === 'Yesterday'
        ? at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : label === 'This week'
          ? at.toLocaleDateString('en-GB', { weekday: 'long' })
          : at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    dur: `${Math.floor(m.duration / 60)}:${String(m.duration % 60).padStart(2, '0')}`,
    ratio: ((me.kills + me.assists) / Math.max(1, me.deaths)).toFixed(2),
    csm: (me.cs / minutes).toFixed(1),
    kp: teamKills ? Math.round(((me.kills + me.assists) / teamKills) * 100) : 0,
    allies: m.participants.filter((p) => p.teamId === me.teamId),
    enemies: m.participants.filter((p) => p.teamId !== me.teamId),
    score: remake ? null : mine,
    place: !remake && mine !== null && mine === best ? (me.win ? 'MVP' : 'ACE') : '',
    lp: m.lpChange ?? null,
  }
}
const href = (m: Match) => `${profilePath(props.gameName, props.tagLine)}/match/${m.matchId}`
</script>

<template>
  <template v-for="g in groups" :key="g.label">
    <span class="lab pm-day">{{ g.label }}</span>
    <template v-for="m in g.rows" :key="m.matchId">
      <Link v-if="row(m)" class="mrow pm" :class="row(m)!.cls" :href="href(m)">
        <div class="col" style="gap: 3px">
          <span class="res">{{ row(m)!.res }}</span>
          <span class="meta">{{ row(m)!.when }}</span>
          <span class="meta">{{ row(m)!.dur }}</span>
        </div>
        <div class="ch">
          <Frame
            :src="champIcon(row(m)!.me.championId)"
            size="s"
            :alt="championName(row(m)!.me.championId)"
          />
          <span class="lv">{{ row(m)!.me.champLevel }}</span>
          <div class="sp">
            <img
              v-for="s in row(m)!.me.spells.slice(0, 2)"
              :key="s"
              :src="assetUrl('spell', s)"
              alt=""
            />
          </div>
          <div class="sp">
            <img
              v-if="row(m)!.me.perks?.keystone"
              class="rn"
              :src="assetUrl('rune', row(m)!.me.perks.keystone)"
              alt=""
            />
            <img
              v-if="row(m)!.me.perks?.sub"
              class="rn"
              :src="assetUrl('runeStyle', row(m)!.me.perks.sub)"
              alt=""
              style="padding: 4px; background: var(--s3)"
            />
          </div>
        </div>
        <div class="col" style="gap: 3px">
          <span class="kda"
            >{{ row(m)!.me.kills }}<span class="sl">/</span
            ><span class="d">{{ row(m)!.me.deaths }}</span
            ><span class="sl">/</span>{{ row(m)!.me.assists }}</span
          >
          <span class="meta">{{ row(m)!.ratio }} KDA</span>
        </div>
        <div class="col" style="gap: 3px">
          <span class="h5 num">{{ row(m)!.me.cs }} CS</span>
          <span class="meta">{{ row(m)!.csm }} a minute</span>
          <span class="meta">{{ row(m)!.kp }}% of kills</span>
        </div>
        <div class="its">
          <img
            v-for="(it, i) in row(m)!.me.items.filter(Boolean).slice(0, 7)"
            :key="i"
            :src="assetUrl('item', it)"
            alt=""
          />
        </div>
        <div class="tms">
          <div>
            <img
              v-for="p in row(m)!.allies"
              :key="p.puuid"
              :class="{ me: p.puuid === puuid }"
              :src="champIcon(p.championId)"
              :alt="championName(p.championId)"
            />
          </div>
          <div class="en">
            <img
              v-for="p in row(m)!.enemies"
              :key="p.puuid"
              :src="champIcon(p.championId)"
              :alt="championName(p.championId)"
            />
          </div>
        </div>
        <ScoreDial :value="row(m)!.score" size="sm" :place="row(m)!.place" />
        <span class="lp" :class="row(m)!.lp === null ? '' : row(m)!.lp! > 0 ? 'wn' : 'ls'">{{
          row(m)!.lp === null ? '' : `${row(m)!.lp! > 0 ? '+' : '−'}${Math.abs(row(m)!.lp!)}`
        }}</span>
      </Link>
    </template>
  </template>
</template>
