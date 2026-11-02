import { test } from '@japa/runner'
import env from '#start/env'

test.group('Contact page', (group) => {
  const saved = env.get('LEGAL_CONTACT_EMAIL')
  group.each.teardown(() => {
    env.set('LEGAL_CONTACT_EMAIL', saved ?? '')
  })

  test('lists the Discord, X, the source and the publisher email', async ({ client }) => {
    env.set('LEGAL_CONTACT_EMAIL', 'contact@example.test')
    const contact = await client.get('/contact')
    contact.assertStatus(200)
    contact.assertTextIncludes('Contact')
    contact.assertTextIncludes('https://discord.gg/JC2QTNmDyu')
    contact.assertTextIncludes('https://x.com/invadedotlol')
    contact.assertTextIncludes('https://github.com/invadelol/core')
    contact.assertTextIncludes('contact@example.test')
    contact.assertTextIncludes('og:title')
    contact.assertTextIncludes('https://invade.lol/contact')
  })

  test('is its own page, not a summoner named contact', async ({ client }) => {
    const contact = await client.get('/contact')
    contact.assertStatus(200)
    contact.assertTextIncludes('&quot;component&quot;:&quot;contact&quot;')
  })
})
