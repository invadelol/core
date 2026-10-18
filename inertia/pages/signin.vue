<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { Logo, RankCrest } from '@invadelol/ui'

/**
 * /signin: a stage, not a form page. On the right, a slow wall of champion loading art, each card
 * worn by a (fictional) player, the kind of profiles an account keeps; on the left, the title and
 * the two ways in. Always dark (a stage, like the app's onboarding). Motion: the wall drifts on
 * the compositor only; reduced motion shows it still.
 */
defineProps<{
  next: string
  authError: string | null
  providers: { discord: boolean; google: boolean }
}>()

/* Fictional players only (public page). Champion ids: loading art from /cdn. */
const P = [
  { c: 103, n: 'Lumen', t: 'EUW', i: 6634, r: 'emerald', d: 'II' },
  { c: 222, n: 'Cinder', t: 'ADC', i: 4655, r: 'platinum', d: 'I' },
  { c: 64, n: 'Moss', t: 'JG', i: 4834, r: 'emerald', d: 'I' },
  { c: 412, n: 'Wisp', t: 'SUP', i: 6271, r: 'emerald', d: 'IV' },
  { c: 266, n: 'Juniper', t: 'TOP', i: 5367, r: 'diamond', d: 'IV' },
  { c: 517, n: 'Vesper', t: 'MID', i: 5915, r: 'emerald', d: 'III' },
  { c: 145, n: 'Nori', t: 'DUO', i: 5455, r: 'emerald', d: 'II' },
  { c: 157, n: 'Halcyon', t: 'KR1', i: 4901, r: 'master', d: '' },
  { c: 233, n: 'Afterglow', t: 'MID', i: 29, r: 'gold', d: 'IV' },
  { c: 99, n: 'Lowlight', t: 'ALT', i: 4568, r: 'platinum', d: 'II' },
  { c: 238, n: 'Kestrel', t: 'EUW', i: 5884, r: 'diamond', d: 'II' },
  { c: 202, n: 'Sable', t: 'NA1', i: 588, r: 'gold', d: 'I' },
  { c: 555, n: 'Tidewright', t: 'FR1', i: 4648, r: 'emerald', d: 'III' },
  { c: 875, n: 'Quillon', t: 'EUW', i: 5891, r: 'platinum', d: 'III' },
  { c: 893, n: 'Glimmer', t: 'LUX', i: 5212, r: 'diamond', d: 'I' },
  { c: 4, n: 'Moth Pine', t: 'NA1', i: 4834, r: 'silver', d: 'I' },
  { c: 950, n: 'Kelpie', t: 'NA1', i: 6634, r: 'emerald', d: 'IV' },
  { c: 81, n: 'Brisk', t: 'EUW', i: 5367, r: 'grandmaster', d: '' },
  { c: 498, n: 'Aster', t: 'EUW', i: 4655, r: 'diamond', d: 'III' },
  { c: 84, n: 'Ember', t: 'TR1', i: 5915, r: 'platinum', d: 'IV' },
]
const tier = (r: string, d: string) => r.charAt(0).toUpperCase() + r.slice(1) + (d ? ` ${d}` : '')
/** Four lanes of five; each lane is drawn twice, so the drift loops without a seam. */
const lanes = [0, 1, 2, 3].map((l) => {
  const cards = P.filter((_, i) => i % 4 === l)
  return [...cards, ...cards]
})
</script>

