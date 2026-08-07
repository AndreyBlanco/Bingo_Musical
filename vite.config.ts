import { networkInterfaces } from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getDevLanHost(): string {
  const scored: Array<{ address: string; score: number }> = []
  for (const entries of Object.values(networkInterfaces())) {
    if (!entries) continue
    for (const net of entries) {
      const isV4 = String(net.family) === 'IPv4' || Number(net.family) === 4
      if (!isV4 || net.internal) continue
      if (net.address.startsWith('169.254.')) continue
      let score = 0
      if (net.address.startsWith('192.168.')) score = 300
      else if (net.address.startsWith('10.')) score = 200
      else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(net.address)) score = 100
      else continue
      scored.push({ address: net.address, score })
    }
  }
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.address ?? ''
}

export default defineConfig(({ mode }) => {
  const devLanHost = mode === 'development' ? getDevLanHost() : ''
  if (mode === 'development' && devLanHost) {
    console.log(`[bingo] LAN host para QR: ${devLanHost}`)
  }

  return {
    plugins: [react()],
    define: {
      __DEV_LAN_HOST__: JSON.stringify(devLanHost),
    },
    server: {
      host: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
    },
  }
})
