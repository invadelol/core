<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RoleIcon, useFormat } from '@invadelol/ui'
import { positionOf, queueShort } from '@invadelol/ui/logic'
import DuoDetail from './DuoDetail.vue'
import PlayerLink from './PlayerLink.vue'
import CardHead from './ui/CardHead.vue'
import EmptyState from './ui/EmptyState.vue'
import FormStrip from './ui/FormStrip.vue'
import Frame from './ui/Frame.vue'
import Icon from './ui/Icon.vue'
import SectionHead from './ui/SectionHead.vue'
import Skeleton from './ui/Skeleton.vue'
import WinRate from './ui/WinRate.vue'
import { champIcon, championName, profileIcon } from '../lib/assets.js'
import { shortDate, timeAgo } from '../lib/format.js'
import { isRemake } from '../lib/match.js'
import { roleLabel, type Partner, type SynergyReport } from '../lib/synergy.js'
import type { Match, Summoner } from '../lib/types.js'

/**
 * The Friends tab: who the player queues with, drawn as a map (the player in the
 * middle, each friend sized by games together, the link blue when they win together and red when
 * they lose), whether friends help, how they queue, the main duos, the premade groups, the latest
 * games with friends, then one duo opened in full. Everything is read by the server from the
 * player's latest stored games (lib/synergy.ts).
 */
const props = defineProps<{
  report: SynergyReport | null
  profile: Summoner
  loading: boolean
  error: boolean
  /** The player's latest games, for the ones played with friends. */
  matches: Match[]
}>()

defineEmits<{ retry: [] }>()

const { mmss, ago } = useFormat()
const rate = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0)

/** "+4", "−3", "±0". */
function signed(value: number) {
  const rounded = Math.round(value)
  if (!rounded) return '±0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`
}

const partners = computed(() => props.report?.partners ?? [])
/** Duo partners and regulars: the people the player actually plays with. */
const friends = computed(() => partners.value.filter((p) => p.tier !== 'occasional'))
const occasional = computed(() => partners.value.filter((p) => p.tier === 'occasional'))

/* ── The map ──────────────────────────────────────────────────── */
const MAP_MAX = 8
const shown = computed(() =>
  (friends.value.length ? friends.value : partners.value).slice(0, MAP_MAX)
)
const nodes = computed(() => {
  const list = shown.value
  const most = Math.max(1, ...list.map((p) => p.games))
  return list.map((p, i) => {
    /* Around the player, the most played first at the top left, the rest round the clock. */
    const angle = -Math.PI * 0.62 + (i * Math.PI * 2) / Math.max(list.length, 3)
    const near = 0.72 + 0.28 * (1 - p.games / most)
    const won = p.wins / Math.max(1, p.games)
    return {
      p,
      x: 50 + Math.cos(angle) * 37 * near,
      y: 47 + Math.sin(angle) * 33 * near,
      size: Math.round(38 + Math.sqrt(p.games / most) * 46),
      width: (1.5 + (p.games / most) * 6).toFixed(1),
      tone: won >= 0.5 ? 'var(--win)' : 'var(--loss)',
      rate: Math.round(won * 100),
    }
  })
})
/** Friends who also queue together: a dashed line between them. */
const pairs = computed(() => {
  const at = new Map(nodes.value.map((n) => [n.p.puuid, n]))
  const seen = new Set<string>()
  const out: Array<{ a: (typeof nodes.value)[number]; b: (typeof nodes.value)[number] }> = []
  for (const group of props.report?.groups ?? []) {
    const members = group.members.map((m) => at.get(m.puuid)).filter(Boolean) as Array<
      (typeof nodes.value)[number]
    >
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const key = [members[i].p.puuid, members[j].p.puuid].sort().join()
        if (!seen.has(key)) {
          seen.add(key)
          out.push({ a: members[i], b: members[j] })
        }
      }
  }
  return out
})

