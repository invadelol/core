import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import { webAnalytics } from '#services/openpanel'
import { latestPatch } from '#services/ranked_games_service'
import type { SignedIn } from '#services/accounts/session_service'
import type { Viewer } from '../inertia/lib/account_types.js'

/** The header's patch badge: the newest patch the stats show, or none when it is slow to come. */
async function currentPatch(): Promise<string | null> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), 300)))
  const patch = latestPatch().catch(() => null)
  return Promise.race([patch, late]).finally(() => clearTimeout(timer))
}

/** The header's account menu for the signed-in person; a failure renders the page signed out. */
async function signedInViewer(user: SignedIn | null | undefined): Promise<Viewer | null> {
  if (!user) return null
  const { default: accountService } = await import('#services/accounts/account_service')
  return accountService.viewer(user).catch(() => null)
}

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data that should be shared with all rendered pages
   */
  sharedData: {
    /**
     * The signed-in person, for the header's account menu (`Viewer`), or null. Pages of signed-in
     * people are never served from or written to the page cache (http_cache_middleware).
     */
    viewer: (ctx) => ctx.inertia.always(() => signedInViewer(ctx.invadeUser)),
    /** OpenPanel's web script, written by the layout (resources/views/inertia_layout.edge). */
    analytics: () => webAnalytics(),
    /** The newest patch with stats (game version, `patchName()` prints it), for the header. */
    patch: () => currentPatch(),
  },

  /**
   * Options for the server-side rendering
   */
  ssr: {
    enabled: true,
    entrypoint: 'inertia/app/ssr.ts',
  },
})

export default inertiaConfig

declare module '@adonisjs/inertia/types' {
  export interface SharedProps extends InferSharedProps<typeof inertiaConfig> {}
}
