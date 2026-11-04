import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useClicSulFondo } from '../clicSulFondo'

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
  // Una terza via, per `scegli`: il pulsante rosso che butta via quello che si
  // stava facendo (es. "Annulla creazione"). `no` e' l'etichetta di "torna
  // indietro" (di norma "Annulla"); Esc e un clic sul fondo valgono "no".
  scarta?: string
  no?: string
}

// "si" = il pulsante di conferma, "scarta" = la terza via, "no" = torna indietro.
export type Risposta = 'si' | 'scarta' | 'no'

type Apri = (d: Domanda, rispondi: (r: Risposta) => void) => void
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
  return new Promise((risolvi) => apri?.(d, (r) => risolvi(r === 'si')))
}

// Come `chiedi`, ma con tre risposte: confermare, scartare o tornare indietro.
export function scegli(domanda: Domanda): Promise<Risposta> {
  if (!apri) return Promise.resolve(window.confirm(domanda.testo) ? 'si' : 'no')
  return new Promise((risolvi) => apri?.(domanda, risolvi))
}

export default function ConfermaHost(): React.JSX.Element | null {
  const [stato, setStato] = useState<{ d: Domanda; rispondi: (r: Risposta) => void } | null>(null)

  useEffect(() => {
    apri = (d, rispondi) => setStato({ d, rispondi })
    return () => {
      apri = null
    }
  }, [])

  // Esc e' "no", come Annulla. Si ascolta in cattura e si ferma l'evento: la
  // finestra che ha fatto la domanda (che chiude con Esc) deve restare aperta.
  const aperta = stato !== null
  useEffect(() => {
    if (!aperta) return
    const gestisci = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      setStato((corrente) => {
        corrente?.rispondi('no')
        return null
      })
    }
    window.addEventListener('keydown', gestisci, true)
    return () => window.removeEventListener('keydown', gestisci, true)
  }, [aperta])

  // Un clic sul fondo e' "no", come Annulla.
  const sulFondo = useClicSulFondo(() => {
    stato?.rispondi('no')
    setStato(null)
  })

  if (!stato) return null

  const chiudi = (r: Risposta): void => {
    stato.rispondi(r)
    setStato(null)
  }

  const { d } = stato
  return (
    <div className="modal-overlay" {...sulFondo}>
      <div className={`modal modal-sm modal-domanda${d.scarta ? ' modal-domanda-tre' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="testata-domanda">
          {d.pericolo && <AlertTriangle size={20} className="icona-pericolo" />}
          <h3>{d.titolo ?? 'Confermi?'}</h3>
        </div>
        <p className="modal-testo">{d.testo}</p>
        <div className="modal-actions">
          <button onClick={() => chiudi('no')}>{d.no ?? 'Annulla'}</button>
          {d.scarta && (
            <button className="danger" onClick={() => chiudi('scarta')}>
              {d.scarta}
            </button>
          )}
          <button
            autoFocus
            className={d.pericolo ? 'danger' : 'primary'}
            onClick={() => chiudi('si')}
          >
            {d.conferma ?? 'Conferma'}
          </button>
        </div>
      </div>
    </div>
  )
}
