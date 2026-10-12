<script setup lang="ts">
import { Icon, Logo, RankCrest, type IconName } from '@invadelol/ui'
import { profileIcon } from '../../lib/assets.js'
import { DEMO } from './demo.js'

/**
 * The desktop app's main window as macOS draws it: the traffic lights over the sidebar (an
 * overlay title bar), the sidebar in its three groups, the top bar with history and search, and
 * the page, a sheet raised over the chrome that catches the one violet light. Always dark: the app
 * has no light theme. The page itself is the slot.
 */
withDefaults(defineProps<{ active?: string; sidebar?: boolean }>(), {
  active: 'dashboard',
  sidebar: true,
})

const NAV: Array<Array<{ id: string; icon: IconName; label: string; dot?: boolean }>> = [
  [
    { id: 'dashboard', icon: 'home', label: 'Home' },
    { id: 'profile', icon: 'user', label: 'Profile' },
    { id: 'live', icon: 'live', label: 'Live game' },
  ],
  [
    { id: 'champions', icon: 'book', label: 'Champions' },
    { id: 'counters', icon: 'swords', label: 'Matchups' },
    { id: 'favorites', icon: 'star', label: 'Favorites' },
  ],
  [
    { id: 'recordings', icon: 'film', label: 'Recordings' },
    { id: 'overlays', icon: 'overlay', label: 'Overlays' },
  ],
]
</script>

<template>
  <div class="aw iv-dark" :class="{ bare: !sidebar }">
    <i class="aw-lights" aria-hidden="true"><b /><b /><b /></i>

    <aside v-if="sidebar" class="aw-side">
      <div class="aw-brand"><Logo :size="20" word /></div>
      <nav class="aw-nav">
        <div v-for="(group, i) in NAV" :key="i" class="aw-group">
          <span
            v-for="item in group"
            :key="item.id"
            class="aw-link"
            :class="{ on: item.id === active }"
          >
            <Icon :name="item.icon" :size="17" />
            <span>{{ item.label }}</span>
          </span>
        </div>
      </nav>
      <div class="aw-foot">
        <span class="aw-link"><Icon name="sliders" :size="17" /><span>Settings</span></span>
        <div class="aw-me">
          <img :src="profileIcon(DEMO.icon)" alt="" width="32" height="32" />
          <span class="aw-who">
            <b
              >{{ DEMO.name }}<small>#{{ DEMO.tag }}</small></b
            >
            <span class="aw-rank"><RankCrest tier="EMERALD" :size="14" /><em>Emerald II</em></span>
          </span>
          <Icon name="up" :size="15" class="aw-more" />
        </div>
      </div>
    </aside>

    <div class="aw-main">
      <header class="aw-top">
        <span class="aw-hist"><Icon name="left" :size="17" /><Icon name="right" :size="17" /></span>
        <span class="aw-search">
          <Icon name="search" :size="15" />
          <span>Search players, champions, pages…</span>
          <kbd>⌘ K</kbd>
        </span>
      </header>
      <div class="aw-page">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.aw {
  /* The window's own grain: dark, whatever the page's theme. */
  --grain: url('../../css/grain.png');
  position: relative;
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  overflow: hidden;
  font: 400 13px/1.4 var(--font);
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
  background: var(--grain), var(--ink-0);
  border-radius: 12px;
  -webkit-font-smoothing: antialiased;
}

.aw.bare {
  grid-template-columns: minmax(0, 1fr);
}

/* The window's own edge: a hairline, brighter on top where the light falls. */
.aw::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.1),
    inset 0 0 0 1px rgb(255 255 255 / 0.07);
  pointer-events: none;
}

.aw-lights {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 2;
  display: flex;
  gap: 8px;
}

.aw-lights b {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff5f57;
  box-shadow: inset 0 0 0 0.5px rgb(0 0 0 / 0.25);
}

.aw-lights b:nth-child(2) {
  background: #febc2e;
}

