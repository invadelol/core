import db from '@adonisjs/lucid/services/db'
import type { CrashReport } from '#types/desktop'

/** How long a crash report is kept (docs/desktop-sync.md §7). */
export const CRASH_REPORT_DAYS = 90

/**
 * Anonymous crash reports (docs/desktop-sync.md §7): stored as sent, without
 * the device, account or address they came from. Older reports are pruned on
 * the way, so the table never outgrows its 90 days.
 */
export class CrashReportService {
  async store(reports: CrashReport[], now = new Date()) {
    // A clock far off (or a forged report) cannot date a crash in the future
    // or before the retention window.
    const oldest = now.getTime() - CRASH_REPORT_DAYS * 86_400_000
    await db.table('desktop_crash_report').insert(
      reports.map((report) => ({
        kind: report.kind,
        process: report.process,
        app: report.app,
        os: report.os,
        os_version: report.osVersion ?? '',
        message: report.message,
        location: report.location ?? '',
        occurred_at: new Date(Math.min(Math.max(report.at, oldest), now.getTime())),
        received_at: now,
      }))
    )
    await db.from('desktop_crash_report').where('received_at', '<', new Date(oldest)).delete()
    return reports.length
  }
}

export default new CrashReportService()
