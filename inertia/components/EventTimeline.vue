<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import ObjectiveGlyph from './ObjectiveGlyph.vue'
import { champIcon, championName, POSITION_NAMES } from '../lib/assets.js'
import { mmss, num, relation, signedK as signedGold } from '../lib/match_view.js'
import type { MatchView, Objective, PlayerView, TimelineView } from '../lib/match_view.js'
import {
  FIGHT_GAP,
  PHASES,
  involves,
  isEpic,
  leadFor,
  scoreAt,
  storyOf,
  valueAt,
} from '../lib/match_story.js'
import type { Fight, GameEvent, KillEvent, ObjectiveEvent, PhaseId } from '../lib/match_story.js'

/**
 * The game as a story told on one rail. By default it is the selected player's story (their
 * kills, deaths and assists, what they took, and the map-changing objectives as quiet context);
 * "Whole game" tells everyone's. Three chapters (laning, mid, late), each opening with what that
 * stretch came to; kills a few seconds apart fold into one fight with its score. Hovering an
 * event shows the state of the game at that second. Colour is the side an event counts for, seen
 * from the viewed player (blue yours, red theirs).
 */
const props = defineProps<{
  detail: MatchView
  timeline: TimelineView
  selected: number
  me?: PlayerView
}>()
const emit = defineEmits<{ select: [index: number] }>()

const scope = shallowRef<'player' | 'game'>('player')
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'kills', label: 'Kills' },
  { id: 'objectives', label: 'Objectives' },
] as const
const filter = shallowRef<(typeof FILTERS)[number]['id']>('all')

const story = computed(() => storyOf(props.detail, props.timeline))
const player = (pid: number) => story.value.byId.get(pid)
const focus = computed(() => props.detail.players[props.selected])
const us = computed(() => props.me?.teamId ?? props.detail.players[0]?.teamId ?? 100)
const them = computed(() => (us.value === 100 ? 200 : 100))
const tone = (team: number) => relation(team, props.me)
const lead = computed(() => leadFor(props.timeline, us.value))
const duration = computed(() =>
  Math.max(props.detail.duration, props.timeline.t[props.timeline.t.length - 1] ?? 0)
)

const groups = computed(() => {
  const ps = props.detail.players.map((p, i) => ({ p, i }))
  return [
    ps.filter((x) => x.p.teamId === us.value),
    ps.filter((x) => x.p.teamId !== us.value),
  ].filter((g) => g.length)
})
function pick(i: number) {
  scope.value = 'player'
  emit('select', i)
}

// --- wording -----------------------------------------------------------------------------------------

const DRAGONS: Record<string, string> = {
  AIR_DRAGON: 'Cloud drake',
  FIRE_DRAGON: 'Infernal drake',
  EARTH_DRAGON: 'Mountain drake',
  WATER_DRAGON: 'Ocean drake',
  HEXTECH_DRAGON: 'Hextech drake',
  CHEMTECH_DRAGON: 'Chemtech drake',
  ELDER_DRAGON: 'Elder dragon',
}
const OBJECTIVES: Record<Objective['kind'], string> = {
  dragon: 'Dragon',
  baron: 'Baron Nashor',
  herald: 'Rift Herald',
  grubs: 'Voidgrubs',
  monster: 'Epic monster',
  tower: 'Turret',
  inhibitor: 'Inhibitor',
}
const ICONS: Record<
  Objective['kind'],
  'tower' | 'inhib' | 'dragon' | 'grubs' | 'herald' | 'baron'
> = {
  dragon: 'dragon',
  baron: 'baron',
  herald: 'herald',
  grubs: 'grubs',
  monster: 'dragon',
  tower: 'tower',
  inhibitor: 'inhib',
}
const LANES: Record<string, string> = { TOP_LANE: 'Top', MID_LANE: 'Mid', BOT_LANE: 'Bot' }
const TOWERS: Record<string, string> = {
  OUTER_TURRET: 'outer',
  INNER_TURRET: 'inner',
  BASE_TURRET: 'base',
  NEXUS_TURRET: 'Nexus',
}
const MULTI = ['', '', 'Double kill', 'Triple kill', 'Quadra kill', 'Penta kill']
const PHASE_NAMES: Record<PhaseId, string> = {
  early: 'Laning phase',
  mid: 'Mid game',
  late: 'Late game',
}

