import { useEffect, useMemo, useState } from 'react'
import type { CardGrid, CardLayout } from '../types'
import { resolveSongMap } from '../lib/cards'
import { dealRoomCard, fetchRoom, releaseRoomCard } from '../lib/roomApi'
import { formatSongCell } from '../lib/songDisplay'
import type { ShareSong } from '../lib/sharePool'

type PlayerCardProps = {
  roomId: string
}

export function PlayerCard({ roomId }: PlayerCardProps) {
  const [error, setError] = useState<string | null>(null)
  const [pool, setPool] = useState<ShareSong[] | null>(null)
  const [layout, setLayout] = useState<CardLayout>({ cols: 3, rows: 3 })
  const [activeCard, setActiveCard] = useState<CardGrid | null>(null)
  const [pendingCard, setPendingCard] = useState<CardGrid | null>(null)
  const [pendingAfterRound, setPendingAfterRound] = useState<number | null>(null)
  const [roomRoundId, setRoomRoundId] = useState(0)
  const [marked, setMarked] = useState<Set<number>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadInitialCard() {
      setLoading(true)
      setError(null)
      try {
        const dealt = await dealRoomCard(roomId)
        if (cancelled) return
        setPool(dealt.songs)
        setLayout({ cols: dealt.cols, rows: dealt.rows })
        setActiveCard(dealt.grid)
        setRoomRoundId(dealt.roundId)
        setPendingCard(null)
        setPendingAfterRound(null)
        setMarked(new Set())
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo asignar el cartón.')
          setPool(null)
          setActiveCard(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadInitialCard()
    return () => {
      cancelled = true
    }
  }, [roomId])

  useEffect(() => {
    if (!pendingCard || pendingAfterRound == null) return

    let cancelled = false

    async function poll() {
      try {
        const room = await fetchRoom(roomId)
        if (cancelled) return
        setRoomRoundId(room.roundId)
      } catch {
        // keep polling
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pendingCard, pendingAfterRound, roomId])

  const songByIndex = useMemo(
    () => (pool ? resolveSongMap(pool) : new Map<number, ShareSong>()),
    [pool],
  )

  const canActivatePending =
    Boolean(pendingCard) &&
    pendingAfterRound != null &&
    roomRoundId > pendingAfterRound

  function toggleMark(playlistIndex: number) {
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(playlistIndex)) next.delete(playlistIndex)
      else next.add(playlistIndex)
      return next
    })
  }

  function handleClearCard() {
    setMarked(new Set())
  }

  async function handleRequestNewCard() {
    setRequesting(true)
    setError(null)
    try {
      const room = await fetchRoom(roomId)
      const dealt = await dealRoomCard(roomId)
      setPool(dealt.songs)
      setLayout({ cols: dealt.cols, rows: dealt.rows })
      setPendingCard(dealt.grid)
      setPendingAfterRound(room.roundId)
      setRoomRoundId(dealt.roundId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pedir otro cartón.')
    } finally {
      setRequesting(false)
    }
  }

  async function handleActivatePending() {
    if (!pendingCard || !canActivatePending || !activeCard) return
    const ok = window.confirm(
      '¿Activar el cartón nuevo? Se limpiarán las marcas del cartón actual.',
    )
    if (!ok) return

    const previous = activeCard
    setActiveCard(pendingCard)
    setPendingCard(null)
    setPendingAfterRound(null)
    setMarked(new Set())

    try {
      await releaseRoomCard(roomId, previous)
    } catch {
      // El cartón nuevo ya está activo; la liberación es best-effort.
    }
  }

  if (error && !activeCard) {
    return (
      <section className="carton">
        <header className="carton__header">
          <p className="carton__eyebrow">Bingo Musical</p>
          <h1 className="carton__brand">Tu cartón</h1>
        </header>
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      </section>
    )
  }

  if (loading || !pool || !activeCard) {
    return (
      <section className="carton">
        <p className="carton__loading">Asignando cartón…</p>
      </section>
    )
  }

  const flat = activeCard.flat()
  const markedCount = flat.filter((idx) => marked.has(idx)).length

  return (
    <section className="carton">
      <header className="carton__header">
        <p className="carton__eyebrow">Bingo Musical</p>
        <h1 className="carton__brand">Tu cartón</h1>
        <p className="carton__lede">
          {layout.cols}×{layout.rows} · Marca al oír cada canción. Si cantas Bingo, limpia el
          cartón como en el físico.
        </p>
      </header>

      {pendingCard ? (
        <p className="banner banner--warn" role="status">
          {canActivatePending
            ? 'La siguiente ronda ya inició. Puedes activar tu cartón nuevo.'
            : 'Pediste un cartón nuevo. Sigue con el actual; se habilitará al iniciar la siguiente ronda.'}
        </p>
      ) : null}

      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="carton-grid"
        style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}
      >
        {activeCard.map((row, r) =>
          row.map((playlistIndex, c) => {
            const display = formatSongCell(songByIndex.get(playlistIndex))
            const isMarked = marked.has(playlistIndex)
            return (
              <button
                key={`${r}-${c}-${playlistIndex}`}
                type="button"
                className={isMarked ? 'carton-cell carton-cell--marked' : 'carton-cell'}
                onClick={() => toggleMark(playlistIndex)}
                aria-pressed={isMarked}
              >
                <span className="carton-cell__num">#{playlistIndex}</span>
                <span className="carton-cell__title">{display.title}</span>
                {display.artist ? (
                  <span className="carton-cell__artist">{display.artist}</span>
                ) : null}
              </button>
            )
          }),
        )}
      </div>

      <p className="carton__progress">
        Marcadas {markedCount} de {flat.length}
      </p>

      <div className="carton__actions">
        <button
          type="button"
          className="btn btn--primary btn--xl"
          onClick={handleClearCard}
          disabled={markedCount === 0}
        >
          Limpiar cartón
        </button>
        {pendingCard ? (
          <button
            type="button"
            className="btn btn--accent btn--lg"
            onClick={() => void handleActivatePending()}
            disabled={!canActivatePending}
          >
            {canActivatePending
              ? 'Activar cartón nuevo'
              : 'Esperando siguiente ronda…'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--secondary btn--lg"
            onClick={() => void handleRequestNewCard()}
            disabled={requesting}
          >
            {requesting ? 'Pidiendo…' : 'Otro cartón'}
          </button>
        )}
      </div>
    </section>
  )
}
