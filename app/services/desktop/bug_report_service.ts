import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

/**
 * Bug reports from the desktop app (docs/desktop-sync.md §9). Every report is kept in the
 * admin's `admin.bug_report` with its screenshot or clip; when the player asks, it is also
 * posted on the Discord server's bug forum through the bot, tagged with the system and the part
 * of the app. The diagnostics stay in the admin: they can hold file paths and never go public.
 */

/** The Invade server's bug forum; `DISCORD_BUGS_FORUM` overrides it. */
const DEFAULT_FORUM = '1559595192145682504'
const API = 'https://discord.com/api/v10'
/** Forum posts read for "maybe already reported", kept this long. */
const THREADS_TTL_MS = 5 * 60 * 1000
const TAGS_TTL_MS = 60 * 60 * 1000

export const REPORT_AREAS = [
  'Overlay',
  'Champ select',
  'Recording',
  'Profile & stats',
  'Sync',
  'Install & updates',
  'Website',
  'Other',
] as const
export type ReportArea = (typeof REPORT_AREAS)[number]

export interface ReportFile {
  kind: 'screenshot' | 'clip'
  name: string
  mime: string
  bytes: Buffer
}

export interface NewReport {
  title: string
  body: string
  page: string
  area: ReportArea
  inGame: string
  diagnostics: string
  appVersion: string
  os: string
  reporter: string
  deviceId: string | null
  files: ReportFile[]
  discord: boolean
  sameAs: string | null
}

interface Thread {
  id: string
  name: string
  guildId: string
  players: number
}

/** Words that say nothing about which bug it is. */
const FILLER = new Set(
  'at to in on of is it my me no an or be so up do the and for not but with when after from into this that then than its are was were has have had does doesnt dont cant cannot wont isnt arent app invade game games page'.split(
    ' '
  )
)

export function words(text: string) {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 2 && !FILLER.has(word))
  )
}

/** How much of the query's words a post title shares, 0 to 1; needs two shared words. */
export function likeness(query: string, title: string) {
  const asked = words(query)
  const seen = words(title)
  if (asked.size === 0) return 0
  let shared = 0
  for (const word of asked) if (seen.has(word)) shared++
  return shared >= 2 ? shared / asked.size : 0
}

/** The post's text: what happened, then one line of facts. Discord stops at 2000 characters. */
export function postContent(
  report: Pick<NewReport, 'body' | 'appVersion' | 'os' | 'page' | 'inGame'>,
  reply: boolean
) {
  const facts = [
    report.appVersion && `**Version** ${report.appVersion}`,
    report.os && `**System** ${report.os}`,
    report.page && `**Where** ${report.page}`,
  ].filter(Boolean)
  const tail = [
    facts.join(' · '),
    report.inGame ? `**In game** ${report.inGame}` : '',
    '-# Sent from the Invade app',
  ]
    .filter(Boolean)
    .join('\n')
  const head = reply ? '**Same here**\n' : '**What happened**\n'
  const room = 2000 - head.length - tail.length - 2
  const body = report.body.length > room ? `${report.body.slice(0, room - 1)}…` : report.body
  return `${head}${body}\n\n${tail}`
}

export class BugReportService {
  #threads: { at: number; list: Thread[] } | null = null
  #tags: { at: number; byName: Map<string, string> } | null = null

  get forum() {
    return env.get('DISCORD_BUGS_FORUM') || DEFAULT_FORUM
  }

  get canPost() {
    return !!env.get('DISCORD_BOT_TOKEN')
  }

  async available() {
    try {
      const result = await db.rawQuery(`SELECT to_regclass('admin.bug_file') IS NOT NULL AS ok`)
      return !!result.rows[0]?.ok
    } catch {
      return false
    }
  }

