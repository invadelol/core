import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { unverifyPro, verifyPro } from '#services/profiles/verified_pros'

const REFUSALS = {
  'no-account': 'No Invade account has this handle.',
  'no-pro': 'No pro has this slug (the address of their page, /pro/<slug>).',
  'pro-taken': 'This pro is already verified on another Invade account: remove that one first.',
} as const

/**
 * Verifies a pro's Invade account: `node ace profiles:verify-pro <handle> <pro-slug>`, or takes it
 * back with `--remove`. Their profile then shows the verified mark and the pro's accounts.
 */
export default class VerifyPro extends BaseCommand {
  static commandName = 'profiles:verify-pro'
  static description = 'Link a pro to their Invade account, or take the link back'

  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'The Invade account handle (/u/<handle>)' })
  declare handle: string

  @args.string({ description: 'The pro slug (/pro/<slug>)', required: false })
  declare slug?: string

  @flags.boolean({ description: 'Take the verification back' })
  declare remove: boolean

  async run() {
    if (this.remove) {
      const removed = await unverifyPro(this.handle)
      this.logger.info(removed ? 'Verification removed.' : 'This account was not verified.')
      return
    }
    if (!this.slug) {
      this.logger.error('Name the pro: node ace profiles:verify-pro <handle> <pro-slug>')
      this.exitCode = 1
      return
    }
    const result = await verifyPro(this.handle, this.slug)
    if (result === 'linked') {
      this.logger.success(`@${this.handle.toLowerCase()} is verified as ${this.slug}.`)
      return
    }
    this.logger.error(REFUSALS[result])
    this.exitCode = 1
  }
}
