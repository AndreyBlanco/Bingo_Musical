import { jsPDF } from 'jspdf'
import type { CardGrid, CardLayout } from '../types'
import type { ShareSong } from './sharePool'
import { formatSongCell } from './songDisplay'

const PAGE_W = 8.5
const PAGE_H = 11
const MARGIN = 0.4
const GAP = 0.25
const CARDS_PER_PAGE = 2

type PdfOptions = {
  cards: CardGrid[]
  layout: CardLayout
  songByIndex: Map<number, ShareSong>
  playlistLabel: string
}

export function downloadCardsPdf(options: PdfOptions): void {
  const { cards, layout, songByIndex, playlistLabel } = options
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })

  // Two full-width cards stacked on a letter page
  const cardW = PAGE_W - MARGIN * 2
  const cardH = (PAGE_H - MARGIN * 2 - GAP) / CARDS_PER_PAGE

  cards.forEach((grid, i) => {
    if (i > 0 && i % CARDS_PER_PAGE === 0) doc.addPage()

    const slot = i % CARDS_PER_PAGE
    const x = MARGIN
    const y = MARGIN + slot * (cardH + GAP)

    drawCard(doc, {
      x,
      y,
      w: cardW,
      h: cardH,
      grid,
      layout,
      songByIndex,
      cardNumber: i + 1,
    })
  })

  const safeName = playlistLabel.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'bingo'
  doc.save(`cartones-${safeName}.pdf`)
}

function drawCard(
  doc: jsPDF,
  args: {
    x: number
    y: number
    w: number
    h: number
    grid: CardGrid
    layout: CardLayout
    songByIndex: Map<number, ShareSong>
    cardNumber: number
  },
) {
  const { x, y, w, h, grid, layout, songByIndex, cardNumber } = args

  doc.setDrawColor(20, 32, 30)
  doc.setLineWidth(0.015)
  doc.roundedRect(x, y, w, h, 0.08, 0.08)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Bingo Musical', x + 0.15, y + 0.32)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Cartón ${cardNumber} · ${layout.cols}×${layout.rows}`, x + 0.15, y + 0.52)

  const headerH = 0.65
  const pad = 0.12
  const gridX = x + pad
  const gridY = y + headerH
  const gridW = w - pad * 2
  const gridH = h - headerH - pad
  const cellW = gridW / layout.cols
  const cellH = gridH / layout.rows

  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const cx = gridX + c * cellW
      const cy = gridY + r * cellH
      const playlistIndex = grid[r][c]
      const display = formatSongCell(songByIndex.get(playlistIndex))

      doc.setDrawColor(80, 100, 96)
      doc.setLineWidth(0.008)
      doc.rect(cx, cy, cellW, cellH)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`#${playlistIndex}`, cx + 0.07, cy + 0.2)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      const titleLines = doc.splitTextToSize(display.title, cellW - 0.14)
      const titleBudget = display.artist
        ? Math.max(1, Math.floor((cellH - 0.48) / 0.14))
        : Math.max(1, Math.floor((cellH - 0.28) / 0.14))
      doc.text(titleLines.slice(0, titleBudget), cx + 0.07, cy + 0.38)

      if (display.artist) {
        const titleUsed = Math.min(titleLines.length, titleBudget)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        const artistLines = doc.splitTextToSize(display.artist, cellW - 0.14)
        const artistY = cy + 0.38 + titleUsed * 0.14
        const artistBudget = Math.max(1, Math.floor((cy + cellH - artistY - 0.06) / 0.12))
        doc.text(artistLines.slice(0, artistBudget), cx + 0.07, artistY)
      }
    }
  }
}
