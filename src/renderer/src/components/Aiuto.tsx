import { useLayoutEffect, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'

// Spiegazione a richiesta.
//
// Le spiegazioni di come funziona una schermata servono le prime volte e poi
// diventano rumore: chi usa l'app tutti i giorni le salta, ma restano li' a
// occupare tre righe. Qui stanno dietro a un punto interrogativo e compaiono
// passandoci sopra col cursore, senza sparire dal programma — se un giorno
// serviranno di nuovo (a un collega, a chi compra l'app) sono ancora scritte.
//
// Il cartellino galleggia sopra la pagina (posizione fissa): dentro a una
// finestra con lo scorrimento verrebbe tagliato dal bordo. Si apre a destra
// dell'icona, ma se li' non c'e' posto (un "?" nella colonna di destra) si
// sposta a sinistra quanto basta per restare tutto dentro la finestra.
export default function Aiuto({ testo }: { testo: string }): React.JSX.Element {
  const [dove, setDove] = useState<{ x: number; y: number; sopra: boolean } | null>(null)
  const bolla = useRef<HTMLSpanElement>(null)

  // Appena disegnato si misura e, se sporge, lo si rimette dentro: prima
  // dello schermo (useLayoutEffect), cosi' non si vede mai fuori posto.
  useLayoutEffect(() => {
    const b = bolla.current
    if (!b || !dove) return
    const MARGINE = 10
    const r = b.getBoundingClientRect()
    let sposta = 0
    if (r.right > window.innerWidth - MARGINE) sposta = window.innerWidth - MARGINE - r.right
    if (r.left + sposta < MARGINE) sposta = MARGINE - r.left
    b.style.left = `${dove.x + sposta}px`
  }, [dove])

  return (
    <>
      <span
        className="icona-aiuto"
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const sopra = r.bottom > window.innerHeight - 200
          setDove({ x: r.left, y: sopra ? r.top - 6 : r.bottom + 6, sopra })
        }}
        onMouseLeave={() => setDove(null)}
      >
        <HelpCircle size={16} />
      </span>
      {dove && (
        <span
          ref={bolla}
          className={`bolla-nota bolla-aiuto${dove.sopra ? ' sopra' : ''}`}
          style={{ left: dove.x, top: dove.y }}
        >
          {testo}
        </span>
      )}
    </>
  )
}
