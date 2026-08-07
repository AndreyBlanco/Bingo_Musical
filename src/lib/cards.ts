import type { CardGrid, CardLayout, Song } from '../types'
import type { ShareSong } from './sharePool'
import { shuffle } from './shuffle'

export type ColumnRange = {
  /** Inclusive playlistIndex start (1-based). */
  from: number
  /** Inclusive playlistIndex end (1-based). */
  to: number
  /** Songs in this column block, sorted by playlistIndex. */
  songs: ShareSong[]
}

/**
 * Split songs into column blocks (traditional bingo).
 * First columns get floor(n/cols); remainder goes entirely to the last column.
 */
export function buildColumnBlocks(
  pool: ShareSong[],
  cols: number,
): ColumnRange[] {
  if (cols < 1) throw new Error('Se necesita al menos 1 columna.')
  const sorted = [...pool].sort((a, b) => a.playlistIndex - b.playlistIndex)
  const n = sorted.length
  if (n === 0) return []

  const base = Math.floor(n / cols)
  const remainder = n % cols
  const blocks: ColumnRange[] = []
  let offset = 0

  for (let c = 0; c < cols; c++) {
    const size = c === cols - 1 ? base + remainder : base
    const slice = sorted.slice(offset, offset + size)
    if (slice.length === 0) {
      throw new Error(
        `La columna ${c + 1} quedó vacía. Usa menos columnas o más canciones.`,
      )
    }
    blocks.push({
      from: slice[0].playlistIndex,
      to: slice[slice.length - 1].playlistIndex,
      songs: slice,
    })
    offset += size
  }

  return blocks
}

export function validateLayoutForPool(
  pool: ShareSong[],
  layout: CardLayout,
): string | null {
  const { cols, rows } = layout
  if (!Number.isInteger(cols) || cols < 1 || cols > 10) {
    return 'Las columnas deben ser un entero entre 1 y 10.'
  }
  if (!Number.isInteger(rows) || rows < 1 || rows > 10) {
    return 'Las filas deben ser un entero entre 1 y 10.'
  }
  if (pool.length < cols * rows) {
    return `Necesitas al menos ${cols * rows} canciones para un cartón ${cols}×${rows}.`
  }
  try {
    const blocks = buildColumnBlocks(pool, cols)
    for (let c = 0; c < blocks.length; c++) {
      if (blocks[c].songs.length < rows) {
        return `La columna ${c + 1} solo tiene ${blocks[c].songs.length} canciones; se necesitan ${rows} por columna.`
      }
    }
  } catch (err) {
    return err instanceof Error ? err.message : 'No se pudo armar el esquema de columnas.'
  }
  return null
}

/** Deal one traditional card: each column picks `rows` songs from its block. */
export function dealTraditionalCard(
  pool: ShareSong[],
  layout: CardLayout,
): CardGrid {
  const error = validateLayoutForPool(pool, layout)
  if (error) throw new Error(error)

  const blocks = buildColumnBlocks(pool, layout.cols)
  const columnPicks: number[][] = blocks.map((block) => {
    const picks = shuffle(block.songs)
      .slice(0, layout.rows)
      .map((s) => s.playlistIndex)
      .sort((a, b) => a - b)
    return picks
  })

  const grid: CardGrid = []
  for (let r = 0; r < layout.rows; r++) {
    const row: number[] = []
    for (let c = 0; c < layout.cols; c++) {
      row.push(columnPicks[c][r])
    }
    grid.push(row)
  }
  return grid
}

export function dealManyCards(
  pool: ShareSong[],
  layout: CardLayout,
  count: number,
): CardGrid[] {
  if (count < 1) return []
  const cards: CardGrid[] = []
  const seen = new Set<string>()
  let attempts = 0
  const maxAttempts = count * 40

  while (cards.length < count && attempts < maxAttempts) {
    attempts++
    const grid = dealTraditionalCard(pool, layout)
    const key = grid.flat().join(',')
    if (seen.has(key)) continue
    seen.add(key)
    cards.push(grid)
  }

  if (cards.length < count) {
    throw new Error(
      `Solo se pudieron generar ${cards.length} cartones únicos de ${count} pedidos. Prueba con menos cartones o más canciones.`,
    )
  }

  return cards
}

export function songsToSharePool(songs: Song[]): ShareSong[] {
  return songs.map(({ videoId, title, playlistIndex, channelTitle }) => ({
    videoId,
    title,
    playlistIndex,
    channelTitle,
  }))
}

export function resolveSongMap(pool: ShareSong[]): Map<number, ShareSong> {
  return new Map(pool.map((s) => [s.playlistIndex, s]))
}

export function flattenCard(grid: CardGrid): number[] {
  return grid.flat()
}

/** Stable fingerprint so two identical boards compare equal. */
export function cardFingerprint(grid: CardGrid): string {
  return grid.map((row) => row.join(',')).join('|')
}

export function describeColumnBlocks(pool: ShareSong[], cols: number): string {
  try {
    return buildColumnBlocks(pool, cols)
      .map((b, i) => `Col ${i + 1}: ${b.from}–${b.to}`)
      .join(' · ')
  } catch {
    return ''
  }
}
