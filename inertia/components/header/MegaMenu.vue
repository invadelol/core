<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ChampIcon, Icon, Logo, RankCrest, RoleIcon } from '@invadelol/ui'
import { pct } from '../../lib/champions.js'
import type { SiteNav } from '../../lib/home.js'
import ProPhoto from '../champions/ProPhoto.vue'
import TeamLogo from '../champions/TeamLogo.vue'
import LeagueLogo from './LeagueLogo.vue'
import { prefetchOnTouch } from './prefetch.js'
import {
  ROLE_LINKS,
  TIER_LABELS,
  championHref,
  positionOf,
  type Section,
  type SectionLink,
} from './sections.js'

/**
 * One section's menu under its trigger: a lit card on the left with the section's live list (the
 * best pick of each role, the top pros, the climbers, or the desktop app), the section's pages
 * with a line each, and the roles or the leagues along the side. Its links and the card's frame
 * paint at once; the list fills in when the menus' data lands (`siteNav`).
 */
const props = defineProps<{ section: Section; nav: SiteNav | null; id: string }>()
const emit = defineEmits<{ close: [focusTrigger: boolean] }>()

const links = computed(() =>
  props.section.links.flatMap((l) => {
    const line = l.line(props.nav)
    return line === null ? [] : [{ ...l, text: l.title?.(props.nav) ?? l.label, line }]
  })
)
const tierList = computed(() => props.nav?.tierList ?? null)
const pros = computed(() => props.nav?.pros?.top ?? [])
const leagues = computed(() => props.nav?.leagues ?? [])
const loading = computed(() => props.nav === null)
const lp = (n: number | null) => (n === null ? '' : `${n.toLocaleString('en-US')} LP`)

const track = (l: SectionLink) =>
  `menu_${props.section.key}_${l.label.toLowerCase().replace(/\W+/g, '_')}`

/** Arrow keys walk the menu's links; Escape closes it and gives the focus back to its trigger. */
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close', true)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const root = event.currentTarget as HTMLElement
  const items = [...root.querySelectorAll<HTMLElement>('a[href]')]
  if (!items.length) return
  event.preventDefault()
  const at = items.indexOf(document.activeElement as HTMLElement)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (at + 1) % items.length
          : (at - 1 + items.length) % items.length
  items[next]?.focus()
}
</script>

