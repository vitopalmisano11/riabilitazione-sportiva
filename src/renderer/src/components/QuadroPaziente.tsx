import { useEffect, useState } from 'react'
import type { PazienteDettaglio, PuntoAndamentoDolore } from '../../../shared/types'
import { toastErrore } from './Toast'
import { errMsg } from '../lib'
import Aiuto from './Aiuto'
import GraficoDolore from './GraficoDolore'

// La prima linguetta che si vede aprendo un paziente: risponde alla domanda
// con cui si apre la visita, "sta migliorando?", guardando il dolore senza
// doverlo ricostruire a mente da mezza scheda. Non introduce nessun dato
// nuovo: le due fonti (sedute e anamnesi) sono gia' scritte altrove nell'app,
// qui si leggono solo insieme. Gli obiettivi non ci sono apposta: hanno gia'
// una linguetta loro in Percorso, e ripeterli qui era solo doppione.
export default function QuadroPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [punti, setPunti] = useState<PuntoAndamentoDolore[]>([])

  useEffect(() => {
    window.api.pazienti
      .andamentoDolore(paziente.id)
      .then(setPunti)
      .catch((e) => toastErrore(errMsg(e)))
  }, [paziente.id])

  return (
    <section className="card">
      <h3>
        Andamento del dolore
        <Aiuto testo="Mette insieme due numeri che hai gia' scritto altrove: il dolore segnato in fondo alle sedute e, prima ancora, i punti del grafico dall'esordio nell'anamnesi. Non si scrive niente da qui." />
      </h3>
      {punti.length === 0 ? (
        <p className="hint">Non ci sono ancora numeri sul dolore.</p>
      ) : (
        <>
          <GraficoDolore punti={punti} />
          <div className="legenda-sintomi">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="pallino" style={{ background: 'var(--text-dim)' }} /> prima
              dell&apos;inizio
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="pallino" style={{ background: 'var(--accent)' }} /> sedute
            </span>
          </div>
        </>
      )}
    </section>
  )
}