<template>
  <Head title="Sign in" />
  <div class="signin iv-dark">
    <header class="signin-top">
      <Link href="/" class="signin-home" aria-label="invade.lol"><Logo :size="22" word /></Link>
    </header>

    <main class="signin-main">
      <h1 class="signin-title">
        <span>Sign in</span>
        <span>to Invade</span>
      </h1>
      <p class="signin-lead">
        Your League accounts and favorite players, on invade.lol and in the app.
      </p>

      <div class="signin-ways">
        <a
          :href="`/auth/discord?next=${encodeURIComponent(next)}`"
          class="iv-btn primary signin-way"
          ><svg width="20" height="16" viewBox="0 0 127 96" fill="currentColor" aria-hidden="true">
            <path
              d="M107.7 8.1a105.2 105.2 0 0 0-26-8.1 72.1 72.1 0 0 0-3.3 6.8 97.7 97.7 0 0 0-29 0A73 73 0 0 0 46 0a105 105 0 0 0-26 8.1C3.5 32.7-1 56.7 1.3 80.3a106 106 0 0 0 32 16.2 79 79 0 0 0 6.6-10.7 68 68 0 0 1-10.4-5c.9-.6 1.7-1.3 2.5-1.9a75 75 0 0 0 63.3 0c.8.6 1.7 1.3 2.5 1.9a68 68 0 0 1-10.4 5A79 79 0 0 0 94 96.5a106 106 0 0 0 32-16.2c2.7-27.3-4.6-51-18.3-72.2ZM42.5 65.8c-6.2 0-11.3-5.7-11.3-12.7 0-7 5-12.7 11.3-12.7 6.3 0 11.4 5.7 11.3 12.7 0 7-5 12.7-11.3 12.7Zm41.9 0c-6.2 0-11.3-5.7-11.3-12.7 0-7 5-12.7 11.3-12.7 6.3 0 11.4 5.7 11.3 12.7 0 7-5 12.7-11.3 12.7Z"
            /></svg
          >Continue with Discord</a
        ><a :href="`/auth/google?next=${encodeURIComponent(next)}`" class="iv-btn signin-way"
          ><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
            /></svg
          >Continue with Google</a
        >
      </div>
      <p v-if="authError" class="signin-error" role="alert">
        {{
          authError === 'unavailable'
            ? 'This sign-in option isn’t available yet. Try the other one.'
            : authError === 'expired'
              ? 'That took a little too long. Please try again.'
              : 'Sign-in didn’t go through. Please try again.'
        }}
      </p>
      <p class="signin-legal">
        Invade never asks for your Riot password. By continuing, you agree to the
        <a href="/terms">Terms</a> and the <a href="/privacy">Privacy policy</a>.
      </p>
    </main>

    <!-- The wall: decoration only. -->
    <div class="signin-wall" aria-hidden="true">
      <div v-for="(lane, l) in lanes" :key="l" class="signin-lane" :style="{ '--l': l }">
        <div class="signin-drift">
          <figure v-for="(p, k) in lane" :key="k" class="signin-card">
            <img :src="`/cdn/loading/${p.c}.jpg`" alt="" decoding="async" />
            <figcaption>
              <img :src="`/cdn/profile-icon/${p.i}.png`" alt="" />
              <span>
                <b
                  >{{ p.n }}<small>#{{ p.t }}</small></b
                >
                <em :style="{ color: `var(--tier-${p.r})` }"
                  ><RankCrest :tier="p.r.toUpperCase()" :size="12" />{{ tier(p.r, p.d) }}</em
                >
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.signin {
  position: relative;
  display: grid;
  grid-template-columns: minmax(420px, 42%) minmax(0, 1fr);
  min-height: 100vh;
  min-height: 100svh;
  overflow: hidden;
  color: var(--text-1);
  background: var(--light), var(--ink-1);
}

.signin-top {
  position: absolute;
  inset: 0 0 auto;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px clamp(24px, 5vw, 72px);
}
.signin-home {
  color: var(--text-1);
}

/* The way in */
.signin-main {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 520px;
  padding: 120px clamp(24px, 5vw, 72px) 64px;
}
.signin-title {
  display: grid;
  margin: 0;
  font-size: clamp(44px, 5.2vw, 72px);
  font-weight: 650;
  line-height: 1;
  letter-spacing: -0.035em;
}
.signin-title span:last-child {
  color: var(--text-3);
}
.signin-lead {
  max-width: 380px;
  margin: 24px 0 0;
  font-size: 16px;
  line-height: 1.55;
  color: var(--text-2);
}
.signin-ways {
  display: grid;
  gap: 10px;
  max-width: 360px;
  margin-top: 40px;
}
.signin-way {
  height: 48px;
  gap: 11px;
  font-size: 14px;
}
.signin-error {
  max-width: 360px;
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--warn);
}
.signin-legal {
  max-width: 360px;
  margin: 28px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-3);
}
.signin-legal a {
  color: var(--text-2);
}

