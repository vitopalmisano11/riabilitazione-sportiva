import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, GripVertical, Pencil, Plus, X } from 'lucide-react'
import type {
  CategoriaQuestionario,
  DomandaQuestionario,
  FasciaQuestionario,
  PunteggioQuestionario,
  Questionario,
  QuestionarioCompleto,
  TipoDomanda
} from '../../../shared/types'
import { toast, toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import ElencoCategorie from '../components/ElencoCategorie'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

const TIPI: { valore: TipoDomanda; etichetta: string }[] = [
  { valore: 'si_no', etichetta: 'Sì / No' },
  { valore: 'scala', etichetta: 'Scala numerica' },
  { valore: 'scelta', etichetta: 'Scelta con punteggi' }
]

// Id provvisori per quello che non e' ancora salvato: negativi e stabili per
// tutta la sessione, cosi' una fascia puo' citare un punteggio appena creato.
let prossimoIdTemporaneo = -1
const idTemporaneo = (): number => prossimoIdTemporaneo--

type Tab = 'domande' | 'punteggi' | 'fasce'

const TABS: { key: Tab; label: string }[] = [
  { key: 'domande', label: 'Domande' },
  { key: 'punteggi', label: 'Punteggi' },
  { key: 'fasce', label: 'Fasce' }
]

// Ogni domanda e ogni punteggio ha un id anche prima di essere salvato: un
// numero negativo assegnato qui, stabile per tutta la sessione, che il processo
// principale traduce nel vero id al salvataggio. Serve perche' i riferimenti
// non si rompano riordinando o inserendo elementi.
let ultimaChiave = 0
const nuovaChiave = (): number => --ultimaChiave

export default function QuestionariPage(): React.JSX.Element {
  const [categorie, setCategorie] = useState<CategoriaQuestionario[]>([])
  const [questionari, setQuestionari] = useState<Questionario[]>([])
  const [catId, setCatId] = useState<number | null>(null)
  const [apertoId, setApertoId] = useState<number | null>(null)

  const loadCategorie = useCallback(
    (): Promise<void> => window.api.questionariCategorie.list().then(setCategorie),
    []
  )
  const loadQuestionari = useCallback(
    (): Promise<void> => window.api.questionari.list(false).then(setQuestionari),
    []
  )

  useEffect(() => {
    void loadCategorie()
    void loadQuestionari()
  }, [loadCategorie, loadQuestionari])

  const categoria = categorie.find((c) => c.id === catId) ?? null
  const aperto = questionari.find((q) => q.id === apertoId) ?? null

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>Questionari</h2>
        <p>
          I questionari che somministri ai pazienti (PROM), raccolti per categoria. Ogni domanda è
          un elenco di risposte che valgono un punteggio; puoi definire più punteggi e le fasce di
          risultato.
        </p>
      </header>

      {categoria && (
        <div className="briciole">
          <button
            className="briciola"
            onClick={() => {
              setApertoId(null)
              setCatId(null)
            }}
          >
            Categorie
          </button>
          <ChevronRight size={16} />
          <button className="briciola" disabled={aperto == null} onClick={() => setApertoId(null)}>
            {categoria.nome}
          </button>
          {aperto && (
            <>
              <ChevronRight size={16} />
              <span className="briciola corrente">{aperto.nome}</span>
            </>
          )}
        </div>
      )}

      {categoria == null ? (
        <ElencoCategorie
          categorie={categorie}
          api={window.api.questionariCategorie}
          etichettaNuova="Nuova categoria di questionari"
          esempio="es. Rachide"
          avvisoElimina="Verranno eliminati anche i questionari che contiene e le compilazioni dei pazienti."
          onApri={setCatId}
          onChanged={loadCategorie}
        />
      ) : aperto == null ? (
        <ElencoQuestionari
          categoriaId={categoria.id}
          questionari={questionari.filter((q) => q.categoria_id === categoria.id)}
          onApri={setApertoId}
          onChanged={loadQuestionari}
        />
      ) : (
        <EditorQuestionario key={aperto.id} id={aperto.id} onChanged={loadQuestionari} />
      )}
    </div>
  )
}