function objName(o: Objective) {
  if (o.kind === 'dragon' && DRAGONS[o.sub]) return DRAGONS[o.sub]
  return OBJECTIVES[o.kind]
}
/** "Mid · outer" for buildings. */
function objWhere(o: Objective) {
  if (o.kind !== 'tower' && o.kind !== 'inhibitor') return ''
  return [LANES[o.lane], o.kind === 'tower' ? TOWERS[o.sub] : ''].filter(Boolean).join(' · ')
}
const champ = (pid: number) => {
  const p = player(pid)
  return p ? championName(p.championId) : ''
}
const icon = (pid: number) => champIcon(player(pid)?.championId ?? 0)
const who = (pid: number) => {
  const p = player(pid)
  return p ? `${p.gameName || championName(p.championId)} · ${championName(p.championId)}` : ''
}
const tagOf = (e: KillEvent) => (e.first ? 'First blood' : e.multi >= 2 ? MULTI[e.multi] : '')

// --- the feed ----------------------------------------------------------------------------------------

/** One line of the feed. `role` is the focused player's part in it (player scope only). */
interface Line {
  key: string
  ev: GameEvent
  role: 'killer' | 'victim' | 'assist' | 'took' | 'context' | 'game'
  /** Seconds after the start of its fight, for the lines inside one. */
  offset: number
  /** Entrance order (rows animate in a few milliseconds apart). */
  idx: number
}
interface Node {
  key: string
  t: number
  lines: Line[]
  fight?: { ours: number; theirs: number; end: number; big: boolean }
  idx: number
}
interface Chapter {
  id: PhaseId
  from: number
  to: number
  nodes: Node[]
  ours: number
  theirs: number
  /** Focused player's kills / deaths / assists in this chapter (player scope). */
  kda: [number, number, number]
  /** Gold lead (viewed player's team) when the chapter ends. */
  lead: number
}

function roleOf(e: GameEvent, pid: number): Line['role'] {
  if (scope.value === 'game') return 'game'
  if (e.kind === 'objective') return e.obj.killer === pid ? 'took' : 'context'
  if (e.kill.killer === pid) return 'killer'
  if (e.kill.victim === pid) return 'victim'
  return 'assist'
}

const chapters = computed<Chapter[]>(() => {
  const pid = focus.value?.participantId ?? -1
  const s = story.value
  const end = duration.value
  const kept = s.events.filter((e) => {
    if (scope.value === 'player') return involves(e, pid) || isEpic(e)
    if (filter.value === 'kills') return e.kind === 'kill'
    if (filter.value === 'objectives') return e.kind === 'objective'
    return true
  })

  const nodes: Node[] = []
  let open: { node: Node; fight: number; end: number } | null = null
  for (const e of kept) {
    const fightIndex = e.kind === 'kill' ? e.fight : -1
    const inFight =
      open && (fightIndex === open.fight || (e.kind === 'objective' && e.t <= open.end + FIGHT_GAP))
    if (open && inFight) {
      open.node.lines.push({
        key: e.key,
        ev: e,
        role: roleOf(e, pid),
        offset: e.t - open.node.t,
        idx: 0,
      })
      continue
    }
    open = null
    if (fightIndex >= 0) {
      const f: Fight = s.fights[fightIndex]
      const ours = f.kills.get(us.value) ?? 0
      const theirs = f.kills.get(them.value) ?? 0
      const node: Node = {
        key: `f${fightIndex}`,
        t: e.t,
        lines: [],
        fight: { ours, theirs, end: f.end, big: ours + theirs >= 5 },
        idx: 0,
      }
      node.lines.push({ key: e.key, ev: e, role: roleOf(e, pid), offset: 0, idx: 0 })
      nodes.push(node)
      open = { node, fight: fightIndex, end: f.end }
    } else
      nodes.push({
        key: e.key,
        t: e.t,
        lines: [{ key: e.key, ev: e, role: roleOf(e, pid), offset: 0, idx: 0 }],
        idx: 0,
      })
  }
  // Entrance order, capped so long feeds do not crawl in.
  let order = 0
  for (const n of nodes) {
    if (n.fight) n.idx = Math.min(order++, 18)
    for (const l of n.lines) l.idx = Math.min(order++, 18)
  }

  return PHASES.filter((ph) => ph.from < end).map((ph) => {
    const to = Math.min(ph.to, end)
    const inPhase = (x: number) => x >= ph.from && (x < ph.to || ph.to === Infinity)
    let ours = 0
    let theirs = 0
    const kda: [number, number, number] = [0, 0, 0]
    for (const e of s.events) {
      if (e.kind !== 'kill' || !inPhase(e.t)) continue
      if (e.team === us.value) ours++
      else theirs++
      if (e.kill.killer === pid) kda[0]++
      else if (e.kill.victim === pid) kda[1]++
      else if (e.kill.assists.includes(pid)) kda[2]++
    }
    return {
      id: ph.id,
      from: ph.from,
      to,
      nodes: nodes.filter((n) => inPhase(n.t)),
      ours,
      theirs,
      kda,
      lead: Math.round(valueAt(props.timeline.t, lead.value, to)),
    }
  })
})
const empty = computed(() => chapters.value.every((c) => !c.nodes.length))

