<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Select from '../../components/ui/Select.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { linkSort, type SortDir } from '../../components/ui/sort.js'
import RoleFilter from '../../components/leaderboards/RoleFilter.vue'
import LadderPager from '../../components/leaderboards/LadderPager.vue'
import LadderPlayer from '../../components/leaderboards/LadderPlayer.vue'
import { champIcon, championName, profileIcon } from '../../lib/assets.js'
import {
  laneOf,
  n,
  playerPath,
  rankWords,
  roleLabel,
  tierWord,
  winPct,
  withQuery,
} from '../../lib/ladders.js'
import '../../css/leaderboards.css'

type Size = 'solo' | 'duo' | 'three' | 'five'
interface Mate {
  gameName: string
  tagLine: string
  icon: number | null
}
interface Row {
  place: number
  gameName: string
  tagLine: string
  icon: number | null
  level: number | null
  tier: string
  division: string | null
  lp: number
  wins: number
  losses: number
  role: string | null
  champions: { champion: number; games: number; wins: number }[]
  games: number
  queuesWith: {
    size: Size
    mates: (Mate & { games: number })[]
    games: number
    wins: number
    share: number
  } | null
}
interface Group {
  size: Size
  members: (Mate & {
    role: string | null
    listed: boolean
    rank: { tier: string; division: string | null; lp: number } | null
  })[]
  games: number
  wins: number
}

/**
 * `/leaderboards/flex`: Riot's flex ladder is not stored, so this is the flex ranks of the players
 * Invade knows on a server (looked up, or seen by the desktop app, in the last 30 days), with who
 * they queue with from their stored flex games (app/services/flex_ladder_service.ts).
 */
const props = defineProps<{
  region: { slug: string; label: string; platform: string }
  regions: { slug: string; label: string }[]
  scope: { kind: 'tracked'; seenDays: number; listed: number }
  filters: {
    role: string | null
    group: Size | null
    q: string | null
    sort: string | null
    dir: SortDir | null
  }
  tiers: { tier: string; players: number }[]
  groups: Group[]
  shares: Record<Size, number> | null
  rows: Row[]
  total: number
  players: number
  page: number
  pages: number
  pageSize: number
  description: string
}>()

const query = computed(() => ({
  region: props.region.slug === 'euw' ? null : props.region.slug,
  role: props.filters.role,
  group: props.filters.group,
  q: props.filters.q,
  sort: props.filters.sort,
  dir: props.filters.dir,
}))
const href = (changes: Record<string, string | number | boolean | null>) =>
  withQuery('/leaderboards/flex', query.value, changes)
/** The heads sort the whole list on the server (`?sort=&dir=`), the first page again. */
const sort = computed(() =>
  linkSort(
    { key: props.filters.sort, dir: props.filters.dir ?? 'desc' },
    (key, dir) => href({ sort: key, dir }),
    { key: 'rank' }
  )
)

const regionSlug = ref(props.region.slug)
watch(regionSlug, (slug) => router.visit(href({ region: slug === 'euw' ? null : slug })))
const search = ref(props.filters.q ?? '')
let typing: ReturnType<typeof setTimeout> | null = null
watch(search, (q) => {
  if (typing) clearTimeout(typing)
  typing = setTimeout(
    () =>
      router.visit(href({ q: q.trim() || null }), { preserveScroll: true, preserveState: true }),
    350
  )
})

const SIZE_LABEL: Record<Size, string> = { solo: 'Solo', duo: 'Duo', three: 'Three', five: 'Five' }
const SIZE_SHADE: Record<Size, string> = {
  solo: 'var(--v200)',
  duo: 'var(--v400)',
  three: 'var(--v600)',
  five: 'var(--v800)',
}
const sizes = ['solo', 'duo', 'three', 'five'] as const
const apex = computed(() =>
  ['CHALLENGER', 'GRANDMASTER'].map((tier) => ({
    tier,
    players: props.tiers.find((t) => t.tier === tier)?.players ?? 0,
  }))
)
/** Players of the first group, marked in the table. */
const firstGroup = computed(
  () => new Set((props.groups[0]?.members ?? []).map((m) => `${m.gameName}#${m.tagLine}`))
)
const inFirst = (r: Row) => firstGroup.value.has(`${r.gameName}#${r.tagLine}`)

/** "Brisk, Marrow and 2 more", "Bramble, Ondine". */
function names(mates: Mate[]) {
  const shown = mates.slice(0, 2).map((m) => m.gameName)
  const more = mates.length - shown.length
  return more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ')
}
/** "Average 2,881 LP, all Challenger" from the ranked members. */
function groupLine(g: Group) {
  const ranked = g.members.filter((m) => m.rank)
  if (!ranked.length) return null
  const tiers = new Set(ranked.map((m) => m.rank!.tier))
  const apexOnly = ranked.every((m) =>
    ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(m.rank!.tier)
  )
  const avg = Math.round(ranked.reduce((s, m) => s + m.rank!.lp, 0) / ranked.length)
  if (apexOnly) {
    return `Average ${n(avg)} LP${tiers.size === 1 ? `, all ${tierWord([...tiers][0])}` : ''}`
  }
  return ranked.length === g.members.length && tiers.size === 1
    ? `All ${tierWord([...tiers][0])}`
    : `${ranked.length} of ${g.members.length} on this list`
}
</script>

