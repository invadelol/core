import { computed, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { usePage, router } from '@inertiajs/vue3'
import type { AccountProfile, InvadeAccountData } from '@invadelol/ui'

const empty = (): InvadeAccountData => ({
  user: null,
  mainPuuid: null,
  accounts: [],
  folders: [],
  favorites: [],
  devices: [],
})
const data = shallowRef<InvadeAccountData>(empty()),
  error = shallowRef(''),
  busy = shallowRef(false)
let inflight: Promise<void> | null = null,
  chain = Promise.resolve(),
  last = 0
export function useAccount() {
  const page = usePage(),
    viewer = computed(() => page.props.viewer as InvadeAccountData['user'])
  const state = computed(() =>
    typeof window === 'undefined'
      ? (page.props.account as InvadeAccountData) || empty()
      : data.value.user?.id === viewer.value?.id
        ? data.value
        : empty()
  )
  async function load(force = false) {
    if (!viewer.value) {
      data.value = empty()
      return
    }
    if (inflight) return inflight
    if (!force && Date.now() - last < 3000) return
    inflight = (async () => {
      try {
        const res = await fetch('/api/account', { headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error('Could not load your account.')
        data.value = await res.json()
        last = Date.now()
        error.value = ''
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Could not load your account.'
      } finally {
        inflight = null
      }
    })()
    return inflight
  }
  function change(input: Record<string, unknown>) {
    busy.value = true
    const task = chain.then(async () => {
      try {
        const res = await fetch('/api/account/changes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(input),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => null)
          throw new Error(e?.message || 'Your change could not be saved. Please try again.')
        }
        data.value = await res.json()
        error.value = ''
        return true
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Could not save your change.'
        return false
      } finally {
        busy.value = false
      }
    })
    chain = task.then(() => {})
    return task
  }
  function favorite(p: AccountProfile) {
    if (!viewer.value) {
      router.visit('/signin?next=' + encodeURIComponent(location.pathname))
      return
    }
    const saved = data.value.favorites.some((f) => f.puuid === p.puuid)
    return change({ type: saved ? 'removeFavorite' : 'favorite', puuid: p.puuid, folderId: null })
  }
  let interval: ReturnType<typeof setInterval> | undefined
  const focus = () => void load(true)
  onMounted(() => {
    if (page.props.account) data.value = page.props.account as InvadeAccountData
    void load()
    interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 15000)
    window.addEventListener('focus', focus)
  })
  onBeforeUnmount(() => {
    clearInterval(interval)
    if (typeof window !== 'undefined') window.removeEventListener('focus', focus)
  })
  return { viewer, state, error, busy, load, change, favorite }
}
export const openAccountProfile = (p: AccountProfile) =>
  router.visit('/' + encodeURIComponent(p.gameName + '-' + p.tagLine))
