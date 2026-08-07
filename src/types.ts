export type Song = {
  videoId: string
  title: string
  channelTitle: string
  /** 1-based position in the original YouTube playlist (before round shuffle). */
  playlistIndex: number
}

export type RoundState = {
  songs: Song[]
  /** Shuffled indices into `songs` */
  order: number[]
  /** Position in `order` (0-based). Meaningful only after the round has started. */
  currentIndex: number
  roundStarted: boolean
}

export type CardLayout = {
  cols: number
  rows: number
}

/** One card: rows × cols of playlistIndex values. */
export type CardGrid = number[][]

export type PlaylistCardPack = {
  playlistKey: string
  cols: number
  rows: number
  /** Each card is a grid of playlistIndex numbers. */
  cards: CardGrid[]
  updatedAt: string
}
