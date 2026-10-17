<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { DISCORD_URL } from '../lib/links.js'
import '../components/changelog/release-notes.css'

/**
 * /roadmap: what comes next for the desktop app and invade.lol, drawn like the changelog (one
 * stage per row, its name on the left, quiet lists on the right). Written by hand from the team's
 * plan, player-facing items only. Move items along as versions ship.
 */
const STAGES = [
  {
    name: 'Now',
    note: 'Being built for the next version',
    groups: [
      {
        title: 'Desktop app',
        items: [
          'Bigger overlays for 4K and ultrawide screens',
          'A setting to turn off the automatic rune import',
          'Runes and build that follow the role you get in champ select',
          'Choose what the overlays do while you hold Tab: hide, stay, or only show then',
          'More ARAM Mayhem augments per tier, with how often each is picked',
          'A lane gold difference that only counts items the game has shown you',
          'A close button on each overlay, a hotkey to show or hide them all, and overlays that come back after Alt+Tab',
          'A small hint for which spell to level next',
          'Gold plates that find the scoreboard again after you move it, if the game allows it',
          'Your build order, minute by minute, in the match details',
          'The seventh item slot in end-of-game builds, so boots stop going missing',
          'The next components to buy, from the gold you have',
          'Overlays on Macs with two external screens',
          'The right message when macOS needs Invade restarted for screen recording',
          'The video player opening on screen with two or three monitors',
        ],
      },
      {
        title: 'invade.lol',
        items: [
          'Click a player’s picture or name to go back to their Overview',
          'Copy a Riot ID in one click',
          'Show all on every shortened list of a profile',
          'Compare fetches the other player’s latest games for you',
          'Friends shows games and win rate first, and groups open to show who’s in them',
          'Ranks for all ten players on the Live tab, without opening each profile',
        ],
      },
    ],
  },
  {
    name: 'Next',
    note: 'Planned after that',
    groups: [
      {
        title: 'Desktop app',
        items: [
          'Place every overlay before your first game, and resize them in game by their corners',
          'Custom builds: start from the recommended one, swap items, save it per champion and role',
          'Arena overlays, starting with augments',
        ],
      },
      {
        title: 'Both',
        items: [
          'Accounts: sign in with Discord or Google, link the app, and see all your League accounts in one place',
          'Favorite profiles, sorted into folders, the same on the site and in the app',
          'Your matchups: your record against each champion, and which of your champions do best against a pick',
          'An Invade score that compares you with players of your own rank',
          'Build order and the seventh slot on match pages',
          'A patch picker, and patches side by side, on Matchups and Champions',
        ],
      },
    ],
  },
  {
    name: 'Later',
    note: 'Ideas we want to get to',
    groups: [
      {
        title: null,
        items: [
          'A draft tool to plan picks and bans',
          'Stats for teams and scrims',
          'Item stats on invade.lol',
          'Jungle camp and ward timers on the minimap',
          'Overlays in your recordings and clips, as an option',
        ],
      },
    ],
  },
]
</script>

<template>
  <Head title="Roadmap" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="mx-auto w-full max-w-[956px] flex-1 px-4 pt-[clamp(32px,7vh,72px)] sm:px-6">
      <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 class="text-[28px] font-semibold leading-tight tracking-[-0.012em] text-ink">
          Roadmap
        </h1>
        <Link href="/app/changelog" class="text-[13px] text-ink-3 transition-colors hover:text-ink">
          What’s new
        </Link>
      </header>
      <p class="mt-3 max-w-[560px] text-[14px] leading-relaxed text-ink-2">
        What’s coming to Invade and invade.lol. Want something moved up, or missing here? Tell us on
        <a
          :href="DISCORD_URL"
          target="_blank"
          rel="noreferrer"
          class="text-ink underline decoration-line-3 underline-offset-2 transition-colors hover:decoration-current"
          >Discord</a
        >.
      </p>

      <div class="rn mt-10">
        <section
          v-for="(stage, i) in STAGES"
          :key="stage.name"
          class="rn-release"
          :style="{ '--i': i }"
          :aria-labelledby="`stage-${stage.name}`"
        >
          <header class="rn-side">
            <h2 :id="`stage-${stage.name}`" class="rn-version">{{ stage.name }}</h2>
            <span class="text-[12px] text-ink-3">{{ stage.note }}</span>
          </header>

          <div class="rn-main">
            <section
              v-for="group in stage.groups"
              :key="group.title ?? stage.name"
              class="rn-group"
            >
              <h3 v-if="group.title" class="rn-group-title">{{ group.title }}</h3>
              <ul>
                <li v-for="item in group.items" :key="item">{{ item }}</li>
              </ul>
            </section>
          </div>
        </section>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
/* The group names read like the changelog's New / Changed / Fixed. */
.rn-group-title {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
</style>
