import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Pencil, Plus, X } from 'lucide-react'
import type {
  Distretto,
  DistrettoCompleto,
  GruppoTest,
  MovimentoDistretto,
  RispostaTest,
  TestDistretto
} from '../../../shared/types'
import { toast, toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

// I movimenti e i test appartengono al distretto, non alla patologia: il rachide
// cervicale ruota comunque, qualunque sia la diagnosi. Cosi' si scrivono una
// volta sola e si riusano su tutte le patologie di quella zona.

// L'ordine e' quello in cui i gruppi compaiono nella valutazione: si scende dal
// dolore alla struttura, poi il neurologico, e in fondo quello che resta.
export const GRUPPI: { valore: GruppoTest; etichetta: string }[] = [
  { valore: 'provocazione', etichetta: 'Provocazione del dolore' },
  { valore: 'forza', etichetta: 'Forza muscolare' },
  { valore: 'legamentosa', etichetta: 'Stabilità legamentosa' },
  { valore: 'flessibilita', etichetta: 'Test di flessibilità' },
  { valore: 'neurologico', etichetta: 'Esame neurologico' },
  { valore: 'altri', etichetta: 'Altri test' }
]

const RISPOSTE: { valore: RispostaTest; etichetta: string }[] = [
  { valore: 'posneg', etichetta: 'positivo / negativo' },
  { valore: 'scala5', etichetta: 'forza da 0 a 5' },
  { valore: 'testo', etichetta: 'testo libero' }
]

let ultimaChiave = 0
const nuovaChiave = (): number => --ultimaChiave

export default function DistrettiPage(): React.JSX.Element {
  const [distretti, setDistretti] = useState<Distretto[]>([])
  const [apertoId, setApertoId] = useState<number | null>(null)

  const load = useCallback(
    (): Promise<void> => window.api.distretti.list().then(setDistretti),
    []
  )

  useEffect(() => {
    void load()
  }, [load])

  const aperto = distretti.find((d) => d.id === apertoId) ?? null

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>Distretti</h2>
      </header>

      {aperto && (
        <div className="briciole">
          <button className="briciola" onClick={() => setApertoId(null)}>
            Distretti
          </button>
          <ChevronRight size={16} />
          <span className="briciola corrente">{aperto.nome}</span>
        </div>
      )}

      {aperto == null ? (
        <ElencoDistretti distretti={distretti} onApri={setApertoId} onChanged={load} />
      ) : (
        <EditorDistretto key={aperto.id} id={aperto.id} onChanged={load} />
      )}
    </div>
  )
}

