import { test } from '@japa/runner'
import { clientIp, cloudflareEdge } from '#utils/trusted_proxy'

/** What `request.ips()` gives behind Traefik: Traefik's own hop, then the peer it saw. */
function request(peer: string, headers: Record<string, string> = {}) {
  return {
    ips: () => ['10.0.1.7', peer],
    header: (name: string) => headers[name.toLowerCase()],
  }
}

test.group('Client IP behind Cloudflare', () => {
  test('knows Cloudflare edges and nothing else', ({ assert }) => {
    for (const address of [
      '172.70.12.4',
      '162.158.1.1',
      '104.23.0.9',
      '2a06:98c1::5',
      '::ffff:172.70.12.4',
    ]) {
      assert.isTrue(cloudflareEdge(address), address)
    }
    for (const address of ['54.37.156.111', '8.8.8.8', '10.0.1.7', '2001:db8::1', 'nonsense']) {
      assert.isFalse(cloudflareEdge(address), address)
    }
  })

  test('reads the player from CF-Connecting-IP when the hop is a Cloudflare edge', ({ assert }) => {
    assert.equal(
      clientIp(request('172.70.12.4', { 'cf-connecting-ip': '81.2.69.160' })),
      '81.2.69.160'
    )
    assert.equal(
      clientIp(request('2a06:98c1::5', { 'cf-connecting-ip': '2001:db8::7' })),
      '2001:db8::7'
    )
  })

  test('ignores the header on a request made straight to the server', ({ assert }) => {
    assert.equal(clientIp(request('81.2.69.160', { 'cf-connecting-ip': '1.1.1.1' })), '81.2.69.160')
  })

  test('keeps the edge when the header is missing or not an address', ({ assert }) => {
    assert.equal(clientIp(request('172.70.12.4')), '172.70.12.4')
    assert.equal(clientIp(request('172.70.12.4', { 'cf-connecting-ip': 'x' })), '172.70.12.4')
  })
})