.aw-lights b:nth-child(3) {
  background: #28c840;
}

/* ── Sidebar ── */
.aw-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 10px 10px;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.012), transparent 40%);
}

.aw-brand {
  display: flex;
  align-items: center;
  height: 84px;
  padding: 32px 10px 0;
}

.aw-nav {
  flex: 1;
  padding-top: 4px;
}

.aw-group {
  display: grid;
  gap: 2px;
}

.aw-group + .aw-group {
  margin-top: 18px;
}

.aw-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  padding: 4px 10px;
  font: 500 13px/1.2 var(--font);
  color: var(--text-2);
  border-radius: var(--r-sm);
}

.aw-link :deep(.iv-icon) {
  flex: none;
  color: var(--text-3);
}

.aw-link.on {
  color: var(--text-1);
  background: linear-gradient(
    90deg,
    rgb(var(--brand-rgb) / 0.18),
    rgb(var(--brand-rgb) / 0.06) 70%,
    rgb(var(--brand-rgb) / 0.03)
  );
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.07),
    inset 0 0 0 1px rgb(var(--brand-rgb) / 0.12);
}

.aw-link.on :deep(.iv-icon) {
  color: var(--brand-hi);
  filter: drop-shadow(0 0 6px rgb(var(--brand-rgb) / 0.5));
}

.aw-foot {
  display: grid;
  gap: 2px;
  padding-top: 8px;
}

.aw-me {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  padding: 14px 6px 6px;
  border-top: 1px solid var(--line);
}

.aw-me > img {
  width: 32px;
  height: 32px;
  border-radius: var(--r-sm);
  object-fit: cover;
}

.aw-who {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
  line-height: 1.25;
}

.aw-who b {
  font-size: 13px;
  font-weight: 600;
}

.aw-who small {
  margin-left: 1px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.aw-rank {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.aw-rank em {
  font-style: normal;
  font-weight: 600;
  color: var(--tier-emerald);
}

.aw-more {
  color: var(--text-3);
}

/* ── Main: the top bar, then the page sheet ── */
.aw-main {
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
}

.aw-top {
  display: grid;
  grid-template-columns: 1fr minmax(240px, 460px) 1fr;
  align-items: center;
  gap: 16px;
  padding-right: 8px;
}

.bare .aw-top {
  padding-left: 84px;
}

.aw-hist {
  display: flex;
  gap: 13px;
  padding-left: 6px;
  color: var(--text-3);
}

.aw-hist :deep(.iv-icon:last-child) {
  opacity: 0.35;
}

.aw-search {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 30px;
  padding: 0 5px 0 11px;
  font-size: 13px;
  color: var(--text-3);
  background: rgb(0 0 0 / 0.28);
  border-radius: var(--r-sm);
  box-shadow:
    inset 0 1px 2px rgb(0 0 0 / 0.5),
    0 1px 0 rgb(255 255 255 / 0.045);
}

.aw-search span {
  flex: 1;
  white-space: nowrap;
}

.aw-search kbd {
  display: inline-grid;
  place-items: center;
  height: 19px;
  padding: 0 5px;
  font: 500 11px var(--font);
  color: var(--text-3);
  background: var(--surface-3);
  border-radius: var(--r-xs);
}

/* The page: a sheet over the chrome, its top edge lit, the violet light and the grain on it. */
.aw-page {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background:
    var(--grain) padding-box,
    var(--light) padding-box,
    linear-gradient(var(--ink-1), var(--ink-1)) padding-box,
    linear-gradient(rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.04) 30%) border-box;
  border: 1px solid transparent;
  border-right: 0;
  border-bottom: 0;
  border-top-left-radius: var(--r-lg);
  box-shadow:
    -18px 0 40px -24px rgb(0 0 0 / 0.9),
    0 -18px 40px -24px rgb(0 0 0 / 0.9);
}

.bare .aw-page {
  border-left: 0;
  border-top-left-radius: 0;
}
</style>