/** State of the game at the hovered line: kill score and gold lead at that second. */
const hover = shallowRef<string | null>(null)
function stateAt(e: GameEvent) {
  const score = scoreAt(story.value, e.t)
  return {
    ours: score.get(us.value) ?? 0,
    theirs: score.get(them.value) ?? 0,
    lead: Math.round(valueAt(props.timeline.t, lead.value, e.t)),
  }
}

/** Who else took part in a kill: the assists, plus the killer when the focus only assisted. */
function company(l: Line): number[] {
  if (l.ev.kind !== 'kill') return []
  const k = l.ev.kill
  const ids = l.role === 'assist' ? [k.killer, ...k.assists] : k.assists
  const self = l.role === 'game' ? -1 : focus.value?.participantId
  return ids.filter((a) => a && a !== self)
}

const isKill = (e: GameEvent): e is KillEvent => e.kind === 'kill'
const isObj = (e: GameEvent): e is ObjectiveEvent => e.kind === 'objective'

// --- scroll edges: fade only where there is more to see -------------------------------------------------

const feed = shallowRef<HTMLElement | null>(null)
const edges = shallowRef({ top: false, bottom: false })
function measure() {
  const el = feed.value
  if (!el) return
  edges.value = {
    top: el.scrollTop > 4,
    bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
  }
}
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(measure)
  if (feed.value) ro.observe(feed.value)
  measure()
})
onBeforeUnmount(() => ro?.disconnect())
watch([chapters, scope], () =>
  requestAnimationFrame(() => {
    if (feed.value) feed.value.scrollTop = 0
    measure()
  })
)
/** The feed is rebuilt (and animates in again) when it tells another story. */
const feedKey = computed(() => `${scope.value}:${props.selected}:${filter.value}`)
</script>

