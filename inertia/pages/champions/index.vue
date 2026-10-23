<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { Search } from 'lucide-vue-next'
import { RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Banner from '../../components/champions/Banner.vue'
import FilterBar from '../../components/champions/FilterBar.vue'
import TierMark from '../../components/champions/TierMark.vue'
import {
  ROLES,
  champIconUrl,
  compact,
  filterQuery,
  pct,
  roleOf,
  splashUrl,
  type ChampionEntry,
  type Filter,
  type RoleStat,
  type Summary,
} from '../../lib/champions.js'
import '../../css/champions.css'

/** `/champions`: every champion, its main role, tier and win rate; a role, a class, a name. */
const props = defineProps<{
  champions: ChampionEntry[]
  summary: Summary | null
  patches: { patch: string; games: number }[]
  filter: Filter | null
}>()

const latest = computed(() => props.patches[0]?.patch)
const rank = computed(() => props.filter?.bracket ?? 'emerald_plus')
const patch = computed(() => props.filter?.patch ?? latest.value ?? '')
const role = ref<string>('ALL')
const kind = ref('all')
const sort = ref<'name' | 'tier' | 'win' | 'pick' | 'ban'>('name')
const query = ref('')

const CLASSES = ['assassin', 'fighter', 'mage', 'marksman', 'support', 'tank']

/** Each champion's roles, its main one first. */
const statsOf = computed(() => {
  const map = new Map<number, RoleStat[]>()
  for (const r of props.summary?.roles ?? [])
    map.set(r.champion, [...(map.get(r.champion) ?? []), r])
  for (const list of map.values()) list.sort((a, b) => b.games - a.games)
  return map
})

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.champions
    .map((c) => {
      const all = statsOf.value.get(c.id) ?? []
      const main = role.value === 'ALL' ? all[0] : all.find((r) => r.position === role.value)
      return { c, all, main }
    })
    .filter(
      (x) =>
        (role.value === 'ALL' || x.main) && (kind.value === 'all' || x.c.roles.includes(kind.value))
    )
    .filter((x) => !q || x.c.name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort.value === 'name') return a.c.name.localeCompare(b.c.name)
      const va = a.main,
        vb = b.main
      if (!va || !vb) return va ? -1 : vb ? 1 : 0
      if (sort.value === 'tier')
        return (va.tier ?? 9) - (vb.tier ?? 9) || (va.rank ?? 999) - (vb.rank ?? 999)
      return (vb[sort.value] as number) - (va[sort.value] as number)
    })
})

const tabsCount = (position: string) =>
  props.champions.filter((c) => statsOf.value.get(c.id)?.some((r) => r.position === position))
    .length
const href = (c: { rank?: string; patch?: string }) =>
  `/champions${filterQuery({ rank: c.rank ?? rank.value, patch: c.patch ?? patch.value }, latest.value)}`
const champHref = (slug: string, position?: string) =>
  `/champions/${slug}${filterQuery({ role: position ? roleOf(position).slug : undefined, rank: rank.value, patch: patch.value }, latest.value)}`
</script>

<template>
  <Head title="Champions" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <Banner
      list
      :art="[222, 103, 64, 412].map(splashUrl)"
      title="Champions"
      :figures="[
        { label: 'Champions', value: champions.length },
        {
          label: 'Games',
          value: summary ? compact(summary.games) : '–',
          sub: filter ? `Patch ${filter.patch}` : undefined,
        },
      ]"
    >
      <template #kicker
        >Our own ranked games · {{ rank === 'emerald_plus' ? 'Emerald+' : rank }}</template
      >
    </Banner>
    <main class="page cs-main flex-1">
      <nav class="cs-tabs" style="margin-top: 0">
        <a href="#" :class="{ on: role === 'ALL' }" @click.prevent="role = 'ALL'"
          >All roles<small>{{ champions.length }}</small></a
        >
        <a
          v-for="r in ROLES"
          :key="r.position"
          href="#"
          :class="{ on: role === r.position }"
          @click.prevent="role = r.position"
        >
          <RoleIcon :lane="r.lane" :size="14" />{{ r.label
          }}<small>{{ tabsCount(r.position) }}</small>
        </a>
      </nav>
      <FilterBar :rank="rank" :patch="patch" :patches="patches" :href="href">
        <label class="cs-field"
          ><Search :size="14" class="text-ink-3" /><input
            v-model="query"
            type="search"
            placeholder="Search a champion"
        /></label>
      </FilterBar>
      <div class="cs-chips">
        <span class="label">Class</span>
        <button :class="{ on: kind === 'all' }" @click="kind = 'all'">All</button>
        <button v-for="c in CLASSES" :key="c" :class="{ on: kind === c }" @click="kind = c">
          {{ c.charAt(0).toUpperCase() + c.slice(1) }}
        </button>
        <span class="sep" />
        <span class="label">Sort</span>
        <button
          v-for="[k, l] in [
            ['name', 'Name'],
            ['tier', 'Tier'],
            ['win', 'Win rate'],
            ['pick', 'Pick rate'],
            ['ban', 'Ban rate'],
          ] as const"
          :key="k"
          :class="{ on: sort === k }"
          @click="sort = k"
        >
          {{ l }}
        </button>
      </div>
      <div class="cs-grid">
        <Link
          v-for="x in rows"
          :key="x.c.id"
          :href="champHref(x.c.slug, x.main?.position)"
          class="cs-tile"
          prefetch
          cache-for="30s"
        >
          <span class="rl"
            ><RoleIcon
              v-for="r in x.all.filter((s, i) => !i || s.roleShare >= 0.12)"
              :key="r.position"
              :lane="roleOf(r.position).lane"
              :size="12"
          /></span>
          <img :src="champIconUrl(x.c.id)" alt="" loading="lazy" />
          <b>{{ x.c.name }}</b>
          <span class="m"
            ><template v-if="x.main"
              ><TierMark :tier="x.main.tier" /><span class="w">{{
                pct(x.main.win)
              }}</span></template
            ><template v-else>–</template></span
          >
        </Link>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