function ElencoDistretti({
  distretti,
  onApri,
  onChanged
}: {
  distretti: Distretto[]
  onApri: (id: number) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [nuovoAperto, setNuovoAperto] = useState(false)
  const [nome, setNome] = useState('')
  const [edit, setEdit] = useState<{ id: number; nome: string } | null>(null)

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const { contenitore, presa } = useRiordino<number>((da, a) => {
    const ids = sposta(distretti, da, a).map((d) => d.id)
    void run(async () => {
      await window.api.distretti.reorder(ids)
      await onChanged()
    })
  })

  const crea = (): void => {
    const n = nome.trim()
    if (!n) return
    void run(async () => {
      const id = await window.api.distretti.create(n)
      setNome('')
      setNuovoAperto(false)
      await onChanged()
      onApri(id)
    })
  }

  const salvaRinomina = (): void => {
    if (!edit || !edit.nome.trim()) return
    void run(async () => {
      const completo = await window.api.distretti.get(edit.id)
      await window.api.distretti.salva({
        ...completo,
        distretto: { ...completo.distretto, nome: edit.nome.trim() }
      })
      setEdit(null)
      await onChanged()
    })
  }

  return (
    <section className="card step-card">
      <div className="step-head">
        <div className="step-title">
          <span className="step-num">1</span>
          <h3>Scegli il distretto</h3>
        </div>
        <button
          className="primary btn-icona"
          title="Aggiungi un distretto"
          onClick={() => setNuovoAperto(true)}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="scelta-tiles">
        {distretti.map((d, idx) => {
          const dnd = contenitore(idx)
          return (
            <div
              key={d.id}
              {...dnd}
              {...presa(idx)}
              className={['scelta-tile', dnd.className].filter(Boolean).join(' ')}
              title="Apri · trascina per spostare"
              onClick={() => onApri(d.id)}
            >
              {edit && edit.id === d.id ? (
                <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={edit.nome}
                    onChange={(e) => setEdit({ id: d.id, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvaRinomina()
                      if (e.key === 'Escape') setEdit(null)
                    }}
                  />
                  <button onClick={salvaRinomina}>OK</button>
                </span>
              ) : (
                <>
                  <span className="scelta-tile-nome">{d.nome}</span>
                  <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                    <button title="Rinomina" onClick={() => setEdit({ id: d.id, nome: d.nome })}>
                      <Pencil size={16} />
                    </button>
                    <button
                      title="Elimina"
                      className="danger"
                      onClick={async () => {
                        if (
                          await chiedi(
                            `Eliminare "${d.nome}"?\nVerranno eliminati i suoi movimenti e test, e i rilievi già registrati nelle valutazioni.\nFinisce nel cestino: puoi rimetterlo a posto da Impostazioni entro un mese.`
                          )
                        ) {
                          void run(async () => {
                            await window.api.distretti.remove(d.id)
                            await onChanged()
                          })
                        }
                      }}
                    >
                      <X size={16} />
                    </button>
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
      {distretti.length === 0 && (
        <p className="hint">
          Nessun distretto: aggiungine uno col pulsante + qui sopra (es. Rachide cervicale).
        </p>
      )}

      {nuovoAperto && (
        <div className="modal-overlay" onClick={() => setNuovoAperto(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>Nuovo distretto</h3>
            <label>
              Nome del distretto
              <input
                autoFocus
                placeholder="es. Rachide cervicale"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') crea()
                  if (e.key === 'Escape') setNuovoAperto(false)
                }}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setNuovoAperto(false)}>Annulla</button>
              <button className="primary" disabled={!nome.trim()} onClick={crea}>
                Crea
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function EditorDistretto({
  id,
  onChanged
}: {
  id: number
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [dati, setDati] = useState<DistrettoCompleto | null>(null)
  const [modificato, setModificato] = useState(false)

  useEffect(() => {
    window.api.distretti
      .get(id)
      .then(setDati)
      .catch((e) => toastErrore(errMsg(e)))
  }, [id])

  if (!dati) return <p className="hint">Caricamento…</p>

  const aggiorna = (patch: Partial<DistrettoCompleto>): void => {
    setDati({ ...dati, ...patch })
    setModificato(true)
  }

  const salva = async (): Promise<void> => {
    try {
      await window.api.distretti.salva(dati)
      setDati(await window.api.distretti.get(id))
      setModificato(false)
      await onChanged()
      toast('Distretto salvato.')
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <Movimenti movimenti={dati.movimenti} onChange={(movimenti) => aggiorna({ movimenti })} />
      <TestDistrettuali test={dati.test} onChange={(test) => aggiorna({ test })} />

      <div className="modal-actions">
        {modificato && <span className="hint">Ci sono modifiche non salvate.</span>}
        <button className="primary" disabled={!modificato} onClick={() => void salva()}>
          Salva distretto
        </button>
      </div>
    </section>
  )
}

function Movimenti({
  movimenti,
  onChange
}: {
  movimenti: MovimentoDistretto[]
  onChange: (m: MovimentoDistretto[]) => void
}): React.JSX.Element {
  const { contenitore, presa } = useRiordino<number>((da, a) =>
    onChange(sposta(movimenti, da, a))
  )

  return (
    <div className="lista-domande">
      <div className="sotto-titolo">Movimenti</div>

      {movimenti.map((m, i) => {
        const dnd = contenitore(i)
        return (
          <div key={i} {...dnd} {...presa(i)} className={['riga-parametro', dnd.className].filter(Boolean).join(' ')}>
            <input
              placeholder="es. Rotazione destra"
              value={m.nome}
              onChange={(e) =>
                onChange(movimenti.map((x, j) => (i === j ? { ...x, nome: e.target.value } : x)))
              }
            />
            <label className="checkbox-inline" title="Misuro l'escursione in gradi">
              <input
                type="checkbox"
                checked={m.gradi === 1}
                onChange={(e) =>
                  onChange(
                    movimenti.map((x, j) => (i === j ? { ...x, gradi: e.target.checked ? 1 : 0 } : x))
                  )
                }
              />
              gradi
            </label>
            <span className="item-actions-static">
              <button
                className="danger"
                title="Elimina movimento"
                onClick={() => onChange(movimenti.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </button>
            </span>
          </div>
        )
      })}

      <button onClick={() => onChange([...movimenti, { id: nuovaChiave(), nome: '', gradi: 0 }])}>
        <Plus size={16} /> Aggiungi movimento
      </button>
    </div>
  )
}

function TestDistrettuali({
  test,
  onChange
}: {
  test: TestDistretto[]
  onChange: (t: TestDistretto[]) => void
}): React.JSX.Element {
  const { contenitore, presa } = useRiordino<number>((da, a) => onChange(sposta(test, da, a)))

  const modifica = (i: number, patch: Partial<TestDistretto>): void =>
    onChange(test.map((t, j) => (i === j ? { ...t, ...patch } : t)))

  return (
    <div className="lista-domande">
      <div className="sotto-titolo">Test</div>

      {test.map((t, i) => {
        const dnd = contenitore(i)
        return (
          <div key={i} {...dnd} {...presa(i)} className={['riga-parametro', dnd.className].filter(Boolean).join(' ')}>
            <input
              placeholder="es. Test di Spurling"
              value={t.nome}
              onChange={(e) => modifica(i, { nome: e.target.value })}
            />
            <select
              value={t.gruppo}
              onChange={(e) => modifica(i, { gruppo: e.target.value as GruppoTest })}
            >
              {GRUPPI.map((g) => (
                <option key={g.valore} value={g.valore}>
                  {g.etichetta}
                </option>
              ))}
            </select>
            <select
              value={t.risposta}
              onChange={(e) => modifica(i, { risposta: e.target.value as RispostaTest })}
            >
              {RISPOSTE.map((r) => (
                <option key={r.valore} value={r.valore}>
                  {r.etichetta}
                </option>
              ))}
            </select>
            <span className="item-actions-static">
              <button
                className="danger"
                title="Elimina test"
                onClick={() => onChange(test.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </button>
            </span>
          </div>
        )
      })}

      <button
        onClick={() =>
          onChange([
            ...test,
            { id: nuovaChiave(), nome: '', gruppo: 'provocazione', risposta: 'posneg' }
          ])
        }
      >
        <Plus size={16} /> Aggiungi test
      </button>
    </div>
  )
}
