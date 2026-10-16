import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import { readFile } from 'node:fs/promises'
import { changelog, normalizeVersion } from '#services/changelog'
import { changelogCardVersion, renderChangelogCard } from '#services/changelog_card'

/** One per version CHANGELOG.md lists, so a handful: kept for the process's life. */
const cards = new Map<string, Promise<Buffer>>()
let poro: Promise<Buffer> | null = null
const poroArt = () =>
  (poro ??= readFile(app.makePath('resources', 'changelog', 'cheeky-poro.webp')).catch((error) => {
    poro = null
    throw error
  }))

/**
 * `/og/app/changelog/0.3.2.jpg?v=…`: the version image, the link preview of
 * /app/changelog/0.3.2 (`changelog_card`). The page links it with `v`, a hash of the version and
 * the renderer: that URL never changes its picture and is kept for good; any other `v`, or none,
 * gets the current picture for five minutes. Only versions CHANGELOG.md lists are drawn.
 */
export default class ChangelogCardsController {
  async show({ params, request, response }: HttpContext) {
    const raw = /^(.+)\.jpg$/.exec(String(params.file))?.[1]
    const version = raw ? normalizeVersion(raw) : null
    const log = await changelog()
    if (!version || !log.parsed.some((r) => r.version === version)) {
      response.header('Cache-Control', 'public, max-age=60')
      return response.notFound()
    }
    let card = cards.get(version)
    if (!card) {
      card = poroArt().then((art) => renderChangelogCard(version, art))
      card.catch(() => cards.delete(version))
      cards.set(version, card)
    }
    const body = await card
    const current = request.qs().v === changelogCardVersion(version)
    response.header('Content-Type', 'image/jpeg')
    response.header(
      'Cache-Control',
      current ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
    )
    return response.send(body)
  }
}
