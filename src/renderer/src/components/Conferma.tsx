import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

// Le domande dell'app ("elimino davvero?", "esco senza salvare?").
//
// Prima erano le finestrelle grigie di Windows: stonavano con tutto il resto e
// non dicevano quale fosse il pulsante pericoloso. Qui la domanda ha i colori
// dell'app e l'azione che cancella e' rossa.
//
// Si usa come la vecchia domanda di sistema, con un'attesa in piu':
//   if (!(await chiedi({ testo: 'Elimino la seduta?' }))) return

export interface Domanda {
  titolo?: string
  testo: string
  // etichetta del pulsante che conferma; rosso se l'azione distrugge qualcosa
  conferma?: string
  pericolo?: boolean
}

type Apri = (d: Domanda, rispondi: (ok: boolean) => void) => void
let apri: Apri | null = null

// Se la domanda parla di cancellare qualcosa, il pulsante diventa rosso e si
// chiama "Elimina": lo decide qui una volta sola, invece di ripeterlo in tutte
// e trenta le domande sparse per l'app.
const DISTRUGGE = /^(elimin|rimuov|togli|cancell)/i

export function chiedi(domanda: Domanda | string): Promise<boolean> {
  const base = typeof domanda === 'string' ? { testo: domanda } : domanda
  const d: Domanda = DISTRUGGE.test(base.testo.trim())
    ? { conferma: 'Elimina', pericolo: true, ...base }
    : base
  // Senza l'host montato (non dovrebbe succedere) si torna alla domanda di
  // sistema: meglio una finestra brutta che un'azione fatta senza chiedere.
  if (!apri) return Promise.resolve(window.confirm(d.testo))
  return new Promise((risolvi) => apri?.(d, risolvi))
}

export default function ConfermaHost(): React.JSX.Element | null {
  const [stato, setStato] = useState<{ d: Domanda; rispondi: (ok: boolean) => void } | null>(null)

  useEffect(() => {
    apri = (d, rispondi) => setStato({ d, rispondi })
    return () => {
      apri = null
    }
  }, [])

  if (!stato) return null

  const chiudi = (ok: boolean): void => {
    stato.rispondi(ok)
    setStato(null)
  }

  const { d } = stato
  return (
    <div className="modal-overlay" onClick={() => chiudi(false)}>
      <div className="modal modal-sm modal-domanda" onClick={(e) => e.stopPropagation()}>
        <div className="testata-domanda">
          {d.pericolo && <AlertTriangle size={20} className="icona-pericolo" />}
          <h3>{d.titolo ?? 'Confermi?'}</h3>
        </div>
        <p className="modal-testo">{d.testo}</p>
        <div className="modal-actions">
          <button onClick={() => chiudi(false)}>Annulla</button>
          <button
            autoFocus
            className={d.pericolo ? 'danger' : 'primary'}
            onClick={() => chiudi(true)}
          >
            {d.conferma ?? 'Conferma'}
          </button>
        </div>
      </div>
    </div>
  )
}
