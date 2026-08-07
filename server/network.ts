import { networkInterfaces } from 'node:os'

function isPrivateIPv4(address: string): boolean {
  if (address.startsWith('10.')) return true
  if (address.startsWith('192.168.')) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return true
  return false
}

function scoreLanAddress(address: string): number {
  if (address.startsWith('192.168.')) return 300
  if (address.startsWith('10.')) return 200
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return 100
  return 0
}

/** All non-internal IPv4 addresses, best LAN candidates first. */
export function listLanIPv4(): string[] {
  const found: string[] = []
  const nets = networkInterfaces()

  for (const entries of Object.values(nets)) {
    if (!entries) continue
    for (const net of entries) {
      const isV4 = String(net.family) === 'IPv4' || Number(net.family) === 4
      if (!isV4 || net.internal) continue
      if (net.address.startsWith('169.254.')) continue
      found.push(net.address)
    }
  }

  return [...new Set(found)].sort((a, b) => scoreLanAddress(b) - scoreLanAddress(a))
}

/** Best LAN IPv4 for phone access, or null. */
export function getLanIPv4(): string | null {
  const list = listLanIPv4().filter(isPrivateIPv4)
  if (list.length > 0) return list[0]
  const any = listLanIPv4()
  return any[0] ?? null
}
