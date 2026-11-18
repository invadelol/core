import type { HttpContext } from '@adonisjs/core/http'
import patchNotesService, { PATCH_NAME } from '#services/patch_notes_service'
import { latestPatch } from '#services/ranked_games_service'
import { BRACKET_TEXT, breadcrumbs, meta, notFoundPage } from '#services/page_meta'
import { versionOf } from '../../inertia/lib/patch_notes.js'
import { patchName } from '../../inertia/lib/patch.js'

export default class PatchNotesController {
  /** `/patch`: the newest notes the site holds. */
  async latest({ response }: HttpContext) {
    const [newest] = await patchNotesService.list()
    if (newest) return response.redirect().toPath(`/patch/${newest}`)
    const latest = await latestPatch()
    return response.redirect().toPath(latest ? `/patch/${patchName(latest)}` : '/')
  }

  /**
   * `/patch/:version`: a patch's changes (Riot's facts: champions, items, ARAM: Mayhem, skins, bug
   * fixes) with how each changed champion did on that patch in our games. A patch the site has no
   * notes for says so (and is not indexed); a game version (`16.22`) moves to the players' name.
   */
  async show({ inertia, params, response }: HttpContext) {
    const asked = String(params.version ?? '')
    if (/^1\d\.\d{1,2}$/.test(asked)) {
      return response
        .redirect()
        .status(301)
        .toPath(`/patch/${patchName(asked)}`)
    }
    if (!PATCH_NAME.test(asked)) return notFoundPage({ inertia, response })

    const [notes, patches] = await Promise.all([
      patchNotesService.get(asked),
      patchNotesService.list(),
    ])
    const version = notes?.version ?? versionOf(asked)
    const ids = notes
      ? [...notes.champions.map((c) => c.id), ...(notes.aram?.champions ?? []).map((c) => c.id)]
      : []
    const [stats, slugs] = notes
      ? await Promise.all([patchNotesService.stats(version, ids), patchNotesService.slugs()])
      : [null, {}]
    // The last two weeks by day speak of the newest patch only.
    const daily =
      stats && asked === patches[0] ? await patchNotesService.daily(stats.byChampion) : null
    // Lanes without the patch's own statistics: each champion's main role on the newest patch.
    const roles =
      notes && !stats ? await patchNotesService.mainRoles(notes.champions.map((c) => c.id)) : {}

    const counts = notes && {
      champions: notes.champions.length,
      items: notes.items.length,
    }
    return inertia.render('patch', {
      current: asked,
      notes,
      patches,
      stats,
      daily,
      roles,
      slugs,
      robots: notes ? null : 'noindex,follow',
      ...meta({
        title: notes ? `Patch ${asked} notes` : `Patch ${asked}`,
        description: notes
          ? `Every change of League of Legends patch ${asked}: ${counts!.champions} champions, ${counts!.items} items, ARAM: Mayhem, skins and bug fixes, with each champion's win rate since, ${BRACKET_TEXT[stats?.bracket ?? 'emerald_plus']}.`
          : `League of Legends patch ${asked}.`,
        path: `/patch/${asked}`,
        image: notes ? `/og/patch/${asked}.jpg` : '/og/home.jpg',
        version: asked,
        alt: notes
          ? `Patch ${asked} in large type, the portraits of the ${counts!.champions} champions it changed, buffs and nerfs`
          : `Patch ${asked} on invade.lol`,
      }),
      jsonld: [
        breadcrumbs([
          { name: 'Patch notes', path: '/patch' },
          { name: asked, path: `/patch/${asked}` },
        ]),
      ],
    })
  }
}
