<script setup lang="ts">
import { computed } from 'vue'
import { ChampIcon, useFormat, useNames } from '@invadelol/ui'
import type { MatchDetail } from '@invadelol/ui/logic'
import VioletLine from './ui/VioletLine.vue'

/**
 * Below the match page's scoreboard (Violet line): the gold lead over the game as one violet line,
 * from the viewed player's side (blue side when nobody is viewed), with the objectives marked where
 * they fell; and damage to champions, everyone on one scale, their own team in blue.
 */
const props = defineProps<{ detail: MatchDetail; puuid: string }>()
const { mmss, signedGold, compact } = useFormat()
const { champName } = useNames()

const me = computed(() => props.detail.players.find((p) => p.puuid === props.puuid))
/** +1 when the lead is read for blue side, -1 for red side. */
const sign = computed(() => (me.value?.teamId === 200 ? -1 : 1))
const ours = computed(() => (sign.value > 0 ? 'Blue side' : 'Red side'))
const theirs = computed(() => (sign.value > 0 ? 'Red side' : 'Blue side'))

const H = 190
const PAD = 14
const gold = computed(() => {
  const t = props.detail.timeline
  if (!t || t.t.length < 3) return null
  const values = t.goldDiff.map((v) => v * sign.value)
  const end = t.t[t.t.length - 1] || 1
  const reach = Math.max(1000, ...values.map(Math.abs)) * 1.15
  const at = (seconds: number) => {
    let i = t.t.findIndex((s) => s >= seconds)
    if (i <= 0) return values[Math.max(0, i)] ?? 0
    const f = (seconds - t.t[i - 1]) / (t.t[i] - t.t[i - 1] || 1)
    return values[i - 1] + (values[i] - values[i - 1]) * f
  }
  const y = (v: number) => PAD + (1 - (v + reach) / (2 * reach)) * (H - PAD * 2)
  const LETTER: Record<string, string> = { dragon: 'D', herald: 'H', baron: 'B', tower: 'T' }
  const marks = t.objectives
    .filter((o) => LETTER[o.kind])
    .map((o) => ({
      key: `${o.kind}${o.t}${o.team}`,
      letter: LETTER[o.kind],
      left: `${(o.t / end) * 100}%`,
      top: `${y(at(o.t)).toFixed(1)}px`,
      mine: (o.team === 100 ? 1 : -1) === sign.value,
      title: `${o.kind === 'tower' ? 'Tower' : o.kind[0].toUpperCase() + o.kind.slice(1)} at ${mmss(o.t)}, ${o.team === 100 ? 'blue side' : 'red side'}`,
    }))
  /* The minute from which the side ahead at the end stayed ahead. */
  const final = values[values.length - 1]
  let from = 0
  for (let i = values.length - 1; i >= 0; i--) {
    if (Math.sign(values[i]) !== Math.sign(final) || values[i] === 0) {
      from = i + 1
      break
    }
  }
  return {
    values,
    xs: t.t.map((s) => s / end),
    min: -reach,
    max: reach,
    zero: y(0),
    marks,
    final,
    from: Math.round((t.t[Math.min(from, t.t.length - 1)] ?? 0) / 60),
    end,
  }
})

const damage = computed(() => {
  const top = Math.max(1, ...props.detail.players.map((p) => p.damage))
  const team = me.value?.teamId ?? 100
  return [...props.detail.players]
    .sort((a, b) => b.damage - a.damage)
    .map((p) => ({ p, width: `${(p.damage / top) * 100}%`, ally: p.teamId === team }))
})
</script>

<template>
  <div class="two">
    <section v-if="gold" class="rd-card">
      <div class="rd-head">
        <h3>
          Gold lead<span class="rd-meta">{{
            gold.final === 0
              ? 'Even at the end'
              : `${gold.final > 0 ? ours : theirs} ahead from minute ${gold.from}`
          }}</span>
        </h3>
        <span
          class="rd-fig num big"
          :class="gold.final > 0 ? 'rd-up' : gold.final < 0 ? 'rd-dn' : ''"
          >{{ signedGold(gold.final) }}</span
        >
      </div>
      <div class="gch">
        <VioletLine
          :values="gold.values"
          :xs="gold.xs"
          :min="gold.min"
          :max="gold.max"
          :height="H"
          :pad="PAD"
          :guides="[{ value: 0, below: 'Even' }]"
        />
        <span
          v-for="m in gold.marks"
          :key="m.key"
          class="ev"
          :class="{ mine: m.mine }"
          :style="{ left: m.left, top: m.top }"
          :title="m.title"
          >{{ m.letter }}</span
        >
      </div>
      <div class="gcx num">
        <span>0:00</span><span>D dragon, H herald, B baron, T tower</span
        ><span>{{ mmss(gold.end) }}</span>
      </div>
    </section>

    <section class="rd-card">
      <div class="rd-head">
        <h3>Damage to champions</h3>
      </div>
      <ul class="dmg">
        <li v-for="d in damage" :key="d.p.puuid" class="shr" :class="d.ally ? 'a' : 'e'">
          <ChampIcon :id="d.p.championId" :size="30" />
          <span class="truncate">{{ d.p.gameName || champName(d.p.championId) }}</span>
          <span class="rd-bar"><i :style="{ width: d.width }" /></span>
          <span class="num">{{ compact(d.p.damage) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.two {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 24px;
  align-items: start;
}
.two > :only-child {
  grid-column: 1 / -1;
}
.big {
  font-size: 20px;
}
.gch {
  position: relative;
  margin: 18px 20px 0;
}
.gch :deep(.gd .b) {
  left: 0;
  right: auto;
}
.ev {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  color: var(--text-1);
  background: var(--rd-card-2);
  box-shadow: 0 0 0 1px rgb(var(--loss-rgb) / 0.5);
}
.ev.mine {
  box-shadow: 0 0 0 1px rgb(var(--win-rgb) / 0.6);
}
.gcx {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 20px 16px;
  font-size: 11px;
  color: var(--text-3);
}
.dmg {
  margin: 0;
  padding: 8px 0 12px;
  list-style: none;
}
.shr {
  display: grid;
  grid-template-columns: 30px 96px minmax(0, 1fr) 44px;
  gap: 10px;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  font-size: 13px;
  color: var(--text-2);
}
.shr :deep(.iv-champ) {
  border-radius: 7px;
}
.shr .rd-bar {
  height: 6px;
}
.shr.a .rd-bar i {
  background: var(--win);
}
.shr.e .rd-bar i {
  background: var(--loss);
}
.shr > span:last-child {
  font-weight: 600;
  text-align: right;
  color: var(--text-1);
}
@media (max-width: 1000px) {
  .two {
    grid-template-columns: minmax(0, 1fr);
  }
  .gcx span:nth-child(2) {
    display: none;
  }
}
</style>
