import riotAssets from '#services/riot/assets'
import { buildCardVersion } from '#services/build_card'
import { LANE_LABELS, SITE, buildPath, withQuery, type BuildLink } from '#services/build_link'

/** A shared build link (`build_link`) checked against the live game data, and its preview. */

export interface SharedBuild extends BuildLink {
  championId: number
  championName: string
  /** Item id to its name, for every item of the build. */
  itemNames: Record<string, string>
}

/** The build a link names, checked against the live game data; `null` for anything unknown. */
export async function resolveBuild(link: BuildLink | null): Promise<SharedBuild | null> {
  if (!link) return null
  const [keys, champions, items] = await Promise.all([
    riotAssets.championKeys(),
    riotAssets.names('champion'),
    riotAssets.names('item'),
  ])
  const championId = keys[link.champion]
  if (!championId) return null
  const all = [
    ...link.items.start,
    ...(link.items.boots === null ? [] : [link.items.boots]),
    ...link.items.core,
    ...link.items.later.flat(),
  ]
  const itemNames: Record<string, string> = {}
  for (const id of all) {
    const name = items[String(id)]
    if (!name) return null
    itemNames[String(id)] = name
  }
  return {
    ...link,
    championId: Number(championId),
    championName: champions[championId] ?? link.champion,
    itemNames,
  }
}

/** The build's page address, its picture's and its link preview. */
export function buildSocial(build: SharedBuild) {
  const page = buildPath('/desktop/build', build)
  const url = `${SITE}${withQuery(page.path, page.query)}`
  const image = buildPath('/og/build', build, '.jpg')
  image.query.set('v', buildCardVersion())
  const lane = LANE_LABELS[build.lane]
  const title = build.name
    ? `${build.name} — ${build.championName} build`
    : `${build.championName} ${lane} build`
  const route = [...build.items.core, ...build.items.later.map((o) => o[0])]
    .map((id) => build.itemNames[String(id)])
    .join(' → ')
  return {
    type: 'website',
    title,
    description: `${build.championName} ${lane}: ${route}. A custom build from Invade for desktop.`,
    url,
    canonical: url,
    image: `${SITE}${withQuery(image.path, image.query)}`,
    imageType: 'image/jpeg',
    alt: `${build.championName} ${lane} build: ${route}`,
  }
}
