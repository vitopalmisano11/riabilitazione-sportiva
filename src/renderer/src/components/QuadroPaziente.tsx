import { useEffect, useState } from 'react'
import type { ObiettivoTerapeutico, PazienteDettaglio, PuntoAndamentoDolore } from '../../../shared/types'
import { toastErrore } from './Toast'
import { errMsg } from '../lib'
import Aiuto from './Aiuto'
import ObiettiviFase from './ObiettiviFase'
import GraficoDolore from './GraficoDolore'
import { TERMINI } from './ObiettiviTerapeutici'

// La prima linguetta che si vede aprendo un paziente: risponde alla domanda
// con cui si apre la visita, "sta migliorando?", guardando le due cose che
// contano per deciderlo — il dolore e i traguardi raggiunti — senza dover
// ricostruirle a mente da mezza scheda. Non introduce nessun dato nuovo: le
// due fonti del dolore e i due elenchi di obiettivi sono gia' scritti altrove
// nell'app, qui si leggono solo insieme.
export default function QuadroPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [punti, setPunti] = useState<PuntoAndamentoDolore[]>([])
  const [terapeutici, setTerapeutici] = useState<ObiettivoTerapeutico[]>([])

  useEffect(() => {
    window.api.pazienti
      .andamentoDolore(paziente.id)
      .then(setPunti)
      .catch((e) => toastErrore(errMsg(e)))
  }, [paziente.id])

  useEffect(() => {
    window.api.obiettiviTerapeutici
      .list(paziente.id)
      .then(setTerapeutici)
      .catch((e) => toastErrore(errMsg(e)))
  }, [paziente.id])

  const faseId = paziente.fase_corrente_id
  const nienteObiettivi = faseId == null && terapeutici.length === 0

  return (
    <>
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

      <section className="card">
        <h3>Obiettivi e traguardi</h3>
        {nienteObiettivi ? (
          <p className="hint">Non ci sono ancora obiettivi registrati.</p>
        ) : (
          <>
            {faseId != null && (
              <>
                <div className="sotto-titolo">Obiettivi della fase corrente</div>
                <ObiettiviFase pazienteId={paziente.id} faseId={faseId} />
              </>
            )}
            {terapeutici.length > 0 && (
              <>
                <div className="sotto-titolo">Obiettivi concordati col paziente</div>
                <ul className="lista-segni">
                  {terapeutici.map((o) => (
                    <li key={o.id}>
                      <span className="segno-nome">{o.testo}</span>
                      <span className="hint">
                        {TERMINI.find((t) => t.valore === o.termine)?.etichetta ?? o.termine}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </>
  )
}
