import type { CardGrid, CardLayout, PlaylistCardPack } from '../types'

const STORAGE_KEY = 'bingo-musical-card-packs'

type PackStore = Record<string, PlaylistCardPack>

function readStore(): PackStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PackStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: PackStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function playlistKeyFromInput(playlistInput: string): string {
  return playlistInput.trim().toLowerCase()
}

export function loadCardPack(playlistKey: string): PlaylistCardPack | null {
  const pack = readStore()[playlistKey]
  return pack ?? null
}

export function saveCardPack(
  playlistKey: string,
  layout: CardLayout,
  cards: CardGrid[],
): PlaylistCardPack {
  const pack: PlaylistCardPack = {
    playlistKey,
    cols: layout.cols,
    rows: layout.rows,
    cards,
    updatedAt: new Date().toISOString(),
  }
  const store = readStore()
  store[playlistKey] = pack
  writeStore(store)
  return pack
}
