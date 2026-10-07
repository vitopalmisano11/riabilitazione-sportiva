import { useEffect, useState } from 'react'
import type { PazienteDettaglio, StatoProgressione } from '../../../shared/types'
import { errMsg, oggiIso } from '../lib'
import { toastErrore } from './Toast'
import Aiuto from './Aiuto'
import SpecchiettoProgressioni from './SpecchiettoProgressioni'

// Dove e' arrivato il paziente nelle progressioni della sua fase: serve a
// programmare, decidendo cosa lavorare in base alle lacune. Sta solo a video,
// mai in cartella o nei referti. Senza progressioni nella fase (una lombalgia,
// per esempio) il riquadro non compare.
export default function ProgressioniPaziente({ paziente }: { paziente: PazienteDettaglio }): React.JSX.Element | null {
  const [stati, setStati] = useState<StatoProgressione[]>([])

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

  return (
    <section className="card">
      <h3>
        Progressioni
        <Aiuto testo="A che step è il paziente in ogni progressione della sua fase: gli step fatti sono colorati, quello da lavorare adesso è evidenziato e gli altri sono da sbloccare. Si aggiorna con l'esito che segni in fondo a ogni seduta. Serve solo a programmare: non compare nella cartella né nei referti." />
      </h3>
      <SpecchiettoProgressioni stati={stati} />
    </section>
  )
}
