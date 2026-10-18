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
      <section class="iv-panel signin-panel">
        <Logo :size="36" />
        <h1>Sign in to Invade</h1>
        <p class="signin-lead">
          Your League accounts, favorites and folders.<br />On the site and in the app.
        </p>
        <div class="signin-providers">
          <a :href="`/auth/discord?next=${encodeURIComponent(next)}`" class="iv-btn primary lg"
            ><svg
              width="19"
              height="16"
              viewBox="0 0 127 96"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M107.7 8.1a105.2 105.2 0 0 0-26-8.1 72.1 72.1 0 0 0-3.3 6.8 97.7 97.7 0 0 0-29 0A73 73 0 0 0 46 0a105 105 0 0 0-26 8.1C3.5 32.7-1 56.7 1.3 80.3a106 106 0 0 0 32 16.2 79 79 0 0 0 6.6-10.7 68 68 0 0 1-10.4-5c.9-.6 1.7-1.3 2.5-1.9a75 75 0 0 0 63.3 0c.8.6 1.7 1.3 2.5 1.9a68 68 0 0 1-10.4 5A79 79 0 0 0 94 96.5a106 106 0 0 0 32-16.2c2.7-27.3-4.6-51-18.3-72.2ZM42.5 65.8c-6.2 0-11.3-5.7-11.3-12.7 0-7 5-12.7 11.3-12.7 6.3 0 11.4 5.7 11.3 12.7 0 7-5 12.7-11.3 12.7Zm41.9 0c-6.2 0-11.3-5.7-11.3-12.7 0-7 5-12.7 11.3-12.7 6.3 0 11.4 5.7 11.3 12.7 0 7-5 12.7-11.3 12.7Z"
              /></svg
            >Continue with Discord<Icon name="next" :size="14" /></a
          ><a :href="`/auth/google?next=${encodeURIComponent(next)}`" class="iv-btn lg"
            ><b class="google-mark">G</b>Continue with Google<Icon name="next" :size="14"
          /></a>
        </div>
        <p v-if="authError" class="signin-error" role="alert">
          {{
            authError === 'unavailable'
              ? 'This sign-in provider is not configured on this server yet.'
              : authError === 'expired'
                ? 'Your sign-in expired. Please try again.'
                : 'Sign-in could not be completed. Please try again.'
          }}
        </p>
        <div class="signin-assurance">
          <Icon name="shield" :size="16" />
          <p>
            League ownership is verified through the desktop app. You never share your Riot password
            with Invade.
          </p>
        </div>
        <p class="signin-legal">
          By continuing, you agree to our <a href="/terms">Terms</a> and
          <a href="/privacy">Privacy Policy</a>.
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
  padding: 80px 20px 104px;
}
.signin-panel {
  width: min(100%, 416px);
  padding: 36px;
}
.signin-panel h1 {
  margin: 24px 0 12px;
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--text-1);
}
.signin-lead {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-2);
}
.signin-providers {
  display: grid;
  gap: 10px;
  margin: 32px 0;
}
.signin-providers a {
  min-height: 42px;
  justify-content: start;
  gap: 12px;
  padding: 0 14px;
}
.signin-providers a > .iv-icon {
  margin-left: auto;
}
.google-mark {
  width: 19px;
  text-align: center;
  font-size: 17px;
  font-weight: 650;
}
.signin-assurance {
  display: flex;
  gap: 10px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  color: var(--text-3);
}
.signin-assurance > svg {
  flex: none;
  margin-top: 2px;
}
.signin-assurance p {
  font-size: 12px;
  line-height: 1.65;
}
.signin-legal {
  margin-top: 28px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-3);
}
.signin-legal a {
  color: var(--text-2);
}
.signin-error {
  margin: -12px 0 20px;
  font-size: 12px;
  color: var(--warn);
}
@media (max-width: 480px) {
  .signin-main {
    padding: 40px 16px;
  }
  .signin-panel {
    padding: 28px 24px;
  }
}
</style>
