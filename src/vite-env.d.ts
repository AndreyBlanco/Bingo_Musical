/// <reference types="vite/client" />

declare const __DEV_LAN_HOST__: string

interface ImportMetaEnv {
  readonly VITE_YOUTUBE_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
