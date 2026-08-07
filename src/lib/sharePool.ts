import type { CardLayout, Song } from '../types'

/** Compact song stored in room API / legacy share payloads. */
export type ShareSong = {
  videoId: string
  title: string
  playlistIndex: number
  channelTitle?: string
}

export type SharePayloadV1 = {
  v: 1
  cols: number
  rows: number
  songs: ShareSong[]
}

export function toShareSongs(songs: Song[]): ShareSong[] {
  return songs.map(({ videoId, title, playlistIndex, channelTitle }) => ({
    videoId,
    title,
    playlistIndex,
    channelTitle,
  }))
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (padded.length % 4)) % 4
  const base64 = padded + '='.repeat(padLength)
  const binary = atob(base64)
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
}

export function encodeSharePayload(payload: SharePayloadV1): string {
  const compact = {
    v: 1 as const,
    c: payload.cols,
    r: payload.rows,
    s: payload.songs.map((song) => [
      song.videoId,
      song.playlistIndex,
      song.title,
      song.channelTitle ?? '',
    ]),
  }
  const json = JSON.stringify(compact)
  return toBase64Url(new TextEncoder().encode(json))
}

export function decodeSharePayload(encoded: string): SharePayloadV1 {
  const json = new TextDecoder().decode(fromBase64Url(encoded))
  const data = JSON.parse(json) as unknown

  // Legacy format: bare array of [videoId, playlistIndex, title]
  if (Array.isArray(data)) {
    const songs = data.map((row, i) => parseSongRow(row, i))
    return { v: 1, cols: 3, rows: 3, songs }
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Formato de cartón inválido.')
  }

  const obj = data as Record<string, unknown>
  const cols = Number(obj.c ?? obj.cols ?? 3)
  const rows = Number(obj.r ?? obj.rows ?? 3)
  const rawSongs = obj.s ?? obj.songs
  if (!Array.isArray(rawSongs)) throw new Error('El enlace no trae canciones.')

  return {
    v: 1,
    cols,
    rows,
    songs: rawSongs.map((row, i) => parseSongRow(row, i)),
  }
}

function parseSongRow(row: unknown, i: number): ShareSong {
  if (!Array.isArray(row) || row.length < 3) {
    throw new Error(`Canción inválida en la posición ${i + 1}.`)
  }
  const [videoId, playlistIndex, title, channelTitle] = row
  if (typeof videoId !== 'string' || typeof title !== 'string') {
    throw new Error(`Canción inválida en la posición ${i + 1}.`)
  }
  const index = Number(playlistIndex)
  if (!Number.isFinite(index) || index < 1) {
    throw new Error(`Índice inválido en la posición ${i + 1}.`)
  }
  return {
    videoId,
    title,
    playlistIndex: index,
    channelTitle: typeof channelTitle === 'string' ? channelTitle : '',
  }
}

export function buildCartonShareUrl(songs: Song[], layout: CardLayout): string {
  const encoded = encodeSharePayload({
    v: 1,
    cols: layout.cols,
    rows: layout.rows,
    songs: toShareSongs(songs),
  })
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = `#/carton/${encoded}`
  return url.toString()
}

export function parseCartonHash(hash: string): string | null {
  const match = hash.match(/^#\/carton\/([A-Za-z0-9_-]+)/)
  return match?.[1] ?? null
}
