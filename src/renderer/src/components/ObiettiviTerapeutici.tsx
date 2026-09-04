import { useCallback, useEffect, useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import type { ObiettivoTerapeutico, TermineObiettivo } from '../../../shared/types'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

// Obiettivi concordati col paziente. L'elenco si presenta gia' diviso per
// respiro dell'obiettivo — breve, medio, lungo — perche' e' l'ordine in cui si
// ragiona durante il colloquio; dentro ogni gruppo l'ordine lo decide il
// fisioterapista trascinando. Il menu a tendina sposta l'obiettivo di gruppo.

const TERMINI: { valore: TermineObiettivo; etichetta: string }[] = [
  { valore: 'breve', etichetta: 'Breve termine' },
  { valore: 'medio', etichetta: 'Medio termine' },
  { valore: 'lungo', etichetta: 'Lungo termine' }
]

export default function ObiettiviTerapeutici({
  pazienteId,
  onChiudi
}: {
  pazienteId: number
  onChiudi: () => void
}): React.JSX.Element {
  const [lista, setLista] = useState<ObiettivoTerapeutico[]>([])
  const [nuovo, setNuovo] = useState('')
  const [aspettative, setAspettative] = useState('')
  const [termineNuovo, setTermineNuovo] = useState<TermineObiettivo>('breve')

  const carica = useCallback(
    (): Promise<void> => window.api.obiettiviTerapeutici.list(pazienteId).then(setLista),
    [pazienteId]
  )

  useEffect(() => {
    void carica().catch((e) => toastErrore(errMsg(e)))
    void window.api.obiettiviTerapeutici
      .aspettative(pazienteId)
      .then((t) => setAspettative(t ?? ''))
      .catch((e) => toastErrore(errMsg(e)))
  }, [carica, pazienteId])

  const aggiungi = async (): Promise<void> => {
    const testo = nuovo.trim()
    if (!testo) return
    try {
      await window.api.obiettiviTerapeutici.create(pazienteId, testo, termineNuovo)
      setNuovo('')
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Il testo si salva quando si esce dalla casella, il menu appena si sceglie:
  // cosi' non si perde niente chiudendo la finestra.
  const salva = async (o: ObiettivoTerapeutico): Promise<void> => {
    const testo = o.testo.trim()
    if (!testo) return
    try {
      await window.api.obiettiviTerapeutici.update(o.id, testo, o.termine)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (o: ObiettivoTerapeutico): Promise<void> => {
    if (!(await chiedi(`Eliminare l’obiettivo “${o.testo}”?`))) return
    try {
      await window.api.obiettiviTerapeutici.remove(o.id)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Si trascina solo dentro il proprio gruppo: per cambiare respiro c'e' il
  // menu a tendina, cosi' un trascinamento lungo non cambia per sbaglio il
  // significato dell'obiettivo.
  const { contenitore, maniglia } = useRiordino<number>((daId, aId) => {
    const da = lista.findIndex((o) => o.id === daId)
    const a = lista.findIndex((o) => o.id === aId)
    if (da < 0 || a < 0 || lista[da].termine !== lista[a].termine) return
    const riordinata = sposta(lista, da, a)
    setLista(riordinata)
    void window.api.obiettiviTerapeutici
      .reorder(riordinata.map((o) => o.id))
      .catch((e) => toastErrore(errMsg(e)))
  })

  return (
    <div className="modal-overlay" onClick={onChiudi}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Obiettivi terapeutici</h3>

        {/* Prima degli obiettivi c'e' quello che il paziente si aspetta, con
            parole sue: e' da li' che il colloquio parte, e spesso spiega
            perche' un obiettivo e' quello e non un altro. Si salva uscendo
            dalla casella, come il testo degli obiettivi. */}
        <label>
          Aspettative e obiettivi del paziente
          <textarea
            rows={3}
            placeholder="Con parole sue: cosa si aspetta, cosa vuole tornare a fare, cosa lo preoccupa"
            value={aspettative}
            onChange={(e) => setAspettative(e.target.value)}
            onBlur={() =>
              void window.api.obiettiviTerapeutici
                .salvaAspettative(pazienteId, aspettative)
                .catch((e) => toastErrore(errMsg(e)))
            }
          />
        </label>

        <div className="sotto-titolo">Obiettivi concordati</div>

        <div className="modal-actions">
          <input
            className="obiettivo-testo"
            placeholder="Nuovo obiettivo (es. salire le scale senza dolore)"
            value={nuovo}
            onChange={(e) => setNuovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void aggiungi()
            }}
          />
          <select
            value={termineNuovo}
            onChange={(e) => setTermineNuovo(e.target.value as TermineObiettivo)}
          >
            {TERMINI.map((t) => (
              <option key={t.valore} value={t.valore}>
                {t.etichetta}
              </option>
            ))}
          </select>
          <button className="primary" disabled={nuovo.trim() === ''} onClick={() => void aggiungi()}>
            <Plus size={16} /> Aggiungi
          </button>
        </div>

        {lista.length === 0 ? (
          <p className="hint">
            Nessun obiettivo. Scrivine uno qui sopra e scegli se è a breve, medio o lungo termine.
          </p>
        ) : (
          TERMINI.filter((t) => lista.some((o) => o.termine === t.valore)).map((t) => (
            <div key={t.valore} className="blocco-impostazione">
              <div className="sotto-titolo">{t.etichetta}</div>
              <ul className="sedute-list">
                {lista
                  .filter((o) => o.termine === t.valore)
                  .map((o) => {
                    const dnd = contenitore(o.id)
                    return (
                      <li key={o.id} {...dnd} className={dnd.className}>
                        {/* La maniglia sta dentro alla casella del testo, a
                            destra, e compare solo passandoci sopra: a riposo la
                            riga resta pulita e si legge l'obiettivo. */}
                        <span className="campo-con-maniglia maniglia-destra obiettivo-testo">
                          <input
                            value={o.testo}
                            onChange={(e) =>
                              setLista((prec) =>
                                prec.map((x) =>
                                  x.id === o.id ? { ...x, testo: e.target.value } : x
                                )
                              )
                            }
                            onBlur={() => void salva(o)}
                          />
                          <button {...maniglia(o.id)} title="Trascina per riordinare">
                            <GripVertical size={16} />
                          </button>
                        </span>
                        <select
                          value={o.termine}
                          onChange={(e) =>
                            void salva({ ...o, termine: e.target.value as TermineObiettivo })
                          }
                        >
                          {TERMINI.map((x) => (
                            <option key={x.valore} value={x.valore}>
                              {x.etichetta}
                            </option>
                          ))}
                        </select>
                        <span className="row-actions">
                          <button
                            className="danger"
                            title="Elimina questo obiettivo"
                            onClick={() => void elimina(o)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </span>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))
        )}

        <div className="modal-actions">
          <button className="primary" onClick={onChiudi}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
