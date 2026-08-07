import type { Song } from '../types'

type PlaylistItemSnippet = {
  title?: string
  channelTitle?: string
  resourceId?: {
    kind?: string
    videoId?: string
  }
}

type PlaylistItemsResponse = {
  nextPageToken?: string
  items?: Array<{
    snippet?: PlaylistItemSnippet
  }>
  error?: {
    message?: string
    errors?: Array<{ reason?: string; message?: string }>
  }
}

/**
 * Accepts full playlist URLs, `list=` query fragments, or raw IDs (PL… / UU… / LL… / OL…).
 */
export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const list = url.searchParams.get('list')
    if (list) return list
  } catch {
    // not a full URL — keep going
  }

  const listMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/)
  if (listMatch) return listMatch[1]

  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed

  return null
}

function isUsableItem(snippet: PlaylistItemSnippet | undefined): snippet is PlaylistItemSnippet & {
  resourceId: { videoId: string }
} {
  const videoId = snippet?.resourceId?.videoId
  if (!videoId) return false
  const title = snippet.title ?? ''
  // YouTube uses these placeholders for unavailable videos
  if (title === 'Private video' || title === 'Deleted video') return false
  return true
}

export async function fetchPlaylistSongs(
  playlistId: string,
  apiKey: string,
): Promise<Song[]> {
  const songs: Song[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: '50',
      playlistId,
      key: apiKey,
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
    )
    const data = (await response.json()) as PlaylistItemsResponse

    if (!response.ok || data.error) {
      const reason = data.error?.errors?.[0]?.reason
      const message = data.error?.message ?? response.statusText
      if (reason === 'playlistNotFound' || response.status === 404) {
        throw new Error('No se encontró la playlist. Comprueba que sea pública y el enlace sea correcto.')
      }
      if (reason === 'keyInvalid' || reason === 'ipRefererBlocked') {
        throw new Error('API Key inválida o bloqueada por restricciones. Revisa la key y los referrers permitidos.')
      }
      throw new Error(message || 'Error al cargar la playlist de YouTube.')
    }

    for (const item of data.items ?? []) {
      const snippet = item.snippet
      if (!isUsableItem(snippet)) continue
      songs.push({
        videoId: snippet.resourceId.videoId,
        title: snippet.title?.trim() || 'Sin título',
        channelTitle: snippet.channelTitle?.trim() || '',
        playlistIndex: songs.length + 1,
      })
    }

    pageToken = data.nextPageToken
  } while (pageToken)

  // Deduplicate by videoId (playlists can repeat tracks); keep first index
  const seen = new Set<string>()
  const unique = songs.filter((song) => {
    if (seen.has(song.videoId)) return false
    seen.add(song.videoId)
    return true
  })

  if (unique.length === 0) {
    throw new Error('La playlist no tiene videos reproducibles.')
  }

  return unique
}

/** Keep at most `maxSongs` entries in playlist order (empty/invalid max = all). */
export function limitSongs(songs: Song[], maxSongs: number | null): Song[] {
  if (maxSongs == null || !Number.isFinite(maxSongs) || maxSongs <= 0) {
    return songs
  }
  return songs.slice(0, Math.floor(maxSongs))
}
