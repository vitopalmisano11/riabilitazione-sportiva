import { useState } from 'react'
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
// finestra con lo scorrimento verrebbe tagliato dal bordo.
export default function Aiuto({ testo }: { testo: string }): React.JSX.Element {
  const [dove, setDove] = useState<{ x: number; y: number; sopra: boolean } | null>(null)

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
          className={`bolla-nota bolla-aiuto${dove.sopra ? ' sopra' : ''}`}
          style={{ left: dove.x, top: dove.y }}
        >
          {testo}
        </span>
      )}
    </>
  )
}
