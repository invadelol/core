import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import type { LegalPublisher } from '../../inertia/lib/legal.js'

const value = (key: Parameters<typeof env.get>[0]) => {
  const raw = env.get(key)
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/**
 * Who publishes the site, read from the environment so the public repository holds no personal
 * details. Every field is optional: the pages leave out a line whose value is not set.
 */
export function legalPublisher(): LegalPublisher {
  const host = value('LEGAL_HOST')
  return {
    name: value('LEGAL_PUBLISHER_NAME'),
    email: value('LEGAL_CONTACT_EMAIL'),
    address: value('LEGAL_ADDRESS'),
    phone: value('LEGAL_PHONE'),
    host,
    hostCompany: host ? host.split(',')[0].trim() || null : null,
    updated: value('LEGAL_UPDATED'),
  }
}

export default class LegalController {
  /** `/privacy`: what invade.lol and the desktop app process, why, and the rights over it. */
  async privacy({ inertia }: HttpContext) {
    return inertia.render('legal/privacy', {
      publisher: legalPublisher(),
      description:
        'What invade.lol and the Invade desktop app collect, why, who receives it, how long it is kept, and how to have it removed.',
    })
  }

  /** `/legal`: the legal notice (mentions légales) and the terms of use (`#terms`). */
  async legal({ inertia }: HttpContext) {
    return inertia.render('legal/legal', {
      publisher: legalPublisher(),
      description: 'Who publishes invade.lol, who hosts it, and the terms of use.',
    })
  }
}
