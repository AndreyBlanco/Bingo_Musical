const STORAGE_KEYS = {
  apiKey: 'bingo-musical-api-key',
  playlist: 'bingo-musical-playlist',
  maxSongs: 'bingo-musical-max-songs',
  cardCols: 'bingo-musical-card-cols',
  cardRows: 'bingo-musical-card-rows',
  printCount: 'bingo-musical-print-count',
} as const

export function loadStoredApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.apiKey) ?? ''
  } catch {
    return ''
  }
}

export function saveApiKey(apiKey: string): void {
  try {
    if (apiKey.trim()) {
      localStorage.setItem(STORAGE_KEYS.apiKey, apiKey.trim())
    } else {
      localStorage.removeItem(STORAGE_KEYS.apiKey)
    }
  } catch {
    // ignore quota / private mode
  }
}

export function loadStoredPlaylist(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.playlist) ?? ''
  } catch {
    return ''
  }
}

export function savePlaylist(playlist: string): void {
  try {
    if (playlist.trim()) {
      localStorage.setItem(STORAGE_KEYS.playlist, playlist.trim())
    } else {
      localStorage.removeItem(STORAGE_KEYS.playlist)
    }
  } catch {
    // ignore
  }
}

export function loadStoredMaxSongs(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.maxSongs) ?? ''
  } catch {
    return ''
  }
}

export function saveMaxSongs(maxSongs: string): void {
  try {
    const trimmed = maxSongs.trim()
    if (trimmed) {
      localStorage.setItem(STORAGE_KEYS.maxSongs, trimmed)
    } else {
      localStorage.removeItem(STORAGE_KEYS.maxSongs)
    }
  } catch {
    // ignore
  }
}

export function loadStoredCardCols(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEYS.cardCols) ?? '5')
    return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 5
  } catch {
    return 5
  }
}

export function loadStoredCardRows(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEYS.cardRows) ?? '5')
    return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 5
  } catch {
    return 5
  }
}

export function saveCardLayout(cols: number, rows: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.cardCols, String(cols))
    localStorage.setItem(STORAGE_KEYS.cardRows, String(rows))
  } catch {
    // ignore
  }
}

export function loadStoredPrintCount(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEYS.printCount) ?? '20')
    return Number.isInteger(n) && n >= 1 && n <= 200 ? n : 20
  } catch {
    return 20
  }
}

export function savePrintCount(count: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.printCount, String(count))
  } catch {
    // ignore
  }
}

export function parseMaxSongsInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

export function resolveApiKey(formValue: string): string {
  const fromForm = formValue.trim()
  if (fromForm) return fromForm

  const fromEnv = import.meta.env.VITE_YOUTUBE_API_KEY
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()

  return loadStoredApiKey()
}

export function hasEnvApiKey(): boolean {
  const fromEnv = import.meta.env.VITE_YOUTUBE_API_KEY
  return typeof fromEnv === 'string' && fromEnv.trim().length > 0
}
