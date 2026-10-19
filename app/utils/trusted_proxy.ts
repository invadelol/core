import { BlockList, isIPv4 } from 'node:net'

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

export function trustedProxy(address: string): boolean {
  // Node reports IPv4 peers of a dual-stack socket as `::ffff:10.0.1.2`.
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address
  if (isIPv4(v4)) return PRIVATE.check(v4, 'ipv4')
  try {
    return PRIVATE.check(address, 'ipv6')
  } catch {
    return false
  }
}
