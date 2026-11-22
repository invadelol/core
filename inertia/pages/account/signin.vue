<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import DiscordMark from '../../components/header/DiscordMark.vue'
import GoogleMark from '../../components/header/GoogleMark.vue'
import '../../css/account.css'

/**
 * /signin: Discord or Google, nothing else. Where the person was heading (`next`) goes through
 * the provider and back.
 */
const props = defineProps<{
  next: string
  error: string | null
  providers: { discord: boolean; google: boolean }
}>()

const ERRORS: Record<string, string> = {
  expired: 'The sign-in took too long or was opened twice. Try again.',
  failed: 'Discord or Google did not answer. Try again in a moment.',
  denied: 'Sign-in was cancelled.',
  unavailable: 'This way to sign in is not available right now.',
  busy: 'Too many sign-ins from here. Try again later.',
}
const message = computed(() => (props.error ? (ERRORS[props.error] ?? null) : null))
const href = (provider: string) => `/auth/${provider}?next=${encodeURIComponent(props.next)}`
const none = computed(() => !props.providers.discord && !props.providers.google)
</script>

<template>
  <Head title="Sign in" />
  <SiteLayout>
    <div class="wrap">
      <section class="ac-sign">
        <h1 class="h1">Sign in to Invade</h1>
        <p class="meta">Your favorite players and League accounts, here and in the app.</p>
        <p v-if="message" class="ac-err" role="alert">{{ message }}</p>
        <div class="ac-ways">
          <a
            v-if="providers.discord"
            class="btn lg"
            :href="href('discord')"
            data-track="sign_in_discord"
            ><DiscordMark :size="20" />Continue with Discord</a
          >
          <a
            v-if="providers.google"
            class="btn lg"
            :href="href('google')"
            data-track="sign_in_google"
            ><GoogleMark :size="18" />Continue with Google</a
          >
          <p v-if="none" class="ac-err">Sign-in is not available right now.</p>
        </div>
        <p class="ac-fine">
          Invade only reads your name from Discord or Google, never your email or password.
        </p>
      </section>
    </div>
  </SiteLayout>
</template>
