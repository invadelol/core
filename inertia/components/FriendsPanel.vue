<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowRight, Users } from 'lucide-vue-next'
import { ChampIcon, RoleIcon, useFormat } from '@invadelol/ui'
import { positionOf, queueShort } from '@invadelol/ui/logic'
import DuoDetail from './DuoDetail.vue'
import PlayerLink from './PlayerLink.vue'
import FormStrip from './ui/FormStrip.vue'
import WinLoss from './ui/WinLoss.vue'
import { championName, profileIcon } from '../lib/assets.js'
import { shortDate, timeAgo } from '../lib/format.js'
import { isRemake } from '../lib/match.js'
import { roleLabel, type Partner, type SynergyReport } from '../lib/synergy.js'
import type { Match, Summoner } from '../lib/types.js'

/**
 * The Friends tab (Violet line): who the player queues with, drawn as a map (the player in the
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
    { label: 'Solo', n: counts[0], tone: 'rgb(166 167 184 / 0.45)' },
    { label: 'Duo', n: counts[1], tone: 'var(--rd-violet)' },
    { label: 'Three', n: counts[2], tone: 'var(--rd-violet-hi)' },
    { label: 'Four or five', n: counts[3], tone: '#d9d4ff' },
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
</script>

<template>
  <section class="fr">
    <!-- Loading: the shape of what is coming -->
    <div v-if="!report && !error" class="grid gap-4" aria-busy="true">
      <div class="iv-skel h-[440px]" />
      <div class="iv-skel h-[280px]" />
    </div>

    <p v-else-if="error && !report" class="notice" role="alert">
      <span>Friends could not be loaded.</span>
      <button type="button" class="iv-btn sm ml-auto" @click="$emit('retry')">Retry</button>
    </p>

    <!-- Nothing stored yet -->
    <div v-else-if="report && !report.games" class="rd-card fr-empty">
      <Users :size="20" class="text-ink-3" />
      <h3>No games yet</h3>
      <p>Once this player's games are stored, the people they play with show up here.</p>
    </div>

    <template v-else-if="report">
      <!-- The map, and what friends do to their games -->
      <section class="rd-card net">
        <div v-if="nodes.length" class="map">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line
              v-for="pair in pairs"
              :key="`${pair.a.p.puuid}${pair.b.p.puuid}`"
              :x1="pair.a.x"
              :y1="pair.a.y"
              :x2="pair.b.x"
              :y2="pair.b.y"
              class="dash"
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
              opacity="0.55"
            />
          </svg>
          <div class="nd me" style="left: 50%; top: 47%">
            <img :src="profileIcon(profile.profileIconId)" alt="" width="84" height="84" />
            <b>{{ profile.gameName }}</b>
          </div>
          <button
            v-for="n in nodes"
            :key="n.p.puuid"
            type="button"
            class="nd"
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
              >{{ n.p.games }} games, <em :style="{ color: n.tone }">{{ n.rate }}%</em></small
            >
          </button>
          <div class="lgd">
            <span><i style="background: var(--win)" />Winning together</span>
            <span><i style="background: var(--loss)" />Losing together</span>
            <span class="max-sm:hidden">Bigger and thicker: more games</span>
          </div>
        </div>
        <div v-else class="map solo">
          <div class="nd me" style="left: 50%; top: 44%">
            <img :src="profileIcon(profile.profileIconId)" alt="" width="84" height="84" />
            <b>{{ profile.gameName }}</b>
            <small class="num">Plays solo in the last {{ report.games }} games</small>
          </div>
        </div>

        <aside class="nside">
          <div>
            <label class="num">Win rate, last {{ report.games }} games</label>
            <div class="vs2">
              <div>
                <span
                  class="rd-fig"
                  :class="
                    summary && summary.aloneRate !== null
                      ? summary.withRate - summary.aloneRate >= 3
                        ? 'rd-up'
                        : summary.withRate - summary.aloneRate <= -3
                          ? 'rd-dn'
                          : ''
                      : ''
                  "
                  >{{ summary ? `${summary.withRate}%` : '-' }}</span
                >
                <small class="num">with friends, {{ report.friends.games }} games</small>
              </div>
              <div>
                <span class="rd-fig">{{
                  report.alone.games ? `${rate(report.alone.wins, report.alone.games)}%` : '-'
                }}</span>
                <small class="num">alone, {{ report.alone.games }} games</small>
              </div>
            </div>
          </div>
          <div v-if="party.length">
            <label>How they queue</label>
            <div class="party">
              <i
                v-for="row in party"
                v-show="row.n"
                :key="row.label"
                :style="{ width: `${row.share}%`, background: row.tone }"
              />
            </div>
            <div class="pleg">
              <span v-for="row in party" :key="row.label" :style="{ '--c': row.tone }"
                >{{ row.label }} <b class="num">{{ row.n }}</b></span
              >
            </div>
          </div>
          <div v-if="best">
            <label>Best with</label>
            <button type="button" class="bw" @click="pick(best)">
              <span class="avs">
                <img :src="profileIcon(profile.profileIconId)" alt="" />
                <img :src="profileIcon(best.profileIconId)" alt="" />
              </span>
              <span class="min-w-0">
                <b class="truncate">{{ best.gameName }}</b>
                <small class="num"
                  >{{ signed(best.synergy) }} points over their usual win rate</small
                >
              </span>
            </button>
          </div>
          <p class="nnote num">
            From {{ shortDate(report.firstMs) }} to {{ shortDate(report.lastMs) }}
          </p>
        </aside>
      </section>

      <!-- Duos -->
      <template v-if="duos.length">
        <div class="fil">
          <h2>Duos<span>Most played first</span></h2>
          <button
            v-if="partners.length > duos.length"
            type="button"
            class="rd-more"
            :aria-expanded="everyone"
            @click="everyone = !everyone"
          >
            {{ everyone ? 'Fewer' : `All ${partners.length} people` }}<ArrowRight :size="14" />
          </button>
        </div>
        <div class="duos">
          <button
            v-for="p in duos"
            :key="p.puuid"
            type="button"
            class="rd-card du"
            :class="{ on: selected === p.puuid }"
            :aria-pressed="selected === p.puuid"
            @click="pick(p)"
          >
            <span class="du-h">
              <span class="avs">
                <img :src="profileIcon(profile.profileIconId)" alt="" />
                <img :src="profileIcon(p.profileIconId)" alt="" />
              </span>
              <span class="min-w-0">
                <b class="truncate"
                  >{{ p.gameName }} <span>#{{ p.tagLine }}</span></b
                >
                <small
                  ><span class="rd-tag" :class="{ v: p.tier === 'duo' }">{{ TIER[p.tier] }}</span
                  ><span class="num">last {{ timeAgo(p.lastMs) }}</span></small
                >
              </span>
            </span>
            <span class="du-w">
              <span class="rd-fig">{{ rate(p.wins, p.games) }}%</span>
              <span class="dwl">
                <WinLoss :wins="p.wins" :losses="p.games - p.wins" />
                <small
                  class="num"
                  :class="
                    p.confidence === 'low' || Math.abs(p.synergy) < 2
                      ? ''
                      : p.synergy > 0
                        ? 'rd-up'
                        : 'rd-dn'
                  "
                  :title="`${rate(p.wins, p.games)}% together, ${Math.round(p.baseline * 100)}% without`"
                  >{{ signed(p.synergy) }} against their usual rate</small
                >
              </span>
            </span>
            <span v-if="pairRole(p)" class="dr">
              <span>Lanes</span>
              <RoleIcon :lane="positionOf(pairRole(p)!.mine)" :size="16" />
              <i>+</i>
              <RoleIcon :lane="positionOf(pairRole(p)!.theirs)" :size="16" />
              <span class="x num"
                >{{ rate(pairRole(p)!.wins, pairRole(p)!.games) }}% over
                {{ pairRole(p)!.games }}</span
              >
            </span>
            <span v-else-if="p.theirRole" class="dr">
              <span>Lanes</span><span class="x">{{ roleLabel(p.theirRole) }}</span>
            </span>
            <span v-if="p.champions[0]" class="dr">
              <span>Best pair</span>
              <ChampIcon :id="p.champions[0].mine" :size="26" />
              <i>+</i>
              <ChampIcon :id="p.champions[0].theirs" :size="26" />
              <span class="x num"
                >{{ p.champions[0].wins }}W {{ p.champions[0].games - p.champions[0].wins }}L</span
              >
            </span>
            <span class="dr">
              <span>Last {{ lastTen(p).length }}</span>
              <FormStrip :results="lastTen(p)" />
              <span class="x quiet num">{{ shortDate(p.lastMs) }}</span>
            </span>
          </button>
        </div>
      </template>

      <!-- Everyone they played with -->
      <section v-if="everyone || !duos.length" class="rd-card mt-4">
        <div class="rd-head">
          <h3>Played with</h3>
          <span class="rd-hm">Pick someone to see the duo</span>
        </div>
        <ul class="rd-plist">
          <li v-for="p in partners" :key="p.puuid">
            <button
              type="button"
              class="prow"
              :class="{ on: selected === p.puuid }"
              :aria-pressed="selected === p.puuid"
              @click="pick(p)"
            >
              <img
                :src="profileIcon(p.profileIconId)"
                alt=""
                width="36"
                height="36"
                loading="lazy"
              />
              <span class="min-w-0">
                <b class="truncate">{{ p.gameName }}</b>
                <small class="num"
                  >{{ TIER[p.tier] }}, {{ signed(p.synergy) }} synergy<template v-if="p.theirRole"
                    >, {{ roleLabel(p.theirRole) }}</template
                  ></small
                >
              </span>
              <WinLoss :wins="p.wins" :losses="p.games - p.wins" />
            </button>
          </li>
        </ul>
      </section>

      <div v-if="report.groups.length || withFriends.length" class="two">
        <!-- Premade groups -->
        <section v-if="report.groups.length" class="rd-card">
          <div class="rd-head">
            <h3>Groups</h3>
            <span class="rd-hm">Three or more</span>
          </div>
          <ul class="rd-plist">
            <li v-for="group in report.groups" :key="groupKey(group)">
              <button
                type="button"
                class="sq"
                :aria-expanded="openGroup === groupKey(group)"
                @click="openGroup = openGroup === groupKey(group) ? null : groupKey(group)"
              >
                <span class="avs">
                  <img :src="profileIcon(profile.profileIconId)" alt="" />
                  <img
                    v-for="member in group.members.slice(0, 4)"
                    :key="member.puuid"
                    :src="profileIcon(member.profileIconId)"
                    alt=""
                    loading="lazy"
                  />
                </span>
                <span class="min-w-0">
                  <b class="truncate">{{ groupName(group) }}</b>
                  <small class="num"
                    >{{ group.games }} games as
                    {{
                      group.members.length >= 4
                        ? 'five'
                        : group.members.length === 3
                          ? 'four'
                          : 'three'
                    }}, last {{ shortDate(group.lastMs) }}</small
                  >
                </span>
                <WinLoss :wins="group.wins" :losses="group.games - group.wins" />
              </button>
              <ul v-if="openGroup === groupKey(group)" class="members">
                <li v-for="member in group.members" :key="member.puuid">
                  <img :src="profileIcon(member.profileIconId)" alt="" width="22" height="22" />
                  <PlayerLink :game-name="member.gameName" :tag-line="member.tagLine" show-tag />
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <!-- Latest games with friends -->
        <section v-if="withFriends.length" class="rd-card">
          <div class="rd-head">
            <h3>Latest games with friends</h3>
          </div>
          <ul class="rd-plist">
            <li
              v-for="g in withFriends"
              :key="g.match.matchId"
              class="lg3"
              :class="g.me.win ? 'w' : 'l'"
            >
              <ChampIcon :id="g.me.championId" :size="40" />
              <span class="res"
                >{{ g.me.win ? 'Win' : 'Loss'
                }}<small class="num">{{ mmss(g.match.duration) }}</small></span
              >
              <span class="kk num"
                >{{ g.me.kills }} / {{ g.me.deaths }} / {{ g.me.assists
                }}<small>{{ ago(Number(g.match.gameStartMs)) }}</small></span
              >
              <span class="wth">
                <span v-for="m in g.mates" :key="m.puuid" class="wc"
                  ><img :src="profileIcon(m.profileIconId)" alt="" />{{ m.gameName }}</span
                >
              </span>
              <span class="rd-tag" :title="championName(g.me.championId)">{{
                queueShort(g.match.queueId)
              }}</span>
            </li>
          </ul>
        </section>
      </div>

      <!-- Now and then: people seen a couple of times -->
      <section v-if="occasional.length && !everyone" class="rd-card mt-4 occ">
        <div class="rd-head">
          <h3>Now and then</h3>
          <span class="rd-hm num">{{ occasional.length }} people seen twice or more</span>
        </div>
        <ul>
          <li v-for="p in occasional.slice(0, 12)" :key="p.puuid">
            <button type="button" class="wc" :class="{ on: selected === p.puuid }" @click="pick(p)">
              <img :src="profileIcon(p.profileIconId)" alt="" loading="lazy" />{{ p.gameName }}
              <span class="num">{{ p.games }}</span>
            </button>
          </li>
        </ul>
      </section>

      <!-- One duo, opened -->
      <DuoDetail
        v-if="duo"
        id="duo"
        :key="duo.puuid"
        class="mt-6 scroll-mt-20"
        :partner="duo"
        :profile="profile"
      />
    </template>
  </section>
</template>

<style scoped>
.fr-empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 40px 16px;
  text-align: center;
}
.fr-empty h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}
.fr-empty p {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.net {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
}
.map {
  position: relative;
  height: 460px;
  background: radial-gradient(50% 60% at 50% 50%, rgb(123 109 255 / 0.1), transparent 75%);
}
.map.solo {
  height: 300px;
}
.map svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.map .dash {
  stroke: var(--text-2);
  stroke-width: 1.5;
  stroke-dasharray: 3 5;
  opacity: 0.45;
}
.nd {
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
.nd.me {
  cursor: default;
}
.nd img {
  display: block;
  margin: 0 auto;
  border-radius: 999px;
  box-shadow:
    0 0 0 3px var(--rd-card),
    0 0 0 5px var(--rc);
}
.nd.me img {
  box-shadow:
    0 0 0 3px var(--rd-card),
    0 0 0 5px var(--rd-violet);
}
.nd.on img {
  box-shadow:
    0 0 0 3px var(--rd-card),
    0 0 0 5px var(--rc),
    0 0 0 7px var(--text-1);
}
.nd:focus-visible {
  outline: 2px solid var(--rd-violet);
  outline-offset: 4px;
  border-radius: 8px;
}
.nd b {
  display: block;
  margin-top: 10px;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
  color: var(--text-1);
}
.nd small {
  display: block;
  font-size: 12px;
  white-space: nowrap;
  color: var(--text-3);
}
.nd small em {
  font-style: normal;
  font-weight: 600;
}
.lgd {
  position: absolute;
  left: 18px;
  bottom: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 11px;
  color: var(--text-3);
}
.lgd span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.lgd i {
  width: 16px;
  height: 3px;
  border-radius: 2px;
}
.nside {
  display: grid;
  align-content: start;
  gap: 22px;
  padding: 22px;
  box-shadow: inset 1px 0 0 var(--rd-line);
}
.nside label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.vs2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 8px;
}
.vs2 .rd-fig {
  display: block;
  font-size: 34px;
  line-height: 1.1;
}
.vs2 small {
  font-size: 12px;
  color: var(--text-3);
}
.party {
  display: flex;
  gap: 2px;
  height: 8px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 9px;
}
.party i {
  display: block;
  height: 100%;
}
.pleg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-3);
}
.pleg span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pleg span::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--c);
}
.pleg b {
  margin-left: auto;
  font-weight: 600;
  color: var(--text-1);
}
.bw {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 10px;
  padding: 0;
  border: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  cursor: pointer;
}
.bw b {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}
.bw small {
  display: block;
  font-size: 12px;
  color: var(--text-3);
}
.nnote {
  margin: 0;
  font-size: 12px;
  color: var(--text-4);
}
.avs {
  display: flex;
  flex: none;
}
.avs img {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  box-shadow: 0 0 0 2px var(--rd-card);
}
.avs img + img {
  margin-left: -10px;
}
.fil {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 28px 0 12px;
}
.fil h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--text-1);
}
.fil h2 span {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
}
.fil .rd-more {
  border: 0;
  background: none;
  cursor: pointer;
}
.duos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.du {
  display: block;
  padding: 0;
  border: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
}
.du:hover {
  background: var(--rd-card-2);
}
.du.on {
  box-shadow: inset 0 0 0 1px rgb(123 109 255 / 0.5);
}
.du:focus-visible {
  outline: 2px solid var(--rd-violet);
  outline-offset: 2px;
}
.du > span {
  display: flex;
}
.du-h {
  align-items: center;
  gap: 14px;
  padding: 18px 18px 14px;
}
.du-h .avs img {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}
.du-h .avs img + img {
  margin-left: -12px;
}
.du-h b {
  display: block;
  font-size: 16px;
  font-weight: 650;
  color: var(--text-1);
}
.du-h b span {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
}
.du-h small {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-3);
}
.du-w {
  align-items: flex-end;
  gap: 16px;
  padding: 0 18px 16px;
}
.du-w .rd-fig {
  font-size: 36px;
  line-height: 1;
}
.dwl {
  display: grid;
  flex: 1;
  gap: 4px;
  min-width: 0;
}
.dwl small {
  font-size: 12px;
  color: var(--text-3);
}
.dr {
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 18px;
  font-size: 12px;
  color: var(--text-3);
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.dr > span:first-child {
  width: 66px;
}
.dr i {
  font-style: normal;
  color: var(--text-4);
}
.dr .x {
  margin-left: auto;
  font-weight: 600;
  color: var(--text-1);
}
.dr .x.quiet {
  font-weight: 400;
  color: var(--text-3);
}
.dr :deep(.iv-champ) {
  border-radius: 6px;
}
.two {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 16px;
  margin-top: 16px;
  align-items: start;
}
.sq {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 120px;
  gap: 16px;
  align-items: center;
  width: 100%;
  height: 68px;
  padding: 0 18px;
  border: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  cursor: pointer;
}
.sq:hover {
  background: var(--surface-1);
}
.sq .avs img {
  width: 34px;
  height: 34px;
  border-radius: 9px;
}
.sq b {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.sq small {
  font-size: 12px;
  color: var(--text-3);
}
.members {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 0 18px 14px;
  list-style: none;
  font-size: 13px;
}
.members li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.members img {
  border-radius: 6px;
}
.lg3 {
  position: relative;
  display: grid;
  grid-template-columns: 40px 56px 92px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-height: 60px;
  padding: 8px 18px 8px 21px;
}
.lg3::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 2px;
  background: var(--edge);
}
.lg3.w {
  --edge: var(--win);
}
.lg3.l {
  --edge: var(--loss);
}
.lg3 :deep(.iv-champ) {
  border-radius: 9px;
}
.lg3 .res {
  font-size: 13px;
  font-weight: 650;
}
.lg3.w .res {
  color: var(--win);
}
.lg3.l .res {
  color: var(--loss);
}
.lg3 small {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}
.lg3 .kk {
  font-size: 14px;
  font-weight: 650;
  color: var(--text-1);
}
.wth {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.wc {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 9px 0 3px;
  border: 0;
  border-radius: 999px;
  font: 500 12px var(--font);
  color: var(--text-2);
  background: var(--surface-3);
}
.wc img {
  width: 22px;
  height: 22px;
  border-radius: 999px;
}
button.wc {
  cursor: pointer;
}
button.wc:hover,
button.wc.on {
  color: var(--text-1);
  background: var(--surface-4);
}
.wc .num {
  color: var(--text-4);
}
.occ ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 14px 18px;
  list-style: none;
}

@media (max-width: 1100px) {
  .net,
  .duos,
  .two {
    grid-template-columns: minmax(0, 1fr);
  }
  .nside {
    box-shadow: inset 0 1px 0 var(--rd-line);
  }
}
@media (max-width: 640px) {
  .map {
    height: 400px;
  }
  .nd b {
    font-size: 12px;
  }
  .nd small {
    display: none;
  }
  .nd.me img {
    width: 64px;
    height: 64px;
  }
  .lg3 {
    grid-template-columns: 40px 52px minmax(0, 1fr);
  }
  .lg3 .wth {
    grid-column: 1 / -1;
  }
  .lg3 > .rd-tag {
    display: none;
  }
}
</style>
