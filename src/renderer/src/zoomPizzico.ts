import { useEffect, useRef, useState } from 'react'

// Pizzicare il pad del pc (o Ctrl e rotella, per chi ha solo il mouse) ingrandisce
// un elemento sotto il puntatore, invece che tutta la finestra: e' lo stesso gesto
// gia' usato per ingrandire il programma (src/main/finestre.ts), Chromium lo manda
// come rotella con Ctrl premuto sia che sia un vero Ctrl+rotella sia un pizzico sul
// pad. Va intercettato con un ascoltatore "non passivo" attaccato a mano: quello che
// React mette da solo su onWheel non puo' bloccare lo zoom della finestra.
const ZOOM_MIN = 1
const ZOOM_MAX = 4
const SENSIBILITA = 0.0035

export function useZoomPizzico<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>
  scala: number
  ingrandita: boolean
} {
  const ref = useRef<T | null>(null)
  const [scala, setScala] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const alGesto = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setScala((s) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s - e.deltaY * SENSIBILITA * s)))
    }
    el.addEventListener('wheel', alGesto, { passive: false })
    return () => el.removeEventListener('wheel', alGesto)
  }, [])

  // Un clic fuori dall'immagine ingrandita la riporta alla misura normale: i
  // segni gia' messi restano, perche' quello che si tocca qui e' solo lo zoom,
  // non i dati della body chart.
  useEffect(() => {
    if (scala <= 1) return
    const fuori = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setScala(1)
    }
    document.addEventListener('pointerdown', fuori, { capture: true })
    return () => document.removeEventListener('pointerdown', fuori, { capture: true })
  }, [scala])

  return { ref, scala, ingrandita: scala > 1.01 }
}
