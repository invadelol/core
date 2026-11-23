import type {
  Clip,
  ClipComment,
  ClipCommentRule,
  ClipVisibility,
  ReportReason,
} from './clip_types.js'

/** "9:12": a moment of a game or a clip, from ms. */
export function clipClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "9:12.3": a moment of the game to a tenth, as Riot's data has it. */
export function gameClock(ms: number) {
  const tenths = Math.max(0, Math.floor(ms / 100))
  const s = Math.floor(tenths / 10)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${tenths % 10}`
}

export const VISIBILITY_WORDS: Record<ClipVisibility, string> = {
  everyone: 'Everyone can watch',
  link: 'Only with the link',
  private: 'Only me',
}

export const COMMENT_WORDS: Record<ClipCommentRule, string> = {
  everyone: 'Everyone can comment',
  game: 'This game’s players can comment',
  off: 'Comments are off',
}

export const REPORT_WORDS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment or hate',
  cheating: 'Cheating or scripting',
  explicit: 'Sexual or violent content',
  other: 'Something else',
}

/** The answer to a clip action that could not be saved, in words for the page. */
export class ClipRequestError extends Error {}

async function send<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ClipRequestError(
      data?.errors?.[0]?.message ?? 'That did not go through. Try again in a moment.'
    )
  }
  return data as T
}

/** The clips of a match everyone may see (and the visitor's own), as `GET /api/clips` answers. */
export async function fetchClips(query: { match?: string; puuid?: string }): Promise<Clip[]> {
  const params = new URLSearchParams(query as Record<string, string>)
  const response = await fetch(`/api/clips?${params}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) return []
  const data = (await response.json().catch(() => null)) as { clips?: Clip[] } | null
  return data?.clips ?? []
}

const base = (id: string) => `/api/clips/${encodeURIComponent(id)}`

export const clipApi = {
  comment: (id: string, input: { body: string; parentId?: string; atMs?: number | null }) =>
    send<{ comments: ClipComment[] }>('POST', `${base(id)}/comments`, input),
  uncomment: (id: string, comment: string) =>
    send<{ comments: ClipComment[] }>('DELETE', `${base(id)}/comments/${comment}`),
  gg: (id: string, on: boolean, comment?: string) =>
    send<{ gg: number; ggByViewer: boolean }>(
      on ? 'PUT' : 'DELETE',
      comment ? `${base(id)}/comments/${comment}/gg` : `${base(id)}/gg`
    ),
  update: (id: string, change: { visibility?: ClipVisibility; comments?: ClipCommentRule }) =>
    send<Clip>('PATCH', base(id), change),
  pin: (id: string, on: boolean) => send<void>(on ? 'PUT' : 'DELETE', `${base(id)}/pin`),
  remove: (id: string) => send<void>('DELETE', base(id)),
  /** Reports the clip, or one of its comments, to the team. */
  report: (id: string, report: { reason: ReportReason; note: string }, comment?: string) =>
    send<{ reported: true }>(
      'POST',
      comment ? `${base(id)}/comments/${comment}/report` : `${base(id)}/report`,
      report
    ),
}
