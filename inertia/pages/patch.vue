<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../components/SiteLayout.vue'
import Icon from '../components/ui/Icon.vue'
import Select from '../components/ui/Select.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import Frame from '../components/ui/Frame.vue'
import TierChip from '../components/ui/TierChip.vue'
import WinRate from '../components/ui/WinRate.vue'
import ChangeMark from '../components/patch/ChangeMark.vue'
import ChangeTable from '../components/patch/ChangeTable.vue'
import NoteLines from '../components/patch/NoteLines.vue'
import { POSITION, positionOf } from '../components/header/sections.js'
import { patchSubRow } from '../components/header/sub_art.js'
import { champIcon, championSplash, skinSplash } from '../lib/assets.js'
import { patchName } from '../lib/patch.js'
import {
  noteCounts,
  type ChampionNote,
  type ChangeKind,
  type NoteLine,
  type PatchChampionStat,
  chromaSet,
  type PatchDaily,
  type PatchNotes,
  type PatchSkin,
  type PatchSkins,
} from '../lib/patch_notes.js'
import '../css/patch.css'

/**
 * `/patch/:version`: one patch's changes, from Riot's notes in the repository's data file. The
 * patch's first new skin across the top; the changed champions sorted into their main lane like a
 * champion select grid; picking one fills the stage below with its art, Riot's tables and what
 * the patch did to it in our games (tier, place in the role, win rate, the last two weeks by
 * day). Items, ARAM: Mayhem and bug fixes follow as short lists, and the new skins close the page
 * as a gallery (art, name, line and rarity, chromas as swatches). Buffs read green,
 * nerfs red, both violet. A patch without a data file says so.
 */
const props = defineProps<{
  /** The patch shown, as players name it ("26.22"). `patch` is the site's shared newest patch. */
  current: string
  notes: PatchNotes | null
  /** The patches with notes, newest first. */
  patches: string[]
  stats: {
    bracket: string
    games: number
    previous?: string | null
    byChampion: Record<number, PatchChampionStat>
  } | null
  daily?: PatchDaily | null
  /** Main roles from the newest statistics, when the patch has none of its own. */
  roles?: Record<number, string>
  slugs: Record<number, string>
  /** The new skins with the game's facts (rarity, line, chromas), when the server had them. */
  skins?: PatchSkins | null
}>()

const RANK: Record<string, string> = {
  emerald_plus: 'Emerald+',
  platinum_plus: 'Platinum+',
  diamond_plus: 'Diamond+',
  master_plus: 'Master+',
  all: 'all ranks',
}
const rank = computed(() => RANK[props.stats?.bracket ?? 'emerald_plus'] ?? 'Emerald+')
const counts = computed(() => (props.notes ? noteCounts(props.notes) : null))
const sub = computed(() => patchSubRow(props.patches, `/patch/${props.current}`))
const patchModel = computed({
  get: () => props.current,
  set: (v: string) => router.visit(`/patch/${v}`),
})
const patchOptions = computed(() => props.patches.map((p) => ({ value: p, label: p })))
/** The patch before, as players name it: the change tables' first row. */
const before = computed(() => {
  if (props.stats?.previous) return patchName(props.stats.previous)
  const [major, minor] = props.current.split('.').map(Number)
  return minor > 1 ? `${major}.${minor - 1}` : 'Before'
})

const n = (x: number) => x.toLocaleString('en-US')
const champHref = (id: number) => (props.slugs[id] ? `/champions/${props.slugs[id]}` : null)
const stat = (id: number) => props.stats?.byChampion[id] ?? null
const abilityIcon = (champion: number, key: string) =>
  `/cdn/ability/${champion}-${key.toLowerCase()}.png`
const keyName = (key: string) => (key === 'base' ? 'Base' : key)

