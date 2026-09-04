import { useState } from 'react'
import { Download, Eye } from 'lucide-react'
import type { PazienteDettaglio, SezioneCartella } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg } from '../lib'

// Stampa della cartella del paziente da consegnare al medico o al paziente
// stesso. Si scelgono le parti da includere: quello che serve al medico
// curante non e' quello che serve a chi ha chiesto una copia per se'.
//
// L'anteprima si apre in una finestra a parte — il documento e' alto, dentro a
// questa finestra si vedrebbe da un buco — ed e' lo stesso HTML da cui nasce il
// PDF, quindi non puo' discostarsi dal file salvato.

const SEZIONI: { chiave: SezioneCartella; etichetta: string }[] = [
  { chiave: 'anagrafica', etichetta: 'Dati del paziente' },
  { chiave: 'anamnesi', etichetta: 'Anamnesi prossima' },
  { chiave: 'remota', etichetta: 'Anamnesi remota' },
  { chiave: 'bodychart', etichetta: 'Body chart' },
  { chiave: 'valutazioni', etichetta: 'Valutazione obiettiva' },
  { chiave: 'questionari', etichetta: 'Questionari' },
  { chiave: 'obiettivi', etichetta: 'Obiettivi terapeutici' },
  { chiave: 'sedute', etichetta: 'Diario delle sedute' }
]

const TUTTE = SEZIONI.map((s) => s.chiave)

export default function EsportaCartella({
  paziente,
  onChiudi
}: {
  paziente: PazienteDettaglio
  onChiudi: () => void
}): React.JSX.Element {
  const [scelte, setScelte] = useState<SezioneCartella[]>(TUTTE)
  const [occupato, setOccupato] = useState(false)

  const cambia = (chiave: SezioneCartella, dentro: boolean): void => {
    setScelte((prec) =>
      dentro
        ? TUTTE.filter((c) => c === chiave || prec.includes(c))
        : prec.filter((c) => c !== chiave)
    )
  }

  const anteprima = async (): Promise<void> => {
    setOccupato(true)
    try {
      await window.api.esporta.anteprimaCartella(paziente.id, scelte)
    } catch (e) {
      toastErrore(errMsg(e))
    } finally {
      setOccupato(false)
    }
  }

  const scarica = async (): Promise<void> => {
    setOccupato(true)
    try {
      const path = await window.api.esporta.cartella(paziente.id, scelte)
      if (path) {
        toast('Cartella esportata in PDF.')
        onChiudi()
      }
    } catch (e) {
      toastErrore(errMsg(e))
    } finally {
      setOccupato(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onChiudi}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          Cartella di {paziente.cognome} {paziente.nome}
        </h3>
        <p className="modal-testo">
          Le sezioni ancora vuote non vengono stampate, anche se sono spuntate.
        </p>

        <div className="checkbox-list sezioni-cartella">
          {SEZIONI.map((s) => (
            <label key={s.chiave} className="checkbox-inline">
              <input
                type="checkbox"
                checked={scelte.includes(s.chiave)}
                onChange={(e) => cambia(s.chiave, e.target.checked)}
              />
              {s.etichetta}
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <span className="hint">
            Contiene dati sanitari: conservalo e consegnalo con la stessa attenzione di una
            cartella di carta.
          </span>
          <span className="spacer" />
          <button
            title="Anteprima del documento"
            disabled={scelte.length === 0 || occupato}
            onClick={() => void anteprima()}
          >
            <Eye size={18} />
          </button>
          <button
            className="primary"
            title="Scarica il documento in PDF"
            disabled={scelte.length === 0 || occupato}
            onClick={() => void scarica()}
          >
            <Download size={18} />
          </button>
          <button onClick={onChiudi}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}
