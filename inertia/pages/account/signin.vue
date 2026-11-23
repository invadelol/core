<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AuthScene from '../../components/account/AuthScene.vue'
import DiscordMark from '../../components/header/DiscordMark.vue'

/**
 * /signin: Continue with Discord, on the scene of the League client's login. Where the person was
 * heading (`next`) goes through Discord and back. A suspended account comes back here with its
 * own state: no button, a way to reach the team.
 */
const props = defineProps<{
  next: string
  error: string | null
  /** Sign-in is set up on this server. */
  available: boolean
}>()

const ERRORS: Record<string, string> = {
  expired: 'The sign-in took too long or was opened twice. Try again.',
  failed: 'Discord did not answer. Try again in a moment.',
  denied: 'Sign-in was cancelled.',
  unavailable: 'Signing in is not available right now.',
  busy: 'Too many sign-ins from here. Try again later.',
}
const suspended = computed(() => props.error === 'suspended')
const message = computed(() => {
  if (!props.available) return ERRORS.unavailable
  return props.error ? (ERRORS[props.error] ?? null) : null
})
const href = computed(() => `/auth/discord?next=${encodeURIComponent(props.next)}`)
</script>

<template>
  <Head :title="suspended ? 'Account suspended' : 'Sign in'" />
  <AuthScene>
    <template v-if="suspended">
      <h1 class="au-h">This account is suspended</h1>
      <p class="au-sub">
        You can’t sign in to it for now. If you think this is a mistake, tell us.
      </p>
      <div class="au-btns">
        <Link class="btn lg au-b" href="/contact">Contact the team</Link>
      </div>
      <p class="au-n"><Link href="/">Back to Invade</Link></p>
    </template>
    <template v-else>
      <h1 class="au-h">Sign in to Invade</h1>
      <p class="au-sub">Follow your friends, save clips and matches.</p>
      <div class="au-btns">
        <a v-if="available" class="btn lg pri au-b" :href="href" data-track="sign_in_discord"
          ><DiscordMark :size="21" mono />Continue with Discord</a
        >
      </div>
      <p v-if="message" class="au-err" role="alert">{{ message }}</p>
      <p class="au-n">We keep your name, never your email. <Link href="/privacy">Privacy</Link></p>
    </template>
  </AuthScene>
</template>
