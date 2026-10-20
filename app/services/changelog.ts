import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import sharp from 'sharp'
import { changelogCardVersion } from '#services/changelog_card'
import { headline, parseChangelog, type Line, type Release } from '#services/changelog_parse'
import type {
  ChangelogFeature,
  ChangelogItem,
  ChangelogRelease,
} from '../../inertia/lib/changelog.js'

/**
 * The desktop app's release notes for /app/changelog: CHANGELOG.md and its screenshots, synced
 * from the app (scripts/sync_changelog.mjs), read once and laid out the way the app's "What's
 * new" page lays them out. Each version leads with its screenshot and headline, then its other
 * marked lines, then the rest as lists under New, Changed, Fixed. A version with nothing written
 * yet is left out.
 */
const SITE = 'https://invade.lol'
/** Lists that read quieter. */
const QUIET = new Set(['Fixed', 'Removed'])
/** How long a link preview's description may run before its last highlights are left out. */
const DESCRIPTION = 200

const DAY = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

export interface Changelog {
  releases: ChangelogRelease[]
  /** The parsed versions, highlights included, in the same order. */
  parsed: Release[]
}

export interface ChangelogSocial {
  type: 'website'
  title: string
  description: string
  url: string
  canonical: string
  image: string
  imageType: 'image/jpeg'
  alt: string
}

interface Shot {
  src: string
  w: number
  h: number
}

/** `public/changelog/<name>`: its address (with a hash of its bytes, so a new picture shows at once) and size. */
async function shot(name: string): Promise<Shot | null> {
  if (!/^[\w-]+\.webp$/.test(name)) return null
  try {
    const bytes = await readFile(join(app.publicPath('changelog'), name))
    const meta = await sharp(bytes).metadata()
    if (meta.format !== 'webp' || !meta.width || !meta.height) return null
    const v = createHash('sha256').update(bytes).digest('base64url').slice(0, 8)
    return { src: `/changelog/${name}?v=${v}`, w: meta.width, h: meta.height }
  } catch {
    return null
  }
}

export async function buildChangelog(md: string): Promise<Changelog> {
  const parsed = parseChangelog(md).filter((r) => r.sections.some((s) => s.lines.length))
  const names = [
    ...new Set(parsed.flatMap((r) => r.sections.flatMap((s) => s.lines.map((l) => l.image)))),
  ].filter((name): name is string => !!name)
  const shots = new Map(await Promise.all(names.map(async (n) => [n, await shot(n)] as const)))

  const feature = (line: Line, key: string): ChangelogFeature => {
    const split = headline(line.runs)
    const picture = line.image ? shots.get(line.image) : null
    return {
      key,
      title: split?.title ?? null,
      runs: split ? split.rest : line.runs,
      ...(picture ?? {}),
    }
  }

  const releases = parsed.map((r): ChangelogRelease => {
    const featured = r.sections.flatMap((s, i) =>
      s.lines.flatMap((l, j) =>
        l.highlight || l.image ? [feature(l, `${r.version}:${i}.${j}`)] : []
      )
    )
    const hero = featured.find((f) => f.src) ?? null
    return {
      version: r.version,
      date: r.date ?? null,
      day: r.date ? DAY.format(new Date(`${r.date}T00:00:00Z`)) : null,
      hero,
      features: featured.filter((f) => f !== hero),
      groups: r.sections
        .map((s, i) => ({
          title: s.title,
          quiet: QUIET.has(s.title),
          items: s.lines.flatMap((l, j): ChangelogItem[] =>
            l.highlight || l.image ? [] : [{ key: `${r.version}:${i}.${j}`, runs: l.runs }]
          ),
        }))
        .filter((g) => g.items.length),
    }
  })
  return { releases, parsed }
}

const FILE = () => app.makePath('resources', 'changelog', 'CHANGELOG.md')
let cached: { at: number; changelog: Promise<Changelog> } | null = null

/** The changelog, read once in production; elsewhere again whenever the file changes. */
export async function changelog(): Promise<Changelog> {
  let at = cached?.at ?? 0
  if (!app.inProduction || !cached) {
    const file = await stat(FILE())
    at = file.mtimeMs
  }
  if (!cached || cached.at !== at) {
    const loading = readFile(FILE(), 'utf8').then(buildChangelog)
    cached = { at, changelog: loading }
    loading.catch(() => (cached = null))
  }
  return cached.changelog
}

/** "v0.3.2" and "0.3.2" are the same version. */
export function normalizeVersion(raw: string) {
  return raw.trim().replace(/^v/i, '')
}

/** The version image's address, with its `v`. */
export function changelogImage(version: string) {
  return `${SITE}/og/app/changelog/${encodeURIComponent(version)}.jpg?v=${changelogCardVersion(version)}`
}

/** The highlights in one line, the last left out while it runs long. */
function summary(release: Release) {
  let text = ''
  for (const h of release.highlights) {
    const next = text ? `${text} ${h}` : h
    if (text && next.length > DESCRIPTION) break
    text = next
  }
  return text
}

/** The link preview of the whole page (the newest version's image) or of one version. */
export function changelogSocial(log: Changelog, version?: string): ChangelogSocial | null {
  const release = version ? log.parsed.find((r) => r.version === version) : log.parsed[0]
  if (!release) return null
  if (!version) {
    return {
      type: 'website',
      title: 'Invade changelog',
      description: `What changed in each version of Invade for desktop. ${release.version}: ${summary(release)}`,
      url: `${SITE}/app/changelog`,
      canonical: `${SITE}/app/changelog`,
      image: changelogImage(release.version),
      imageType: 'image/jpeg',
      alt: `Invade ${release.version}`,
    }
  }
  const url = `${SITE}/app/changelog/${encodeURIComponent(release.version)}`
  return {
    type: 'website',
    title: `Invade ${release.version}`,
    description: summary(release),
    url,
    canonical: url,
    image: changelogImage(release.version),
    imageType: 'image/jpeg',
    alt: `Invade ${release.version}`,
  }
}