/* ── Beside the map ────────────────────────────────────────────── */
const summary = computed(() => {
  const r = props.report
  if (!r || !r.friends.games) return null
  return {
    withRate: rate(r.friends.wins, r.friends.games),
    aloneRate: r.alone.games ? rate(r.alone.wins, r.alone.games) : null,
  }
})

/** How many friends were on the team in each game: alone, as two, three, four or five. */
const party = computed(() => {
  const r = props.report
  if (!r?.games) return []
  const at = new Map<number, number>()
  for (const p of friends.value)
    for (const point of p.series) at.set(point.t, (at.get(point.t) ?? 0) + 1)
  const counts = [0, 0, 0, 0]
  for (const n of at.values()) counts[Math.min(3, n)]++
  counts[0] = Math.max(0, r.games - counts[1] - counts[2] - counts[3])
  const rows = [
    { label: 'Solo', n: counts[0], tone: 'var(--s4)' },
    { label: 'Duo', n: counts[1], tone: 'var(--v600)' },
    { label: 'Three', n: counts[2], tone: 'var(--v400)' },
    { label: 'Four or five', n: counts[3], tone: 'var(--v200)' },
  ]
  return rows
    .filter((row, i) => i < 2 || row.n > 0)
    .map((row) => ({ ...row, share: (row.n / r.games) * 100 }))
})

/** The friend the player does best with, on enough games to say so. */
const best = computed(
  () =>
    [...friends.value]
      .filter((p) => p.confidence !== 'low' && p.synergy >= 2)
      .sort((a, b) => b.synergy - a.synergy)[0] ?? null
)

/* ── Duos and the rest ────────────────────────────────────────── */
const TIER: Record<Partner['tier'], string> = {
  duo: 'Duo partner',
  regular: 'Regular',
  occasional: 'Now and then',
}
const duos = computed(() => friends.value.slice(0, 3))
const everyone = ref(false)

