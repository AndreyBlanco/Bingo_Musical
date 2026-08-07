import { useState, type FormEvent } from 'react'
import {
  hasEnvApiKey,
  loadStoredApiKey,
  loadStoredMaxSongs,
  loadStoredPlaylist,
} from '../lib/storage'

export type SetupValues = {
  playlist: string
  apiKey: string
  maxSongs: string
}

type SetupFormProps = {
  loading: boolean
  error: string | null
  onSubmit: (values: SetupValues) => void
}

export function SetupForm({ loading, error, onSubmit }: SetupFormProps) {
  const envKey = hasEnvApiKey()
  const [playlist, setPlaylist] = useState(() => loadStoredPlaylist())
  const [apiKey, setApiKey] = useState(() => (envKey ? '' : loadStoredApiKey()))
  const [maxSongs, setMaxSongs] = useState(() => loadStoredMaxSongs())
  const apiKeyRequired = !envKey && !loadStoredApiKey()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ playlist, apiKey, maxSongs })
  }

  return (
    <section className="setup">
      <header className="setup__hero">
        <p className="setup__eyebrow">Tómbola digital</p>
        <h1 className="brand">Bingo Musical</h1>
        <p className="setup__lede">
          Carga tu playlist de YouTube, baraja el orden y saca canciones como en el bingo
          tradicional. El grupo canta, baila y disfruta entre canción y canción.
        </p>
      </header>

      <form className="setup__form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Playlist de YouTube</span>
          <input
            className="field__input"
            type="text"
            name="playlist"
            placeholder="https://www.youtube.com/playlist?list=…"
            value={playlist}
            onChange={(e) => setPlaylist(e.target.value)}
            autoComplete="off"
            required
            disabled={loading}
          />
        </label>

        <label className="field">
          <span className="field__label">
            API Key de YouTube
            {envKey ? ' (opcional — ya hay una en .env)' : ''}
          </span>
          <input
            className="field__input"
            type="password"
            name="apiKey"
            placeholder={envKey ? 'Usando la key del entorno' : 'AIza…'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            required={apiKeyRequired}
            disabled={loading}
          />
        </label>

        <label className="field">
          <span className="field__label">Máximo de canciones (opcional)</span>
          <input
            className="field__input"
            type="number"
            name="maxSongs"
            min={1}
            step={1}
            placeholder="Todas las de la playlist"
            value={maxSongs}
            onChange={(e) => setMaxSongs(e.target.value)}
            disabled={loading}
          />
          <span className="field__hint">
            Si la playlist es muy larga, usa solo las primeras N canciones de la lista.
          </span>
        </label>

        {error ? <p className="banner banner--error" role="alert">{error}</p> : null}

        <button className="btn btn--primary btn--xl" type="submit" disabled={loading}>
          {loading ? 'Cargando playlist…' : 'Cargar y barajar'}
        </button>
      </form>
    </section>
  )
}
