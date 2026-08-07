import { useCallback, useEffect, useRef, useState } from 'react'

export type PlayerState =
  | 'unstarted'
  | 'ended'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'cued'
  | 'unknown'

type YTPlayer = {
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  loadVideoById: (videoId: string) => void
  cueVideoById: (videoId: string) => void
  getPlayerState: () => number
  destroy: () => void
}

type YTNamespace = {
  Player: new (
    element: string | HTMLElement,
    options: {
      videoId?: string
      width?: string | number
      height?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: { target: YTPlayer }) => void
        onStateChange?: (event: { data: number; target: YTPlayer }) => void
        onError?: (event: { data: number }) => void
      }
    },
  ) => YTPlayer
  PlayerState: {
    UNSTARTED: number
    ENDED: number
    PLAYING: number
    PAUSED: number
    BUFFERING: number
    CUED: number
  }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null

function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }

    if (!document.querySelector('script[data-youtube-iframe-api]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.youtubeIframeApi = 'true'
      document.head.appendChild(script)
    }
  })

  return apiPromise
}

function mapState(code: number): PlayerState {
  const S = window.YT?.PlayerState
  if (!S) return 'unknown'
  switch (code) {
    case S.UNSTARTED:
      return 'unstarted'
    case S.ENDED:
      return 'ended'
    case S.PLAYING:
      return 'playing'
    case S.PAUSED:
      return 'paused'
    case S.BUFFERING:
      return 'buffering'
    case S.CUED:
      return 'cued'
    default:
      return 'unknown'
  }
}

type UseYouTubePlayerOptions = {
  /** Stable outer shell; a fresh inner host is created for each YT.Player instance. */
  containerRef: React.RefObject<HTMLDivElement | null>
  videoId: string | null
  autoplay?: boolean
}

export function useYouTubePlayer({
  containerRef,
  videoId,
  autoplay = true,
}: UseYouTubePlayerOptions) {
  const playerRef = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [playerState, setPlayerState] = useState<PlayerState>('unstarted')
  const [error, setError] = useState<string | null>(null)
  const autoplayRef = useRef(autoplay)
  autoplayRef.current = autoplay
  const loadedVideoRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const shell = containerRef.current
    if (!shell) return

    async function init() {
      try {
        await loadYouTubeIframeApi()
        if (cancelled || !window.YT || !shell) return

        playerRef.current?.destroy()
        playerRef.current = null
        loadedVideoRef.current = null
        setReady(false)

        shell.replaceChildren()
        const host = document.createElement('div')
        host.className = 'player-shell__frame'
        shell.appendChild(host)

        playerRef.current = new window.YT.Player(host, {
          width: '100%',
          height: '100%',
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return
              setReady(true)
              setError(null)
            },
            onStateChange: (event) => {
              if (cancelled) return
              setPlayerState(mapState(event.data))
            },
            onError: () => {
              if (cancelled) return
              setError('No se pudo reproducir este video. Prueba con Siguiente.')
            },
          },
        })
      } catch {
        if (!cancelled) {
          setError('No se pudo cargar el reproductor de YouTube.')
        }
      }
    }

    void init()

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
      loadedVideoRef.current = null
      shell.replaceChildren()
    }
  }, [containerRef])

  useEffect(() => {
    if (!ready || !playerRef.current) return

    if (!videoId) {
      playerRef.current.stopVideo()
      loadedVideoRef.current = null
      setPlayerState('unstarted')
      return
    }

    if (loadedVideoRef.current === videoId) return

    loadedVideoRef.current = videoId
    setError(null)

    if (autoplayRef.current) {
      playerRef.current.loadVideoById(videoId)
    } else {
      playerRef.current.cueVideoById(videoId)
    }
  }, [videoId, ready])

  const play = useCallback(() => {
    playerRef.current?.playVideo()
  }, [])

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo()
  }, [])

  const stop = useCallback(() => {
    playerRef.current?.stopVideo()
    loadedVideoRef.current = null
    setPlayerState('unstarted')
  }, [])

  const toggle = useCallback(() => {
    const player = playerRef.current
    if (!player || !window.YT) return
    const state = player.getPlayerState()
    if (state === window.YT.PlayerState.PLAYING) {
      player.pauseVideo()
    } else {
      player.playVideo()
    }
  }, [])

  return {
    ready,
    playerState,
    error,
    play,
    pause,
    stop,
    toggle,
    isPlaying: playerState === 'playing' || playerState === 'buffering',
  }
}