  async #discord(path: string, init: RequestInit = {}) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bot ${env.get('DISCORD_BOT_TOKEN')}`,
        'User-Agent': 'DiscordBot (https://invade.lol, 1.0)',
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      throw new Error(`Discord ${init.method ?? 'GET'} ${path.split('?')[0]}: ${response.status}`)
    }
    return response.json() as Promise<any>
  }

  /** The forum's open posts and its recent archived ones. */
  async threads(): Promise<Thread[]> {
    if (!this.canPost) return []
    if (this.#threads && Date.now() - this.#threads.at < THREADS_TTL_MS) return this.#threads.list
    const forum = await this.#discord(`/channels/${this.forum}`)
    const [active, archived] = await Promise.all([
      this.#discord(`/guilds/${forum.guild_id}/threads/active`),
      this.#discord(`/channels/${this.forum}/threads/archived/public?limit=50`),
    ])
    const list = [...(active.threads ?? []), ...(archived.threads ?? [])]
      // The pinned guide post is not a bug.
      .filter(
        (thread: any) =>
          thread.parent_id === this.forum &&
          !thread.thread_metadata?.locked &&
          !(Number(thread.flags) & 2)
      )
      .map((thread: any) => ({
        id: String(thread.id),
        name: String(thread.name),
        guildId: String(forum.guild_id),
        players: Math.max(1, Number(thread.member_count) || 1),
      }))
    this.#threads = { at: Date.now(), list }
    return list
  }

  /** The post whose title looks most like `query`, if one is close enough. */
  async similar(query: string) {
    try {
      let best: { thread: Thread; score: number } | null = null
      for (const thread of await this.threads()) {
        const score = likeness(query, thread.name)
        if (score >= 0.5 && (!best || score > best.score)) best = { thread, score }
      }
      if (!best) return null
      const { thread } = best
      return {
        id: thread.id,
        title: thread.name,
        url: `https://discord.com/channels/${thread.guildId}/${thread.id}`,
        players: thread.players,
      }
    } catch (error) {
      logger.warn({ err: error }, 'reports: could not read the bug forum')
      return null
    }
  }

  async #tagIds(names: string[]) {
    if (!this.#tags || Date.now() - this.#tags.at > TAGS_TTL_MS) {
      const forum = await this.#discord(`/channels/${this.forum}`)
      this.#tags = {
        at: Date.now(),
        byName: new Map(
          (forum.available_tags ?? []).map((tag: any) => [String(tag.name), String(tag.id)])
        ),
      }
    }
    return names.map((name) => this.#tags!.byName.get(name)).filter((id): id is string => !!id)
  }

  /** Posts the report (or a reply in `sameAs`) and returns the post's link. */
  async post(report: NewReport) {
    const form = new FormData()
    const attachments = report.files.map((file, id) => ({ id, filename: file.name }))
    report.files.forEach((file, id) => {
      form.append(
        `files[${id}]`,
        new Blob([new Uint8Array(file.bytes)], { type: file.mime }),
        file.name
      )
    })
    const content = postContent(report, !!report.sameAs)
    const allowed = { parse: [] as string[] }
    if (report.sameAs) {
      form.append(
        'payload_json',
        JSON.stringify({ content, attachments, allowed_mentions: allowed })
      )
      const message = await this.#discord(`/channels/${report.sameAs}/messages`, {
        method: 'POST',
        body: form,
      })
      const thread = await this.#discord(`/channels/${report.sameAs}`)
      return `https://discord.com/channels/${thread.guild_id}/${report.sameAs}/${message.id}`
    }
    const os = /mac/i.test(report.os) ? 'macOS' : /win/i.test(report.os) ? 'Windows' : null
    const tags = await this.#tagIds([os, report.area].filter((name): name is string => !!name))
    form.append(
      'payload_json',
      JSON.stringify({
        name: report.title.slice(0, 100),
        applied_tags: tags,
        message: { content, attachments, allowed_mentions: allowed },
      })
    )
    const thread = await this.#discord(`/channels/${this.forum}/threads`, {
      method: 'POST',
      body: form,
    })
    this.#threads = null
    return `https://discord.com/channels/${thread.guild_id}/${thread.id}`
  }

  /** Keeps the report and its files; posts it when asked. The report is kept even if Discord fails. */
  async submit(report: NewReport) {
    const inserted = await db.rawQuery(
      `INSERT INTO admin.bug_report (title, body, source, reporter, app_version, os, page, area, in_game, diagnostics, device_id, same_as)
       VALUES (?, ?, 'app', ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        report.title || 'Same bug',
        report.body,
        report.reporter,
        report.appVersion,
        report.os,
        report.page,
        report.area,
        report.inGame,
        report.diagnostics,
        report.deviceId,
        report.sameAs,
      ]
    )
    const id = Number(inserted.rows[0].id)
    for (const file of report.files) {
      await db.rawQuery(
        `INSERT INTO admin.bug_file (bug_id, kind, name, mime, size, bytes) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, file.kind, file.name, file.mime, file.bytes.length, file.bytes]
      )
    }
    if (!report.discord) return { id, discordUrl: null, discordError: false }
    if (!this.canPost) return { id, discordUrl: null, discordError: true }
    try {
      const discordUrl = await this.post(report)
      await db.rawQuery(
        `UPDATE admin.bug_report SET discord_url = ?, updated_at = now() WHERE id = ?`,
        [discordUrl, id]
      )
      return { id, discordUrl, discordError: false }
    } catch (error) {
      logger.warn({ err: error, id }, 'reports: Discord post failed')
      return { id, discordUrl: null, discordError: true }
    }
  }

  /** Who sent it, for the admin: the tester label or the device's first linked Riot ID. */
  async reporterOf(deviceId: string | null) {
    if (!deviceId) return 'Anonymous'
    try {
      const result = await db.rawQuery(
        `SELECT coalesce(p.game_name || '#' || p.tag_line, a.puuid) AS label
         FROM desktop_device_account a LEFT JOIN riot_player p ON p.puuid = a.puuid
         WHERE a.device_id = ? ORDER BY a.puuid LIMIT 1`,
        [deviceId]
      )
      return result.rows[0]?.label ?? 'Anonymous'
    } catch {
      return 'Anonymous'
    }
  }
}

export default new BugReportService()
