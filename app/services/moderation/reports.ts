import db from '@adonisjs/lucid/services/db'
import { AccountError } from '#services/accounts/errors'
import type { SignedIn } from '#services/accounts/session_service'
import commentService from '#services/clips/comments'
import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  type Clip,
  type ReportReason,
} from '../../../inertia/lib/clip_types.js'

/** Reports one person may send in an hour, attempts included: plenty for a person, not a script. */
export const REPORTS_PER_HOUR = 20

/** What a person sends: why, and a few words if they want. */
export interface ReportInput {
  reason?: unknown
  note?: unknown
}

/** What is reported, and what the report keeps of it for the team. */
interface Target {
  kind: 'clip' | 'comment'
  id: string
  clipId: string
  authorId: string
  /** The clip's title or the comment's text, as it was when it was reported. */
  excerpt: string
}

const isReason = (value: unknown): value is ReportReason =>
  REPORT_REASONS.includes(value as ReportReason)

/** The note as it is kept: one line of plain words, null when there is none. */
function cleanNote(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw AccountError.invalid('The note must be text.')
  const note = value.replace(/\s+/g, ' ').trim()
  if (note.length > REPORT_NOTE_MAX) {
    throw AccountError.invalid(`Keep the note under ${REPORT_NOTE_MAX} characters.`)
  }
  return note || null
}

const yours = (what: string) => new AccountError(`This is your own ${what}.`, 403, 'E_REPORT_OWN')

/**
 * Reports: a signed-in person tells the team that a clip or a comment they can see breaks the
 * rules. One report per person and target, never on their own; the team reads them in its
 * dashboard and decides there (taking content down, suspending an account).
 */
class ReportService {
  async clip(user: SignedIn, clip: Clip, input: ReportInput) {
    if (clip.mine) throw yours('clip')
    await this.save(user, input, {
      kind: 'clip',
      id: clip.id,
      clipId: clip.id,
      authorId: clip.author.id,
      excerpt: clip.title,
    })
  }

  /** A comment of the clip, as its thread shows it (a hidden one is gone). */
  async comment(user: SignedIn, clip: Clip, commentId: string, input: ReportInput) {
    const comment = await commentService.find(clip.id, commentId)
    if (!comment) throw AccountError.notFound('This comment is gone.')
    if (comment.userId === user.id) throw yours('comment')
    await this.save(user, input, {
      kind: 'comment',
      id: comment.id,
      clipId: clip.id,
      authorId: comment.userId,
      excerpt: comment.body,
    })
  }

  private async save(user: SignedIn, input: ReportInput, target: Target) {
    if (!isReason(input.reason)) throw AccountError.invalid('Choose why you report it.')
    const note = cleanNote(input.note)
    const inserted = await db
      .knexQuery()
      .table('invade_report')
      .insert({
        reporter_id: user.id,
        target_kind: target.kind,
        target_id: target.id,
        clip_id: target.clipId,
        author_id: target.authorId,
        excerpt: target.excerpt,
        reason: input.reason,
        note,
      })
      .onConflict(['reporter_id', 'target_kind', 'target_id'])
      .ignore()
      .returning('id')
    if (!inserted.length) {
      throw new AccountError('You already reported this.', 409, 'E_REPORT_EXISTS')
    }
  }
}

export default new ReportService()
