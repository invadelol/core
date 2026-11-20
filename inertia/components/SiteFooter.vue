<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import Glyph from './ui/Glyph.vue'
import Icon from './ui/Icon.vue'
import ThemeChoice from './header/ThemeChoice.vue'
import { prefetchOnTouch } from './header/prefetch.js'
import { DISCORD_URL, REPO_URL, X_URL } from '../lib/links.js'
import { FOOTER_COLUMNS, NEW_DAWN_LINK, patchPath } from '../lib/site_nav.js'

/**
 * The foot of every page (Facet): the mark and one line on what Invade is, the Discord and X,
 * then four columns (Tier list, Leaderboards, Esports, Invade, with New Dawn under the patch
 * notes); under a hairline, Riot's notice, the policies and the theme.
 */
const page = usePage()
const version = computed(() => (page.props as { patch?: string | null }).patch ?? null)

const columns = computed(() => [
  ...FOOTER_COLUMNS,
  {
    title: 'Invade',
    links: [
      ...(version.value ? [{ label: 'Patch notes', href: patchPath(version.value) }] : []),
      { label: NEW_DAWN_LINK.label, href: NEW_DAWN_LINK.href },
      { label: 'Desktop app', href: '/app' },
      { label: 'Changelog', href: '/app/changelog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
])

const year = new Date().getFullYear()
</script>

<template>
  <footer class="vb ft-root">
    <div class="ft">
      <div class="wrap">
        <div class="ft-top">
          <div class="ft-brand">
            <Link class="brand" href="/" aria-label="Invade home"
              ><Glyph :h="24" /><span class="wm">Invade</span></Link
            >
            <p>
              League of Legends stats on the web, and an app for Windows and macOS that follows your
              games.
            </p>
            <div class="ft-social">
              <a
                class="btn sm"
                :href="DISCORD_URL"
                target="_blank"
                rel="noreferrer"
                data-track="footer_discord"
                ><Icon name="discord" :size="16" />Discord</a
              >
              <a class="btn sm" :href="X_URL" target="_blank" rel="noreferrer" data-track="footer_x"
                >X</a
              >
              <a
                class="btn sm ico"
                :href="REPO_URL"
                target="_blank"
                rel="noreferrer"
                aria-label="Source code on GitHub"
                data-track="footer_github"
                ><Icon name="github" :size="16"
              /></a>
            </div>
          </div>
          <nav v-for="c in columns" :key="c.title" class="ft-col" :aria-label="c.title">
            <span class="ft-h">{{ c.title }}</span>
            <Link
              v-for="l in c.links"
              :key="l.href"
              :href="l.href"
              prefetch
              @touchstart.passive="prefetchOnTouch(l.href)"
              >{{ l.label }}</Link
            >
          </nav>
        </div>

        <div class="ft-bot">
          <span>
            Invade isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot
            Games or anyone officially involved in producing or managing Riot Games properties. Riot
            Games and all associated properties are trademarks or registered trademarks of Riot
            Games, Inc. Some pros’ accounts come from
            <a href="https://lol.fandom.com/" rel="noopener" target="_blank">Leaguepedia</a>, under
            <a
              href="https://creativecommons.org/licenses/by-sa/3.0/"
              rel="license noopener"
              target="_blank"
              >CC BY-SA 3.0</a
            >.
          </span>
          <span class="ft-meta">
            <span class="ft-legal">
              <span>© {{ year }} Invade</span>
              <Link href="/privacy">Privacy</Link>
              <Link href="/legal">Legal notice</Link>
              <a href="/legal#terms">Terms</a>
            </span>
            <ThemeChoice />
          </span>
        </div>
      </div>
    </div>
  </footer>
</template>
