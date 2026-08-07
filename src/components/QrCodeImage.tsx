import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type QrCodeImageProps = {
  value: string
  size?: number
  className?: string
}

export function QrCodeImage({ value, size = 160, className }: QrCodeImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        if (value.length > 1200) {
          throw new Error(
            'El enlace es demasiado largo para un QR. Usa “Copiar enlace”.',
          )
        }
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) {
          setDataUrl(url)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setDataUrl(null)
          setError(err instanceof Error ? err.message : 'No se pudo generar el QR.')
        }
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (error) {
    return <p className="share-qr-error">{error}</p>
  }

  if (!dataUrl) {
    return <div className="share-qr share-qr--loading" style={{ width: size, height: size }} />
  }

  return (
    <img
      className={className ?? 'share-qr'}
      src={dataUrl}
      alt="Código QR para cartones"
      width={size}
      height={size}
    />
  )
}
