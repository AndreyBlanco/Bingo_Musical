import type { Song } from '../types'

type CalledListProps = {
  songs: Song[]
  /** Inclusive index in the call order; ignored when round has not started. */
  currentIndex: number
  roundStarted: boolean
}

export function CalledList({ songs, currentIndex, roundStarted }: CalledListProps) {
  if (!roundStarted || songs.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel__title">Ya salieron</h2>
        <p className="panel__empty">Aún no hay canciones cantadas.</p>
      </div>
    )
  }

  const called = songs.slice(0, currentIndex + 1).reverse()

  return (
    <div className="panel">
      <h2 className="panel__title">Ya salieron</h2>
      <ol className="called-list">
        {called.map((song, reverseIdx) => {
          const isCurrent = reverseIdx === 0
          return (
            <li
              key={`${song.videoId}-${song.playlistIndex}-${reverseIdx}`}
              className={
                isCurrent ? 'called-list__item called-list__item--current' : 'called-list__item'
              }
            >
              <span className="called-list__num">{song.playlistIndex}</span>
              <span className="called-list__title">{song.title}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
