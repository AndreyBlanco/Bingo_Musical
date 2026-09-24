import { cardFingerprint } from './cards'
import type { CardGrid, CardLayout } from '../types'
import type { ShareSong } from './sharePool'

export type PublicRoom = {
  id: string
  cols: number
  rows: number
  roundId: number
  songCount: number
  playlistKey: string
  assignedCount?: number
}

export type DealtCard = {
  roomId: string
  roundId: number
  cols: number
  rows: number
  grid: CardGrid
  songs: ShareSong[]
}

export type NetworkInfo = {
  host: string
  hosts?: string[]
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(
      typeof data === 'object' && data && 'error' in data && data.error
        ? String(data.error)
        : `Error de API (${response.status})`,
    )
  }
  return data
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

function resolveDevLanHost(): string {
  try {
    if (typeof __DEV_LAN_HOST__ === 'string' && __DEV_LAN_HOST__.trim()) {
      return __DEV_LAN_HOST__.trim()
    }
  } catch {
    // ignore
  }
  return ''
}

export async function createRoom(input: {
  playlistKey: string
  layout: CardLayout
  songs: ShareSong[]
}): Promise<PublicRoom> {
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playlistKey: input.playlistKey,
      cols: input.layout.cols,
      rows: input.layout.rows,
      songs: input.songs,
    }),
  })
  const data = await parseJson<{ room: PublicRoom }>(response)
  return data.room
}

export async function updateRoom(
  roomId: string,
  input: {
    playlistKey: string
    layout: CardLayout
    songs: ShareSong[]
  },
): Promise<PublicRoom> {
  const response = await fetch(`/api/rooms/${roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playlistKey: input.playlistKey,
      cols: input.layout.cols,
      rows: input.layout.rows,
      songs: input.songs,
    }),
  })
  const data = await parseJson<{ room: PublicRoom }>(response)
  return data.room
}

export async function fetchRoom(roomId: string): Promise<PublicRoom> {
  const response = await fetch(`/api/rooms/${roomId}`)
  const data = await parseJson<{ room: PublicRoom }>(response)
  return data.room
}

export async function startRoomRound(roomId: string): Promise<PublicRoom> {
  const response = await fetch(`/api/rooms/${roomId}/start-round`, { method: 'POST' })
  const data = await parseJson<{ room: PublicRoom }>(response)
  return data.room
}

export async function dealRoomCard(roomId: string): Promise<DealtCard> {
  const response = await fetch(`/api/rooms/${roomId}/cards`, { method: 'POST' })
  return parseJson<DealtCard>(response)
}

export async function registerPrintedCards(roomId: string, grids: CardGrid[]): Promise<void> {
  const fingerprints = grids.map(cardFingerprint)
  const response = await fetch(`/api/rooms/${roomId}/cards/register-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprints }),
  })
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Error de API (${response.status})`)
  }
}

export async function releaseRoomCard(roomId: string, grid: CardGrid): Promise<void> {
  const response = await fetch(`/api/rooms/${roomId}/cards/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grid }),
  })
  await parseJson<{ room: PublicRoom }>(response)
}

export async function fetchNetworkInfo(): Promise<NetworkInfo> {
  const response = await fetch('/api/network-info')
  return parseJson<NetworkInfo>(response)
}

/**
 * Share URL for QR / copy.
 * Local (localhost): prefers Vite-injected LAN IP, then API network-info.
 * Production / already on LAN hostname: uses the current origin.
 */
export async function buildRoomShareUrl(roomId: string): Promise<string> {
  const hash = `#/carton/${roomId}`
  const { protocol, hostname, port, pathname } = window.location

  let shareHost = hostname
  if (isLoopbackHost(hostname)) {
    const fromVite = resolveDevLanHost()
    if (fromVite) {
      shareHost = fromVite
    } else {
      try {
        const info = await fetchNetworkInfo()
        if (info.host) shareHost = info.host
      } catch {
        // keep localhost if nothing available
      }
    }
  }

  const portPart = port ? `:${port}` : ''
  return `${protocol}//${shareHost}${portPart}${pathname}${hash}`
}

export function parseRoomIdFromHash(hash: string): string | null {
  const match = hash.match(/^#\/carton\/([a-f0-9]{8}|[A-Za-z0-9_-]{6,32})$/i)
  return match?.[1] ?? null
}
