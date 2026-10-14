import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import type { LegalPublisher } from '../../inertia/lib/legal.js'

const value = (key: Parameters<typeof env.get>[0]) => {
  const raw = env.get(key)
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/** The publisher's details when the environment sets none (the LEGAL_* variables override them). */
const DEFAULTS = {
  name: 'Louis Leschevin',
  email: 'louis.leschevin@gmail.com',
  address: '1005 Haute Folie, 14200 Hérouville-Saint-Clair, France',
  /** OVHcloud's head office; the servers run in its Gravelines data centre. */
  host: 'OVH SAS, 2 rue Kellermann, 59100 Roubaix, France, +33 9 72 10 10 07',
}

/**
 * Who publishes the site: the LEGAL_* environment variables, else the defaults above. Every other
 * field is optional: the pages leave out a line whose value is not set.
 */
export function legalPublisher(): LegalPublisher {
  const host = value('LEGAL_HOST') ?? DEFAULTS.host
  return {
    name: value('LEGAL_PUBLISHER_NAME') ?? DEFAULTS.name,
    email: value('LEGAL_CONTACT_EMAIL') ?? DEFAULTS.email,
    address: value('LEGAL_ADDRESS') ?? DEFAULTS.address,
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