/** The group's name: "With A and B", or "Full five". */
function groupName(group: SynergyReport['groups'][number]) {
  if (group.members.length >= 4) return 'Full five'
  const names = group.members.map((m) => m.gameName)
  return `With ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
const groupKey = (group: { members: Array<{ puuid: string }> }) =>
  group.members.map((m) => m.puuid).join()
const openGroup = ref<string | null>(null)

/** The latest games with a friend on the team, from the games already loaded. */
const withFriends = computed(() => {
  const known = new Map(partners.value.map((p) => [p.puuid, p]))
  return props.matches
    .filter((m) => m.queueId !== 0 && !isRemake(m))
    .map((m) => {
      const me = m.participants.find((p) => p.puuid === props.profile.puuid)
      if (!me) return null
      const mates = m.participants.filter(
        (p) =>
          p.teamId === me.teamId && p.puuid !== me.puuid && known.get(p.puuid)?.tier !== undefined
      )
      const friendsIn = mates.filter((p) => known.get(p.puuid)?.tier !== 'occasional')
      if (!friendsIn.length) return null
      return { match: m, me, mates: friendsIn.map((p) => known.get(p.puuid)!) }
    })
    .filter(Boolean)
    .slice(0, 6) as Array<{ match: Match; me: Match['participants'][number]; mates: Partner[] }>
})

/* ── The duo opened below ─────────────────────────────────────── */
const selected = ref<string | null>(null)
const duo = computed(() => partners.value.find((p) => p.puuid === selected.value) ?? null)

/** `?with=Name-Tag` keeps the open duo in the address, so it can be shared or reloaded. */
function fromAddress() {
  if (typeof window === 'undefined') return null
  const wanted = new URLSearchParams(window.location.search).get('with')?.toLowerCase()
  if (!wanted) return null
  return (
    partners.value.find((p) => `${p.gameName}-${p.tagLine}`.toLowerCase() === wanted)?.puuid ?? null
  )
}

watch(
  partners,
  (list) => {
    if (list.some((p) => p.puuid === selected.value)) return
    selected.value = fromAddress() ?? friends.value[0]?.puuid ?? null
  },
  { immediate: true }
)
onMounted(() => {
  const linked = fromAddress()
  if (linked) selected.value = linked
})

function pick(partner: Partner, scroll = true) {
  selected.value = partner.puuid
  const url = new URL(window.location.href)
  url.searchParams.set('with', `${partner.gameName}-${partner.tagLine}`)
  window.history.replaceState(window.history.state, '', url)
  if (!scroll) return
  void nextTick(() => {
    const target = document.getElementById('duo')
    if (!target) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
  })
}

const pairRole = (p: Partner) => p.roles[0] ?? null
const lastTen = (p: Partner) => p.series.slice(-10).map((s) => s.win)
/** A synergy worth colouring: enough games and at least two points either way. */
const lean = (p: Partner) =>
  p.confidence === 'low' || Math.abs(p.synergy) < 2 ? '' : p.synergy > 0 ? 'wn' : 'ls'
</script>

<template>
  <div class="fp">
    <!-- Loading: the shape of what is coming -->
    <div v-if="!report && !error" class="fp" aria-busy="true">
      <article class="card"><Skeleton :height="440" /></article>
      <article class="card"><Skeleton :rows="5" pic /></article>
    </div>

    <article v-else-if="error && !report" class="card" role="alert">
      <EmptyState icon="users" title="Friends could not be loaded">
        <button type="button" class="btn sm" @click="$emit('retry')">Retry</button>
      </EmptyState>
    </article>

    <!-- Nothing stored yet -->
    <article v-else-if="report && !report.games" class="card">
      <EmptyState
        icon="users"
        title="No games yet"
        line="Once this player's games are stored, the people they play with show up here."
      />
    </article>

    <template v-else-if="report">
      <!-- The map, and what friends do to their games -->
      <article class="card">
        <CardHead
          title="Friends"
          icon="users"
          :meta="`Last ${report.games} games, ${shortDate(report.firstMs)} to ${shortDate(report.lastMs)}`"
        />
        <div class="fp-net">
          <div v-if="nodes.length" class="fp-map">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line
                v-for="pair in pairs"
                :key="`${pair.a.p.puuid}${pair.b.p.puuid}`"
                :x1="pair.a.x"
                :y1="pair.a.y"
                :x2="pair.b.x"
                :y2="pair.b.y"
                class="fp-dash"
                vector-effect="non-scaling-stroke"
              />
              <line
                v-for="n in nodes"
                :key="n.p.puuid"
                x1="50"
                y1="47"
                :x2="n.x"
                :y2="n.y"
                :stroke="n.tone"
                :stroke-width="n.width"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
                opacity="0.6"
              />
            </svg>
            <div class="fp-nd me" style="left: 50%; top: 47%">
              <img :src="profileIcon(profile.profileIconId)" alt="" width="84" height="84" />
              <b>{{ profile.gameName }}</b>
            </div>
            <button
              v-for="n in nodes"
              :key="n.p.puuid"
              type="button"
              class="fp-nd"
              :class="{ on: selected === n.p.puuid }"
              :style="{ 'left': `${n.x}%`, 'top': `${n.y}%`, '--rc': n.tone }"
              :aria-pressed="selected === n.p.puuid"
              :title="`${n.p.gameName}#${n.p.tagLine}: ${n.p.games} games together, ${n.rate}% won`"
              @click="pick(n.p)"
            >
              <img
                :src="profileIcon(n.p.profileIconId)"
                alt=""
                :width="n.size"
                :height="n.size"
                loading="lazy"
              />
              <b>{{ n.p.gameName }}</b>
              <small class="num"
                >{{ n.p.games }} games,
                <em :class="n.rate >= 50 ? 'wn' : 'ls'">{{ n.rate }}%</em></small
              >
            </button>
            <div class="fp-lgd">
              <span><i style="background: var(--win)" />Winning together</span>
              <span><i style="background: var(--loss)" />Losing together</span>
              <span class="fp-hm">Bigger and thicker: more games</span>
            </div>
          </div>
          <div v-else class="fp-map solo">
            <div class="fp-nd me" style="left: 50%; top: 44%">
              <img :src="profileIcon(profile.profileIconId)" alt="" width="84" height="84" />
              <b>{{ profile.gameName }}</b>
              <small class="num">Plays solo in the last {{ report.games }} games</small>
            </div>
          </div>

          <aside class="fp-side">
            <div>
              <span class="lab">Win rate</span>
              <div class="fp-vs">
                <div>
                  <span
                    class="fg-l"
                    :class="
                      summary && summary.aloneRate !== null
                        ? summary.withRate - summary.aloneRate >= 3
                          ? 'wn'
                          : summary.withRate - summary.aloneRate <= -3
                            ? 'ls'
                            : ''
                        : ''
                    "
                    >{{ summary ? `${summary.withRate}%` : '-' }}</span
                  >
                  <span class="meta num">with friends, {{ report.friends.games }} games</span>
                </div>
                <div>
                  <span class="fg-l">{{
                    report.alone.games ? `${rate(report.alone.wins, report.alone.games)}%` : '-'
                  }}</span>
                  <span class="meta num">alone, {{ report.alone.games }} games</span>
                </div>
              </div>
            </div>
            <div v-if="party.length">
              <span class="lab">How they queue</span>
              <div class="fp-party">
                <i
                  v-for="row in party"
                  v-show="row.n"
                  :key="row.label"
                  :style="{ width: `${row.share}%`, background: row.tone }"
                />
              </div>
              <div class="fp-pleg">
                <span v-for="row in party" :key="row.label" :style="{ '--c': row.tone }"
                  >{{ row.label }} <b class="num">{{ row.n }}</b></span
                >
              </div>
            </div>
            <div v-if="best">
              <span class="lab">Best with</span>
              <button type="button" class="fp-best" @click="pick(best)">
                <span class="fp-avs">
                  <img :src="profileIcon(profile.profileIconId)" alt="" />
                  <img :src="profileIcon(best.profileIconId)" alt="" />
                </span>
                <span class="col" style="gap: 2px; min-width: 0">
                  <b class="h5 ell">{{ best.gameName }}</b>
                  <span class="meta num"
                    >{{ signed(best.synergy) }} points over their usual win rate</span
                  >
                </span>
              </button>
            </div>
          </aside>
        </div>
      </article>

      <!-- Duos -->
      <section v-if="duos.length">
        <SectionHead title="Duos" icon="users" meta="Most played first">
          <button
            v-if="partners.length > duos.length"
            type="button"
            class="more"
            :aria-expanded="everyone"
            @click="everyone = !everyone"
          >
            {{ everyone ? 'Fewer' : `All ${partners.length} people` }}<Icon name="chevr" />
          </button>
        </SectionHead>
        <div class="grid3 fp-duos">
          <button
            v-for="p in duos"
            :key="p.puuid"
            type="button"
            class="card fp-du"
            :class="{ on: selected === p.puuid }"
            :aria-pressed="selected === p.puuid"
            @click="pick(p)"
          >
            <span class="fp-du-h">
              <span class="fp-avs">
                <img :src="profileIcon(profile.profileIconId)" alt="" />
                <img :src="profileIcon(p.profileIconId)" alt="" />
              </span>
              <span class="col" style="gap: 4px; min-width: 0">
                <b class="h4 ell"
                  >{{ p.gameName }} <span class="t3">#{{ p.tagLine }}</span></b
                >
                <span class="row" style="gap: 8px">
                  <span :class="p.tier === 'duo' ? 'stat2' : 'tagx sm'">{{ TIER[p.tier] }}</span>
                  <span class="meta num">last {{ timeAgo(p.lastMs) }}</span>
                </span>
              </span>
            </span>
            <span class="fp-du-w">
              <span class="fg-l">{{ rate(p.wins, p.games) }}%</span>
              <span class="col grow" style="gap: 8px; min-width: 0">
                <span class="row meta num" style="justify-content: space-between">
                  <span>{{ p.wins }}W {{ p.games - p.wins }}L</span>
                  <span
                    :class="lean(p)"
                    :title="`${rate(p.wins, p.games)}% together, ${Math.round(p.baseline * 100)}% without`"
                    >{{ signed(p.synergy) }} vs usual</span
                  >
                </span>
                <WinRate :wins="p.wins" :games="p.games" bare />
              </span>
            </span>
            <span v-if="pairRole(p)" class="fp-dr">
              <span class="lab">Lanes</span>
              <RoleIcon :lane="positionOf(pairRole(p)!.mine)" :size="16" />
              <i>+</i>
              <RoleIcon :lane="positionOf(pairRole(p)!.theirs)" :size="16" />
              <span class="x meta num"
                >{{ rate(pairRole(p)!.wins, pairRole(p)!.games) }}% over
                {{ pairRole(p)!.games }}</span
              >
            </span>
            <span v-else-if="p.theirRole" class="fp-dr">
              <span class="lab">Lanes</span><span class="x meta">{{ roleLabel(p.theirRole) }}</span>
            </span>
            <span v-if="p.champions[0]" class="fp-dr">
              <span class="lab">Best pair</span>
              <Frame :src="champIcon(p.champions[0].mine)" :width="26" size="xs" />
              <i>+</i>
              <Frame :src="champIcon(p.champions[0].theirs)" :width="26" size="xs" />
              <span class="x meta num"
                >{{ p.champions[0].wins }}W {{ p.champions[0].games - p.champions[0].wins }}L</span
              >
            </span>
            <span class="fp-dr">
              <span class="lab">Last {{ lastTen(p).length }}</span>
              <FormStrip :results="lastTen(p)" small />
              <span class="x meta num">{{ shortDate(p.lastMs) }}</span>
            </span>
          </button>
        </div>
      </section>

      <!-- Everyone they played with -->
      <article v-if="everyone || !duos.length" class="card">
        <CardHead title="Played with" icon="users" meta="Pick someone to see the duo" />
        <button
          v-for="p in partners"
          :key="p.puuid"
          type="button"
          class="lrow fp-row"
          :class="{ on: selected === p.puuid }"
          :aria-pressed="selected === p.puuid"
          @click="pick(p)"
        >
          <Frame :src="profileIcon(p.profileIconId)" :width="36" size="xs" />
          <span class="col grow" style="gap: 2px; min-width: 0">
            <b class="h5 ell"
              >{{ p.gameName }} <span class="t3">#{{ p.tagLine }}</span></b
            >
            <span class="meta num ell"
              >{{ TIER[p.tier] }}, {{ signed(p.synergy) }} synergy<template v-if="p.theirRole"
                >, {{ roleLabel(p.theirRole) }}</template
              ></span
            >
          </span>
          <WinRate :wins="p.wins" :games="p.games" :width="110" small end />
        </button>
      </article>

      <div v-if="report.groups.length || withFriends.length" class="grid2 fp-two">
        <!-- Premade groups -->
        <article v-if="report.groups.length" class="card">
          <CardHead title="Groups" icon="layers" meta="Three or more" />
          <div v-for="group in report.groups" :key="groupKey(group)">
            <button
              type="button"
              class="lrow fp-row"
              :aria-expanded="openGroup === groupKey(group)"
              @click="openGroup = openGroup === groupKey(group) ? null : groupKey(group)"
            >
              <span class="fp-avs">
                <img :src="profileIcon(profile.profileIconId)" alt="" />
                <img
                  v-for="member in group.members.slice(0, 4)"
                  :key="member.puuid"
                  :src="profileIcon(member.profileIconId)"
                  alt=""
                  loading="lazy"
                />
              </span>
              <span class="col grow" style="gap: 2px; min-width: 0">
                <b class="h5 ell">{{ groupName(group) }}</b>
                <span class="meta num"
                  >{{ group.games }} games as
                  {{
                    group.members.length >= 4
                      ? 'five'
                      : group.members.length === 3
                        ? 'four'
                        : 'three'
                  }}, last {{ shortDate(group.lastMs) }}</span
                >
              </span>
              <WinRate :wins="group.wins" :games="group.games" :width="110" small end />
            </button>
            <ul v-if="openGroup === groupKey(group)" class="fp-members">
              <li v-for="member in group.members" :key="member.puuid">
                <Frame :src="profileIcon(member.profileIconId)" :width="22" size="xs" />
                <PlayerLink :game-name="member.gameName" :tag-line="member.tagLine" show-tag />
              </li>
            </ul>
          </div>
        </article>

        <!-- Latest games with friends -->
        <article v-if="withFriends.length" class="card">
          <CardHead title="Latest games with friends" icon="clock" />
          <div v-for="g in withFriends" :key="g.match.matchId" class="lrow fp-game">
            <Frame :src="champIcon(g.me.championId)" :width="40" size="xs" />
            <span class="col" style="gap: 2px">
              <b class="h5" :class="g.me.win ? 'wn' : 'ls'">{{ g.me.win ? 'Win' : 'Loss' }}</b>
              <span class="meta num">{{ mmss(g.match.duration) }}</span>
            </span>
            <span class="col" style="gap: 2px">
              <b class="fg-xs num">{{ g.me.kills }} / {{ g.me.deaths }} / {{ g.me.assists }}</b>
              <span class="meta num">{{ ago(Number(g.match.gameStartMs)) }}</span>
            </span>
            <span class="fp-with">
              <span v-for="m in g.mates" :key="m.puuid" class="tagx"
                ><img :src="profileIcon(m.profileIconId)" alt="" />{{ m.gameName }}</span
              >
            </span>
            <span class="meta fp-q" :title="championName(g.me.championId)">{{
              queueShort(g.match.queueId)
            }}</span>
          </div>
        </article>
      </div>

      <!-- Now and then: people seen a couple of times -->
      <article v-if="occasional.length && !everyone" class="card">
        <CardHead
          title="Now and then"
          icon="users"
          :meta="`${occasional.length} people seen twice or more`"
        />
        <ul class="fp-occ">
          <li v-for="p in occasional.slice(0, 12)" :key="p.puuid">
            <button
              type="button"
              class="tagx fp-chip"
              :class="{ on: selected === p.puuid }"
              @click="pick(p)"
            >
              <img :src="profileIcon(p.profileIconId)" alt="" loading="lazy" />{{ p.gameName }}
              <span class="t3 num">{{ p.games }}</span>
            </button>
          </li>
        </ul>
      </article>

      <!-- One duo, opened -->
      <DuoDetail
        v-if="duo"
        id="duo"
        :key="duo.puuid"
        class="fp-duo"
        :partner="duo"
        :profile="profile"
      />
    </template>
  </div>
</template>

<style scoped>
.fp {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.fp-net {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  border-top: 1px solid var(--line);
}
.fp-map {
  position: relative;
  height: 460px;
}
.fp-map.solo {
  height: 300px;
}
.fp-map svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.fp-dash {
  stroke: var(--t3);
  stroke-width: 1.5;
  stroke-dasharray: 3 5;
  opacity: 0.5;
}
.fp-nd {
  position: absolute;
  padding: 0;
  border: 0;
  font: inherit;
  text-align: center;
  color: inherit;
  background: none;
  transform: translate(-50%, -50%);
  cursor: pointer;
}
.fp-nd.me {
  cursor: default;
}
.fp-nd img {
  display: block;
  margin: 0 auto;
  border-radius: var(--r2);
  background: var(--s3);
  box-shadow:
    0 0 0 3px var(--s1),
    0 0 0 5px var(--rc);
}
.fp-nd.me img {
  box-shadow:
    0 0 0 3px var(--s1),
    0 0 0 5px var(--v400);
}
.fp-nd.on img {
  box-shadow:
    0 0 0 3px var(--s1),
    0 0 0 5px var(--rc),
    0 0 0 7px var(--t1);
}
.fp-nd:focus-visible {
  outline: 2px solid var(--v400);
  outline-offset: 4px;
  border-radius: 8px;
}
.fp-nd b {
  display: block;
  margin-top: 10px;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
  color: var(--t1);
}
.fp-nd small {
  display: block;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--t3);
}
.fp-nd small em {
  font-style: normal;
}
.fp-lgd {
  position: absolute;
  left: 20px;
  bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t3);
}
.fp-lgd span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.fp-lgd i {
  width: 16px;
  height: 3px;
  border-radius: 2px;
}
.fp-side {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px;
  border-left: 1px solid var(--line);
}
.fp-side .lab {
  display: block;
  margin-bottom: 10px;
}
.fp-vs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.fp-vs > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fp-party {
  display: flex;
  gap: 2px;
  height: 6px;
  overflow: hidden;
  border-radius: 2px;
}
.fp-party i {
  display: block;
  height: 100%;
}
.fp-pleg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  margin-top: 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t3);
}
.fp-pleg span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fp-pleg span::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--c);
}
.fp-pleg b {
  margin-left: auto;
  color: var(--t1);
}
.fp-best {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: var(--r2);
  font: inherit;
  text-align: left;
  color: inherit;
  background: var(--s2);
  box-shadow: inset 0 0 0 1px var(--line);
  cursor: pointer;
}
.fp-best:hover {
  background: var(--s3);
}
.fp-avs {
  display: flex;
  flex: none;
}
.fp-avs img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--s3);
  box-shadow: 0 0 0 2px var(--s1);
}
.fp-avs img + img {
  margin-left: -8px;
}
.fp-duos {
  align-items: stretch;
}
.fp-du {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: background 160ms var(--ease);
}
.fp-du:hover {
  background: var(--s2);
}
.fp-du.on {
  background: var(--v950);
  border-color: rgb(var(--v-rgb) / 0.5);
}
.fp-du-h {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 16px;
}
.fp-du-w {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px 16px;
}
.fp-dr {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 20px;
  border-top: 1px solid var(--line);
  color: var(--t2);
}
.fp-dr .lab {
  width: 72px;
  flex: none;
}
.fp-dr i {
  font-style: normal;
  font-size: 12px;
  color: var(--t3);
}
.fp-dr .x {
  margin-left: auto;
}
.tagx.sm {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
}
.fp-row {
  width: 100%;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  cursor: pointer;
}
.fp-row.on {
  background: rgb(var(--v-rgb) / 0.08);
}
.fp-members {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 0;
  padding: 4px 20px 16px 74px;
  list-style: none;
}
.fp-members li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}
.fp-game {
  display: grid;
  grid-template-columns: 40px 56px 96px minmax(0, 1fr) auto;
}
.fp-with {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.fp-with .tagx {
  height: 26px;
  padding: 0 9px 0 4px;
  font-size: 12px;
}
.fp-with .tagx img {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}
.fp-occ {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0 20px 20px;
  list-style: none;
}
.fp-chip {
  border: 0;
  font-family: inherit;
  cursor: pointer;
}
.fp-chip img {
  border-radius: 4px;
}
.fp-chip:hover,
.fp-chip.on {
  color: var(--t1);
  background: var(--s3);
}
.fp-duo {
  scroll-margin-top: 80px;
}
.fp-two {
  align-items: start;
}
@media (max-width: 1100px) {
  .fp-net,
  .fp-duos,
  .fp-two {
    grid-template-columns: minmax(0, 1fr);
  }
  .fp-side {
    border-top: 1px solid var(--line);
    border-left: 0;
  }
}
@media (max-width: 640px) {
  .fp-map {
    height: 380px;
  }
  .fp-nd b {
    font-size: 12px;
  }
  .fp-nd small,
  .fp-hm {
    display: none;
  }
  .fp-nd.me img {
    width: 60px;
    height: 60px;
  }
  .fp-nd:not(.me) img {
    max-width: 52px;
    max-height: 52px;
  }
  .fp-game {
    grid-template-columns: 40px 52px minmax(0, 1fr);
  }
  .fp-game .fp-with {
    grid-column: 1 / -1;
  }
  .fp-q {
    display: none;
  }
  .fp-members {
    padding-left: 20px;
  }
}
</style>
