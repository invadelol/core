<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import { approveLink } from '../../lib/account.js'
import '../../css/account.css'

/**
 * /account/link/:code: the desktop app opened this to connect itself to the signed-in account.
 * Nothing happens until the person says yes, after checking the app shows the same four
 * characters: a link someone else sent cannot tie their app to this account by being opened.
 */
const props = defineProps<{
  code: string
  pairing: {
    os: string
    app: string
    check: string
    expired: boolean
    approved: boolean
    linkedElsewhere: boolean
  } | null
}>()

const OS: Record<string, string> = { windows: 'Windows', macos: 'macOS' }
const done = ref(props.pairing?.approved ?? false)
const busy = ref(false)
const error = ref('')

const state = computed(() => {
  if (done.value) return 'done'
  if (!props.pairing || props.pairing.expired) return 'expired'
  if (props.pairing.linkedElsewhere) return 'taken'
  return 'ask'
})

async function connect() {
  busy.value = true
  error.value = ''
  try {
    await approveLink(props.code)
    done.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'That did not go through.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Head title="Connect the app" />
  <SiteLayout>
    <div class="wrap">
      <section class="ac-sign ac-link">
        <template v-if="state === 'ask'">
          <h1 class="h1">Connect the app</h1>
          <p class="meta">
            Invade {{ pairing!.app }} on {{ OS[pairing!.os] ?? pairing!.os }} asks to use your
            account.
          </p>
          <div class="ac-check">
            <span class="lab">The app shows</span>
            <b class="num">{{ pairing!.check }}</b>
          </div>
          <p v-if="error" class="ac-err" role="alert">{{ error }}</p>
          <div class="ac-ways">
            <button type="button" class="btn lg pri" :disabled="busy" @click="connect">
              Connect
            </button>
            <Link class="btn lg ghost" href="/account">Cancel</Link>
          </div>
          <p class="ac-fine">Only connect an app you opened yourself, with the same code.</p>
        </template>
        <template v-else-if="state === 'done'">
          <Icon name="check" :size="28" class="ac-ok" />
          <h1 class="h1">The app is connected</h1>
          <p class="meta">You can go back to Invade. Your favorites are there too.</p>
          <div class="ac-ways">
            <Link class="btn lg" href="/account">Open your account</Link>
          </div>
        </template>
        <template v-else-if="state === 'taken'">
          <h1 class="h1">This app is on another account</h1>
          <p class="meta">Disconnect it from the account it uses first, then try again.</p>
          <div class="ac-ways">
            <Link class="btn lg" href="/account">Open your account</Link>
          </div>
        </template>
        <template v-else>
          <h1 class="h1">This link has expired</h1>
          <p class="meta">Links last ten minutes. Start again from the app.</p>
          <div class="ac-ways">
            <Link class="btn lg" href="/account">Open your account</Link>
          </div>
        </template>
      </section>
    </div>
  </SiteLayout>
</template>
