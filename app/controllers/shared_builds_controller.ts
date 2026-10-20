import type { HttpContext } from '@adonisjs/core/http'
import riotAssets from '#services/riot/assets'
import { renderBuildCard } from '#services/build_card'
import { parseBuildLink, routeOf } from '#services/build_link'
import { buildSocial, resolveBuild, type SharedBuild } from '#services/build_share'
import { ByteCache } from '#utils/byte_cache'

/** About 85 KB a card. */
const cards = new ByteCache<Buffer>(24 * 1024 * 1024, 512)
const pending = new Map<string, Promise<{ body: Buffer; complete: boolean }>>()

/** Renders at once: a link pasted in a busy channel brings many crawlers. */
const RENDERS = 2
let running = 0
const waiting: Array<() => void> = []
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (running >= RENDERS) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await work()
  } finally {
    running--
    waiting.shift()?.()
  }
}

async function draw(build: SharedBuild) {
  // The card draws the route: the first starting set and boots, the core, the later slots.
  const route = routeOf(build.items)
  const ids = [
    ...new Set([
      ...route.start,
      ...(route.boots === null ? [] : [route.boots]),
      ...route.core,
      ...route.later.flat(),
    ]),
  ]
  const [art, ...pictures] = await Promise.all([
    riotAssets.get('centered', String(build.championId)),
    ...ids.map((id) => riotAssets.get('item', String(id))),
  ])
  const icons = new Map<number, Uint8Array>()
  pictures.forEach((p, i) => !p.placeholder && icons.set(ids[i], p.body))
  const body = await renderBuildCard(
    {
      championName: build.championName,
      lane: build.lane,
      name: build.name,
      items: route,
    },
    art.placeholder ? undefined : art.body,
    icons
  )
  return { body, complete: !art.placeholder && icons.size === ids.length }
}

/**
 * A build shared from the desktop app: `/desktop/build/1/ahri/mid/1056,2003-3020-…?n=…` (or a
 * version 2 link, every row of the build), its page, and `/og/build/1/ahri/mid/1056,2003-3020-….jpg?n=…`,
 * its link preview (`build_card`).
 * Anything the app would not have written, or that names an unknown champion or item, is a 404.
 */
export default class SharedBuildsController {
  async show({ inertia, params, request, response }: HttpContext) {
    const link = parseBuildLink(
      params.version,
      params.champion,
      params.role,
      params.groups,
      request.qs().n
    )
    const build = await resolveBuild(link).catch(() => null)
    if (!build) {
      response.status(404)
      return inertia.render('errors/not_found', { error: { status: 404, message: null } })
    }
    const social = buildSocial(build)
    return inertia.render('desktop/build', {
      build: {
        championId: build.championId,
        championName: build.championName,
        lane: build.lane,
        name: build.name,
        items: build.items,
        itemNames: build.itemNames,
      },
      link: social.url,
      description: social.description,
      social,
    })
  }

  async image({ params, request, response }: HttpContext) {
    const groups = /^(.+)\.jpg$/.exec(String(params.file))?.[1]
    const link = groups
      ? parseBuildLink(params.version, params.champion, params.role, groups, request.qs().n)
      : null
    const build = await resolveBuild(link).catch(() => null)
    if (!build) {
      response.header('Cache-Control', 'public, max-age=60')
      return response.notFound()
    }
    const key = JSON.stringify([build.championId, build.lane, build.name, build.items])
    let body = cards.get(key)
    let complete = true
    if (!body) {
      let job = pending.get(key)
      if (!job) {
        job = limited(() => draw(build))
          .then((result) => {
            if (result.complete) cards.set(key, result.body, result.body.byteLength, 3_600_000)
            return result
          })
          .finally(() => pending.delete(key))
        pending.set(key, job)
      }
      const result = await job
      body = result.body
      complete = result.complete
    }
    response.header('Content-Type', 'image/jpeg')
    // The URL says everything drawn; a missing picture (art unavailable for now) is retried soon.
    response.header(
      'Cache-Control',
      complete ? 'public, max-age=604800, stale-while-revalidate=86400' : 'public, max-age=300'
    )
    return response.send(body)
  }
}
