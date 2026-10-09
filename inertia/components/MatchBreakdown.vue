<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { champIcon, championName } from '../lib/assets.js'
import { ordinal } from '../lib/format.js'
import { num, pct, relation, short as compact, signedK as signedGold } from '../lib/match_view.js'
import type { MatchView, PlayerView } from '../lib/match_view.js'

/**
 * Every number of the game, compared. Three reads, from quickest to deepest:
 * 1. What stood out for the selected player: the few stats where they ranked best in the lobby
 *    (or on their team), and the one where they ranked worst, each with its rank. Facts only.
 * 2. Two duels on one axis: the player against their lane opponent, and team against team.
 * 3. The full table: one column per player, one row per stat, the best value of each row in
 *    bold, the selected player's column lit; the row under the pointer shows its spread as small
 *    bars. A click on a column selects that player for every tab.
 */
const props = defineProps<{ detail: MatchView; selected: number; me?: PlayerView }>()
const emit = defineEmits<{ select: [index: number] }>()

const players = computed(() => props.detail.players)
const focus = computed(() => players.value[props.selected])
const minutes = computed(() => Math.max(1, props.detail.duration / 60))
const us = computed(() => props.me?.teamId ?? players.value[0]?.teamId ?? 100)
const twoSides = computed(() => players.value.some((p) => p.teamId !== us.value))
const opponent = computed(() =>
  players.value.find((p) => p.participantId === focus.value?.opponent)
)

// --- 1. what stood out -------------------------------------------------------------------------------

interface Fact {
  id: string
  figure: string
  label: string
  rank: string
  /** 0 (worst) ‥ 1 (best) in its scope. */
  standing: number
  tone?: 'ally' | 'enemy'
}
interface Candidate {
  id: string
  /** Wording after the figure; a function when it depends on the number (1 death, 2 deaths). */
  label: string | ((v: number) => string)
  value: (p: PlayerView) => number
  figure: (p: PlayerView) => string
  scope: 'game' | 'team'
  /** Lower is better (deaths). */
  low?: boolean
  /** Only meaningful as a strength (damage taken is a role, not a weakness). */
  strengthOnly?: boolean
}
const CANDIDATES: Candidate[] = [
  {
    id: 'damage',
    label: 'damage to champions',
    value: (p) => p.damage,
    figure: (p) => compact(p.damage),
    scope: 'game',
  },
  {
    id: 'share',
    label: 'of the team’s damage',
    value: (p) => p.damageShare,
    figure: (p) => pct(p.damageShare),
    scope: 'team',
  },
  {
    id: 'kp',
    label: 'kill participation',
    value: (p) => p.kp,
    figure: (p) => pct(p.kp),
    scope: 'team',
  },
  {
    id: 'csmin',
    label: 'CS per minute',
    value: (p) => p.csMin,
    figure: (p) => num(p.csMin, 1),
    scope: 'game',
  },
  {
    id: 'vision',
    label: 'vision score',
    value: (p) => p.vision,
    figure: (p) => num(p.vision),
    scope: 'game',
  },
  {
    id: 'deaths',
    label: (v) => (v === 1 ? 'death' : 'deaths'),
    value: (p) => p.deaths,
    figure: (p) => num(p.deaths),
    scope: 'game',
    low: true,
  },
  {
    id: 'taken',
    label: 'damage taken',
    value: (p) => p.damageTaken,
    figure: (p) => compact(p.damageTaken),
    scope: 'game',
    strengthOnly: true,
  },
  {
    id: 'objectives',
    label: 'damage to objectives',
    value: (p) => p.objectiveDamage,
    figure: (p) => compact(p.objectiveDamage),
    scope: 'game',
    strengthOnly: true,
  },
]

function rankLine(r: number, n: number, scope: 'game' | 'team', low: boolean) {
  if (r === 1)
    return scope === 'game'
      ? low
        ? 'Fewest in the game'
        : 'Most in the game'
      : low
        ? 'Fewest on the team'
        : 'Most on the team'
  if (r === n)
    return scope === 'game'
      ? low
        ? 'Most in the game'
        : 'Fewest in the game'
      : low
        ? 'Most on the team'
        : 'Fewest on the team'
  return scope === 'game' ? `${ordinal(r)} in the game` : `${ordinal(r)} on the team`
}