function ElencoQuestionari({
  categoriaId,
  questionari,
  onApri,
  onChanged
}: {
  categoriaId: number
  questionari: Questionario[]
  onApri: (id: number) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [ricerca, setRicerca] = useState('')
  const [nuovoAperto, setNuovoAperto] = useState(false)
  const [nome, setNome] = useState('')
  const [edit, setEdit] = useState<{ id: number; nome: string } | null>(null)

  const q = ricerca.trim().toLowerCase()
  const filtrati = questionari.filter((x) => q === '' || x.nome.toLowerCase().includes(q))

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const { contenitore, maniglia } = useRiordino<number>((da, a) => {
    const ids = sposta(questionari, da, a).map((x) => x.id)
    void run(async () => {
      await window.api.questionari.reorder(ids)
      await onChanged()
    })
  })

  const salvaRinomina = (): void => {
    if (!edit || !edit.nome.trim()) return
    void run(async () => {
      const completo = await window.api.questionari.get(edit.id)
      await window.api.questionari.salva({
        ...completo,
        questionario: { ...completo.questionario, nome: edit.nome.trim() }
      })
      setEdit(null)
      await onChanged()
    })
  }

  const crea = (): void => {
    const n = nome.trim()
    if (!n) return
    void run(async () => {
      const id = await window.api.questionari.create(n, categoriaId)
      setNome('')
      setNuovoAperto(false)
      await onChanged()
      onApri(id)
    })
  }

  return (
    <section className="card step-card">
      <div className="step-head">
        <div className="step-title">
          <span className="step-num">2</span>
          <h3>Scegli il questionario</h3>
        </div>
        <div className="ricerca-con-azione">
          <input
            type="search"
            className="ricerca-compatta"
            placeholder="Cerca questionario…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
          <button
            className="primary btn-icona"
            title="Aggiungi un questionario"
            onClick={() => setNuovoAperto(true)}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="scelta-tiles">
        {filtrati.map((x, idx) => {
          const dnd = contenitore(idx)
          return (
            <div
              key={x.id}
              {...dnd}
              className={['scelta-tile', dnd.className].filter(Boolean).join(' ')}
              onClick={() => onApri(x.id)}
            >
              {edit?.id === x.id ? (
                <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={edit.nome}
                    onChange={(e) => setEdit({ id: x.id, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvaRinomina()
                      if (e.key === 'Escape') setEdit(null)
                    }}
                  />
                  <button onClick={salvaRinomina}>OK</button>
                </span>
              ) : (
                <>
              <span className="scelta-tile-nome">{x.nome}</span>
              <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                <button {...maniglia(idx)}>
                  <GripVertical size={16} />
                </button>
                <button title="Rinomina" onClick={() => setEdit({ id: x.id, nome: x.nome })}>
                  <Pencil size={16} />
                </button>
                <button
                  title="Elimina"
                  className="danger"
                  onClick={async () => {
                    if (
                      await chiedi(
                        `Eliminare "${x.nome}"?\nVerranno eliminate anche le compilazioni fatte dai pazienti.`
                      )
                    ) {
                      void run(async () => {
                        await window.api.questionari.remove(x.id)
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
      {filtrati.length === 0 && (
        <p className="hint">
          {questionari.length === 0
            ? 'Nessun questionario: aggiungine uno col pulsante + qui sopra.'
            : 'Nessun risultato per la ricerca.'}
        </p>
      )}

      {nuovoAperto && (
        <div className="modal-overlay" onClick={() => setNuovoAperto(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>Nuovo questionario</h3>
            <label>
              Nome del questionario
              <input
                autoFocus
                placeholder="es. StarT Back"
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

function EditorQuestionario({
  id,
  onChanged
}: {
  id: number
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [dati, setDati] = useState<QuestionarioCompleto | null>(null)
  const [tab, setTab] = useState<Tab>('domande')
  const [modificato, setModificato] = useState(false)

  useEffect(() => {
    window.api.questionari
      .get(id)
      .then(setDati)
      .catch((e) => toastErrore(errMsg(e)))
  }, [id])

  if (!dati) return <p className="hint">Caricamento…</p>

  const aggiorna = (patch: Partial<QuestionarioCompleto>): void => {
    setDati({ ...dati, ...patch })
    setModificato(true)
  }

  const salva = async (): Promise<void> => {
    try {
      await window.api.questionari.salva(dati)
      const fresco = await window.api.questionari.get(id)
      setDati(fresco)
      setModificato(false)
      await onChanged()
      toast('Questionario salvato.')
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="config-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <label>
        Istruzioni per il paziente (facoltative)
        <textarea
          rows={1}
          placeholder="es. Pensando alle ultime due settimane, indichi la risposta…"
          value={dati.questionario.istruzioni ?? ''}
          onChange={(e) =>
            aggiorna({ questionario: { ...dati.questionario, istruzioni: e.target.value || null } })
          }
        />
      </label>

      {tab === 'domande' && (
        <TabDomande
          domande={dati.domande}
          onChange={(domande) => aggiorna({ domande })}
        />
      )}
      {tab === 'punteggi' && (
        <TabPunteggi
          domande={dati.domande}
          punteggi={dati.punteggi}
          onChange={(punteggi) => aggiorna({ punteggi })}
        />
      )}
      {tab === 'fasce' && (
        <TabFasce
          punteggi={dati.punteggi}
          fasce={dati.fasce}
          onChange={(fasce) => aggiorna({ fasce })}
        />
      )}

      <div className="modal-actions">
        {modificato && <span className="hint">Ci sono modifiche non salvate.</span>}
        <button className="primary" disabled={!modificato} onClick={() => void salva()}>
          Salva questionario
        </button>
      </div>
    </section>
  )
}

function TabDomande({
  domande,
  onChange
}: {
  domande: DomandaQuestionario[]
  onChange: (d: DomandaQuestionario[]) => void
}): React.JSX.Element {
  const { contenitore, maniglia } = useRiordino<number>((da, a) =>
    onChange(sposta(domande, da, a))
  )

  const modifica = (i: number, patch: Partial<DomandaQuestionario>): void =>
    onChange(domande.map((d, j) => (i === j ? { ...d, ...patch } : d)))

  return (
    <div className="lista-domande">
      <p className="modal-testo">
        Ogni domanda vale un punteggio. <b>Sì / No</b> vale 0 o 1. <b>Scala numerica</b> vale il
        numero scelto. <b>Scelta con punteggi</b> ti lascia scrivere le risposte e quanto vale
        ciascuna — serve per domande come &ldquo;per niente / un poco / moderatamente&rdquo;.
      </p>

      {domande.map((d, i) => {
        const dnd = contenitore(i)
        return (
          <div key={i} {...dnd} className={['domanda-card', dnd.className].filter(Boolean).join(' ')}>
            <div className="domanda-testata">
              <span className="domanda-numero">{i + 1}</span>
              <input
                className="domanda-testo"
                placeholder="Testo della domanda"
                value={d.testo}
                onChange={(e) => modifica(i, { testo: e.target.value })}
              />
              <select
                value={d.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoDomanda
                  modifica(i, {
                    tipo,
                    scala_min: tipo === 'scala' ? (d.scala_min ?? 0) : null,
                    scala_max: tipo === 'scala' ? (d.scala_max ?? 10) : null,
                    opzioni: tipo === 'scelta' && d.opzioni.length === 0 ? [] : d.opzioni
                  })
                }}
              >
                {TIPI.map((t) => (
                  <option key={t.valore} value={t.valore}>
                    {t.etichetta}
                  </option>
                ))}
              </select>
              <span className="item-actions-static">
                <button {...maniglia(i)}>
                  <GripVertical size={16} />
                </button>
                <button
                  title="Elimina domanda"
                  className="danger"
                  onClick={() => onChange(domande.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </span>
            </div>

            {d.tipo === 'scala' && (
              <div className="form-row-2">
                <label>
                  Da
                  <input
                    type="number"
                    value={d.scala_min ?? 0}
                    onChange={(e) => modifica(i, { scala_min: Number(e.target.value) })}
                  />
                </label>
                <label>
                  A
                  <input
                    type="number"
                    value={d.scala_max ?? 10}
                    onChange={(e) => modifica(i, { scala_max: Number(e.target.value) })}
                  />
                </label>
              </div>
            )}

            {d.tipo === 'scelta' && (
              <div className="opzioni-domanda">
                {d.opzioni.map((o, k) => (
                  <div key={k} className="opzione-riga">
                    <input
                      placeholder="Testo della risposta"
                      value={o.etichetta}
                      onChange={(e) =>
                        modifica(i, {
                          opzioni: d.opzioni.map((x, j) =>
                            j === k ? { ...x, etichetta: e.target.value } : x
                          )
                        })
                      }
                    />
                    <input
                      type="number"
                      className="opzione-punteggio"
                      title="Quanto vale questa risposta"
                      value={o.punteggio}
                      onChange={(e) =>
                        modifica(i, {
                          opzioni: d.opzioni.map((x, j) =>
                            j === k ? { ...x, punteggio: Number(e.target.value) } : x
                          )
                        })
                      }
                    />
                    <button
                      className="danger"
                      title="Togli questa risposta"
                      onClick={() =>
                        modifica(i, { opzioni: d.opzioni.filter((_, j) => j !== k) })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    modifica(i, {
                      opzioni: [...d.opzioni, { id: null, etichetta: '', punteggio: 0 }]
                    })
                  }
                >
                  <Plus size={16} /> Aggiungi risposta
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={() =>
          onChange([
            ...domande,
            {
              id: nuovaChiave(),
              testo: '',
              tipo: 'si_no',
              scala_min: null,
              scala_max: null,
              opzioni: []
            }
          ])
        }
      >
        <Plus size={16} /> Aggiungi domanda
      </button>
    </div>
  )
}

function TabPunteggi({
  domande,
  punteggi,
  onChange
}: {
  domande: DomandaQuestionario[]
  punteggi: PunteggioQuestionario[]
  onChange: (p: PunteggioQuestionario[]) => void
}): React.JSX.Element {
  const modifica = (i: number, patch: Partial<PunteggioQuestionario>): void =>
    onChange(punteggi.map((p, j) => (i === j ? { ...p, ...patch } : p)))

  return (
    <div className="lista-domande">
      <p className="modal-testo">
        Un punteggio è la somma di alcune domande. Di solito ne basta uno
        (&ldquo;Totale&rdquo;, tutte le domande), ma puoi aggiungerne altri se il questionario lo
        richiede — per esempio un sotto-punteggio calcolato solo sulle ultime domande.
      </p>

      {punteggi.map((p, i) => (
        <div key={i} className="domanda-card">
          <div className="domanda-testata">
            <input
              className="domanda-testo"
              placeholder="Nome del punteggio (es. Totale)"
              value={p.nome}
              onChange={(e) => modifica(i, { nome: e.target.value })}
            />
            <span className="item-actions-static">
              <button
                title="Elimina punteggio"
                className="danger"
                onClick={() => onChange(punteggi.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </button>
            </span>
          </div>
          <ul className="checkbox-list">
            {domande.map((d, k) => {
              const rif = d.id ?? 0
              const dentro = p.domanda_ids.includes(rif)
              return (
                <li key={k}>
                  <label>
                    <input
                      type="checkbox"
                      checked={dentro}
                      onChange={() =>
                        modifica(i, {
                          domanda_ids: dentro
                            ? p.domanda_ids.filter((x) => x !== rif)
                            : [...p.domanda_ids, rif]
                        })
                      }
                    />
                    {k + 1}. {d.testo || <span className="hint">domanda senza testo</span>}
                  </label>
                </li>
              )
            })}
            {domande.length === 0 && <li className="empty">Aggiungi prima le domande.</li>}
          </ul>
        </div>
      ))}

      <button
        onClick={() =>
          onChange([...punteggi, { id: idTemporaneo(), nome: '', domanda_ids: [] }])
        }
      >
        <Plus size={16} /> Aggiungi punteggio
      </button>
    </div>
  )
}

function TabFasce({
  punteggi,
  fasce,
  onChange
}: {
  punteggi: PunteggioQuestionario[]
  fasce: FasciaQuestionario[]
  onChange: (f: FasciaQuestionario[]) => void
}): React.JSX.Element {
  const { contenitore, maniglia } = useRiordino<number>((da, a) => onChange(sposta(fasce, da, a)))

  const modifica = (i: number, patch: Partial<FasciaQuestionario>): void =>
    onChange(fasce.map((f, j) => (i === j ? { ...f, ...patch } : f)))

  // Solo i punteggi che hanno un id: uno appena aggiunto ne riceve uno negativo
  // provvisorio, tradotto nel vero id al salvataggio. Prima chi non l'aveva
  // finiva in elenco con valore 0, e la fascia restava agganciata a un punteggio
  // inesistente — quindi non si avverava mai e l'esito restava vuoto.
  const opzioniPunteggio = punteggi
    .filter((p): p is typeof p & { id: number } => p.id != null)
    .map((p, k) => ({ valore: p.id, nome: p.nome || `punteggio ${k + 1}` }))

  const numero = (v: string): number | null => (v === '' ? null : Number(v))

  return (
    <div className="lista-domande">
      <p className="modal-testo">
        Le fasce si leggono <b>dall&apos;alto verso il basso</b>: vince la prima riga che si avvera.
        Lascia vuoti i limiti che non ti servono. La seconda condizione è facoltativa e serve ai
        questionari che combinano due punteggi.
      </p>

      {fasce.map((f, i) => {
        const dnd = contenitore(i)
        return (
          <div key={i} {...dnd} className={['domanda-card', dnd.className].filter(Boolean).join(' ')}>
            <div className="domanda-testata">
              <span className="domanda-numero">{i + 1}</span>
              <input
                className="domanda-testo"
                placeholder="Risultato (es. Rischio basso)"
                value={f.etichetta}
                onChange={(e) => modifica(i, { etichetta: e.target.value })}
              />
              <span className="item-actions-static">
                <button {...maniglia(i)}>
                  <GripVertical size={16} />
                </button>
                <button
                  title="Elimina fascia"
                  className="danger"
                  onClick={() => onChange(fasce.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </span>
            </div>

            <div className="regola-fascia">
              <span className="regola-parola">se</span>
              <select
                value={f.punteggio_id ?? ''}
                onChange={(e) => modifica(i, { punteggio_id: numero(e.target.value) })}
              >
                <option value="">— punteggio —</option>
                {opzioniPunteggio.map((o) => (
                  <option key={o.valore} value={o.valore}>
                    {o.nome}
                  </option>
                ))}
              </select>
              <span className="regola-parola">da</span>
              <input
                type="number"
                value={f.minimo ?? ''}
                onChange={(e) => modifica(i, { minimo: numero(e.target.value) })}
              />
              <span className="regola-parola">a</span>
              <input
                type="number"
                value={f.massimo ?? ''}
                onChange={(e) => modifica(i, { massimo: numero(e.target.value) })}
              />
            </div>

            <div className="regola-fascia">
              <span className="regola-parola">e</span>
              <select
                value={f.punteggio2_id ?? ''}
                onChange={(e) => modifica(i, { punteggio2_id: numero(e.target.value) })}
              >
                <option value="">— nessuna seconda condizione —</option>
                {opzioniPunteggio.map((o) => (
                  <option key={o.valore} value={o.valore}>
                    {o.nome}
                  </option>
                ))}
              </select>
              <span className="regola-parola">da</span>
              <input
                type="number"
                disabled={f.punteggio2_id == null}
                value={f.minimo2 ?? ''}
                onChange={(e) => modifica(i, { minimo2: numero(e.target.value) })}
              />
              <span className="regola-parola">a</span>
              <input
                type="number"
                disabled={f.punteggio2_id == null}
                value={f.massimo2 ?? ''}
                onChange={(e) => modifica(i, { massimo2: numero(e.target.value) })}
              />
            </div>
          </div>
        )
      })}

      <button
        onClick={() =>
          onChange([
            ...fasce,
            {
              id: null,
              etichetta: '',
              punteggio_id: null,
              minimo: null,
              massimo: null,
              punteggio2_id: null,
              minimo2: null,
              massimo2: null
            }
          ])
        }
      >
        <Plus size={16} /> Aggiungi fascia
      </button>
    </div>
  )
}
