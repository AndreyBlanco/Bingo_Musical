import type { ShareSong } from './sharePool'

export type SongDisplay = {
  /** Song title when we can separate it; otherwise the full video name. */
  title: string
  /** Artist/author when available. */
  artist: string | null
}

/**
 * Prefer "title + artist". If we can't resolve an artist, fall back to the video name only.
 */
export function getSongDisplay(song: Pick<ShareSong, 'title'> & { channelTitle?: string }): SongDisplay {
  const videoName = song.title.trim() || 'Sin título'
  const channel = song.channelTitle?.trim() || ''

  const dashed = videoName.split(/\s[-–—]\s+/).map((part) => part.trim()).filter(Boolean)
  if (dashed.length >= 2) {
    const artist = dashed[0]
    const title = dashed.slice(1).join(' - ')
    if (artist && title) {
      return { title, artist }
    }
  }

  if (channel) {
    return { title: videoName, artist: channel }
  }

  return { title: videoName, artist: null }
}

export function formatSongCell(song: Pick<ShareSong, 'title'> & { channelTitle?: string } | undefined): {
  title: string
  artist: string | null
} {
  if (!song) return { title: '—', artist: null }
  return getSongDisplay(song)
}
