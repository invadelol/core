import { computed, shallowRef } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import type {
  FollowKind,
  FollowState,
  InvadeAccountData,
  SavedKind,
  SiteAccountOp,
  Viewer,
} from './account_types.js'
import type { SavedKeys } from './saved_types.js'

/**
 * The signed-in person on the site's pages: the `viewer` every page carries (the header's menu),
 * the way to change the account, the Follow buttons and the Favorites stars.
 */

/** The answer to a change that could not be saved, in words for the page. */
export class AccountRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function send<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AccountRequestError(
      data?.errors?.[0]?.message ?? 'That did not go through. Try again in a moment.',
      response.status
    )
  }
  return data as T
}

/** The header and the buttons read `viewer`: ask the server for it again, nothing else. */
export function refreshViewer() {
  router.reload({ only: ['viewer'] })
}

/** Where to sign in, and come back here after. */
export function signInHref(path?: string) {
  const here = path ?? (typeof location === 'undefined' ? '/' : location.pathname + location.search)
  return `/signin?next=${encodeURIComponent(here)}`
}

/** Applies changes and answers the account as it now is; the header's counts follow. */
export async function changeAccount(ops: SiteAccountOp[]) {
  const account = await send<InvadeAccountData>('POST', '/api/account/changes', { ops })
  refreshViewer()
  return account
}

export const approveLink = (code: string) => send<void>('POST', '/api/account/link', { code })

export const deleteAccount = () => send<void>('DELETE', '/api/account', { confirm: 'delete' })

export function useViewer() {
  const page = usePage()
  const viewer = computed(() => (page.props as { viewer?: Viewer | null }).viewer ?? null)
  return { viewer }
}

/** Follows or stops following; answers whether the visitor follows, and how many do. */
export function setFollow(kind: FollowKind, id: string, on: boolean) {
  const path = `/api/follows/${kind}/${encodeURIComponent(id)}`
  return send<FollowState>(on ? 'PUT' : 'DELETE', path)
}

/** Saves someone else's shared build to the visitor's builds (their account and app), or not. */
export function setBuildSaved(id: string, on: boolean) {
  return send<{ saved: boolean }>(on ? 'PUT' : 'DELETE', `/api/builds/${id}/save`)
}

/* ── Favorites: the stars of clips and matches ─────────────────────── */

/**
 * What the signed-in visitor keeps, asked for once per visit the first time a star shows, then
 * kept in step with each star pressed: a page never carries the whole list.
 */
const savedClips = shallowRef<ReadonlySet<string>>(new Set())
const savedGames = shallowRef<ReadonlySet<string>>(new Set())
let asked: Promise<void> | null = null

function loadSaved() {
  if (asked || typeof window === 'undefined') return
  asked = send<SavedKeys>('GET', '/api/saved').then(
    (keys) => {
      savedClips.value = new Set(keys.clips)
      savedGames.value = new Set(keys.games)
    },
    // Unknown for now: the stars show empty, and the next visit asks again.
    () => void (asked = null)
  )
}

/** The number in a match id, as the shared rows key a game. */
export const gameIdOf = (matchId: string) => matchId.slice(matchId.indexOf('_') + 1)

export function useSaved() {
  const { viewer } = useViewer()

  /** Whether the visitor keeps this clip or match; signed out, nothing is kept. */
  function isSaved(kind: SavedKind, id: string) {
    if (!viewer.value) return false
    loadSaved()
    return kind === 'clip' ? savedClips.value.has(id) : savedGames.value.has(gameIdOf(id))
  }

  /**
   * Keeps or lets go of a clip or a match (`puuid`: whose game it is); signed out, it leads to
   * the sign-in first. The star turns at once and turns back if the server says no.
   */
  async function toggleSaved(kind: SavedKind, id: string, puuid?: string) {
    if (!viewer.value) {
      router.visit(signInHref())
      return
    }
    const on = !isSaved(kind, id)
    const list = kind === 'clip' ? savedClips : savedGames
    const key = kind === 'clip' ? id : gameIdOf(id)
    const flip = (keep: boolean) => {
      const next = new Set(list.value)
      if (keep) next.add(key)
      else next.delete(key)
      list.value = next
    }
    flip(on)
    try {
      await send(on ? 'PUT' : 'DELETE', `/api/saved/${kind}/${encodeURIComponent(id)}`, {
        puuid,
      })
      refreshViewer()
    } catch (error) {
      flip(!on)
      throw error
    }
  }

  return { isSaved, toggleSaved }
}
