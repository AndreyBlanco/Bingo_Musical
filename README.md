# Bingo Musical — Tómbola

Web app de tómbola para Bingo Musical con cartones digitales (API) y PDF para imprimir.

## Requisitos

- Node.js 20+
- API Key de [YouTube Data API v3](https://developers.google.com/youtube/v3/getting-started)

## Configurar

```bash
cp .env.example .env
# VITE_YOUTUBE_API_KEY=...
```

## Desarrollo

Levanta **API + frontend** (la web se expone en red local automáticamente):

```bash
npm install
npm run dev
```

- Web: `http://localhost:5173` y `http://TU-IP:5173`
- API: `http://localhost:8787`
- El QR usa la **IP de red** cuando abres desde localhost, para que los celulares conecten sin problema.

En producción, el QR usa el host real de la app.

## Flujo de cartones digitales

1. El tombolero carga la playlist y publica una **sala** en la API.
2. El QR / enlace solo lleva el ID corto: `#/carton/a1b2c3d4`.
3. Al abrir el enlace, el celular pide un cartón único a `POST /api/rooms/:id/cards`.
4. Al **Iniciar ronda**, la API incrementa `roundId` (habilita cartones nuevos pendientes).
5. En el celular: marca casillas, **Limpiar cartón** y **Otro cartón** (sin Bingo automático).

## Uso rápido

1. Configura columnas × filas y (opcional) máximo de canciones.
2. Comparte QR o enlace.
3. **Iniciar ronda** → play / pausa / siguiente.
4. PDF Carta: 2 cartones por página (local, no usa la API).

## Producción (local)

```bash
npm run build
npm start
```

Sirve la API y el `dist` en el puerto `8787` (o `PORT`).

## Despliegue en Render (recomendado)

La app ya incluye [`render.yaml`](render.yaml).

1. Sube el repo a GitHub (si aún no está).
2. En [Render](https://dashboard.render.com) → **New** → **Blueprint** (o **Web Service**) y conecta el repo.
3. Si usas Web Service manual:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. En **Environment** agrega:
   - `VITE_YOUTUBE_API_KEY` = tu API key  
   (debe existir en el **build**, porque Vite la embebe en el front)
5. Deploy. Anota la URL, p. ej. `https://bingo-musical.onrender.com`.

### Dominio Namecheap → Render

Opción simple (subdominio):

1. En Render → tu servicio → **Settings → Custom Domains** → añade `bingo.allmedia-dev.com`.
2. En Namecheap → **Domain List** → `allmedia-dev.com` → **Advanced DNS**:
   - Tipo **CNAME**
   - Host: `bingo`
   - Value: el hostname que indique Render (p. ej. `bingo-musical.onrender.com`)
3. Espera la propagación DNS y el certificado SSL en Render.

### YouTube API Key

En Google Cloud, añade referrers HTTP:

- `https://bingo-musical.onrender.com/*`
- `https://bingo.allmedia-dev.com/*`
- `http://localhost:5173/*` (dev)

### Notas del plan Free de Render

- El servicio puede **dormir** tras inactividad (~15 min); el primer acceso tarda en despertar.
- Al dormir/reiniciar se **borran las salas en memoria** (hay que volver a cargar la playlist).
- Para una fiesta, abre la URL unos minutos antes para “calentar” el servicio.
