import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { validateLayoutForPool } from '../src/lib/cards'
import type { ShareSong } from '../src/lib/sharePool'
import type { CardGrid } from '../src/types'
import { getLanIPv4, listLanIPv4 } from './network'
import {
  createRoomId,
  dealUniqueCard,
  getRoom,
  releaseCardAssignment,
  saveRoom,
  startRoomRound,
  toPublicRoom,
  updateRoom,
  type DealtCardResponse,
  type Room,
} from './store'

const PORT = Number(process.env.PORT ?? 8787)
const serveSpa = existsSync('./dist/index.html')

const app = new Hono()

app.use('/api/*', cors())

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/network-info', (c) => {
  const hosts = listLanIPv4()
  const host = getLanIPv4()
  if (!host) {
    return c.json({ error: 'No se encontró una IP de red local.', hosts: [] }, 404)
  }
  return c.json({ host, hosts, apiPort: PORT })
})

app.post('/api/rooms', async (c) => {
  const body = (await c.req.json()) as {
    playlistKey?: string
    cols?: number
    rows?: number
    songs?: ShareSong[]
  }

  const songs = Array.isArray(body.songs) ? body.songs : []
  const cols = Number(body.cols)
  const rows = Number(body.rows)
  const playlistKey = typeof body.playlistKey === 'string' ? body.playlistKey : 'playlist'

  if (songs.length === 0) {
    return c.json({ error: 'La sala necesita canciones.' }, 400)
  }

  const layoutError = validateLayoutForPool(songs, { cols, rows })
  if (layoutError) {
    return c.json({ error: layoutError }, 400)
  }

  const now = new Date().toISOString()
  const room: Room = {
    id: createRoomId(),
    playlistKey,
    cols,
    rows,
    songs,
    roundId: 0,
    assignedCardKeys: new Set(),
    createdAt: now,
    updatedAt: now,
  }
  saveRoom(room)

  return c.json({ room: toPublicRoom(room) }, 201)
})

app.get('/api/rooms/:id', (c) => {
  const room = getRoom(c.req.param('id'))
  if (!room) return c.json({ error: 'Sala no encontrada.' }, 404)
  return c.json({ room: toPublicRoom(room) })
})

app.put('/api/rooms/:id', async (c) => {
  const room = getRoom(c.req.param('id'))
  if (!room) return c.json({ error: 'Sala no encontrada.' }, 404)

  const body = (await c.req.json()) as {
    playlistKey?: string
    cols?: number
    rows?: number
    songs?: ShareSong[]
  }

  const songs = Array.isArray(body.songs) ? body.songs : room.songs
  const cols = body.cols != null ? Number(body.cols) : room.cols
  const rows = body.rows != null ? Number(body.rows) : room.rows
  const playlistKey =
    typeof body.playlistKey === 'string' ? body.playlistKey : room.playlistKey

  const layoutError = validateLayoutForPool(songs, { cols, rows })
  if (layoutError) {
    return c.json({ error: layoutError }, 400)
  }

  const updated = updateRoom(room.id, { songs, cols, rows, playlistKey })
  return c.json({ room: toPublicRoom(updated!) })
})

app.post('/api/rooms/:id/start-round', (c) => {
  const updated = startRoomRound(c.req.param('id'))
  if (!updated) return c.json({ error: 'Sala no encontrada.' }, 404)
  return c.json({ room: toPublicRoom(updated) })
})

app.post('/api/rooms/:id/cards', (c) => {
  const room = getRoom(c.req.param('id'))
  if (!room) return c.json({ error: 'Sala no encontrada.' }, 404)

  try {
    const grid = dealUniqueCard(room)
    const response: DealtCardResponse = {
      roomId: room.id,
      roundId: room.roundId,
      cols: room.cols,
      rows: room.rows,
      grid,
      songs: room.songs,
    }
    return c.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo asignar el cartón.'
    return c.json({ error: message }, 409)
  }
})

app.post('/api/rooms/:id/cards/release', async (c) => {
  const room = getRoom(c.req.param('id'))
  if (!room) return c.json({ error: 'Sala no encontrada.' }, 404)

  const body = (await c.req.json()) as { grid?: CardGrid }
  if (!Array.isArray(body.grid)) {
    return c.json({ error: 'Falta el cartón a liberar.' }, 400)
  }

  releaseCardAssignment(room.id, body.grid)
  return c.json({ room: toPublicRoom(room) })
})

if (serveSpa) {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  const lan = getLanIPv4()
  console.log(`Bingo Musical API en http://localhost:${info.port}`)
  if (lan) console.log(`Red local: http://${lan}:${info.port}`)
})
