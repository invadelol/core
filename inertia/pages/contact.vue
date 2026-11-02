<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Mail } from 'lucide-vue-next'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { DISCORD_URL, REPO_URL, X_URL } from '../lib/links.js'

/**
 * `/contact`: the ways to reach the team, one row each. The email is the publisher's address that
 * /legal already shows (app/controllers/legal_controller.ts); the row is left out when none is set.
 */
defineProps<{ email: string | null }>()

/** The brands' own marks (24×24), drawn in the text colour like any other icon. */
const MARKS = {
  discord:
    'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
}

/** `invadelol/core` out of the repository's address. */
const repo = REPO_URL.replace('https://github.com/', '')
</script>

<template>
  <Head title="Contact" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="mx-auto w-full max-w-[680px] flex-1 px-4 pt-[clamp(32px,9vh,96px)] sm:px-6">
      <h1 class="text-[28px] font-semibold leading-tight tracking-[-0.012em] text-ink">Contact</h1>
      <p class="mt-2 text-[14px] text-ink-2">The Discord is the quickest way to reach us.</p>

      <ul class="ways iv-panel lit-sheet mt-6">
        <li class="way">
          <span class="mark" aria-hidden="true">
            <svg class="brand" viewBox="0 0 24 24"><path :d="MARKS.discord" /></svg>
          </span>
          <div class="body">
            <h2 class="name">Discord</h2>
            <p class="what">
              Help, feedback and
              <a href="/bugs" target="_blank" rel="noreferrer" data-track="contact_bugs"
                >bug reports</a
              >.
            </p>
          </div>
          <a
            :href="DISCORD_URL"
            target="_blank"
            rel="noreferrer"
            class="go iv-btn primary"
            data-track="contact_discord"
          >
            Join the server
          </a>
        </li>

        <li class="way">
          <span class="mark" aria-hidden="true">
            <svg class="brand" viewBox="0 0 24 24"><path :d="MARKS.x" /></svg>
          </span>
          <div class="body">
            <h2 class="name">X <span class="meta">@invadedotlol</span></h2>
            <p class="what">News and new releases.</p>
          </div>
          <a
            :href="X_URL"
            target="_blank"
            rel="noreferrer"
            class="go iv-btn"
            data-track="contact_x"
          >
            Follow
          </a>
        </li>

        <li class="way">
          <span class="mark" aria-hidden="true">
            <svg class="brand" viewBox="0 0 24 24"><path :d="MARKS.github" /></svg>
          </span>
          <div class="body">
            <h2 class="name">
              GitHub <span class="meta">{{ repo }}</span>
            </h2>
            <p class="what">The code of this site.</p>
          </div>
          <a
            :href="REPO_URL"
            target="_blank"
            rel="noreferrer"
            class="go iv-btn"
            data-track="contact_github"
          >
            View source
          </a>
        </li>

        <li v-if="email" class="way">
          <span class="mark" aria-hidden="true"><Mail :size="18" :stroke-width="1.75" /></span>
          <div class="body">
            <h2 class="name">
              Email <span class="meta">{{ email }}</span>
            </h2>
            <p class="what">Privacy and legal requests.</p>
          </div>
          <a :href="`mailto:${email}`" class="go iv-btn" data-track="contact_email">
            Send an email
          </a>
        </li>
      </ul>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.ways {
  padding: 0 16px;
}

/* One way in per row: the mark, what it is for, and its button. */
.way {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 14px;
  padding: 16px 0;
}

.way + .way {
  border-top: 1px solid var(--line);
}

.mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--text-1);
  background: var(--inset);
  border-radius: var(--r-sm);
  box-shadow: var(--inset-shadow);
}

.mark .brand {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.name {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-1);
}

.meta {
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
  overflow-wrap: anywhere;
}

.what {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-2);
}

.what a {
  color: var(--text-1);
  text-decoration: underline;
  text-decoration-color: var(--line-3);
  text-underline-offset: 2px;
  border-radius: var(--r-xs);
  transition: text-decoration-color var(--t-fast);
}

.what a:hover {
  text-decoration-color: currentColor;
}

/* The shared button's own shadow would hide the site's focus ring: keep both. */
.go:focus-visible {
  box-shadow: var(--btn-shadow), var(--focus);
}

.go.primary:focus-visible {
  box-shadow: var(--primary-shadow), var(--focus);
}

/* A phone gives the text the row's width and puts the button under it. */
@media (max-width: 479px) {
  .way {
    grid-template-columns: 36px minmax(0, 1fr);
    align-items: start;
    row-gap: 12px;
  }

  .go {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
