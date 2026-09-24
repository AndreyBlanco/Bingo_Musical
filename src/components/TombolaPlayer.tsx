import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardLayout, Song } from '../types'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'
import {
  dealManyCards,
  describeColumnBlocks,
  resolveSongMap,
  songsToSharePool,
  validateLayoutForPool,
} from '../lib/cards'
import { playlistKeyFromInput, saveCardPack, loadCardPack } from '../lib/cardStore'
import { downloadCardsPdf } from '../lib/pdfCards'
import {
  buildRoomShareUrl,
  createRoom,
  registerPrintedCards,
  startRoomRound,
  updateRoom,
} from '../lib/roomApi'
import { toShareSongs } from '../lib/sharePool'
import {
  loadStoredCardCols,
  loadStoredCardRows,
  loadStoredPrintCount,
  saveCardLayout,
  savePrintCount,
} from '../lib/storage'
import { CalledList } from './CalledList'
import { QrCodeImage } from './QrCodeImage'

type TombolaPlayerProps = {
  playlistLabel: string
  poolSongs: Song[]
  orderedSongs: Song[]
  currentIndex: number
  roundStarted: boolean
  onStartRound: () => void
  onNext: () => void
  onNewRound: () => void
  onChangePlaylist: () => void
}

export function TombolaPlayer({
  playlistLabel,
  poolSongs,
  orderedSongs,
  currentIndex,
  roundStarted,
  onStartRound,
  onNext,
  onNewRound,
  onChangePlaylist,
}: TombolaPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'error'>('idle')
  const [cols, setCols] = useState(() => loadStoredCardCols())
  const [rows, setRows] = useState(() => loadStoredCardRows())
  const [printCount, setPrintCount] = useState(() => loadStoredPrintCount())
  const [packMessage, setPackMessage] = useState<string | null>(null)
  const [packError, setPackError] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [roomError, setRoomError] = useState<string | null>(null)
  const [roomSyncing, setRoomSyncing] = useState(false)
  const [starting, setStarting] = useState(false)

  const total = orderedSongs.length
  const current = orderedSongs[currentIndex] ?? null
  const isLast = roundStarted && currentIndex >= total - 1
  const remaining = roundStarted ? Math.max(0, total - currentIndex - 1) : total

  const layout: CardLayout = useMemo(() => ({ cols, rows }), [cols, rows])
  const sharePool = useMemo(() => toShareSongs(poolSongs), [poolSongs])
  const layoutError = useMemo(
    () => validateLayoutForPool(sharePool, layout),
    [sharePool, layout],
  )
  const blockSummary = useMemo(
    () => (layoutError ? '' : describeColumnBlocks(sharePool, cols)),
    [sharePool, cols, layoutError],
  )

  const activeVideoId = roundStarted ? (current?.videoId ?? null) : null

  const { toggle, isPlaying, error: playerError, ready, stop } = useYouTubePlayer({
    containerRef,
    videoId: activeVideoId,
    autoplay: true,
  })

  const existingPack = useMemo(
    () => loadCardPack(playlistKeyFromInput(playlistLabel)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playlistLabel, packMessage],
  )

  const roomIdRef = useRef<string | null>(null)
  roomIdRef.current = roomId

  useEffect(() => {
    if (!roomId) {
      setShareUrl('')
      return
    }
    let cancelled = false
    void buildRoomShareUrl(roomId).then((url) => {
      if (!cancelled) setShareUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [roomId])

  useEffect(() => {
    if (layoutError) {
      setRoomError(layoutError)
      return
    }

    let cancelled = false

    async function syncRoom() {
      setRoomSyncing(true)
      setRoomError(null)
      try {
        const payload = {
          playlistKey: playlistKeyFromInput(playlistLabel),
          layout,
          songs: sharePool,
        }
        const existingId = roomIdRef.current
        let room
        try {
          room = existingId
            ? await updateRoom(existingId, payload)
            : await createRoom(payload)
        } catch (err) {
          // Sala perdida tras reinicio de API: crear una nueva
          if (existingId) {
            room = await createRoom(payload)
          } else {
            throw err
          }
        }
        if (!cancelled) {
          setRoomId(room.id)
          roomIdRef.current = room.id
        }
      } catch (err) {
        if (!cancelled) {
          setRoomError(
            err instanceof Error
              ? err.message
              : 'No se pudo publicar la sala. ¿Está corriendo la API?',
          )
        }
      } finally {
        if (!cancelled) setRoomSyncing(false)
      }
    }

    void syncRoom()
    return () => {
      cancelled = true
    }
  }, [playlistLabel, sharePool, layout, layoutError])

  function handleNewRound() {
    const ok = window.confirm(
      '¿Iniciar una nueva ronda? Se limpiará el historial y se barajará de nuevo la lista.',
    )
    if (!ok) return
    stop()
    onNewRound()
  }

  async function handleStartRound() {
    if (!roomId) {
      setRoomError('Espera a que la sala esté lista antes de iniciar.')
      return
    }
    setStarting(true)
    setRoomError(null)
    try {
      await startRoomRound(roomId)
      onStartRound()
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'No se pudo iniciar la ronda en la API.')
    } finally {
      setStarting(false)
    }
  }

  function persistLayout(nextCols: number, nextRows: number) {
    setCols(nextCols)
    setRows(nextRows)
    saveCardLayout(nextCols, nextRows)
    setPackError(null)
  }

  async function handleCopyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('ok')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2500)
    }
  }

  async function handleGeneratePdf() {
    setPackError(null)
    setPackMessage(null)

    if (layoutError) {
      setPackError(layoutError)
      return
    }

    const count = Math.floor(printCount)
    if (!Number.isFinite(count) || count < 1 || count > 200) {
      setPackError('Indica entre 1 y 200 cartones para el PDF.')
      return
    }

    let cards: ReturnType<typeof dealManyCards>
    try {
      cards = dealManyCards(songsToSharePool(poolSongs), layout, count)
    } catch (err) {
      setPackError(err instanceof Error ? err.message : 'No se pudo generar el PDF.')
      return
    }

    const key = playlistKeyFromInput(playlistLabel)
    saveCardPack(key, layout, cards)
    savePrintCount(count)

    let registrationWarning: string | null = null
    if (roomId) {
      try {
        await registerPrintedCards(roomId, cards)
      } catch {
        registrationWarning =
          'El PDF fue descargado, pero los cartones impresos no pudieron registrarse en el servidor. Pueden coincidir con cartones digitales.'
      }
    } else {
      registrationWarning =
        'El PDF fue descargado sin sala activa. Los cartones impresos no están registrados y pueden coincidir con cartones digitales.'
    }

    downloadCardsPdf({
      cards,
      layout,
      songByIndex: resolveSongMap(sharePool),
      playlistLabel,
    })

    if (registrationWarning) {
      setPackError(registrationWarning)
    } else {
      setPackMessage(
        `PDF listo: ${cards.length} cartones (${cols}×${rows}) guardados para esta playlist.`,
      )
    }
  }

  return (
    <section className="tombola">
      <header className="tombola__header">
        <div>
          <p className="tombola__eyebrow">Bingo Musical</p>
          <h1 className="tombola__brand">Tómbola</h1>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onChangePlaylist}>
          Cambiar playlist
        </button>
      </header>

      <p className="tombola__meta" title={playlistLabel}>
        {total} canciones · {playlistLabel}
      </p>

      <div className="tombola__stage">
        <div className={`player-wrap ${roundStarted ? '' : 'player-wrap--hidden'}`}>
          <div className="player-shell" ref={containerRef} />
          {roundStarted && !ready ? (
            <div className="player-shell__loading">Preparando reproductor…</div>
          ) : null}
        </div>

        {!roundStarted ? (
          <div className="round-gate">
            <p className="round-gate__eyebrow">Ronda lista</p>
            <h2 className="round-gate__title">Esperando tu orden</h2>
            <p className="round-gate__text">
              La lista ya está barajada. Cuando el grupo esté listo, inicia la ronda para sacar la
              primera canción.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--xl"
              onClick={() => void handleStartRound()}
              disabled={starting || !roomId || Boolean(layoutError)}
            >
              {starting ? 'Iniciando…' : 'Iniciar ronda'}
            </button>
            <button type="button" className="btn btn--accent btn--lg" onClick={handleNewRound}>
              Volver a barajar
            </button>
          </div>
        ) : (
          <>
            <div className="now-playing">
              <p className="now-playing__label">
                Canción {currentIndex + 1} de {total}
                {current ? ` · #${current.playlistIndex} en playlist` : ''}
              </p>
              <h2 className="now-playing__title">{current?.title ?? '—'}</h2>
              {current?.channelTitle ? (
                <p className="now-playing__channel">{current.channelTitle}</p>
              ) : null}
            </div>

            {playerError ? (
              <p className="banner banner--error" role="alert">
                {playerError}
              </p>
            ) : null}

            <div className="controls">
              <button
                type="button"
                className="btn btn--secondary btn--lg"
                onClick={toggle}
                disabled={!current}
              >
                {isPlaying ? 'Pausa' : 'Reanudar'}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={onNext}
                disabled={!current || isLast}
              >
                Siguiente
              </button>
              <button type="button" className="btn btn--accent btn--lg" onClick={handleNewRound}>
                Nueva ronda
              </button>
            </div>

            <p className="tombola__remaining">
              {isLast
                ? 'Última canción de la ronda'
                : `${remaining} canción${remaining === 1 ? '' : 'es'} por salir`}
            </p>
          </>
        )}
      </div>

      <div className="panel panel--share">
        <h2 className="panel__title">Cartones</h2>

        <div className="layout-fields">
          <label className="field">
            <span className="field__label">Columnas</span>
            <input
              className="field__input"
              type="number"
              min={1}
              max={10}
              value={cols}
              onChange={(e) => persistLayout(Number(e.target.value) || 1, rows)}
            />
          </label>
          <label className="field">
            <span className="field__label">Filas</span>
            <input
              className="field__input"
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(e) => persistLayout(cols, Number(e.target.value) || 1)}
            />
          </label>
          <label className="field">
            <span className="field__label">Cartones en PDF</span>
            <input
              className="field__input"
              type="number"
              min={1}
              max={200}
              value={printCount}
              onChange={(e) => setPrintCount(Number(e.target.value) || 1)}
            />
          </label>
        </div>

        {blockSummary ? <p className="share-hint">{blockSummary}</p> : null}
        {layoutError ? (
          <p className="banner banner--error" role="alert">
            {layoutError}
          </p>
        ) : (
          <p className="panel__empty">
            El QR usa la IP de red en local para que los celulares entren fácil.
            {roomSyncing ? ' Publicando sala…' : roomId ? ` Sala ${roomId}` : ''}
            {shareUrl ? ` · ${shareUrl.replace(/^https?:\/\//, '').split('#')[0]}` : ''}
          </p>
        )}

        <div className="share-row">
          {shareUrl ? <QrCodeImage value={shareUrl} size={160} /> : null}
          <div className="share-actions">
            <button
              type="button"
              className="btn btn--secondary btn--lg"
              onClick={() => void handleCopyLink()}
              disabled={!shareUrl}
            >
              {copyState === 'ok'
                ? 'Enlace copiado'
                : copyState === 'error'
                  ? 'No se pudo copiar'
                  : 'Copiar enlace digital'}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => void handleGeneratePdf()}
              disabled={Boolean(layoutError)}
            >
              Descargar PDF (Carta)
            </button>
            <p className="share-hint">
              2 cartones por página (Carta). PDF local; cartones digitales vía API.
            </p>
            {existingPack ? (
              <p className="share-hint">
                Último pack PDF: {existingPack.cards.length} cartones · {existingPack.cols}×
                {existingPack.rows}
              </p>
            ) : null}
          </div>
        </div>

        {roomError ? (
          <p className="banner banner--error" role="alert">
            {roomError}
          </p>
        ) : null}
        {packError ? (
          <p className="banner banner--error" role="alert">
            {packError}
          </p>
        ) : null}
        {packMessage ? <p className="banner banner--ok">{packMessage}</p> : null}
      </div>

      <CalledList songs={orderedSongs} currentIndex={currentIndex} roundStarted={roundStarted} />
    </section>
  )
}