<template>
  <div class="evt">
    <header v-if="timeline.hasEvents" class="evt-head">
      <div class="evt-scope" role="group" :aria-label="'Whose story'">
        <button
          type="button"
          class="evt-all"
          :class="{ on: scope === 'game' }"
          :aria-pressed="scope === 'game'"
          @click="scope = 'game'"
        >
          Whole game
        </button>
        <span v-for="(g, k) in groups" :key="k" class="evt-team" :class="k ? 'enemy' : 'ally'">
          <button
            v-for="{ p, i } in g"
            :key="p.participantId"
            type="button"
            :class="{ on: scope === 'player' && i === selected }"
            :title="`${p.gameName || championName(p.championId)} · ${championName(p.championId)}`"
            :aria-pressed="scope === 'player' && i === selected"
            @click="pick(i)"
          >
            <img :src="champIcon(p.championId)" alt="" />
          </button>
        </span>
      </div>
      <p v-if="scope === 'player' && focus" class="evt-who">
        <b>{{ focus.gameName || championName(focus.championId) }}</b>
        <small
          >{{ championName(focus.championId)
          }}<template v-if="focus.position">
            · {{ POSITION_NAMES[focus.position] ?? focus.position }}</template
          ></small
        >
      </p>
      <div v-else class="seg seg-sm evt-filter">
        <button
          v-for="f in FILTERS"
          :key="f.id"
          type="button"
          :data-active="filter === f.id"
          @click="filter = f.id"
        >
          {{ f.label }}
        </button>
      </div>
    </header>

    <p v-if="!timeline.hasEvents" class="evt-empty">
      This game was stored before invade.lol kept its kills and objectives.
    </p>
    <p v-else-if="empty" class="evt-empty">Nothing here</p>
    <div
      v-else
      ref="feed"
      :key="feedKey"
      class="evt-feed"
      :class="{ 'fade-top': edges.top, 'fade-bottom': edges.bottom }"
      @scroll.passive="measure"
    >
      <section v-for="c in chapters" :key="c.id" class="evt-chapter">
        <h4 class="evt-phase">
          <span class="evt-phase-name">{{ PHASE_NAMES[c.id] }}</span>
          <span class="evt-phase-time">{{ mmss(c.from) }}–{{ mmss(c.to) }}</span>
          <span class="evt-phase-facts">
            <span v-if="scope === 'player'" :title="'Kills / deaths / assists in this phase'">
              <b>{{ c.kda[0] }}</b
              ><i>/</i><b>{{ c.kda[1] }}</b
              ><i>/</i><b>{{ c.kda[2] }}</b>
            </span>
            <span v-else :title="'Kills in this phase'">
              <b class="ally">{{ c.ours }}</b
              ><i>–</i><b class="enemy">{{ c.theirs }}</b> kills
            </span>
            <span :title="`Team gold lead at ${mmss(c.to)}`">
              <b :class="c.lead > 0 ? 'ally' : c.lead < 0 ? 'enemy' : ''">{{
                c.lead === 0 ? 'even' : signedGold(c.lead)
              }}</b>
              gold
            </span>
          </span>
        </h4>

        <p v-if="!c.nodes.length" class="evt-quiet">
          {{
            scope === 'player'
              ? `Quiet for ${championName(focus?.championId ?? 0)}`
              : 'Nothing here'
          }}
        </p>
        <ol v-else class="evt-list">
          <li v-for="n in c.nodes" :key="n.key" class="evt-node" :class="{ fight: n.fight }">
            <div v-if="n.fight" class="evt-row evt-fight" :style="{ '--i': n.idx }">
              <time>{{ mmss(n.t) }}</time>
              <i
                class="evt-dot ring"
                :class="
                  n.fight.ours > n.fight.theirs
                    ? 'ally'
                    : n.fight.ours < n.fight.theirs
                      ? 'enemy'
                      : ''
                "
              />
              <span class="evt-body">
                <b>{{ n.fight.big ? 'Teamfight' : 'Skirmish' }}</b>
                <span class="evt-score"
                  ><em class="ally">{{ n.fight.ours }}</em
                  ><i>–</i><em class="enemy">{{ n.fight.theirs }}</em></span
                >
                <span class="evt-meta"
                  >{{
                    n.fight.ours > n.fight.theirs
                      ? 'won'
                      : n.fight.ours < n.fight.theirs
                        ? 'lost'
                        : 'traded'
                  }}
                  · {{ num(Math.max(1, n.fight.end - n.t)) }} s</span
                >
              </span>
            </div>
            <div
              v-for="l in n.lines"
              :key="l.key"
              class="evt-row"
              :class="[
                { nested: n.fight, context: l.role === 'context', on: hover === l.key },
                `r-${l.role}`,
              ]"
              :style="{ '--i': l.idx }"
              @mouseenter="hover = l.key"
              @mouseleave="hover = null"
            >
              <time>{{ n.fight ? (l.offset ? `+${l.offset}s` : '') : mmss(l.ev.t) }}</time>
              <i class="evt-dot" :class="[tone(l.ev.team), { hollow: l.role === 'context' }]" />

              <!-- Kills -->
              <span v-if="isKill(l.ev)" class="evt-body">
                <template v-if="l.role === 'killer'">
                  <span class="evt-verb">Killed</span>
                  <span class="evt-art dead"
                    ><img :src="icon(l.ev.kill.victim)" alt="" :title="who(l.ev.kill.victim)"
                  /></span>
                  <b>{{ champ(l.ev.kill.victim) }}</b>
                </template>
                <template v-else-if="l.role === 'victim'">
                  <span class="evt-verb">{{ l.ev.kill.killer ? 'Slain by' : 'Executed' }}</span>
                  <template v-if="l.ev.kill.killer">
                    <span class="evt-art"
                      ><img :src="icon(l.ev.kill.killer)" alt="" :title="who(l.ev.kill.killer)"
                    /></span>
                    <b>{{ champ(l.ev.kill.killer) }}</b>
                  </template>
                </template>
                <template v-else-if="l.role === 'assist'">
                  <span class="evt-verb">Helped kill</span>
                  <span class="evt-art dead"
                    ><img :src="icon(l.ev.kill.victim)" alt="" :title="who(l.ev.kill.victim)"
                  /></span>
                  <b>{{ champ(l.ev.kill.victim) }}</b>
                </template>
                <template v-else>
                  <template v-if="l.ev.kill.killer">
                    <span class="evt-art"
                      ><img :src="icon(l.ev.kill.killer)" alt="" :title="who(l.ev.kill.killer)"
                    /></span>
                    <b>{{ champ(l.ev.kill.killer) }}</b>
                  </template>
                  <span class="evt-verb">{{ l.ev.kill.killer ? 'killed' : 'Executed' }}</span>
                  <span class="evt-art dead"
                    ><img :src="icon(l.ev.kill.victim)" alt="" :title="who(l.ev.kill.victim)"
                  /></span>
                  <span class="evt-target">{{ champ(l.ev.kill.victim) }}</span>
                </template>
                <!-- Who else was there: the killer joins the stack when the focus only assisted. -->
                <span v-if="company(l).length" class="evt-stack" :title="'With'">
                  <img v-for="a in company(l)" :key="a" :src="icon(a)" :title="who(a)" alt="" />
                </span>
                <span v-if="tagOf(l.ev)" class="tag" :class="{ 'tag-gold': !l.ev.first }">{{
                  tagOf(l.ev)
                }}</span>
              </span>

              <!-- Objectives -->
              <span v-else-if="isObj(l.ev)" class="evt-body">
                <span
                  class="evt-obj"
                  :class="tone(l.ev.team)"
                  :title="l.ev.team === us ? 'Your team' : 'Enemy team'"
                  ><ObjectiveGlyph :name="ICONS[l.ev.obj.kind]" :size="15"
                /></span>
                <span v-if="l.role === 'took'" class="evt-verb">{{
                  l.ev.obj.kind === 'tower' || l.ev.obj.kind === 'inhibitor' ? 'Destroyed' : 'Took'
                }}</span>
                <b>{{ objName(l.ev.obj) }}</b>
                <span v-if="l.ev.count > 1" class="evt-meta">×{{ l.ev.count }}</span>
                <span v-if="objWhere(l.ev.obj)" class="evt-meta">{{ objWhere(l.ev.obj) }}</span>
                <span
                  v-if="l.role !== 'took' && player(l.ev.obj.killer)"
                  class="evt-stack solo"
                  :title="who(l.ev.obj.killer)"
                >
                  <img :src="icon(l.ev.obj.killer)" alt="" />
                </span>
              </span>

              <span v-if="hover === l.key" class="evt-state" aria-hidden="true">
                <template v-for="s in [stateAt(l.ev)]" :key="s.lead">
                  <span
                    ><em class="ally">{{ s.ours }}</em
                    ><i>–</i><em class="enemy">{{ s.theirs }}</em></span
                  >
                  <span :class="s.lead > 0 ? 'ally' : s.lead < 0 ? 'enemy' : ''">{{
                    s.lead === 0 ? 'even' : signedGold(s.lead)
                  }}</span>
                </template>
              </span>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
