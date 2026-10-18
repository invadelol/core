<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Logo, Icon } from '@invadelol/ui'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
defineProps<{
  next: string
  authError: string | null
  providers: { discord: boolean; google: boolean }
}>()
</script>
<template>
  <Head title="Sign in" />
  <div class="signin-page">
    <AppHeader :search="false" />
    <main class="signin-main">
      <section class="iv-panel lit-sheet signin-panel">
        <span class="signin-mark"><Logo :size="28" /></span>
        <h1>Sign in to Invade</h1>
        <p class="signin-lead">
          Your League accounts and favorite players in one place, on invade.lol and in the app.
        </p>
        <div class="signin-providers">
          <a :href="`/auth/discord?next=${encodeURIComponent(next)}`" class="iv-btn primary lg"
            ><svg
              width="20"
              height="16"
              viewBox="0 0 127 96"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M107.7 8.1a105.2 105.2 0 0 0-26-8.1 72.1 72.1 0 0 0-3.3 6.8 97.7 97.7 0 0 0-29 0A73 73 0 0 0 46 0a105 105 0 0 0-26 8.1C3.5 32.7-1 56.7 1.3 80.3a106 106 0 0 0 32 16.2 79 79 0 0 0 6.6-10.7 68 68 0 0 1-10.4-5c.9-.6 1.7-1.3 2.5-1.9a75 75 0 0 0 63.3 0c.8.6 1.7 1.3 2.5 1.9a68 68 0 0 1-10.4 5A79 79 0 0 0 94 96.5a106 106 0 0 0 32-16.2c2.7-27.3-4.6-51-18.3-72.2ZM42.5 65.8c-6.2 0-11.3-5.7-11.3-12.7 0-7 5-12.7 11.3-12.7 6.3 0 11.4 5.7 11.3 12.7 0 7-5 12.7-11.3 12.7Zm41.9 0c-6.2 0-11.3-5.7-11.3-12.7 0-7 5-12.7 11.3-12.7 6.3 0 11.4 5.7 11.3 12.7 0 7-5 12.7-11.3 12.7Z"
              /></svg
            >Continue with Discord</a
          ><a :href="`/auth/google?next=${encodeURIComponent(next)}`" class="iv-btn lg"
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
        <div class="signin-assurance">
          <Icon name="shield" :size="15" />
          <p>
            Invade never asks for your Riot password. The desktop app shows which League accounts
            are yours.
          </p>
        </div>
        <p class="signin-legal">
          By continuing, you agree to the <a href="/terms">Terms</a> and the
          <a href="/privacy">Privacy policy</a>.
        </p>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>
<style scoped>
.signin-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.signin-main {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 72px 20px 112px;
}
.signin-panel {
  width: min(100%, 400px);
  padding: 32px;
  text-align: center;
}
.signin-mark {
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  background: var(--key);
  border-radius: var(--r-lg);
  box-shadow:
    var(--key-shadow),
    0 10px 30px -12px rgb(var(--brand-rgb) / 0.7);
}
.signin-panel h1 {
  margin: 20px 0 8px;
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--text-1);
}
.signin-lead {
  margin: 0 auto;
  max-width: 300px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-2);
}
.signin-providers {
  display: grid;
  gap: 8px;
  margin: 28px 0 24px;
}
.signin-providers a {
  height: 44px;
  gap: 10px;
  font-size: 13.5px;
}
.signin-assurance {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  text-align: left;
  color: var(--text-3);
  background: var(--well);
  border-radius: var(--r-sm);
  box-shadow: var(--inset-shadow);
}
.signin-assurance > svg {
  flex: none;
  margin-top: 2px;
  color: var(--brand-hi);
}
.signin-assurance p {
  font-size: 12.5px;
  line-height: 1.55;
}
.signin-legal {
  margin-top: 20px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-3);
}
.signin-legal a {
  color: var(--text-2);
}
.signin-error {
  margin: -8px 0 20px;
  font-size: 12.5px;
  color: var(--warn);
}
@media (max-width: 480px) {
  .signin-main {
    padding: 32px 16px 64px;
  }
  .signin-panel {
    padding: 28px 20px;
  }
}
</style>
