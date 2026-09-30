import { test } from '@japa/runner'
import { DESKTOP_PLATFORMS, isDesktopPlatform, parseRelease } from '#services/desktop_release'

const base = 'https://github.com/invadelol/releases/releases/download/v0.2.0'
const asset = (name: string) => ({ name, browser_download_url: `${base}/${name}` })

test.group('Desktop release', () => {
  test('picks the installer of each platform and strips the tag prefix', ({ assert }) => {
    const release = parseRelease({
      tag_name: 'v0.2.0',
      draft: false,
      assets: [
        asset('latest.json'),
        asset('Invade_0.2.0_x64-setup.exe'),
        asset('Invade_0.2.0_x64-setup.exe.sig'),
        asset('Invade_0.2.0_aarch64.dmg'),
        asset('Invade_0.2.0_x64.dmg'),
        asset('Invade_aarch64.app.tar.gz'),
      ],
    })
    assert.equal(release?.version, '0.2.0')
    assert.deepEqual(release?.urls, {
      'windows': `${base}/Invade_0.2.0_x64-setup.exe`,
      'mac-arm': `${base}/Invade_0.2.0_aarch64.dmg`,
      'mac-intel': `${base}/Invade_0.2.0_x64.dmg`,
    })
  })

  test('leaves out platforms that are not built yet and refuses foreign hosts', ({ assert }) => {
    const release = parseRelease({
      tag_name: 'v0.2.0',
      assets: [
        asset('Invade_0.2.0_aarch64.dmg'),
        {
          name: 'Invade_0.2.0_x64-setup.exe',
          browser_download_url: 'https://evil.example/Invade_0.2.0_x64-setup.exe',
        },
      ],
    })
    assert.deepEqual(Object.keys(release!.urls), ['mac-arm'])
  })

  test('ignores drafts and malformed payloads', ({ assert }) => {
    assert.isNull(parseRelease({ tag_name: 'v1', draft: true, assets: [] }))
    assert.isNull(parseRelease(null))
    assert.isNull(parseRelease({ assets: [] }))
  })

  test('only known platform ids are accepted', ({ assert }) => {
    for (const id of DESKTOP_PLATFORMS) assert.isTrue(isDesktopPlatform(id))
    assert.isFalse(isDesktopPlatform('linux'))
    assert.isFalse(isDesktopPlatform('../etc'))
  })
})
