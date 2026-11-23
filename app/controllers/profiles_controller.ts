import type { HttpContext } from '@adonisjs/core/http'
import profileService, { HANDLE, PROFILE_TABS } from '#services/profiles/profile_service'
import { browserWriter } from '#services/profiles/browser_writes'
import { meta, notFoundPage, today } from '#services/page_meta'
import type { ProfileTab } from '../../inertia/lib/invade_profile.js'

/**
 * Invade profiles: `/u/<handle>` and its tabs (`/u/<handle>/skins`), and the owner's Customize
 * saves. A profile is public; what it shows of the person's League accounts is what they chose.
 */
export default class ProfilesController {
  async page(ctx: HttpContext) {
    const { handle, tab } = ctx.params as { handle: string; tab?: string }
    const lower = handle.toLowerCase()
    if (lower !== handle && HANDLE.test(lower)) {
      return ctx.response.redirect(`/u/${lower}${tab ? `/${tab}` : ''}`, false, 301)
    }
    if (tab !== undefined && (tab === 'overview' || !PROFILE_TABS.has(tab as ProfileTab))) {
      return notFoundPage(ctx)
    }
    const page = await profileService.page(
      handle,
      (tab ?? 'overview') as ProfileTab,
      ctx.invadeUser
    )
    if (!page) return notFoundPage(ctx)
    const { head } = page
    const path = `/u/${head.handle}${page.tab === 'overview' ? '' : `/${page.tab}`}`
    return ctx.inertia.render('profile/show', {
      ...page,
      ...meta({
        title: `${head.name} (@${head.handle}) on Invade`,
        description: head.bio || `${head.name}'s Invade profile: clips, skins, builds and friends.`,
        path,
        image: head.backdrop?.url ?? '/og/home.jpg',
        version: today(),
        alt: `${head.name}'s profile backdrop`,
        type: 'profile',
      }),
    })
  }

  /** `PUT /api/profile`: the owner's Customize choices, checked and saved. */
  async save(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    return ctx.response.ok(await profileService.save(user, ctx.request.body()))
  }
}
