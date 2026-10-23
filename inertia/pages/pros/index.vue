<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { RankCrest, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Banner from '../../components/champions/Banner.vue'
import TeamLogo from '../../components/champions/TeamLogo.vue'
import { regionLabel } from '../../lib/assets.js'
import { laneOf, splashUrl, thousands, type ProTag } from '../../lib/champions.js'
import '../../css/champions.css'

/** `/pros`: the best ranked pros now, and every active team by region. */
const props = defineProps<{
  directory: {
    teams: {
      id: string
      slug: string
      name: string
      shortName: string | null
      region: string | null
      players: number
    }[]
    top: (ProTag & {
      best: { tier: string; division: number | null; lp: number | null } | null
      account: { gameName: string; tagLine: string; platform: string }
    })[]
    counts: { players: number; accounts: number; teams: number }
  }
}>()

const regions = computed(() => {
  const map = new Map<string, typeof props.directory.teams>()
  for (const t of props.directory.teams)
    map.set(t.region ?? 'Other', [...(map.get(t.region ?? 'Other') ?? []), t])
  return [...map].sort((a, b) => b[1].length - a[1].length)
})
const region = ref<string | null>(null)
const shown = computed(() => regions.value.find(([r]) => r === region.value) ?? regions.value[0])
</script>

<template>
  <Head title="Pros" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <Banner
      list
      :art="[157, 238, 222].map(splashUrl)"
      title="Pros"
      :figures="[
        { label: 'Players', value: thousands(directory.counts.players) },
        { label: 'Accounts', value: thousands(directory.counts.accounts) },
        { label: 'Active teams', value: thousands(directory.counts.teams) },
      ]"
    >
      <template #kicker>Professional players and their ranked accounts</template>
    </Banner>
    <main class="page cs-main flex-1">
      <div class="cs-cols cs-c-side">
        <section v-if="shown">
          <div class="cs-chips" style="margin-top: 0">
            <span class="label">Teams</span>
            <button
              v-for="[r, teams] in regions"
              :key="r"
              :class="{ on: r === shown[0] }"
              @click="region = r"
            >
              {{ r }}<small>{{ teams.length }}</small>
            </button>
          </div>
          <div class="cs-teams">
            <Link
              v-for="t in shown[1]"
              :key="t.id"
              :href="`/team/${t.slug}`"
              class="cs-team"
              prefetch
              cache-for="30s"
            >
              <TeamLogo :team="t" :size="40" />
              <span class="min-w-0"
                ><b>{{ t.name }}</b
                ><small>{{ t.shortName }} · {{ t.players }} players</small></span
              >
            </Link>
          </div>
        </section>
        <section class="iv-panel cs-card cs-lead">
          <h2>Highest ranked now</h2>
          <Link
            v-for="(p, i) in directory.top"
            :key="p.slug"
            :href="`/pro/${p.slug}`"
            class="cs-member"
            prefetch
            cache-for="30s"
          >
            <span class="w-6 text-right text-[12px] text-ink-3">{{ i + 1 }}</span>
            <span class="role"
              ><RoleIcon v-if="laneOf(p.role ?? '')" :lane="laneOf(p.role ?? '') as any" :size="18"
            /></span>
            <span class="nm"
              ><b>{{ p.name }}</b
              ><small
                >{{ p.team?.name ?? 'No team' }} · {{ regionLabel(p.account.platform) }}</small
              ></span
            >
            <RankCrest v-if="p.best" :tier="p.best.tier" :size="20" />
            <span class="text-[12.5px] font-semibold">{{
              p.best ? `${thousands(p.best.lp ?? 0)} LP` : ''
            }}</span>
          </Link>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
