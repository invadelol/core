<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Banner from '../../components/champions/Banner.vue'
import FilterBar from '../../components/champions/FilterBar.vue'
import TierMark from '../../components/champions/TierMark.vue'
import {
  ROLES,
  TIERS,
  champIconUrl,
  compact,
  filterQuery,
  pct,
  roleOf,
  splashUrl,
  thousands,
  type ChampionEntry,
  type Filter,
  type Summary,
} from '../../lib/champions.js'
import '../../css/champions.css'

/** `/tier-list?role=bot`: one role's champions ranked, as tier rows and as a table. */
const props = defineProps<{
  champions: ChampionEntry[]
  summary: Summary | null
  previousRanks: Record<string, number> | null
  previousPatch: string | null
  position: string
  patches: { patch: string; games: number }[]
  filter: Filter | null
}>()

const latest = computed(() => props.patches[0]?.patch)
const rank = computed(() => props.filter?.bracket ?? 'emerald_plus')
const patch = computed(() => props.filter?.patch ?? latest.value ?? '')
const role = computed(() => roleOf(props.position))
const byId = computed(() => new Map(props.champions.map((c) => [c.id, c])))

const rows = computed(() =>
  (props.summary?.roles ?? [])
    .filter((r) => r.position === props.position && r.rank)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((r) => ({
      ...r,
      c: byId.value.get(r.champion),
      was: props.previousRanks?.[r.champion] ?? null,
    }))
    .filter((r) => r.c)
)
const tiers = computed(() =>
  TIERS.map((label, tier) => ({
    label,
    tier,
    list: rows.value.filter((r) => r.tier === tier),
  })).filter((t) => t.list.length)
)
const top = computed(() => rows.value[0])
const games = computed(
  () => rows.value.reduce((n, r) => n + r.games, 0) / (props.position === 'NONE' ? 1 : 1)
)

const href = (c: { rank?: string; patch?: string; role?: string }) =>
  `/tier-list${filterQuery({ role: c.role ?? role.value.slug, rank: c.rank ?? rank.value, patch: c.patch ?? patch.value }, latest.value)}`
const champHref = (slug: string) =>
  `/champions/${slug}${filterQuery({ role: role.value.slug, rank: rank.value, patch: patch.value }, latest.value)}`
const roleTabs = computed(() =>
  ROLES.map((r) => ({
    label: r.label,
    href: href({ role: r.slug }),
    on: r.position === props.position,
    lane: r.lane,
    small: props.summary?.ranked[r.position],
  }))
)
</script>

<template>
  <Head :title="`${role.label} tier list`" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <Banner
      list
      :art="rows.slice(0, 3).map((r) => splashUrl(r.champion))"
      title="Tier list"
      :tabs="roleTabs"
      :figures="[
        { label: 'Champions', value: rows.length },
        {
          label: 'Games',
          value: summary ? compact(summary.games) : '–',
          sub: filter ? `Patch ${filter.patch}` : undefined,
        },
        ...(top
          ? [
              {
                label: 'Top pick',
                value: top.c!.name,
                sub: `${TIERS[top.tier ?? 0]} · ${pct(top.win)}`,
              },
            ]
          : []),
      ]"
    >
      <template #kicker>{{ role.label }} · our own ranked games</template>
    </Banner>
    <main class="page cs-main flex-1">
      <FilterBar :rank="rank" :patch="patch" :patches="patches" :href="href" />
      <p v-if="!rows.length" class="cs-empty">
        Not enough games for this role with these filters yet.
      </p>
      <template v-else>
        <section class="iv-panel cs-tiers">
          <div v-for="t in tiers" :key="t.tier" class="cs-trow">
            <div class="k">
              <TierMark :tier="t.tier" large /><small>{{ t.list.length }}</small>
            </div>
            <div class="cs">
              <Link
                v-for="r in t.list"
                :key="r.champion"
                :href="champHref(r.c!.slug)"
                class="cs-tc"
                prefetch
                cache-for="30s"
              >
                <span
                  v-if="r.was && r.was !== r.rank"
                  class="mv cs-mv"
                  :class="r.was > r.rank! ? 'cs-up' : 'cs-down'"
                  >{{ r.was > r.rank! ? '▲' : '▼' }}{{ Math.abs(r.was - r.rank!) }}</span
                >
                <img :src="champIconUrl(r.champion)" alt="" loading="lazy" />
                <b>{{ r.c!.name }}</b>
                <small>{{ pct(r.win) }}</small>
              </Link>
            </div>
          </div>
        </section>
        <section class="iv-panel cs-card flush" style="margin-top: 16px">
          <h2>
            All {{ role.label.toLowerCase() }} champions<span class="meta"
              >{{ rows.length }} ranked<template v-if="previousPatch">
                · moves since {{ previousPatch }}</template
              ></span
            >
          </h2>
          <table class="iv-table cs-table">
            <thead>
              <tr>
                <th class="rk">#</th>
                <th>Champion</th>
                <th class="on">Tier</th>
                <th class="num">Win rate</th>
                <th class="num">Pick</th>
                <th class="num hm">Ban</th>
                <th class="num hm">Games</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.champion">
                <td class="rk num">{{ r.rank }}</td>
                <td class="c">
                  <img :src="champIconUrl(r.champion)" alt="" />
                  <Link :href="champHref(r.c!.slug)" prefetch cache-for="30s"
                    ><b>{{ r.c!.name }}</b></Link
                  >
                  <span
                    v-if="r.was && r.was !== r.rank"
                    class="cs-mv"
                    :class="r.was > r.rank! ? 'cs-up' : 'cs-down'"
                    >{{ r.was > r.rank! ? '▲' : '▼' }}{{ Math.abs(r.was - r.rank!) }}</span
                  >
                </td>
                <td><TierMark :tier="r.tier" /></td>
                <td class="num">
                  <b>{{ pct(r.win) }}</b>
                </td>
                <td class="num">{{ pct(r.pick) }}</td>
                <td class="num hm">{{ pct(r.ban) }}</td>
                <td class="num hm t2">{{ thousands(r.games) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>
