import { BlockList, isIP, isIPv4 } from 'node:net'

/**
 * Loopback and private addresses: in production the only peer the server
 * ever sees is Coolify's Traefik on the Docker network (10.0.0.0/8), never a
 * player. Trusting it lets `request.ip()` read the player's address from
 * `X-Forwarded-For`; without it every request had the proxy's address, and
 * the per-IP limits of the desktop API were one limit shared by everyone.
 * A public address is never trusted, so nobody outside can forge their IP.
 */
const PRIVATE = new BlockList()
PRIVATE.addSubnet('127.0.0.0', 8, 'ipv4')
PRIVATE.addSubnet('10.0.0.0', 8, 'ipv4')
PRIVATE.addSubnet('172.16.0.0', 12, 'ipv4')
PRIVATE.addSubnet('192.168.0.0', 16, 'ipv4')
PRIVATE.addAddress('::1', 'ipv6')
PRIVATE.addSubnet('fc00::', 7, 'ipv6')

/** Cloudflare's edge addresses, from https://www.cloudflare.com/ips (read 2026-11-14). */
const CLOUDFLARE = new BlockList()
for (const range of [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
]) {
  const [network, bits] = range.split('/')
  CLOUDFLARE.addSubnet(network, Number(bits), 'ipv4')
}
for (const range of [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]) {
  const [network, bits] = range.split('/')
  CLOUDFLARE.addSubnet(network, Number(bits), 'ipv6')
}

function inList(list: BlockList, address: string | undefined): boolean {
  // A socket the client already closed has no address left: it is nobody we trust.
  if (typeof address !== 'string') return false
  // Node reports IPv4 peers of a dual-stack socket as `::ffff:10.0.1.2`.
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address
  if (isIPv4(v4)) return list.check(v4, 'ipv4')
  try {
    return list.check(address, 'ipv6')
  } catch {
    return false
  }
}

export function trustedProxy(address: string | undefined): boolean {
  return inList(PRIVATE, address)
}

export function cloudflareEdge(address: string | undefined): boolean {
  return inList(CLOUDFLARE, address)
}

interface IpSource {
  ips(): string[]
  header(name: string): string | null | undefined
}

/**
 * The player's address. Behind Cloudflare the first public hop is one of its
 * edges, and Traefik drops the `X-Forwarded-For` it sent (it does not trust
 * the edge), so the player is the `CF-Connecting-IP` header Cloudflare sets.
 * The header counts only when the hop really is a Cloudflare edge: a request
 * made straight to the server keeps its own address, whatever it claims.
 */
export function clientIp(request: IpSource): string {
  const hops = request.ips()
  const hop = hops[hops.length - 1]
  if (!cloudflareEdge(hop)) return hop
  const visitor = request.header('cf-connecting-ip')?.trim()
  return visitor && isIP(visitor) ? visitor : hop
}
