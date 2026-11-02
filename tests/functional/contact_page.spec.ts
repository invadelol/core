import { test } from '@japa/runner'
import env from '#start/env'
import { discordServer } from '#services/discord_server'

test.group('Contact page', (group) => {
  const saved = env.get('LEGAL_CONTACT_EMAIL')
  group.each.setup(() => discordServer.prime({ members: 1234, online: 56 }))
  group.each.teardown(() => {
    env.set('LEGAL_CONTACT_EMAIL', saved ?? '')
    discordServer.prime(null)
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

  test('shows the Discord server counts it read', async ({ client }) => {
    const contact = await client.get('/contact')
    contact.assertStatus(200)
    contact.assertTextIncludes('&quot;members&quot;:1234')
    contact.assertTextIncludes('&quot;online&quot;:56')
  })

  test('is its own page, not a summoner named contact', async ({ client }) => {
    const contact = await client.get('/contact')
    contact.assertStatus(200)
    contact.assertTextIncludes('&quot;component&quot;:&quot;contact&quot;')
  })
})
