import { test } from '@japa/runner'
import sharp from 'sharp'
import { escapeSvg, renderSocialCard } from '#services/social_card'

test('social card escapes player-controlled text and renders a 1200 by 630 PNG', async ({
  assert,
}) => {
  assert.equal(escapeSvg('<&"\''), '&lt;&amp;&quot;&apos;')
  const image = await renderSocialCard(
    { gameName: 'A<&" player', tagLine: 'EUW', platform: 'EUW1' },
    null
  )
  const meta = await sharp(image).metadata()
  assert.equal(meta.format, 'png')
  assert.equal(meta.width, 1200)
  assert.equal(meta.height, 630)
})
