import { useState } from 'react'
import { Download, Eye } from 'lucide-react'
import Aiuto from './Aiuto'
import type { PazienteDettaglio, SezioneCartella, TipoRelazione } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import Modale from './Modale'
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

const RELAZIONI: { tipo: TipoRelazione; nome: string; aiuto: string }[] = [
  {
    tipo: 'anamnesi',
    nome: 'Relazione scritta dell’anamnesi',
    aiuto:
      "Un documento a parte: l'anamnesi prossima e remota raccontate in frasi, con quello che hai scritto e selezionato, nell'ordine del colloquio. Non usa nessuna intelligenza artificiale e i dati non escono dal computer."
  },
  {
    tipo: 'valutazione',
    nome: 'Relazione scritta della valutazione obiettiva',
    aiuto:
      "Un documento a parte: le valutazioni obiettive raccontate in frasi, dalla più recente. Per ogni distretto i movimenti attivi e passivi, il confronto fra destra e sinistra dove ci sono tutti e due, i test e il carico. Quello che hai lasciato vuoto non compare; i movimenti con la spunta si scrivono nella norma."
  }
]

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

  // La relazione dell'anamnesi e' un altro documento: stessi due gesti,
  // guardarla o salvarla, ma per conto suo.
  const anteprimaRelazione = async (tipo: TipoRelazione): Promise<void> => {
    setOccupato(true)
    try {
      await window.api.esporta.anteprimaRelazione(paziente.id, tipo)
    } catch (e) {
      toastErrore(errMsg(e))
    } finally {
      setOccupato(false)
    }
  }

  const scaricaRelazione = async (tipo: TipoRelazione): Promise<void> => {
    setOccupato(true)
    try {
      const path = await window.api.esporta.relazione(paziente.id, tipo)
      if (path) toast('Relazione esportata in PDF.')
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
    <Modale onConferma={onChiudi}>
        <h3>
          Cartella di {paziente.cognome} {paziente.nome}
        </h3>
        {/* In cima le due relazioni, ognuna con anteprima e scarica. Sotto la
            cartella completa: prima si scelgono le sezioni, poi i suoi
            pulsanti, subito sotto alle spunte. */}
        <div className="gruppo-documenti">
          <div className="titolo-gruppo">Relazioni scritte</div>
          <div className="elenco-documenti">
          {RELAZIONI.map((r) => (
            <div key={r.tipo} className="altro-documento senza-linea">
              <span className="nome-documento">
                {r.nome}
                <Aiuto testo={r.aiuto} />
              </span>
              <span className="spacer" />
              <button
                title="Anteprima della relazione"
                disabled={occupato}
                onClick={() => void anteprimaRelazione(r.tipo)}
              >
                <Eye size={18} />
              </button>
              <button
                title="Scarica la relazione in PDF"
                disabled={occupato}
                onClick={() => void scaricaRelazione(r.tipo)}
              >
                <Download size={18} />
              </button>
            </div>
          ))}
          </div>
        </div>

        <div className="gruppo-documenti blocco-cartella">
          <span className="titolo-gruppo">
            Cartella completa
            <Aiuto testo="Tutto quello che c'è nella scheda del paziente, con le sezioni che scegli qui sotto. Le sezioni ancora vuote non vengono stampate, anche se sono spuntate." />
          </span>
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
          <div className="pulsanti-cartella">
            <button
              title="Anteprima della cartella"
              disabled={scelte.length === 0 || occupato}
              onClick={() => void anteprima()}
            >
              <Eye size={18} />
            </button>
            <button
              title="Scarica la cartella in PDF"
              disabled={scelte.length === 0 || occupato}
              onClick={() => void scarica()}
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onChiudi}>Chiudi</button>
        </div>
    </Modale>
  )
}