const published = computed(() => {
  if (!props.notes?.published) return null
  const d = new Date(`${props.notes.published}T12:00:00Z`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
})
const aramCount = computed(() =>
  props.notes?.aram
    ? props.notes.aram.champions.length +
      props.notes.aram.augments.length +
      (props.notes.aram.systems?.length ?? 0)
    : 0
)

/* ── The banner: the patch's first new skin ────────────────────── */
const banner = computed(() => {
  const s = props.notes?.skins[0]
  if (s) return skinSplash(s.champion, s.skin)
  const first = props.notes?.champions[0]
  return first ? championSplash(first.id) : null
})

/* ── The skins: a gallery of the new ones, then older skins' new chromas ── */
/** The game's facts when the server had them, else the notes' own names. */
const skinView = computed<PatchSkins>(() => {
  if (props.skins) return props.skins
  const sets = (props.notes?.chromas ?? []).map(chromaSet)
  return {
    skins: (props.notes?.skins ?? []).map((s) => ({
      ...s,
      champions: [s.champion],
      rarity: null,
      line: null,
      chromas: (sets.find((c) => c.skin === s.name)?.names ?? []).map((name) => ({
        name,
        color: null,
      })),
    })),
    chromas: sets
      .filter((c) => c.names.length && !props.notes?.skins.some((s) => s.name === c.skin))
      .map((c) => ({
        skin: c.skin,
        champion: null,
        chromas: c.names.map((name) => ({ name, color: null })),
      })),
  }
})
/**
 * Rows of three across a 6-column grid; a row of two stretches over the whole width (never a
 * lone card on the last row: four are two rows of two, seven 3 + 2 + 2).
 */
const skinCards = computed(() => {
  const list = skinView.value.skins
  const n = list.length
  const rows: number[] = []
  for (let left = n; left > 0; left -= rows[rows.length - 1])
    rows.push(left === 4 || left === 2 ? 2 : left === 1 ? 1 : 3)
  let i = 0
  return rows.flatMap((size) => list.slice(i, (i += size)).map((s) => ({ s, span: 6 / size })))
})
const chromaCount = computed(
  () =>
    skinView.value.skins.reduce((n, s) => n + s.chromas.length, 0) +
    skinView.value.chromas.reduce((n, c) => n + c.chromas.length, 0)
)
/** On touch, a skin's chromas name themselves on a tap. */
const chromaOpen = ref<string | null>(null)
const skinKey = (s: { champion: number; skin: number }) => `${s.champion}-${s.skin}`
const skinMeta = (s: PatchSkin) => [s.line, s.rarity].filter(Boolean).join(', ')

/* ── The lanes: each changed champion in its main role ─────────── */
const LANES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
const KIND_ORDER: Record<ChangeKind, number> = { up: 0, down: 1, mix: 2, new: 3 }
const roleOf = (id: number) => stat(id)?.position ?? props.roles?.[id] ?? null
const lanes = computed(() => {
  const list = [...(props.notes?.champions ?? [])].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  )
  const out = LANES.map((p) => ({
    key: p as string,
    label: POSITION[p].label,
    lane: POSITION[p].lane as string | null,
    champions: list.filter((c) => roleOf(c.id) === p),
  }))
  const rest = list.filter((c) => !LANES.includes(roleOf(c.id) as (typeof LANES)[number]))
  if (rest.length) out.push({ key: 'OTHER', label: 'Other', lane: null, champions: rest })
  return out
})
const byLane = computed(() => lanes.value.some((l) => l.key !== 'OTHER'))
const lane = ref<string>('all')
const shownLanes = computed(() =>
  lane.value === 'all' ? lanes.value : lanes.value.filter((l) => l.key === lane.value)
)
const firstChampion = computed(() => lanes.value.find((l) => l.champions.length)?.champions[0])

