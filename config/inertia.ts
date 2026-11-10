import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import { webAnalytics } from '#services/openpanel'
import { latestPatch } from '#services/ranked_games_service'

/** The header's patch badge: the newest patch the stats show, or none when it is slow to come. */
async function currentPatch(): Promise<string | null> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), 300)))
  const patch = latestPatch().catch(() => null)
  return Promise.race([patch, late]).finally(() => clearTimeout(timer))
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
    // user: (ctx) => ctx.inertia.always(() => ctx.auth.user),
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
