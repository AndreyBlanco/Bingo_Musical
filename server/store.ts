import { randomBytes } from 'node:crypto'
import { cardFingerprint, dealTraditionalCard } from '../src/lib/cards'
import type { ShareSong } from '../src/lib/sharePool'
import type { CardGrid } from '../src/types'

export type Room = {
  id: string
  playlistKey: string
  cols: number
  rows: number
  songs: ShareSong[]
  /** Increments each time the host starts a round. */
  roundId: number
  /** Fingerprints of cards currently assigned to players. */
  assignedCardKeys: Set<string>
  createdAt: string
  updatedAt: string
}

const rooms = new Map<string, Room>()

export function createRoomId(): string {
  return randomBytes(4).toString('hex') // 8 chars
}

export function saveRoom(room: Room): void {
  rooms.set(room.id, room)
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id)
}

export function updateRoom(
  id: string,
  patch: Partial<Pick<Room, 'cols' | 'rows' | 'songs' | 'playlistKey' | 'roundId'>>,
): Room | undefined {
  const room = rooms.get(id)
  if (!room) return undefined
  const layoutChanged =
    (patch.cols != null && patch.cols !== room.cols) ||
    (patch.rows != null && patch.rows !== room.rows) ||
    (patch.songs != null && patch.songs !== room.songs)

  const next: Room = {
    ...room,
    ...patch,
    assignedCardKeys: layoutChanged ? new Set() : room.assignedCardKeys,
    updatedAt: new Date().toISOString(),
  }
  rooms.set(id, next)
  return next
}

export function startRoomRound(id: string): Room | undefined {
  const room = rooms.get(id)
  if (!room) return undefined
  const next: Room = {
    ...room,
    roundId: room.roundId + 1,
    updatedAt: new Date().toISOString(),
  }
  rooms.set(id, next)
  return next
}

export function dealUniqueCard(room: Room): CardGrid {
  const layout = { cols: room.cols, rows: room.rows }
  const maxAttempts = 250

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = dealTraditionalCard(room.songs, layout)
    const key = cardFingerprint(grid)
    if (room.assignedCardKeys.has(key)) continue
    room.assignedCardKeys.add(key)
    room.updatedAt = new Date().toISOString()
    return grid
  }

  throw new Error(
    'No hay más cartones únicos disponibles para esta sala. Pide al tombolero más canciones o menos jugadores.',
  )
}

export function registerCardBatch(roomId: string, fingerprints: string[]): boolean {
  const room = rooms.get(roomId)
  if (!room) return false
  for (const fp of fingerprints) {
    room.assignedCardKeys.add(fp)
  }
  room.updatedAt = new Date().toISOString()
  return true
}

export function releaseCardAssignment(roomId: string, grid: CardGrid): boolean {
  const room = rooms.get(roomId)
  if (!room) return false
  return room.assignedCardKeys.delete(cardFingerprint(grid))
}

export type PublicRoom = {
  id: string
  cols: number
  rows: number
  roundId: number
  songCount: number
  playlistKey: string
  assignedCount: number
}

export function toPublicRoom(room: Room): PublicRoom {
  return {
    id: room.id,
    cols: room.cols,
    rows: room.rows,
    roundId: room.roundId,
    songCount: room.songs.length,
    playlistKey: room.playlistKey,
    assignedCount: room.assignedCardKeys.size,
  }
}

export type DealtCardResponse = {
  roomId: string
  roundId: number
  cols: number
  rows: number
  grid: CardGrid
  songs: ShareSong[]
}