/* ── The stage: the picked champion ────────────────────────────── */
const picked = ref<number | null>(null)
const champion = computed<ChampionNote | null>(() => {
  const list = props.notes?.champions ?? []
  return list.find((c) => c.id === picked.value) ?? firstChampion.value ?? list[0] ?? null
})
const stage = ref<HTMLElement | null>(null)
function pick(id: number, scroll = true) {
  picked.value = id
  if (typeof window !== 'undefined') history.replaceState(history.state, '', `#c${id}`)
  if (!scroll) return
  void nextTick(() => {
    const el = stage.value
    if (!el) return
    const box = el.getBoundingClientRect()
    if (box.top > window.innerHeight * 0.6 || box.top < 0)
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
function pickLane(key: string) {
  lane.value = key
  const group = lanes.value.find((l) => l.key === key)
  if (group?.champions.length && !group.champions.some((c) => c.id === champion.value?.id))
    pick(group.champions[0].id, false)
}
const changed = (c: ChampionNote) => {
  const abilities = c.blocks.filter((b) => b.key !== 'base').length
  const base = c.blocks.some((b) => b.key === 'base')
  const parts = []
  if (base) parts.push('base stats')
  if (abilities) parts.push(`${abilities} ${abilities === 1 ? 'ability' : 'abilities'}`)
  return `${parts.join(' and ')} changed`
}
const laneWord = (id: number) => {
  const p = roleOf(id)
  return p ? positionOf(p).label : null
}

/* ── What the patch did: rank in role and the daily line ───────── */
function move(s: PatchChampionStat) {
  if (s.rank === null || s.prevRank === null) return null
  const d = s.prevRank - s.rank
  return { d, text: d ? `${d > 0 ? '+' : '−'}${Math.abs(d)}` : '=' }
}
const DW = 260
const DH = 56
const line = computed(() => {
  const c = champion.value
  const days = props.daily?.days
  const values = c ? props.daily?.lines[c.id] : null
  if (!c || !days || !values || values.filter((v) => v !== null).length < 3) return null
  const shown = values.filter((v): v is number => v !== null)
  const lo = Math.min(0.45, ...shown.map((v) => v - 0.01))
  const hi = Math.max(0.55, ...shown.map((v) => v + 0.01))
  const x = (i: number) => 2 + (i / (days.length - 1)) * (DW - 4)
  const y = (v: number) => DH - 3 - ((v - lo) / (hi - lo)) * (DH - 6)
  const pts = values.flatMap((v, i) => (v === null ? [] : [[x(i), y(v)] as const]))
  const path = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${pts[0][0].toFixed(1)},${DH} ${path} ${pts[pts.length - 1][0].toFixed(1)},${DH}`
  const at = props.notes?.published ? days.indexOf(props.notes.published) : -1
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    })
  return {
    path,
    area,
    mid: y(0.5),
    patch: at >= 0 ? x(at) : null,
    last: pts[pts.length - 1],
    range: `${fmt(days[0]).split(' ')[0]} to ${fmt(days[days.length - 1])}`,
  }
})

/* ── Short lists: items, ARAM: Mayhem, bug fixes ───────────────── */
type AramRow = {
  key: string
  name: string
  kind: ChangeKind | null
  icon: string | null
  scope?: string
  lines: NoteLine[]
}
const aramRows = computed<AramRow[]>(() => {
  const a = props.notes?.aram
  if (!a) return []
  return [
    ...a.champions.map((c) => ({
      key: `c${c.id}`,
      name: c.name,
      kind: c.kind,
      icon: champIcon(c.id),
      scope: c.scope,
      lines: c.lines,
    })),
    ...a.augments.map((g) => ({
      key: `a${g.name}`,
      name: g.name,
      kind: g.kind,
      icon: g.id ? `/cdn/augment/${g.id}.png` : null,
      lines: g.lines,
    })),
    ...(a.systems ?? []).map((l, i) => ({
      key: `s${i}`,
      name: 'Systems',
      kind: null,
      icon: null,
      lines: [l],
    })),
  ]
})
const ARAM_SHOWN = 6
const BUGS_SHOWN = 5
const aramOpen = ref(false)
const bugsOpen = ref(false)

/* ── The section tabs follow the scroll ────────────────────────── */
const TABS = computed(() => {
  const notes = props.notes
  if (!notes) return []
  return [
    { id: 'champions', label: 'Champions', n: notes.champions.length },
    { id: 'items', label: 'Items', n: notes.items.length },
    { id: 'aram', label: 'ARAM: Mayhem', n: aramCount.value },
    { id: 'bugs', label: 'Bug fixes', n: notes.bugs.length },
    { id: 'skins', label: 'Skins', n: notes.skins.length || skinView.value.chromas.length },
  ].filter((t) => t.n > 0)
})
const active = ref('champions')
let observer: IntersectionObserver | undefined
onMounted(() => {
  const m = /^#c(\d+)$/.exec(window.location.hash)
  if (m && props.notes?.champions.some((c) => c.id === Number(m[1]))) {
    picked.value = Number(m[1])
    void nextTick(() => stage.value?.scrollIntoView({ block: 'start' }))
  }
  observer = new IntersectionObserver(
    (entries) => {
      const seen = entries.filter((e) => e.isIntersecting).map((e) => e.target.id)
      if (seen.length) active.value = seen[0]
    },
    { rootMargin: '-30% 0px -60% 0px' }
  )
  for (const t of TABS.value) {
    const el = document.getElementById(t.id)
    if (el) observer.observe(el)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <Head :title="notes ? `Patch ${current} notes` : `Patch ${current}`" />
  <SiteLayout :sub="sub" patch-on>
    <div class="pnb">
      <section v-if="notes" class="hb">
        <img v-if="banner" :key="banner" class="hb-img" :src="banner" alt="" fetchpriority="high" />
        <div class="wrap hb-in">
          <div class="hb-l">
            <nav class="crumbs" aria-label="Breadcrumb">
              <Link href="/patch" prefetch>Patch notes</Link><Icon name="chevr" :size="12" /><span
                class="t1"
                aria-current="page"
                >{{ current }}</span
              >
            </nav>
            <h1 class="d1 hb-t">Patch {{ current }}</h1>
            <div class="pa-date">
              <span v-if="published">Published {{ published }}</span>
              <a :href="notes.source" target="_blank" rel="noreferrer"
                >Riot's notes<Icon name="external" :size="13"
              /></a>
              <Select
                v-if="patchOptions.length > 1"
                v-model="patchModel"
                :options="patchOptions"
                label="Patch"
                width="9rem"
                class="pn-sel"
              />
            </div>
            <p v-if="counts" class="pa-c">
              <span class="up"
                ><b class="num">{{ counts.up }}</b
                >buffs</span
              ><i /><span class="down"
                ><b class="num">{{ counts.down }}</b
                >nerfs</span
              ><i /><span class="mix"
                ><b class="num">{{ counts.mix }}</b
                >adjusted</span
              ><template v-if="counts.items"
                ><i /><span
                  ><b class="num">{{ counts.items }}</b
                  >items</span
                ></template
              ><template v-if="aramCount"
                ><i /><span
                  ><b class="num">{{ aramCount }}</b
                  >ARAM: Mayhem</span
                ></template
              ><template v-if="notes.skins.length"
                ><i /><span
                  ><b class="num">{{ notes.skins.length }}</b
                  >skins</span
                ></template
              ><template v-if="notes.bugs.length"
                ><i /><span
                  ><b class="num">{{ notes.bugs.length }}</b
                  >bug fixes</span
                ></template
              >
            </p>
          </div>
        </div>
      </section>

      <div class="wrap">
        <template v-if="notes">
          <nav class="pn-tabs pb-tabs" aria-label="Sections">
            <a
              v-for="t in TABS"
              :key="t.id"
              :href="`#${t.id}`"
              :class="{ on: active === t.id }"
              @click="active = t.id"
              >{{ t.label }}<span class="n num">{{ t.n }}</span></a
            >
          </nav>

          <section id="champions" class="sec pb-first" aria-labelledby="pn-champions">
            <div class="sec-h">
              <h2 id="pn-champions" class="h2">Champions by lane</h2>
              <span class="meta">{{
                stats ? `Each champion in its main role, ${rank}` : 'Each champion in its main role'
              }}</span>
              <div v-if="byLane" class="more lp" role="group" aria-label="Lane">
                <button type="button" :class="{ on: lane === 'all' }" @click="pickLane('all')">
                  All<span class="n num">{{ notes.champions.length }}</span>
                </button>
                <button
                  v-for="l in lanes"
                  :key="l.key"
                  type="button"
                  :class="{ on: lane === l.key }"
                  :disabled="!l.champions.length"
                  @click="pickLane(l.key)"
                >
                  <RoleIcon v-if="l.lane" :lane="l.lane" :size="15" />{{ l.label
                  }}<span class="n num">{{ l.champions.length }}</span>
                </button>
              </div>
            </div>

            <div class="lns" :class="{ one: shownLanes.length === 1 }">
              <div v-for="l in shownLanes" :key="l.key" class="ln">
                <div class="ln-h">
                  <RoleIcon v-if="l.lane" :lane="l.lane" :size="16" /><b>{{ l.label }}</b
                  ><span class="t4 num">{{ l.champions.length }}</span>
                </div>
                <div v-if="l.champions.length" class="ln-g">
                  <a
                    v-for="c in l.champions"
                    :key="c.id"
                    :href="`#c${c.id}`"
                    class="pt"
                    :class="{ on: champion?.id === c.id }"
                    :aria-current="champion?.id === c.id ? 'true' : undefined"
                    @click.prevent="pick(c.id)"
                    ><span class="pt-i"
                      ><Frame
                        :src="champIcon(c.id)"
                        :width="64"
                        :alt="c.name"
                        size="s" /><ChangeMark :kind="c.kind" /></span
                    ><b>{{ c.name }}</b
                    ><span class="pt-k">{{
                      c.blocks.map((b) => keyName(b.key)).join(' ')
                    }}</span></a
                  >
                </div>
                <p v-else class="meta ln-e">No change</p>
              </div>
            </div>

            <article
              v-if="champion"
              :id="`c${champion.id}`"
              ref="stage"
              :key="champion.id"
              class="sg"
              aria-live="polite"
            >
              <div class="sg-a">
                <Frame
                  :src="championSplash(champion.id)"
                  width="100%"
                  :height="203"
                  size="l"
                  position="50% 25%"
                  class="sg-fr"
                  :alt="champion.name"
                  eager
                />
                <div class="sg-n">
                  <span class="row" style="gap: 12px">
                    <component
                      :is="champHref(champion.id) ? Link : 'span'"
                      class="h1"
                      :href="champHref(champion.id) ?? undefined"
                      >{{ champion.name }}</component
                    >
                    <ChangeMark :kind="champion.kind" pill />
                  </span>
                  <span class="meta sg-r"
                    ><RoleIcon
                      v-if="roleOf(champion.id)"
                      :lane="positionOf(roleOf(champion.id)!).lane"
                      :size="14"
                    /><template v-if="laneWord(champion.id)">{{ laneWord(champion.id) }}, </template
                    >{{ changed(champion) }}</span
                  >
                </div>
              </div>

              <div class="sg-b">
                <div class="sg-ch">
                  <div v-for="b in champion.blocks" :key="b.key + b.title" class="ct">
                    <div class="ct-h">
                      <span v-if="b.key === 'base'" class="ct-ai base"
                        ><Icon name="sliders" :size="16"
                      /></span>
                      <span v-else class="ct-ai"
                        ><img
                          :src="abilityIcon(champion.id, b.key)"
                          alt=""
                          width="30"
                          height="30"
                        /><i>{{ b.key }}</i></span
                      >
                      <span class="ct-n"
                        ><span v-if="b.key !== 'base'" class="ct-k">{{
                          b.key === 'P' ? 'Passive' : b.key
                        }}</span
                        ><b>{{ b.title }}</b></span
                      >
                    </div>
                    <ChangeTable
                      :lines="b.lines"
                      :kind="champion.kind"
                      :before="before"
                      :after="current"
                    />
                  </div>
                </div>

                <div v-if="stat(champion.id)" class="msh">
                  <span class="ms-t"
                    >Since the patch<span class="meta"
                      >{{ rank }}, {{ positionOf(stat(champion.id)!.position).label }}</span
                    ></span
                  >
                  <div class="msh-g">
                    <div class="msh-c">
                      <span class="lab">Tier</span>
                      <span class="mv-t"
                        ><template v-if="stat(champion.id)!.prevTier !== null"
                          ><TierChip :tier="stat(champion.id)!.prevTier" /><Icon
                            name="arrow"
                            :size="12" /></template
                        ><TierChip :tier="stat(champion.id)!.tier"
                      /></span>
                    </div>
                    <div class="msh-c">
                      <span class="lab"
                        >Rank in
                        {{ positionOf(stat(champion.id)!.position).label.toLowerCase() }}</span
                      >
                      <span
                        v-if="stat(champion.id)!.rank !== null"
                        class="mv-r"
                        :class="{
                          up: (move(stat(champion.id)!)?.d ?? 0) > 0,
                          down: (move(stat(champion.id)!)?.d ?? 0) < 0,
                        }"
                        ><template v-if="stat(champion.id)!.prevRank !== null"
                          ><span class="t3">#{{ stat(champion.id)!.prevRank }}</span
                          ><Icon name="arrow" :size="12" /></template
                        ><b>#{{ stat(champion.id)!.rank }}</b
                        ><i v-if="move(stat(champion.id)!)">{{
                          move(stat(champion.id)!)!.text
                        }}</i></span
                      >
                      <span v-else class="meta">Not ranked</span>
                    </div>
                    <div class="msh-c">
                      <span class="lab">Win rate</span>
                      <span class="msh-w"
                        ><WinRate :rate="stat(champion.id)!.win" :digits="1" :width="130" /><span
                          class="meta num"
                          >{{ n(stat(champion.id)!.games) }} games</span
                        ></span
                      >
                    </div>
                    <div v-if="line" class="msh-c wide">
                      <span class="lab">Win rate by day, {{ line.range }}</span>
                      <svg
                        class="spk"
                        :viewBox="`0 0 ${DW} ${DH}`"
                        :width="DW"
                        :height="DH"
                        role="img"
                        :aria-label="`${champion.name}'s win rate by day`"
                      >
                        <line class="spk-50" x1="0" :x2="DW" :y1="line.mid" :y2="line.mid" />
                        <line
                          v-if="line.patch !== null"
                          class="spk-p"
                          :x1="line.patch"
                          :x2="line.patch"
                          y1="0"
                          :y2="DH"
                        />
                        <polygon class="spk-a" :points="line.area" />
                        <polyline class="spk-l" :points="line.path" />
                        <circle class="spk-d" :cx="line.last[0]" :cy="line.last[1]" r="2.6" />
                        <text v-if="line.patch !== null" class="spk-t" :x="line.patch + 5" y="11">
                          {{ current }}
                        </text>
                        <text class="spk-t lo" x="2" :y="line.mid - 4">50%</text>
                      </svg>
                    </div>
                  </div>
                  <Link v-if="champHref(champion.id)" class="ms-a" :href="champHref(champion.id)!"
                    >{{ champion.name }} build<Icon name="chevr" :size="13"
                  /></Link>
                </div>
                <Link
                  v-else-if="champHref(champion.id)"
                  class="ms-a"
                  :href="champHref(champion.id)!"
                  >{{ champion.name }} build<Icon name="chevr" :size="13"
                /></Link>
              </div>
            </article>
          </section>

          <section
            v-if="notes.items.length || aramRows.length || notes.bugs.length"
            class="sec pb-last"
            aria-labelledby="pn-also"
          >
            <div class="sec-h">
              <h2 id="pn-also" class="h2">Also in {{ current }}</h2>
            </div>
            <div class="al">
              <div v-if="notes.items.length" id="items" class="al-c">
                <span class="lab"
                  >Items <span class="t4 num">{{ notes.items.length }}</span></span
                >
                <div v-for="it in notes.items" :key="it.id" class="al-r">
                  <span class="al-i"><img :src="`/cdn/item/${it.id}.png`" alt="" /></span>
                  <b>{{ it.name }}</b
                  ><ChangeMark :kind="it.kind" />
                  <div class="al-v"><NoteLines :lines="it.lines" :kind="it.kind" /></div>
                </div>
              </div>

              <div v-if="aramRows.length" id="aram" class="al-c">
                <span class="lab"
                  >ARAM: Mayhem <span class="t4 num">{{ aramRows.length }}</span></span
                >
                <div
                  v-for="r in aramOpen ? aramRows : aramRows.slice(0, ARAM_SHOWN)"
                  :key="r.key"
                  class="al-r"
                >
                  <span class="al-i" :class="{ g: !r.icon }"
                    ><img v-if="r.icon" :src="r.icon" alt="" /><Icon
                      v-else-if="r.name === 'Systems'"
                      name="settings"
                      :size="15"
                    /><template v-else>{{ r.name[0] }}</template></span
                  >
                  <b>{{ r.name }}</b
                  ><ChangeMark v-if="r.kind" :kind="r.kind" />
                  <span v-if="r.scope" class="meta al-s">{{ r.scope }}</span>
                  <div class="al-v"><NoteLines :lines="r.lines" :kind="r.kind ?? 'mix'" /></div>
                </div>
                <button
                  v-if="aramRows.length > ARAM_SHOWN"
                  type="button"
                  class="al-more"
                  :aria-expanded="aramOpen"
                  @click="aramOpen = !aramOpen"
                >
                  {{ aramOpen ? 'Fewer' : `${aramRows.length - ARAM_SHOWN} more`
                  }}<Icon name="chev" :size="13" :class="{ flip: aramOpen }" />
                </button>
              </div>

              <div v-if="notes.bugs.length" id="bugs" class="al-c">
                <span class="lab"
                  >Bug fixes <span class="t4 num">{{ notes.bugs.length }}</span></span
                >
                <p
                  v-for="(b, i) in bugsOpen ? notes.bugs : notes.bugs.slice(0, BUGS_SHOWN)"
                  :key="i"
                  class="al-b"
                >
                  {{ b }}
                </p>
                <button
                  v-if="notes.bugs.length > BUGS_SHOWN"
                  type="button"
                  class="al-more"
                  :aria-expanded="bugsOpen"
                  @click="bugsOpen = !bugsOpen"
                >
                  {{ bugsOpen ? 'Fewer' : `${notes.bugs.length - BUGS_SHOWN} more`
                  }}<Icon name="chev" :size="13" :class="{ flip: bugsOpen }" />
                </button>
              </div>
            </div>
          </section>

          <section
            v-if="skinView.skins.length || skinView.chromas.length"
            id="skins"
            class="sec pb-last sk"
            aria-labelledby="pn-skins"
          >
            <div class="sec-h">
              <h2 id="pn-skins" class="h2">Skins</h2>
              <span class="meta"
                >{{
                  skinView.skins.length
                    ? `${skinView.skins.length} new ${skinView.skins.length === 1 ? 'skin' : 'skins'}`
                    : 'New chromas'
                }}<template v-if="skinView.skins.length && chromaCount"
                  >, {{ chromaCount }} {{ chromaCount === 1 ? 'chroma' : 'chromas' }}</template
                ></span
              >
            </div>
            <div v-if="skinCards.length" class="sk-g">
              <figure
                v-for="{ s, span } in skinCards"
                :key="skinKey(s)"
                class="sk-c"
                :style="{ gridColumn: `span ${span}` }"
              >
                <span class="fr l sk-a"
                  ><img :src="skinSplash(s.champion, s.skin)" alt="" loading="lazy"
                /></span>
                <figcaption class="sk-t">
                  <b class="sk-n">{{ s.name }}</b>
                  <span v-if="s.champions.length > 1 || skinMeta(s)" class="sk-m">
                    <span v-if="s.champions.length > 1" class="sk-cs"
                      ><img
                        v-for="c in s.champions"
                        :key="c"
                        :src="champIcon(c)"
                        alt=""
                        loading="lazy" /></span
                    >{{ skinMeta(s) }}</span
                  >
                  <button
                    v-if="s.chromas.length"
                    type="button"
                    class="sk-ch"
                    :aria-expanded="chromaOpen === skinKey(s)"
                    :aria-label="`${s.chromas.length} ${s.chromas.length === 1 ? 'chroma' : 'chromas'}: ${s.chromas.map((c) => c.name).join(', ')}`"
                    @click="chromaOpen = chromaOpen === skinKey(s) ? null : skinKey(s)"
                  >
                    <span class="sk-sw"
                      ><i
                        v-for="c in s.chromas"
                        :key="c.name"
                        :class="{ none: !c.color }"
                        :style="c.color ? { background: c.color } : undefined"
                        :title="c.name"
                    /></span>
                    <span class="sk-cn">{{
                      s.chromas.length === 1 ? s.chromas[0].name : `${s.chromas.length} chromas`
                    }}</span>
                  </button>
                  <span v-if="chromaOpen === skinKey(s)" class="sk-names">{{
                    s.chromas.map((c) => c.name).join(', ')
                  }}</span>
                </figcaption>
              </figure>
            </div>
            <div v-if="skinView.chromas.length" class="sk-o">
              <span class="lab">New chromas for older skins</span>
              <div v-for="c in skinView.chromas" :key="c.skin" class="sk-or">
                <span class="sk-oi"
                  ><img v-if="c.champion" :src="champIcon(c.champion)" alt="" loading="lazy"
                /></span>
                <b>{{ c.skin }}</b>
                <span class="sk-sw"
                  ><i
                    v-for="x in c.chromas"
                    :key="x.name"
                    :class="{ none: !x.color }"
                    :style="x.color ? { background: x.color } : undefined"
                /></span>
                <span class="t3">{{ c.chromas.map((x) => x.name).join(', ') }}</span>
              </div>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="pn-hero">
            <nav class="crumbs" aria-label="Breadcrumb">
              <Link href="/patch" prefetch>Patch notes</Link><Icon name="chevr" :size="12" /><span
                class="t1"
                aria-current="page"
                >{{ current }}</span
              >
            </nav>
            <h1 class="d1 hb-t">Patch {{ current }}</h1>
          </section>
          <section class="sec pb-last">
            <div class="card">
              <EmptyState
                icon="news"
                :title="`No notes for patch ${current} on invade.lol`"
                :line="
                  patches.length
                    ? `Riot's own notes have every change. The patches written up here: ${patches.join(', ')}.`
                    : `Riot's own notes have every change.`
                "
              >
                <div class="row" style="gap: 10px; justify-content: center">
                  <a
                    class="btn sm"
                    href="https://www.leagueoflegends.com/en-us/news/game-updates/"
                    target="_blank"
                    rel="noreferrer"
                    >Riot's notes<Icon name="external" :size="16"
                  /></a>
                  <Link v-if="patches.length" class="btn sm pri" :href="`/patch/${patches[0]}`"
                    >Patch {{ patches[0] }}</Link
                  >
                </div>
              </EmptyState>
            </div>
          </section>
        </template>
      </div>
    </div>
  </SiteLayout>
</template>
