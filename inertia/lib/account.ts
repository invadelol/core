import { computed, shallowRef } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import type { AccountChange, InvadeAccountData, Viewer } from './account_types.js'

/**
 * The signed-in person on the site's pages: the `viewer` every page carries (the header's menu,
 * a profile's star) and the one way to change the account, `POST /api/account/changes`.
 */

/** The answer to a change that could not be saved, in words for the page. */
export class AccountRequestError extends Error {}

async function send<T>(method: 'POST' | 'DELETE', url: string, body?: unknown): Promise<T> {
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
      data?.errors?.[0]?.message ?? 'That did not go through. Try again in a moment.'
    )
  }
  return data as T
}

/** Applies a change and answers the account as it now is; the header's counts follow. */
export async function changeAccount(change: AccountChange) {
  const account = await send<InvadeAccountData>('POST', '/api/account/changes', change)
  refreshViewer()
  return account
}

export const approveLink = (code: string) =>
  send<InvadeAccountData>('POST', '/api/account/link', { code })

export const deleteAccount = () => send<void>('DELETE', '/api/account', { confirm: 'delete' })

/** The header and the stars read `viewer`: ask the server for it again, nothing else. */
export function refreshViewer() {
  router.reload({ only: ['viewer'] })
}

/** Where to sign in, and come back here after. */
export function signInHref(path?: string) {
  const here = path ?? (typeof location === 'undefined' ? '/' : location.pathname + location.search)
  return `/signin?next=${encodeURIComponent(here)}`
}

/** Stars changed since the page was drawn: the server's answer, by PUUID. */
const known = shallowRef<Record<string, boolean>>({})

export function useViewer() {
  const page = usePage()
  const viewer = computed(() => (page.props as { viewer?: Viewer | null }).viewer ?? null)

  /** `drawn`: what the page said when it was rendered. */
  function isFavorite(puuid: string, drawn: boolean) {
    return known.value[puuid] ?? drawn
  }

  /** Stars or unstars a player; signed out, it leads to the sign-in first. */
  async function toggleFavorite(puuid: string, drawn: boolean) {
    if (!viewer.value) {
      router.visit(signInHref())
      return
    }
    const on = !isFavorite(puuid, drawn)
    known.value = { ...known.value, [puuid]: on }
    try {
      const account = await send<InvadeAccountData>('POST', '/api/account/changes', {
        type: on ? 'favorite' : 'removeFavorite',
        puuid,
      })
      known.value = { ...known.value, [puuid]: account.favorites.some((f) => f.puuid === puuid) }
      refreshViewer()
    } catch (error) {
      known.value = { ...known.value, [puuid]: !on }
      throw error
    }
  }

  return { viewer, isFavorite, toggleFavorite }
}
