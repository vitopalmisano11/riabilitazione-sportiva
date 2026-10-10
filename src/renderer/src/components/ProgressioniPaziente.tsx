import { useEffect, useState } from 'react'
import type { PazienteDettaglio, StatoProgressione } from '../../../shared/types'
import { errMsg, oggiIso } from '../lib'
import { toastErrore } from './Toast'
import Aiuto from './Aiuto'
import Modale from './Modale'
import SpecchiettoProgressioni from './SpecchiettoProgressioni'

// A che step e' il paziente in ogni progressione della sua fase: una casella per
// progressione, come le patologie e i distretti, con il nome e lo step (2/5).
// Premendola si apre la scala con tutti gli step. Serve a programmare, decidendo
// cosa lavorare in base alle lacune. Sta solo a video, mai in cartella o nei
// referti. Senza progressioni nella fase (una lombalgia, per esempio) il
// riquadro non compare.

// Lo step da lavorare adesso, contato da 1; a scala finita, tutti.
const stepAttuale = (p: StatoProgressione): number => (p.completata ? p.step.length : p.posizione + 1)

export default function ProgressioniPaziente({ paziente }: { paziente: PazienteDettaglio }): React.JSX.Element | null {
  const [stati, setStati] = useState<StatoProgressione[]>([])
  const [apertaId, setApertaId] = useState<number | null>(null)

  // Dipende dal paziente intero: dopo ogni seduta salvata l'oggetto cambia e lo
  // step si ricalcola.
  useEffect(() => {
    let attuale = true
    window.api.progressioni
      .stato(paziente.id, paziente.fase_corrente_id, oggiIso(), null)
      .then((s) => attuale && setStati(s))
      .catch((e) => toastErrore(errMsg(e)))
    return () => {
      attuale = false
    }
  }, [paziente])

  if (stati.length === 0) return null

  const aperta = stati.find((p) => p.id === apertaId) ?? null

  return (
    <section className="card">
      <h3>
        Progressioni
        <Aiuto testo="A che step è il paziente in ogni progressione della sua fase (per esempio 2/5). Premi una casella per vedere tutti gli step: quelli fatti sono colorati, quello da lavorare adesso è evidenziato e gli altri sono da sbloccare. Si aggiorna con l'esito che segni in fondo a ogni seduta. Serve solo a programmare: non compare nella cartella né nei referti." />
      </h3>
      <div className="scelta-tiles">
        {stati.map((p) => (
          <div
            key={p.id}
            className="scelta-tile"
            role="button"
            tabIndex={0}
            title="Vedi gli step"
            onClick={() => setApertaId(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setApertaId(p.id)
              }
            }}
          >
            <span className="scelta-tile-nome">{p.nome}</span>
            <span className="riga-pillola">
              <span className="badge">
                {stepAttuale(p)}/{p.step.length}
              </span>
            </span>
          </div>
        ))}
      </div>

      {aperta && (
        <Modale onConferma={() => setApertaId(null)}>
          <SpecchiettoProgressioni stati={[aperta]} />
          <div className="modal-actions">
            <button className="primary" onClick={() => setApertaId(null)}>
              Chiudi
            </button>
          </div>
        </Modale>
      )}
    </section>
  )
}