const facts = computed<Fact[]>(() => {
  const p = focus.value
  if (!p || props.detail.remake) return []
  const all: (Fact & { strengthOnly?: boolean })[] = []
  for (const c of CANDIDATES) {
    const pool =
      c.scope === 'game' ? players.value : players.value.filter((x) => x.teamId === p.teamId)
    if (pool.length < 2) continue
    const v = c.value(p)
    if (!c.low && v <= 0) continue
    const better = pool.filter((x) => (c.low ? c.value(x) < v : c.value(x) > v)).length
    const rank = better + 1
    // Ties at the top share it; a scope's spread decides how strong a rank reads.
    const standing = 1 - better / (pool.length - 1)
    all.push({
      id: c.id,
      figure: c.figure(p),
      label: typeof c.label === 'string' ? c.label : c.label(v),
      rank: rankLine(rank, pool.length, c.scope, !!c.low),
      standing: c.scope === 'team' ? standing * 0.92 : standing,
      strengthOnly: c.strengthOnly,
    })
  }
  // The lane at 15 minutes: a strength or a weakness on its own scale (1.5k gold = decisive).
  const opp = opponent.value
  if (opp && p.gold15 !== null && Math.abs(p.gold15) >= 300) {
    all.push({
      id: 'lane',
      figure: signedGold(p.gold15),
      label: `gold vs ${championName(opp.championId)} at 15:00`,
      rank: p.gold15 > 0 ? 'Won the lane' : 'Lost the lane',
      standing:
        p.gold15 > 0 ? 0.6 + Math.min(0.4, p.gold15 / 3750) : 0.4 - Math.min(0.4, -p.gold15 / 3750),
      tone:
        relation(p.teamId, props.me) === 'ally'
          ? p.gold15 > 0
            ? 'ally'
            : 'enemy'
          : p.gold15 > 0
            ? 'enemy'
            : 'ally',
    })
  }
  const strengths = all.filter((f) => f.standing >= 0.6).sort((a, b) => b.standing - a.standing)
  const weakness = all
    .filter((f) => !f.strengthOnly && f.standing <= 0.15)
    .sort((a, b) => a.standing - b.standing)[0]
  const out = strengths.slice(0, weakness ? 3 : 4)
  if (out.length < 3)
    out.push(
      ...all
        .filter((f) => !out.includes(f) && f !== weakness && f.standing > 0.3)
        .sort((a, b) => b.standing - a.standing)
        .slice(0, 3 - out.length)
    )
  if (weakness) out.push(weakness)
  return out
})

// --- 2. duels ----------------------------------------------------------------------------------------

interface DuelRow {
  label: string
  a: number
  b: number
  aText: string
  bText: string
  /** Lower is better. */
  low?: boolean
}
const duelRow = (
  label: string,
  a: number,
  b: number,
  f: (n: number) => string,
  low = false
): DuelRow => ({ label, a, b, aText: f(a), bText: f(b), low })
const winner = (r: DuelRow) => (r.a === r.b ? 0 : r.a > r.b !== !!r.low ? 1 : -1)
const share = (r: DuelRow) => (r.a + r.b > 0 ? (r.a / (r.a + r.b)) * 100 : 50)
const plain = (n: number) => num(Math.round(n))