<template>
  <div
    :id="id"
    class="sh-pop sh-mega"
    :class="`is-${section.key}`"
    role="region"
    :aria-label="section.label"
    @keydown="onKey"
  >
    <!-- The lit card: the section's live list. -->
    <div class="sh-feat">
      <template v-if="section.key === 'champions'">
        <span class="k">{{ tierList ? `Tier list, patch ${tierList.patch}` : 'Tier list' }}</span>
        <h3>Best pick in each role</h3>
        <ul v-if="loading || tierList?.best.length">
          <template v-if="tierList">
            <li v-for="b in tierList.best" :key="b.position">
              <Link
                :href="championHref(b.slug, b.position)"
                prefetch
                data-track="menu_champions_best"
                @touchstart.passive="prefetchOnTouch(championHref(b.slug, b.position))"
              >
                <span class="r"><RoleIcon :lane="positionOf(b.position).lane" :size="14" /></span>
                <span class="pic"><ChampIcon :id="b.championId" :size="24" /></span>
                <span class="n">{{ b.name }}</span>
                <span v-if="b.tier !== null" class="sh-tier" :class="`t${b.tier}`">{{
                  TIER_LABELS[b.tier]
                }}</span>
                <span class="v num">{{ pct(b.winRate) }}</span>
              </Link>
            </li>
          </template>
          <li v-for="i in loading ? 5 : 0" :key="`s${i}`" class="sk" aria-hidden="true">
            <span /><span />
          </li>
        </ul>
        <Link href="/tier-list" prefetch class="more" data-track="menu_champions_tier_list_more">
          Full tier list<Icon name="right" :size="13" />
        </Link>
      </template>

      <template v-else-if="section.key === 'pros'">
        <span class="k">Solo queue now</span>
        <h3>Highest ranked pros</h3>
        <ul v-if="loading || pros.length">
          <li v-for="p in pros" :key="p.slug">
            <Link
              :href="`/pro/${p.slug}`"
              prefetch
              class="two"
              data-track="menu_pros_top"
              @touchstart.passive="prefetchOnTouch(`/pro/${p.slug}`)"
            >
              <ProPhoto
                v-if="p.photo"
                :slug="p.slug"
                :photo="p.photo"
                :width="28"
                :height="28"
                class="logo"
              />
              <TeamLogo v-else-if="p.team" :team="p.team" :size="28" class="logo" />
              <span v-else class="logo none" aria-hidden="true"
                ><Icon name="user" :size="14"
              /></span>
              <span class="n"
                >{{ p.name }}<small v-if="p.team">{{ p.team.name }}</small></span
              >
              <RankCrest v-if="p.tier" :tier="p.tier" :size="16" />
              <span class="v num">{{ lp(p.lp) }}</span>
              <span
                v-if="p.movement?.places"
                class="mv num"
                :class="p.movement.places > 0 ? 'up' : 'down'"
                >{{ p.movement.places > 0 ? '▲' : '▼' }}{{ Math.abs(p.movement.places) }}</span
              >
            </Link>
          </li>
          <li v-for="i in loading ? 5 : 0" :key="`s${i}`" class="sk two" aria-hidden="true">
            <span /><span />
          </li>
        </ul>
        <Link href="/pros?view=ladder" prefetch class="more" data-track="menu_pros_ladder_more">
          Full ladder<Icon name="right" :size="13" />
        </Link>
      </template>

      <template v-else-if="section.key === 'stats'">
        <template v-if="tierList?.climbers.length">
          <span class="k">{{ tierList.previousPatch }} to {{ tierList.patch }}</span>
          <h3>Biggest climbers</h3>
          <ul>
            <li v-for="c in tierList.climbers" :key="`${c.position}${c.championId}`">
              <Link
                :href="championHref(c.slug, c.position)"
                prefetch
                data-track="menu_stats_climber"
              >
                <span class="r"><RoleIcon :lane="positionOf(c.position).lane" :size="14" /></span>
                <span class="pic"><ChampIcon :id="c.championId" :size="24" /></span>
                <span class="n">{{ c.name }}</span>
                <span class="v num"
                  ><span class="was">#{{ c.from }}</span
                  ><Icon name="right" :size="11" class="to" />#{{ c.to }}</span
                >
              </Link>
            </li>
          </ul>
          <Link href="/stats?view=patch" prefetch class="more" data-track="menu_stats_patch_more">
            Patch report<Icon name="right" :size="13" />
          </Link>
        </template>
        <template v-else>
          <span class="k">{{ tierList ? `Patch ${tierList.patch}` : 'Ranked games' }}</span>
          <h3>Champion stats</h3>
          <p v-if="tierList" class="p num">
            {{ tierList.games.toLocaleString('en-US') }} ranked games, Emerald and above
          </p>
          <Link href="/stats" prefetch class="more" data-track="menu_stats_all_more">
            All stats<Icon name="right" :size="13" />
          </Link>
        </template>
      </template>

      <template v-else>
        <Logo :size="18" />
        <h3 class="app">Invade for desktop</h3>
        <p class="p">Live stats over your game, scouting in champ select, every game scored.</p>
        <Link href="/app" prefetch class="more" data-track="menu_tools_app">
          Windows and macOS<Icon name="right" :size="13" />
        </Link>
      </template>
    </div>

    <!-- The section's pages. -->
    <div class="sh-links" :class="{ one: section.key === 'pros' || section.key === 'tools' }">
      <Link
        v-for="l in links"
        :key="l.href"
        :href="l.href"
        prefetch
        class="sh-link"
        :data-track="track(l)"
        @touchstart.passive="prefetchOnTouch(l.href)"
      >
        <span class="ic"><Icon :name="l.icon" :size="16" /></span>
        <span class="t"
          ><b>{{ l.text }}</b
          ><span class="d">{{ l.line }}</span></span
        >
      </Link>
    </div>

    <div v-if="section.key === 'champions'" class="sh-mega-foot">
      <span class="lbl">By role</span>
      <Link
        v-for="r in ROLE_LINKS"
        :key="r.href"
        :href="r.href"
        prefetch
        class="sh-chip"
        data-track="menu_champions_role"
      >
        <RoleIcon :lane="r.lane" :size="13" />{{ r.label }}
      </Link>
    </div>

    <div v-if="section.key === 'pros' && leagues.length" class="sh-leagues">
      <span class="lbl">Leagues</span>
      <Link
        v-for="l in leagues"
        :key="l.slug"
        :href="`/pros?league=${l.slug}`"
        prefetch
        :title="l.name"
        data-track="menu_pros_league"
      >
        <LeagueLogo :league="l" :size="20" />
        <span class="nm"
          ><b>{{ l.code ?? l.short }}</b
          ><span class="d">{{ l.region ?? l.name }}</span></span
        >
        <small class="num" :aria-label="`${l.teams} teams`">{{ l.teams }}</small>
      </Link>
    </div>
  </div>
</template>