<template>
  <Head :title="`Flex ladder, ${region.label}`">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap">
      <section class="mast">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/leaderboards/solo">Leaderboards</Link><Icon name="chevr" />
          <span class="t1">Flex</span>
        </nav>
        <div class="lb-mt">
          <div class="col" style="gap: 8px">
            <h1 class="h1">Flex ladder</h1>
            <span class="meta row" style="gap: 10px"
              >{{ region.label }}, ranked flex<span
                class="lb-ex"
                :title="`Riot's flex ladder is not stored: these are the players Invade looked up or saw in the desktop app in the last ${scope.seenDays} days`"
                ><Icon name="users" />Players Invade knows</span
              ></span
            >
          </div>
          <div class="row" style="gap: 8px; margin-left: auto">
            <Select
              v-model="regionSlug"
              label="Region"
              :options="regions.map((r) => ({ value: r.slug, label: r.label }))"
              width="11rem"
              align="right"
            />
          </div>
        </div>
      </section>

      <EmptyState
        v-if="!players"
        icon="users"
        :title="`No ${region.label} flex player known yet`"
        line="Players appear here once someone looks them up on invade.lol or meets them in the desktop app."
      />

      <template v-else>
        <template v-if="groups.length">
          <div class="sec-h" style="margin-bottom: 12px">
            <Icon name="users" />
            <h2 class="h3">Groups that win together</h2>
            <span class="meta">Seen together in their stored flex games</span>
          </div>
          <div class="lb-top">
            <div
              v-for="(g, i) in groups"
              :key="i"
              class="lb-gc"
              :style="i === 0 ? 'box-shadow: inset 0 0 0 1px rgb(var(--v-rgb)/.45)' : undefined"
            >
              <span class="lb-gh">
                <span class="lab">#{{ i + 1 }}</span>
                <span class="lb-sz" :class="{ v: i === 0 }"
                  ><Icon name="users" />{{ SIZE_LABEL[g.size] }}</span
                >
                <span class="meta" style="margin-left: auto">{{ n(g.games) }} games together</span>
              </span>
              <span class="lb-mem">
                <Link
                  v-for="m in g.members"
                  :key="`${m.gameName}#${m.tagLine}`"
                  :href="playerPath(m.gameName, m.tagLine) ?? '#'"
                >
                  <Frame :src="profileIcon(m.icon)" size="s" />
                  <b>{{ m.gameName }}</b>
                  <RoleIcon v-if="laneOf(m.role)" class="r" :lane="laneOf(m.role)!" :size="13" />
                </Link>
              </span>
              <span class="col" style="gap: 8px; margin-top: auto">
                <span class="row" style="gap: 10px">
                  <span class="fg-m"
                    >{{ Math.round((g.wins / g.games) * 100) }}<span class="u">%</span></span
                  >
                  <span class="meta">{{ n(g.wins) }}W {{ n(g.games - g.wins) }}L</span>
                </span>
                <span class="split"
                  ><i :style="{ width: winPct(g.wins, g.games) }"></i><b></b
                ></span>
                <span v-if="groupLine(g)" class="meta">{{ groupLine(g) }}</span>
              </span>
            </div>
          </div>
        </template>

        <section class="card lb-cs" :style="groups.length ? undefined : 'margin-top: 0'">
          <div v-for="t in apex" :key="t.tier">
            <RankEmblem :tier="t.tier" :size="40" />
            <span class="col" style="gap: 3px">
              <span class="lab">{{ tierWord(t.tier) }}</span>
              <span class="fg-m num">{{ n(t.players) }}</span>
              <span class="meta">players Invade knows</span>
            </span>
          </div>
          <div v-if="shares" class="m">
            <span class="lb-cx"
              ><span class="lab">How the players here queue</span
              ><span class="meta">share of their stored flex games</span></span
            >
            <div class="lb-qs">
              <i
                v-for="s in sizes"
                :key="s"
                :style="{ width: `${shares[s] * 100}%`, background: SIZE_SHADE[s] }"
              ></i>
            </div>
            <div class="lb-ql">
              <span v-for="s in sizes" :key="s"
                ><b
                  ><i :style="{ background: SIZE_SHADE[s] }"></i
                  >{{ Math.round(shares[s] * 100) }}%</b
                >{{ SIZE_LABEL[s] }}</span
              >
            </div>
          </div>
          <div v-else class="m">
            <span class="lab">How the players here queue</span>
            <span class="na">None of their flex games is stored yet.</span>
          </div>
          <div class="n">
            <span class="lab">Who is listed</span>
            <span class="h4">{{ n(players) }} players</span>
            <span class="meta">seen in the last {{ scope.seenDays }} days</span>
          </div>
        </section>

        <div class="lb-filt">
          <RoleFilter :active="filters.role" :href="(role) => href({ role })" />
          <nav class="seg" aria-label="Group size">
            <Link :href="href({ group: null })" :class="{ on: !filters.group }" preserve-scroll
              >Any group</Link
            >
            <Link
              v-for="s in sizes"
              :key="s"
              :href="href({ group: s })"
              :class="{ on: filters.group === s }"
              preserve-scroll
              >{{ SIZE_LABEL[s] }}</Link
            >
          </nav>
          <label class="field" style="margin-left: auto; width: 280px">
            <Icon name="search" />
            <input
              v-model="search"
              type="text"
              placeholder="Find a player"
              aria-label="Find a player"
            />
          </label>
        </div>

        <section class="card">
          <div class="lb-h lb-fx">
            <span class="lb-n" style="font-weight: 650">#</span>
            <span>Player</span>
            <span>Role</span>
            <SortHead :sorter="sort" col="rank" label="Rank" />
            <SortHead :sorter="sort" col="wr" label="Win rate, season" />
            <span>Queues with</span>
            <span>Most played</span>
          </div>
          <EmptyState
            v-if="!rows.length"
            compact
            icon="search"
            title="No player matches these filters"
          />
          <Link
            v-for="r in rows"
            :key="r.place"
            class="lb-r lb-fx"
            :class="{ hl: inFirst(r) }"
            :href="playerPath(r.gameName, r.tagLine) ?? '#'"
          >
            <span class="lb-n">{{ r.place }}</span>
            <LadderPlayer
              :game-name="r.gameName"
              :tag-line="r.tagLine"
              :icon="r.icon"
              :level="r.level"
            />
            <span class="meta lb-role"
              ><RoleIcon v-if="laneOf(r.role)" :lane="laneOf(r.role)!" :size="15" />{{
                roleLabel(r.role) || '–'
              }}</span
            >
            <span class="row" style="gap: 9px">
              <RankEmblem :tier="r.tier" :size="26" />
              <span class="col">
                <span class="h5 num">{{ n(r.lp) }} LP</span>
                <span class="meta">{{ rankWords(r.tier, r.division) }}</span>
              </span>
            </span>
            <span class="col" style="gap: 5px">
              <span class="h5 num"
                >{{ winPct(r.wins, r.wins + r.losses) }}
                <span class="meta">{{ n(r.wins) }}W {{ n(r.losses) }}L</span></span
              >
              <span class="split"
                ><i :style="{ width: winPct(r.wins, r.wins + r.losses) }"></i><b></b
              ></span>
            </span>
            <span v-if="r.queuesWith && r.queuesWith.size !== 'solo'" class="lb-with">
              <span class="lb-sz" :class="{ v: inFirst(r) }"
                ><Icon name="users" />{{ SIZE_LABEL[r.queuesWith.size] }}</span
              >
              <span class="lb-stk">
                <img
                  v-for="m in r.queuesWith.mates.slice(0, 4)"
                  :key="`${m.gameName}#${m.tagLine}`"
                  :src="profileIcon(m.icon)"
                  alt=""
                  style="width: 26px; height: 26px"
                />
              </span>
              <span class="col">
                <span class="h5 ell">{{ names(r.queuesWith.mates) }}</span>
                <span class="meta ell"
                  >{{ n(r.queuesWith.games) }} games together,
                  {{ winPct(r.queuesWith.wins, r.queuesWith.games) }} won</span
                >
              </span>
            </span>
            <span v-else-if="r.queuesWith" class="lb-with">
              <span class="lb-sz"><Icon name="user" />Solo</span>
              <span class="col">
                <span class="h5">Plays alone</span>
                <span class="meta"
                  >Solo in {{ Math.round(r.queuesWith.share * 100) }}% of games</span
                >
              </span>
            </span>
            <span v-else class="meta">No stored flex game</span>
            <span class="row" style="gap: 4px">
              <Frame
                v-for="c in r.champions"
                :key="c.champion"
                :src="champIcon(c.champion)"
                :width="30"
                size="xs"
                :alt="championName(c.champion)"
              />
            </span>
          </Link>
          <LadderPager
            :page="page"
            :pages="pages"
            :total="total"
            :page-size="pageSize"
            noun="players"
            :href="(p) => withQuery('/leaderboards/flex', query, { page: p })"
          />
        </section>
        <p class="meta lb-note">
          Riot's flex ladder is not stored: these are the flex ranks of players Invade looked up or
          saw in the desktop app in the last {{ scope.seenDays }} days. Queues with: the players
          they were on the same side with in {{ 3 }} or more of their stored flex games.
          <template v-if="groups.length">Rows marked in violet: the players of group #1.</template>
        </p>
      </template>
    </div>
  </SiteLayout>
</template>