const lane = computed(() => {
  const a = focus.value
  const b = opponent.value
  if (!a || !b) return null
  const ratio = (p: PlayerView) =>
    p.deaths ? (p.kills + p.assists) / p.deaths : p.kills + p.assists
  const rows = [
    {
      ...duelRow('KDA', ratio(a), ratio(b), () => ''),
      aText: `${a.kills}/${a.deaths}/${a.assists}`,
      bText: `${b.kills}/${b.deaths}/${b.assists}`,
    },
    duelRow('Damage to champions', a.damage, b.damage, compact),
    duelRow('Gold', a.gold, b.gold, compact),
    duelRow('CS', a.cs, b.cs, plain),
    duelRow('Damage taken', a.damageTaken, b.damageTaken, compact),
    duelRow('Vision score', a.vision, b.vision, plain),
  ]
  const at15 =
    a.gold15 !== null || a.cs15 !== null || a.xp15 !== null
      ? { gold: a.gold15, cs: a.cs15, xp: a.xp15 }
      : null
  return { a, b, rows, at15, bSide: relation(b.teamId, props.me) }
})
const at15Tone = (v: number) => {
  const good = relation(focus.value?.teamId ?? 0, props.me) === 'ally' ? v > 0 : v < 0
  return v === 0 ? '' : good ? 'ally' : 'enemy'
}
const signedNum = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v))}`

const teams = computed(() => {
  // Team against team reads only with two sides (Arena has more).
  if (!twoSides.value || props.detail.teams.length !== 2) return null
  const mine = props.detail.teams.find((x) => x.teamId === us.value)
  const theirs = props.detail.teams.find((x) => x.teamId !== us.value)
  if (!mine || !theirs) return null
  const sum = (team: number, f: (p: PlayerView) => number) =>
    players.value.filter((p) => p.teamId === team).reduce((s, p) => s + f(p), 0)
  return {
    names: props.me ? ['Your team', 'Enemy team'] : ['Blue side', 'Red side'],
    rows: [
      duelRow('Kills', mine.kills, theirs.kills, plain),
      duelRow('Gold', mine.gold, theirs.gold, compact),
      duelRow('Damage to champions', mine.damage, theirs.damage, compact),
      duelRow(
        'CS',
        sum(mine.teamId, (p) => p.cs),
        sum(theirs.teamId, (p) => p.cs),
        plain
      ),
      duelRow(
        'Vision score',
        sum(mine.teamId, (p) => p.vision),
        sum(theirs.teamId, (p) => p.vision),
        plain
      ),
      duelRow('Turrets', mine.towers, theirs.towers, plain),
      duelRow('Dragons', mine.dragons, theirs.dragons, plain),
      duelRow('Barons', mine.barons, theirs.barons, plain),
    ],
  }
})

// --- 3. the table ------------------------------------------------------------------------------------

interface Stat {
  label: string
  value: (p: PlayerView) => number | null
  text?: (p: PlayerView, v: number) => string
  low?: boolean
  /** Values can be negative (leads): no bars. */
  signed?: boolean
}
interface Section {
  label: string
  stats: Stat[]
}
const perMin = (v: number) => v / minutes.value
const SECTIONS = computed<Section[]>(() => {
  const anyAt15 = players.value.some((p) => p.gold15 !== null)
  const out: Section[] = [
    {
      label: 'Combat',
      stats: [
        {
          label: 'KDA',
          value: (p) => (p.deaths ? (p.kills + p.assists) / p.deaths : p.kills + p.assists + 0.01),
          text: (p) => `${p.kills}/${p.deaths}/${p.assists}`,
        },
        { label: 'Kill participation', value: (p) => p.kp, text: (_, v) => pct(v) },
      ],
    },
    {
      label: 'Damage',
      stats: [
        { label: 'To champions', value: (p) => p.damage, text: (_, v) => compact(v) },
        { label: 'Per minute', value: (p) => perMin(p.damage), text: (_, v) => num(Math.round(v)) },
        { label: 'Share of team', value: (p) => p.damageShare, text: (_, v) => pct(v) },
        { label: 'Physical', value: (p) => p.physical, text: (_, v) => compact(v) },
        { label: 'Magic', value: (p) => p.magic, text: (_, v) => compact(v) },
        { label: 'True', value: (p) => p.trueDamage, text: (_, v) => compact(v) },
        { label: 'To objectives', value: (p) => p.objectiveDamage, text: (_, v) => compact(v) },
        { label: 'To turrets', value: (p) => p.turretDamage, text: (_, v) => compact(v) },
        { label: 'Taken', value: (p) => p.damageTaken, text: (_, v) => compact(v) },
      ],
    },
    {
      label: 'Economy',
      stats: [
        { label: 'Gold', value: (p) => p.gold, text: (_, v) => compact(v) },
        {
          label: 'Gold per minute',
          value: (p) => perMin(p.gold),
          text: (_, v) => num(Math.round(v)),
        },
        { label: 'Gold share', value: (p) => p.goldShare, text: (_, v) => pct(v) },
        { label: 'CS', value: (p) => p.cs },
        { label: 'CS per minute', value: (p) => p.csMin, text: (_, v) => num(v, 1) },
        { label: 'Level', value: (p) => p.level },
      ],
    },
  ]
  if (anyAt15)
    out.push({
      label: 'Lane at 15:00',
      stats: [
        { label: 'Gold lead', value: (p) => p.gold15, text: (_, v) => signedGold(v), signed: true },
        { label: 'CS lead', value: (p) => p.cs15, text: (_, v) => signedNum(v), signed: true },
        { label: 'XP lead', value: (p) => p.xp15, text: (_, v) => signedGold(v), signed: true },
      ],
    })
  out.push({
    label: 'Vision',
    stats: [
      { label: 'Vision score', value: (p) => p.vision },
      { label: 'Per minute', value: (p) => perMin(p.vision), text: (_, v) => num(v, 2) },
      { label: 'Wards placed', value: (p) => p.wardsPlaced },
      { label: 'Wards destroyed', value: (p) => p.wardsKilled },
      { label: 'Control wards', value: (p) => p.controlWards },
    ],
  })
  return out
})

/** Columns: the viewed player's team first, a gap, then the other team. */
const columns = computed(() => {
  const ps = players.value.map((p, i) => ({ p, i }))
  const mine = ps.filter((x) => x.p.teamId === us.value)
  const rest = ps.filter((x) => x.p.teamId !== us.value)
  return { mine, rest, all: [...mine, ...rest] }
})

interface Cell {
  i: number
  text: string
  best: boolean
  zero: boolean
  /** 0‥1 on the row's scale; null = no bar. */
  bar: number | null
}
const table = computed(() =>
  SECTIONS.value.map((s) => ({
    label: s.label,
    rows: s.stats.map((stat) => {
      const vals = columns.value.all.map(({ p }) => stat.value(p))
      const known = vals.filter((v): v is number => v !== null)
      const best = known.length ? (stat.low ? Math.min(...known) : Math.max(...known)) : null
      const top = Math.max(0, ...known)
      const cells: Cell[] = columns.value.all.map(({ p, i }, k) => {
        const v = vals[k]
        if (v === null) return { i, text: '–', best: false, zero: true, bar: null }
        return {
          i,
          text: stat.text ? stat.text(p, v) : num(Math.round(v)),
          best:
            best !== null &&
            v === best &&
            (stat.low || v > 0) &&
            known.filter((x) => x === best).length < known.length,
          zero: Math.abs(v) < 1e-9,
          bar: stat.signed || top <= 0 ? null : Math.max(0, v) / top,
        }
      })
      return {
        label: stat.label,
        cells: [
          ...cells.slice(0, columns.value.mine.length),
          null,
          ...cells.slice(columns.value.mine.length),
        ],
      }
    }),
  }))
)
const span = computed(() => columns.value.all.length + (columns.value.rest.length ? 2 : 1))
const hoverCol = shallowRef<number | null>(null)
const who = (p: PlayerView) =>
  `${p.gameName || championName(p.championId)} · ${championName(p.championId)}`
</script>

<template>
  <div class="brk">
    <!-- 1. What stood out -->
    <section v-if="facts.length && focus" class="brk-facts" :aria-label="'What stood out'">
      <div v-for="f in facts" :key="f.id" class="brk-fact">
        <b class="brk-fig" :class="f.tone">{{ f.figure }}</b>
        <span class="brk-label">{{ f.label }}</span>
        <span class="brk-rank" :class="{ low: f.standing <= 0.15 }">{{ f.rank }}</span>
      </div>
    </section>

    <!-- 2. Duels -->
    <div v-if="lane || teams" class="brk-duels">
      <section v-if="lane" class="brk-duel">
        <header class="brk-duel-head">
          <span class="brk-side">
            <img :src="champIcon(lane.a.championId)" alt="" class="self" />
            <b :title="who(lane.a)">{{ lane.a.gameName || championName(lane.a.championId) }}</b>
          </span>
          <span class="brk-vs">vs</span>
          <span class="brk-side right">
            <b :title="who(lane.b)">{{ lane.b.gameName || championName(lane.b.championId) }}</b>
            <img :src="champIcon(lane.b.championId)" alt="" :class="lane.bSide" />
          </span>
        </header>
        <ul class="brk-rows">
          <li
            v-for="r in lane.rows"
            :key="r.label"
            class="brk-row"
            :style="{ '--a': `${share(r)}%` }"
          >
            <span class="brk-n" :class="{ win: winner(r) > 0 }">{{ r.aText }}</span>
            <span class="brk-row-label">{{ r.label }}</span>
            <span class="brk-n right" :class="{ win: winner(r) < 0 }">{{ r.bText }}</span>
            <span class="brk-split"
              ><i
                class="a self"
                :class="{ 'brk-ahead': winner(r) > 0, 'brk-even': !winner(r) }" /><i
                class="b"
                :class="[lane.bSide, { 'brk-ahead': winner(r) < 0, 'brk-even': !winner(r) }]"
            /></span>
          </li>
        </ul>
        <p v-if="lane.at15" class="brk-at15">
          <span>At 15:00</span>
          <span v-if="lane.at15.gold !== null"
            ><b :class="at15Tone(lane.at15.gold)">{{ signedGold(lane.at15.gold) }}</b> gold</span
          >
          <span v-if="lane.at15.cs !== null"
            ><b :class="at15Tone(lane.at15.cs)">{{ signedNum(lane.at15.cs) }}</b> CS</span
          >
          <span v-if="lane.at15.xp !== null"
            ><b :class="at15Tone(lane.at15.xp)">{{ signedGold(lane.at15.xp) }}</b> XP</span
          >
        </p>
      </section>

      <section v-if="teams" class="brk-duel">
        <header class="brk-duel-head">
          <span class="brk-side"
            ><b class="ally">{{ teams.names[0] }}</b></span
          >
          <span class="brk-vs">vs</span>
          <span class="brk-side right"
            ><b class="enemy">{{ teams.names[1] }}</b></span
          >
        </header>
        <ul class="brk-rows">
          <li
            v-for="r in teams.rows"
            :key="r.label"
            class="brk-row"
            :style="{ '--a': `${share(r)}%` }"
          >
            <span class="brk-n" :class="{ win: winner(r) > 0 }">{{ r.aText }}</span>
            <span class="brk-row-label">{{ r.label }}</span>
            <span class="brk-n right" :class="{ win: winner(r) < 0 }">{{ r.bText }}</span>
            <span class="brk-split"
              ><i
                class="a ally"
                :class="{ 'brk-ahead': winner(r) > 0, 'brk-even': !winner(r) }" /><i
                class="b enemy"
                :class="{ 'brk-ahead': winner(r) < 0, 'brk-even': !winner(r) }"
            /></span>
          </li>
        </ul>
      </section>
    </div>

    <!-- 3. Everything -->
    <div class="brk-table-wrap">
      <table class="brk-table" @pointerleave="hoverCol = null">
        <colgroup>
          <col class="brk-c-label" />
          <template v-for="(c, k) in columns.all" :key="c.i">
            <col v-if="k === columns.mine.length" class="brk-c-gap" />
            <col class="brk-c" :class="{ on: c.i === selected, hover: c.i === hoverCol }" />
          </template>
        </colgroup>
        <thead>
          <tr v-if="columns.rest.length" class="brk-teams">
            <th />
            <th :colspan="columns.mine.length" class="ally">
              {{ me ? 'Your team' : 'Blue side' }}
            </th>
            <th />
            <th :colspan="columns.rest.length" class="enemy">
              {{ me ? 'Enemy team' : 'Red side' }}
            </th>
          </tr>
          <tr class="brk-heads">
            <th />
            <template v-for="(c, k) in columns.all" :key="c.i">
              <th v-if="k === columns.mine.length" />
              <th>
                <button
                  type="button"
                  class="brk-pick"
                  :class="{ on: c.i === selected }"
                  :title="who(c.p)"
                  :aria-pressed="c.i === selected"
                  @pointerenter="hoverCol = c.i"
                  @click="emit('select', c.i)"
                >
                  <img :src="champIcon(c.p.championId)" alt="" />
                </button>
              </th>
            </template>
          </tr>
        </thead>
        <tbody v-for="s in table" :key="s.label">
          <tr class="brk-section">
            <th :colspan="span">{{ s.label }}</th>
          </tr>
          <tr v-for="r in s.rows" :key="r.label">
            <th scope="row" :title="r.label">{{ r.label }}</th>
            <template v-for="(c, k) in r.cells" :key="k">
              <td v-if="!c" class="brk-gap" />
              <td
                v-else
                :class="{ best: c.best, zero: c.zero, on: c.i === selected }"
                @pointerenter="hoverCol = c.i"
                @click="emit('select', c.i)"
              >
                <span class="brk-v">{{ c.text }}</span>
                <span v-if="c.bar !== null" class="brk-bar"
                  ><i :style="{ width: `${c.bar * 100}%` }"
                /></span>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