/* The wall: four lanes drifting in turn up and down, faded at every edge. */
.signin-wall {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  height: 100vh;
  height: 100svh;
  padding: 0 clamp(16px, 3vw, 40px) 0 0;
  mask-image:
    linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent),
    linear-gradient(to right, transparent, #000 22%);
  mask-composite: intersect;
  -webkit-mask-composite: source-in;
}
.signin-lane {
  min-width: 0;
  animation: signin-rise 1100ms var(--ease-glide) both;
  animation-delay: calc(var(--l) * 110ms + 120ms);
}
.signin-lane:nth-child(even) {
  margin-top: -90px;
}
.signin-drift {
  display: grid;
  gap: 14px;
  animation: signin-up 120s linear infinite;
  will-change: transform;
}
.signin-lane:nth-child(even) .signin-drift {
  animation-name: signin-down;
  animation-duration: 140s;
}
@keyframes signin-up {
  to {
    transform: translateY(calc(-50% - 7px));
  }
}
@keyframes signin-down {
  from {
    transform: translateY(calc(-50% - 7px));
  }
  to {
    transform: translateY(0);
  }
}
@keyframes signin-rise {
  from {
    opacity: 0;
    transform: translateY(48px);
  }
}

.signin-card {
  position: relative;
  margin: 0;
  overflow: hidden;
  aspect-ratio: 308 / 560;
  background: var(--surface-2);
  border-radius: var(--r-lg);
  box-shadow: var(--contact), var(--shadow-3);
}
.signin-card > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.85) brightness(0.82);
}
/* A lit top edge and a faint rim, like the app's media. */
.signin-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    inset 0 0 0 1px rgb(255 255 255 / 0.05);
  pointer-events: none;
}
.signin-card figcaption {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 36px 12px 12px;
  background: linear-gradient(to top, rgb(8 9 12 / 0.92), rgb(8 9 12 / 0));
}
.signin-card figcaption > img {
  flex: none;
  width: 26px;
  height: 26px;
  object-fit: cover;
  border-radius: var(--r-sm);
  box-shadow: var(--portrait-sm);
}
.signin-card figcaption > span {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.signin-card b {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.signin-card b small {
  margin-left: 1px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
}
.signin-card em {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
}

/* The way in arrives just after the wall. */
.signin-main > * {
  animation: signin-text 900ms var(--ease-glide) both;
}
.signin-title {
  animation-delay: 80ms;
}
.signin-lead {
  animation-delay: 180ms;
}
.signin-ways {
  animation-delay: 260ms;
}
.signin-legal {
  animation-delay: 340ms;
}
@keyframes signin-text {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .signin-lane,
  .signin-drift,
  .signin-main > * {
    animation: none;
  }
}

/* Narrow: the wall becomes a band above the way in. */
@media (max-width: 900px) {
  .signin {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }
  .signin-wall {
    grid-row: 1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    height: 44svh;
    padding: 0 16px;
    mask-image: linear-gradient(to bottom, rgb(0 0 0 / 0.35), #000 30%, #000 55%, transparent);
    mask-composite: add;
  }
  .signin-card figcaption {
    display: none;
  }
  .signin-lane:nth-child(4) {
    display: none;
  }
  .signin-drift {
    gap: 10px;
  }
  .signin-card {
    border-radius: var(--r-md);
  }
  .signin-main {
    grid-row: 2;
    margin-top: -64px;
    padding: 0 20px 48px;
  }
  .signin-title {
    font-size: 44px;
  }
  .signin-lead {
    margin-top: 16px;
    font-size: 15px;
  }
  .signin-ways {
    max-width: none;
    margin-top: 28px;
  }
  .signin-way {
    height: 50px;
  }
  .signin-top {
    justify-content: center;
    padding: 20px;
  }
}
</style>
