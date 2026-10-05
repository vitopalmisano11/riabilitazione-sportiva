import { useEffect, useState } from 'react'
import type { VoceCestino } from '../../../../shared/types'
import { Trash2, Undo2 } from 'lucide-react'
import { toast, toastErrore } from '../../components/Toast'
import { chiedi } from '../../components/Conferma'
import { errMsg } from '../../lib'
import { COSA_RESTA_NELLE_COPIE } from '../../testiCancellazione'

// Quello che hai eliminato di recente, con il pulsante per rimetterlo dov'era.
// Dopo un mese si svuota da solo: e' una rete per gli sbagli di ieri, non un
// secondo archivio.
export function SchedaCestino(): React.JSX.Element {
  const [voci, setVoci] = useState<VoceCestino[]>([])

  const carica = (): void => {
    void window.api.cestino
      .list()
      .then(setVoci)
      .catch((e) => toastErrore(errMsg(e)))
  }

  useEffect(carica, [])

  const rimetti = async (v: VoceCestino): Promise<void> => {
    try {
      await window.api.cestino.ripristina(v.id)
      toast(`${v.etichetta} è tornato al suo posto.`)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const butta = async (v: VoceCestino): Promise<void> => {
    if (
      !(await chiedi(
        `Eliminare definitivamente “${v.etichetta}”? Non si torna indietro.\n${COSA_RESTA_NELLE_COPIE}`
      ))
    ) {
      return
    }
    try {
      await window.api.cestino.svuota(v.id)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const quando = (iso: string): string => {
    const d = new Date(iso)
    return `${d.toLocaleDateString('it-IT')} alle ${d.toLocaleTimeString('it-IT').slice(0, 5)}`
  }

  // Chiuso finche' non serve: quasi sempre e' vuoto, e da aperto occuperebbe
  // mezza schermata per niente.
  return (
    <details className="blocco-apribile blocco-cestino">
      <summary>
        Cestino{voci.length > 0 ? ` (${voci.length})` : ' — vuoto'}
      </summary>
      <div className="contenuto-apribile contenuto-cestino">
      {voci.length > 0 && (
        <div className="modal-actions">
          <button
            className="danger"
            onClick={() =>
              void (async () => {
                if (!(await chiedi('Svuotare il cestino? Non si torna indietro.'))) return
                await window.api.cestino.svuota()
                carica()
              })()
            }
          >
            <Trash2 size={16} /> Svuota il cestino
          </button>
        </div>
      )}
      {voci.length === 0 ? (
        <p className="hint">
          Quello che elimini finisce qui e resta un mese, poi se ne va da solo.
        </p>
      ) : (
        <ul className="sedute-list">
          {voci.map((v) => (
            <li key={v.id}>
              <div className="seduta-info">
                <span className="seduta-data">{v.etichetta}</span>
                <span className="seduta-meta">
                  {v.tipo} · eliminato il {quando(v.quando)} ·{' '}
                  {v.righe === 1 ? '1 riga' : `${v.righe} righe`}
                </span>
              </div>
              <span className="row-actions">
                <button onClick={() => void rimetti(v)}>
                  <Undo2 size={16} /> Rimetti a posto
                </button>
                <button className="danger" title="Elimina definitivamente" onClick={() => void butta(v)}>
                  <Trash2 size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      </div>
    </details>
  )
}
