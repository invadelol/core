<script setup lang="ts">
import { Icon, RankCrest, RoleIcon } from '@invadelol/ui'
import { assetUrl } from '../../lib/assets.js'
import { vReveal } from './reveal.js'

/**
 * The rest of the app, one small card each: champions and the tier list, the live game's
 * scouting, favorites, languages, updates. The figures in the cards are sample figures.
 */
const TIERS = [
  { id: 64, name: 'Lee Sin', tier: 'S', win: '51.2%', pick: '12.4%', ban: '8.1%' },
  { id: 254, name: 'Vi', tier: 'S', win: '52.0%', pick: '7.9%', ban: '3.2%' },
  { id: 234, name: 'Viego', tier: 'A', win: '50.6%', pick: '9.6%', ban: '11.4%' },
  { id: 5, name: 'Xin Zhao', tier: 'A', win: '51.7%', pick: '5.1%', ban: '1.6%' },
]

const SCOUT = [
  { id: 234, name: 'Nightfall', tier: 'EMERALD', rank: 'Emerald I', flag: 'Hot streak' },
  { id: 103, name: 'Foxglove', tier: 'DIAMOND', rank: 'Diamond IV', flag: 'One-trick' },
  { id: 145, name: 'Daybreak', tier: 'EMERALD', rank: 'Emerald III', flag: 'Autofill' },
]

const LANGUAGES = [
  'English',
  'Français',
  'Español',
  'Deutsch',
  'Italiano',
  'Português (Brasil)',
  'Polski',
  'Türkçe',
  'Русский',
  '한국어',
  '日本語',
  '中文',
]
</script>

<template>
  <section id="more" class="ap-section page">
    <header v-reveal class="ap-head">
      <div>
        <p class="ap-kicker">And the rest</p>
        <h2>Everything around your games</h2>
      </div>
      <p>Builds for every champion, the lobby read for you, favorites, and the app in your language.</p>
    </header>

    <div class="more">
      <article v-reveal class="card champs iv-panel">
        <div class="card-copy">
          <h3>Champions</h3>
          <p>
            A tier list for your role and rank, and a page for every champion: runes, spells, skill
            order, items and matchups, as they are played. Save a setup and champ select picks it
            up.
          </p>
        </div>
        <table class="tl">
          <thead>
            <tr><th>Champion</th><th>Tier</th><th>Win</th><th>Pick</th><th>Ban</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in TIERS" :key="c.id">
              <td>
                <span class="tl-champ"><img :src="assetUrl('champion', c.id)" alt="" width="24" height="24" loading="lazy" />{{ c.name }}</span>
              </td>
              <td><b class="tl-tier" :class="c.tier">{{ c.tier }}</b></td>
              <td>{{ c.win }}</td>
              <td>{{ c.pick }}</td>
              <td>{{ c.ban }}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article v-reveal class="card iv-panel">
        <div class="card-copy">
          <h3>Live game</h3>
          <p>Every player's rank, form and record on their champion, in champ select and in game.</p>
        </div>
        <ul class="scout">
          <li v-for="p in SCOUT" :key="p.id">
            <img :src="assetUrl('champion', p.id)" alt="" width="28" height="28" loading="lazy" />
            <span>
              <b>{{ p.name }}</b>
              <small><RankCrest :tier="p.tier" :size="12" />{{ p.rank }}</small>
            </span>
            <em>{{ p.flag }}</em>
          </li>
        </ul>
      </article>

      <article v-reveal class="card iv-panel">
        <div class="card-copy">
          <h3>Favorites</h3>
          <p>Star a champion, a build, a rune page, a matchup, a game or a clip, and find it on Home.</p>
        </div>
        <ul class="favs">
          <li><RoleIcon lane="JUNGLE" :size="16" /><span>Lee Sin · Jungle build</span><Icon name="star" :size="14" /></li>
          <li><Icon name="swords" :size="16" /><span>Lee Sin into Viego</span><Icon name="star" :size="14" /></li>
          <li><Icon name="film" :size="16" /><span>Triple kill · 0:24</span><Icon name="star" :size="14" /></li>
        </ul>
      </article>

      <article v-reveal class="card iv-panel">
        <div class="card-copy">
          <h3>12 languages</h3>
          <p>The app follows your League client's language, or the one you choose.</p>
        </div>
        <ul class="langs">
          <li v-for="l in LANGUAGES" :key="l">{{ l }}</li>
        </ul>
      </article>

      <article v-reveal class="card iv-panel">
        <div class="card-copy">
          <h3>No account</h3>
          <p>
            Invade reads your profile from the League client on this computer. No login, no
            password, no Riot API key.
          </p>
        </div>
        <div class="facts">
          <span><Icon name="check" :size="14" />Free</span>
          <span><Icon name="check" :size="14" />Updates when you choose, never during a game</span>
          <span><Icon name="check" :size="14" />Every update verified before it installs</span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.more {
  display: grid;
  gap: 16px;
}

@media (min-width: 720px) {
  .more {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .champs {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1100px) {
  .more {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .champs {
    grid-column: span 2;
  }
}

.card {
  display: grid;
  align-content: space-between;
  gap: 24px;
  padding: 22px;
}

.card h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.card-copy p {
  max-width: 38em;
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--text-3);
}

/* ── Tier list ── */
.champs {
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 720px) {
  .champs {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    align-items: center;
  }
}

.tl {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.tl th {
  height: 30px;
  font-size: 12px;
  font-weight: 500;
  text-align: right;
  color: var(--text-3);
  border-bottom: 1px solid var(--line);
}

.tl td {
  height: 42px;
  text-align: right;
  color: var(--text-2);
  border-bottom: 1px solid var(--line);
}

.tl tr:last-child td {
  border-bottom: 0;
}

.tl :is(th, td):first-child {
  text-align: left;
}

.tl :is(th, td):nth-child(2) {
  text-align: center;
}

.tl-champ {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: var(--text-1);
}

.tl-champ img {
  width: 24px;
  height: 24px;
  border-radius: var(--r-xs);
  box-shadow: var(--portrait-sm);
}

.tl-tier {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 20px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-1);
  background: var(--surface-3);
  border-radius: var(--r-xs);
}

.tl-tier.S {
  color: var(--gold-c);
}

@media (max-width: 480px) {
  .tl :is(th, td):nth-child(4) {
    display: none;
  }
}

/* ── Scouting ── */
.scout {
  display: grid;
  gap: 10px;
}

.scout li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.scout img {
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
  box-shadow: var(--portrait-sm);
}

.scout span {
  display: grid;
  flex: 1;
  min-width: 0;
  line-height: 1.25;
}

.scout b {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.scout small {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-3);
}

.scout em {
  padding: 2px 8px;
  font-size: 11.5px;
  font-style: normal;
  font-weight: 600;
  color: var(--text-2);
  background: var(--surface-2);
  border-radius: 999px;
}

/* ── Favorites ── */
.favs {
  display: grid;
  gap: 2px;
}

.favs li {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--text-2);
  background: var(--surface-1);
  border-radius: var(--r-sm);
}

.favs li > :first-child {
  color: var(--text-3);
}

.favs span {
  flex: 1;
}

.favs li > :last-child {
  color: var(--gold-c);
}

.favs li > :last-child :deep(path) {
  fill: rgb(var(--gold-rgb) / 0.3);
}

/* ── Languages ── */
.langs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.langs li {
  padding: 3px 9px;
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--surface-2);
  border-radius: 999px;
}

/* ── No account ── */
.facts {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
}

.facts span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.facts :deep(.iv-icon) {
  flex: none;
  color: var(--brand-hi);
}
</style>
