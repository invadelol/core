import { test } from '@japa/runner'
import env from '#start/env'

const KEYS = [
  'LEGAL_PUBLISHER_NAME',
  'LEGAL_CONTACT_EMAIL',
  'LEGAL_ADDRESS',
  'LEGAL_PHONE',
  'LEGAL_HOST',
  'LEGAL_UPDATED',
] as const

test.group('Privacy policy and legal notice', (group) => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, env.get(key)]))
  const set = (values: Partial<Record<(typeof KEYS)[number], string>>) => {
    for (const key of KEYS) env.set(key, values[key] ?? '')
  }
  group.each.teardown(() => {
    for (const key of KEYS) env.set(key, saved[key] ?? '')
  })

  test('the publisher comes from the environment', async ({ client }) => {
    set({
      LEGAL_PUBLISHER_NAME: 'Test Publisher',
      LEGAL_CONTACT_EMAIL: 'contact@example.test',
      LEGAL_HOST: 'Example Host SAS, 1 rue de l’Exemple, 75000 Paris, +33 1 00 00 00 00',
      LEGAL_UPDATED: '14 October 2026',
    })
    const privacy = await client.get('/privacy')
    privacy.assertStatus(200)
    privacy.assertTextIncludes('Privacy policy')
    privacy.assertTextIncludes('Test Publisher')
    privacy.assertTextIncludes('contact@example.test')
    privacy.assertTextIncludes('14 October 2026')
    privacy.assertTextIncludes('Example Host SAS')
    privacy.assertTextIncludes('docs/desktop-sync.md')
    // The OpenPanel web script is in every page's head.
    privacy.assertTextIncludes('https://op.lschvn.foo/op1.js')
    privacy.assertTextIncludes('9a2c508e-3e56-415e-bf7f-bf76fd0741e2')

    const legal = await client.get('/legal')
    legal.assertStatus(200)
    legal.assertTextIncludes('Legal notice')
    legal.assertTextIncludes('Test Publisher')
    legal.assertTextIncludes('Example Host SAS, 1 rue')
  })

  test('nothing set falls back to the default publisher, with no placeholder', async ({
    client,
    assert,
  }) => {
    set({})
    const legal = await client.get('/legal')
    legal.assertStatus(200)
    legal.assertTextIncludes('Louis Leschevin')
    legal.assertTextIncludes('louis.leschevin@gmail.com')
    legal.assertTextIncludes('Hérouville-Saint-Clair')
    legal.assertTextIncludes('OVH SAS, 2 rue Kellermann')
    assert.notInclude(legal.text(), '6-III-2')
    assert.notInclude(legal.text(), '[publisher')
    const privacy = await client.get('/privacy')
    privacy.assertStatus(200)
    privacy.assertTextIncludes('OVH SAS')
    privacy.assertTextIncludes('louis.leschevin@gmail.com')
    assert.notInclude(privacy.text(), '[contact email]')
    assert.notInclude(privacy.text(), 'Last updated')
  })

  test('an address replaces the private-individual sentence', async ({ client, assert }) => {
    set({ LEGAL_PUBLISHER_NAME: 'Test Publisher', LEGAL_ADDRESS: '1 Test Street' })
    const legal = await client.get('/legal')
    legal.assertTextIncludes('1 Test Street')
    assert.notInclude(legal.text(), '6-III-2')
  })

  test('/terms, /discord, /x redirect', async ({ client }) => {
    const terms = await client.get('/terms').redirects(0)
    terms.assertStatus(302)
    terms.assertHeader('location', '/legal#terms')
    const discord = await client.get('/discord').redirects(0)
    discord.assertStatus(302)
    discord.assertHeader('location', 'https://discord.gg/JC2QTNmDyu')
    const x = await client.get('/x').redirects(0)
    x.assertStatus(302)
    x.assertHeader('location', 'https://x.com/invadedotlol')
  })
})
