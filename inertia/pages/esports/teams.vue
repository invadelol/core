<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import Logo from '../../components/pros/Logo.vue'
import ProPic from '../../components/pros/ProPic.vue'
import Flag from '../../components/pros/Flag.vue'
import { countryName } from '../../lib/board.js'
import { laneOf, n, roleLabel } from '../../lib/ladders.js'
import { slots, type LeagueBoard, type TeamBoard } from '../../lib/esports_landing.js'
import '../../css/esports.css'
import '../../css/esports-landing.css'

/**
 * `/teams`: every league's teams in one ranking by their starters' average solo queue LP (those in
 * Master and above; a team needs three of its five there to be ranked), each with its crest,
 * league, country and starting five by face and name, a dot on the ones who joined in the last
 * weeks. The leagues above narrow the list in the browser
 * (`?league=lec`, or a league page's `#lec`), the address following.
 */
const props = defineProps<{ boards: LeagueBoard[]; description: string }>()

type Row = TeamBoard & { league: LeagueBoard['league'] }
/** A team is ranked by its starters' average LP once three of them are in Master and above. */
const RANKED = 3
const ranked = (t: TeamBoard) => t.lp !== null && t.apex >= RANKED
const all = computed<Row[]>(() =>
  props.boards
    .flatMap((b) => b.teams.map((t) => ({ ...t, league: b.league })))
    .sort(
      (a, b) =>
        Number(ranked(b)) - Number(ranked(a)) ||
        (ranked(a) ? 0 : b.apex - a.apex) ||
        (b.lp ?? -1) - (a.lp ?? -1) ||
        a.name.localeCompare(b.name)
    )
)
const known = (slug: string | null | undefined) =>
  slug && props.boards.some((b) => b.league.slug === slug) ? slug : null

/** The league the list is narrowed to: read from the address, so the server draws it too. */
const page = usePage()
const league = ref<string | null>(
  known(new URLSearchParams(page.url.split('?')[1] ?? '').get('league'))
)
onMounted(() => {
  const hash = known(window.location.hash.slice(1))
  if (hash && !league.value) league.value = hash
})
function pick(slug: string | null) {
  league.value = slug
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set('league', slug)
  else url.searchParams.delete('league')
  url.hash = ''
  window.history.replaceState(window.history.state, '', url)
}

const rows = computed(() =>
  all.value.filter((t) => !league.value || t.league.slug === league.value)
)
/** A team's place in the list; one with fewer than three starters in Master and above has none. */
const place = (i: number, t: Row) => (ranked(t) ? String(i + 1) : '–')
const fresh = computed(() => all.value.some((t) => t.five.some((p) => p.fresh)))
</script>

<template>
  <Head title="Teams">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap pg-es el-pg">
      <Masthead
        title="Teams"
        :crumbs="[{ label: 'Esports', href: '/esports' }, { label: 'Teams' }]"
      >
        <nav class="el-jump" aria-label="League">
          <button
            type="button"
            :class="{ on: !league }"
            :aria-pressed="!league"
            @click="pick(null)"
          >
            All
          </button>
          <button
            v-for="b in boards"
            :key="b.league.slug"
            type="button"
            :class="{ on: league === b.league.slug }"
            :aria-pressed="league === b.league.slug"
            @click="pick(league === b.league.slug ? null : b.league.slug)"
          >
            <Logo :league="b.league.slug" :size="24" class="el-lg24" />{{ b.league.code }}
          </button>
          <span v-if="fresh" class="el-key"><i class="el-new"></i>Joined in the last 60 days</span>
        </nav>
      </Masthead>

      <section v-if="rows.length" class="card el-rk-c">
        <div class="el-rk-h">
          <span></span>
          <span>Team</span>
          <span>Starting five</span>
          <span class="el-rk-r">LP average</span>
          <span class="el-rk-r">In Master+</span>
        </div>
        <div v-for="(t, i) in rows" :key="t.id" class="el-rk">
          <span
            class="el-rk-n num"
            :title="ranked(t) ? undefined : 'Fewer than three starters in Master and above'"
            >{{ place(i, t) }}</span
          >
          <Link :href="`/team/${t.slug}`" class="el-rk-t">
            <Logo :team="t.id" :size="40" class="el-lg40" />
            <span class="col" style="min-width: 0">
              <span class="el-nm el-rk-tn ell">{{ t.name }}</span>
              <span class="el-sub"
                ><Logo :league="t.league.slug" :size="16" class="el-tl" />{{ t.league.code
                }}<Flag
                  v-if="t.country"
                  :code="t.country"
                  :size="16"
                  :title="countryName(t.country)"
              /></span>
            </span>
          </Link>
          <span class="el-rk-5">
            <template v-for="s in slots(t)" :key="s.role">
              <Link v-if="s.p" :href="`/pro/${s.p.slug}`" class="el-rk-p" :title="s.p.name">
                <span class="el-face"
                  ><ProPic :slug="s.p.slug" :photo="s.p.photo" :team="t" :size="40"
                /></span>
                <span class="col">
                  <span class="el-nm el-rk-pn ell"
                    >{{ s.p.name
                    }}<i v-if="s.p.fresh" class="el-new" title="Joined in the last 60 days"></i
                  ></span>
                  <span class="el-sub"
                    ><RoleIcon :lane="laneOf(s.role)!" :size="11" />{{ roleLabel(s.role) }}</span
                  >
                </span>
              </Link>
              <span v-else class="el-rk-p" :title="`${roleLabel(s.role)}: no starter stored`"
                ><span class="el-face el-empty-slot"></span
                ><span class="col"
                  ><span class="el-rk-pn t3">–</span
                  ><span class="el-sub"
                    ><RoleIcon :lane="laneOf(s.role)!" :size="11" />{{ roleLabel(s.role) }}</span
                  ></span
                ></span
              >
            </template>
          </span>
          <span class="el-rk-r el-v num">{{ t.lp === null ? '–' : n(t.lp) }}</span>
          <span class="el-rk-r el-sub num el-rk-a">{{ t.apex }} of 5</span>
        </div>
      </section>
      <p v-else class="meta" style="padding-top: 24px">No team is stored for these leagues yet.</p>
    </div>
  </SiteLayout>
</template>
