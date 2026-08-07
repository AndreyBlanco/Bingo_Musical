import { useEffect, useMemo, useState } from 'react'
import { PlayerCard } from './components/PlayerCard'
import { SetupForm, type SetupValues } from './components/SetupForm'
import { TombolaPlayer } from './components/TombolaPlayer'
import { shuffleIndices } from './lib/shuffle'
import { parseRoomIdFromHash } from './lib/roomApi'
import {
  parseMaxSongsInput,
  resolveApiKey,
  saveApiKey,
  saveMaxSongs,
  savePlaylist,
} from './lib/storage'
import { fetchPlaylistSongs, limitSongs, parsePlaylistId } from './lib/youtubeApi'
import type { Song } from './types'

type Phase = 'setup' | 'playing'

function readRoomId(): string | null {
  return parseRoomIdFromHash(window.location.hash)
}

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(() => readRoomId())
  const [phase, setPhase] = useState<Phase>('setup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlistInput, setPlaylistInput] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [order, setOrder] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [roundStarted, setRoundStarted] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)

  useEffect(() => {
    function onHashChange() {
      setRoomId(readRoomId())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const orderedSongs = useMemo(
    () => order.map((songIndex) => songs[songIndex]).filter(Boolean) as Song[],
    [order, songs],
  )

  async function handleSetupSubmit(values: SetupValues) {
    setError(null)

    const playlistId = parsePlaylistId(values.playlist)
    if (!playlistId) {
      setError('No pude leer el ID de la playlist. Pega la URL completa o el ID (empieza por PL…).')
      return
    }

    const apiKey = resolveApiKey(values.apiKey)
    if (!apiKey) {
      setError('Necesitas una API Key de YouTube Data API v3 (en el formulario o en .env).')
      return
    }

    const maxSongs = parseMaxSongsInput(values.maxSongs)
    if (values.maxSongs.trim() && maxSongs == null) {
      setError('El máximo de canciones debe ser un número entero mayor que 0.')
      return
    }

    setLoading(true)
    try {
      const loaded = await fetchPlaylistSongs(playlistId, apiKey)
      const limited = limitSongs(loaded, maxSongs)
      if (limited.length === 0) {
        throw new Error('No quedaron canciones con ese máximo.')
      }
      const nextOrder = shuffleIndices(limited.length)

      saveApiKey(values.apiKey.trim() || apiKey)
      savePlaylist(values.playlist.trim())
      saveMaxSongs(values.maxSongs)

      setSongs(limited)
      setOrder(nextOrder)
      setCurrentIndex(0)
      setRoundStarted(false)
      setSessionKey((key) => key + 1)
      setPlaylistInput(values.playlist.trim())
      setPhase('playing')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar la playlist.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function handleStartRound() {
    setRoundStarted(true)
  }

  function handleNext() {
    if (!roundStarted) return
    setCurrentIndex((index) => Math.min(index + 1, orderedSongs.length - 1))
  }

  function handleNewRound() {
    setOrder(shuffleIndices(songs.length))
    setCurrentIndex(0)
    setRoundStarted(false)
  }

  function handleChangePlaylist() {
    setPhase('setup')
    setRoundStarted(false)
    setError(null)
  }

  return (
    <div className="app">
      <div className="app__atmosphere" aria-hidden="true" />
      <main className={`app__main ${roomId ? 'app__main--carton' : ''}`}>
        {roomId ? (
          <PlayerCard roomId={roomId} />
        ) : phase === 'setup' ? (
          <SetupForm loading={loading} error={error} onSubmit={handleSetupSubmit} />
        ) : (
          <TombolaPlayer
            key={sessionKey}
            playlistLabel={playlistInput}
            poolSongs={songs}
            orderedSongs={orderedSongs}
            currentIndex={currentIndex}
            roundStarted={roundStarted}
            onStartRound={handleStartRound}
            onNext={handleNext}
            onNewRound={handleNewRound}
            onChangePlaylist={handleChangePlaylist}
          />
        )}
      </main>
    </div>
  )
}
