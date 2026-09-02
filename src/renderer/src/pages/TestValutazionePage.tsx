import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, GripVertical, Pencil, Plus, X } from 'lucide-react'
import type {
  CalcoloMisura,
  CategoriaTest,
  DirezioneCutoff,
  MisuraTest,
  ParametroTest,
  RiassuntoMisura,
  TestValutazione,
  TestValutazioneCompleto
} from '../../../shared/types'
import { toast, toastErrore } from '../components/Toast'
import ElencoCategorie from '../components/ElencoCategorie'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

const RIASSUNTI: { valore: RiassuntoMisura; etichetta: string }[] = [
  { valore: 'migliore', etichetta: 'la prova migliore' },
  { valore: 'media', etichetta: 'la media delle prove' },
  { valore: 'peggiore', etichetta: 'la prova peggiore' }
]

export default function TestValutazionePage(): React.JSX.Element {
  const [categorie, setCategorie] = useState<CategoriaTest[]>([])
  const [test, setTest] = useState<TestValutazione[]>([])
  const [catId, setCatId] = useState<number | null>(null)
  const [apertoId, setApertoId] = useState<number | null>(null)

  const loadCategorie = useCallback(
    (): Promise<void> => window.api.testCategorie.list().then(setCategorie),
    []
  )
  const loadTest = useCallback(
    (): Promise<void> => window.api.testValutazione.list(false).then(setTest),
    []
  )

  useEffect(() => {
    void loadCategorie()
    void loadTest()
  }, [loadCategorie, loadTest])

  const categoria = categorie.find((c) => c.id === catId) ?? null
  const aperto = test.find((t) => t.id === apertoId) ?? null

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>Test di valutazione</h2>
        <p>
          I test da letteratura che usi per valutare i pazienti, raccolti per categoria: per
          ognuno il protocollo, i parametri di esecuzione e le misure con i valori di riferimento.
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
          api={window.api.testCategorie}
          etichettaNuova="Nuova categoria di test"
          esempio="es. Test di salto"
          avvisoElimina="Verranno eliminati anche i test che contiene."
          onApri={setCatId}
          onChanged={loadCategorie}
        />
      ) : aperto == null ? (
        <ElencoTest
          categoriaId={categoria.id}
          test={test.filter((t) => t.categoria_id === categoria.id)}
          onApri={setApertoId}
          onChanged={loadTest}
        />
      ) : (
        <EditorTest key={aperto.id} id={aperto.id} onChanged={loadTest} />
      )}
    </div>
  )
}

function ElencoTest({
  categoriaId,
  test,
  onApri,
  onChanged
}: {
  categoriaId: number
  test: TestValutazione[]
  onApri: (id: number) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [ricerca, setRicerca] = useState('')
  const [nuovoAperto, setNuovoAperto] = useState(false)
  const [nome, setNome] = useState('')
  const [edit, setEdit] = useState<{ id: number; nome: string } | null>(null)

  const q = ricerca.trim().toLowerCase()
  const filtrati = test.filter((t) => q === '' || t.nome.toLowerCase().includes(q))

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const { contenitore, maniglia } = useRiordino<number>((da, a) => {
    const ids = sposta(test, da, a).map((t) => t.id)
    void run(async () => {
      await window.api.testValutazione.reorder(ids)
      await onChanged()
    })
  })

  const crea = (): void => {
    const n = nome.trim()
    if (!n) return
    void run(async () => {
      const id = await window.api.testValutazione.create(n, categoriaId)
      setNome('')
      setNuovoAperto(false)
      await onChanged()
      onApri(id)
    })
  }

  const salvaRinomina = (): void => {
    if (!edit || !edit.nome.trim()) return
    void run(async () => {
      const completo = await window.api.testValutazione.get(edit.id)
      await window.api.testValutazione.salva({
        ...completo,
        test: { ...completo.test, nome: edit.nome.trim() }
      })
      setEdit(null)
      await onChanged()
    })
  }

  return (
    <section className="card step-card">
      <div className="step-head">
        <div className="step-title">
          <span className="step-num">2</span>
          <h3>Scegli il test</h3>
        </div>
        <div className="ricerca-con-azione">
          <input
            type="search"
            className="ricerca-compatta"
            placeholder="Cerca test…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
          <button
            className="primary btn-icona"
            title="Aggiungi un test"
            onClick={() => setNuovoAperto(true)}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="scelta-tiles">
        {filtrati.map((t, idx) => {
          const dnd = contenitore(idx)
          return (
            <div
              key={t.id}
              {...dnd}
              className={['scelta-tile', dnd.className].filter(Boolean).join(' ')}
              onClick={() => onApri(t.id)}
            >
              {edit && edit.id === t.id ? (
                <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={edit.nome}
                    onChange={(e) => setEdit({ id: t.id, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvaRinomina()
                      if (e.key === 'Escape') setEdit(null)
                    }}
                  />
                  <button onClick={salvaRinomina}>OK</button>
                </span>
              ) : (
                <>
                  <span className="scelta-tile-nome">{t.nome}</span>
                  <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                    <button {...maniglia(idx)}>
                      <GripVertical size={16} />
                    </button>
                    <button title="Rinomina" onClick={() => setEdit({ id: t.id, nome: t.nome })}>
                      <Pencil size={16} />
                    </button>
                    <button
                      title="Elimina"
                      className="danger"
                      onClick={() => {
                        if (confirm(`Eliminare il test "${t.nome}"?`)) {
                          void run(async () => {
                            await window.api.testValutazione.remove(t.id)
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
          {test.length === 0
            ? 'Nessun test: aggiungine uno col pulsante + qui sopra (es. Drop Jump Test).'
            : 'Nessun risultato per la ricerca.'}
        </p>
      )}

      {nuovoAperto && (
        <div className="modal-overlay" onClick={() => setNuovoAperto(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>Nuovo test di valutazione</h3>
            <label>
              Nome del test
              <input
                autoFocus
                placeholder="es. Drop Jump Test"
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

function EditorTest({
  id,
  onChanged
}: {
  id: number
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [dati, setDati] = useState<TestValutazioneCompleto | null>(null)
  const [modificato, setModificato] = useState(false)

  useEffect(() => {
    window.api.testValutazione
      .get(id)
      .then(setDati)
      .catch((e) => toastErrore(errMsg(e)))
  }, [id])

  if (!dati) return <p className="hint">Caricamento…</p>

  const aggiorna = (patch: Partial<TestValutazioneCompleto>): void => {
    setDati({ ...dati, ...patch })
    setModificato(true)
  }
  const aggiornaTest = (patch: Partial<TestValutazioneCompleto['test']>): void =>
    aggiorna({ test: { ...dati.test, ...patch } })

  const salva = async (): Promise<void> => {
    try {
      await window.api.testValutazione.salva(dati)
      setDati(await window.api.testValutazione.get(id))
      setModificato(false)
      await onChanged()
      toast('Test salvato.')
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <label>
        A cosa serve
        <textarea
          rows={1}
          placeholder="es. Valuta il controllo dinamico del ginocchio all'atterraggio e la capacità reattiva"
          value={dati.test.descrizione ?? ''}
          onChange={(e) => aggiornaTest({ descrizione: e.target.value || null })}
        />
      </label>
      <label>
        Come si esegue (protocollo)
        <textarea
          rows={1}
          placeholder="es. Dal box, cadere con entrambi i piedi e saltare subito il più in alto possibile"
          value={dati.test.protocollo ?? ''}
          onChange={(e) => aggiornaTest({ protocollo: e.target.value || null })}
        />
      </label>

      <div className="form-row-2">
        <label>
          Link all&apos;esecuzione (facoltativo)
          <input
            placeholder="es. video che mostra come si esegue"
            value={dati.test.link ?? ''}
            onChange={(e) => aggiornaTest({ link: e.target.value || null })}
          />
        </label>
        <label>
          Numero di prove
          <input
            type="number"
            min={1}
            value={dati.test.prove}
            onChange={(e) => aggiornaTest({ prove: Math.max(1, Number(e.target.value)) })}
          />
        </label>
      </div>

      {/* I test monopodalici si registrano gamba per gamba: e' da qui che nasce
          il confronto fra destra e sinistra. */}
      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={dati.test.per_lato === 1}
          onChange={(e) => aggiornaTest({ per_lato: e.target.checked ? 1 : 0 })}
        />
        Si esegue una gamba per volta (destra e sinistra separate)
      </label>

      {/* La soglia sull'LSI e' cosa diversa da quella sulla misura: qui si
          confronta il rapporto fra i due arti, non il valore misurato. */}
      {dati.test.per_lato === 1 && (
        <div className="regola-fascia">
          <span className="regola-parola">simmetria sufficiente da</span>
          <input
            type="number"
            className="campo-stretto"
            placeholder="es. 90"
            value={dati.test.lsi_cutoff ?? ''}
            onChange={(e) =>
              aggiornaTest({
                lsi_cutoff: e.target.value === '' ? null : Number(e.target.value)
              })
            }
          />
          <span className="regola-parola">% in su</span>
          {dati.test.lsi_cutoff == null && (
            <span className="hint">senza soglia l&apos;asimmetria si mostra, non si giudica</span>
          )}
        </div>
      )}

      <Parametri
        parametri={dati.parametri}
        onChange={(parametri) => aggiorna({ parametri })}
      />
      <Misure
        misure={dati.misure}
        prove={dati.test.prove}
        onChange={(misure) => aggiorna({ misure })}
      />

      <div className="modal-actions">
        {modificato && <span className="hint">Ci sono modifiche non salvate.</span>}
        <button className="primary" disabled={!modificato} onClick={() => void salva()}>
          Salva test
        </button>
      </div>
    </section>
  )
}

// Il setup fisso del test: quello che resta uguale a ogni somministrazione.
function Parametri({
  parametri,
  onChange
}: {
  parametri: ParametroTest[]
  onChange: (p: ParametroTest[]) => void
}): React.JSX.Element {
  const { contenitore, maniglia } = useRiordino<number>((da, a) =>
    onChange(sposta(parametri, da, a))
  )
  const modifica = (i: number, patch: Partial<ParametroTest>): void =>
    onChange(parametri.map((p, j) => (i === j ? { ...p, ...patch } : p)))

  return (
    <div className="lista-domande">
      <div className="sotto-titolo">Parametri di esecuzione</div>
      <p className="modal-testo">
        Il setup del test, quello che resta uguale ogni volta: es. altezza del box 30 cm, recupero
        tra le prove 30 s.
      </p>
      {parametri.map((p, i) => {
        const dnd = contenitore(i)
        return (
          <div key={i} {...dnd} className={['riga-parametro', dnd.className].filter(Boolean).join(' ')}>
            <input
              placeholder="Parametro (es. Altezza del box)"
              value={p.nome}
              onChange={(e) => modifica(i, { nome: e.target.value })}
            />
            <input
              className="campo-stretto"
              placeholder="Valore"
              value={p.valore ?? ''}
              onChange={(e) => modifica(i, { valore: e.target.value || null })}
            />
            <input
              className="campo-stretto"
              placeholder="Unità"
              value={p.unita ?? ''}
              onChange={(e) => modifica(i, { unita: e.target.value || null })}
            />
            <span className="item-actions-static">
              <button {...maniglia(i)}>
                <GripVertical size={16} />
              </button>
              <button
                className="danger"
                title="Elimina parametro"
                onClick={() => onChange(parametri.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </button>
            </span>
          </div>
        )
      })}
      <button
        onClick={() => onChange([...parametri, { id: null, nome: '', valore: null, unita: null }])}
      >
        <Plus size={16} /> Aggiungi parametro
      </button>
    </div>
  )
}

// Cosa si registra, e con quale valore di riferimento.
function Misure({
  misure,
  prove,
  onChange
}: {
  misure: MisuraTest[]
  prove: number
  onChange: (m: MisuraTest[]) => void
}): React.JSX.Element {
  const { contenitore, maniglia } = useRiordino<number>((da, a) => onChange(sposta(misure, da, a)))
  const modifica = (i: number, patch: Partial<MisuraTest>): void =>
    onChange(misure.map((m, j) => (i === j ? { ...m, ...patch } : m)))

  return (
    <div className="lista-domande">
      <div className="sotto-titolo">Misure</div>
      <p className="modal-testo">
        Cosa registri. Una misura si può prendere <b>a ogni prova</b> (es. l&apos;altezza del
        salto) oppure <b>una volta sola</b> per tutto il test (es. la simmetria fra i due arti). Se
        metti una soglia, l&apos;app ti dirà se il test è superato.
      </p>

      {misure.map((m, i) => {
        const dnd = contenitore(i)
        return (
          <div key={i} {...dnd} className={['domanda-card', dnd.className].filter(Boolean).join(' ')}>
            <div className="domanda-testata">
              <span className="domanda-numero">{i + 1}</span>
              <input
                className="domanda-testo"
                placeholder="Misura (es. Altezza del salto)"
                value={m.nome}
                onChange={(e) => modifica(i, { nome: e.target.value })}
              />
              <input
                className="campo-stretto"
                placeholder="Unità"
                value={m.unita ?? ''}
                onChange={(e) => modifica(i, { unita: e.target.value || null })}
              />
              <span className="item-actions-static">
                <button {...maniglia(i)}>
                  <GripVertical size={16} />
                </button>
                <button
                  className="danger"
                  title="Elimina misura"
                  onClick={() => onChange(misure.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </span>
            </div>

            <div className="regola-fascia">
              <span className="regola-parola">si registra</span>
              <select
                value={m.per_prova}
                onChange={(e) => modifica(i, { per_prova: Number(e.target.value) as 0 | 1 })}
              >
                <option value={1}>a ogni prova</option>
                <option value={0}>una volta sola</option>
              </select>
              {m.per_prova === 1 && prove > 1 && (
                <>
                  <span className="regola-parola">e vale</span>
                  <select
                    value={m.riassunto}
                    onChange={(e) =>
                      modifica(i, { riassunto: e.target.value as RiassuntoMisura })
                    }
                  >
                    {RIASSUNTI.map((r) => (
                      <option key={r.valore} value={r.valore}>
                        {r.etichetta}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className="regola-fascia">
              <span className="regola-parola">superato se</span>
              <select
                value={m.cutoff_direzione ?? 'min'}
                disabled={m.cutoff == null}
                onChange={(e) =>
                  modifica(i, { cutoff_direzione: e.target.value as DirezioneCutoff })
                }
              >
                <option value="min">almeno</option>
                <option value="max">al massimo</option>
              </select>
              <input
                type="number"
                placeholder="soglia"
                value={m.cutoff ?? ''}
                onChange={(e) =>
                  modifica(i, {
                    cutoff: e.target.value === '' ? null : Number(e.target.value),
                    cutoff_direzione: m.cutoff_direzione ?? 'min'
                  })
                }
              />
              <span className="regola-parola">{m.unita ?? ''}</span>
              {m.cutoff == null && <span className="hint">senza soglia: solo registrata</span>}
            </div>

            {/* Misure ricavate da altre due dello stesso test: l'EUR e' CMJ
                diviso Squat Jump. Le fonti devono essere gia' salvate, perche'
                una misura appena aggiunta non ha ancora un id da citare. */}
            <div className="regola-fascia">
              <span className="regola-parola">si ottiene</span>
              <select
                value={m.calcolo ?? ''}
                onChange={(e) =>
                  modifica(i, {
                    calcolo: e.target.value === '' ? null : (e.target.value as CalcoloMisura),
                    calcolo_a: e.target.value === '' ? null : m.calcolo_a,
                    calcolo_b: e.target.value === '' ? null : m.calcolo_b
                  })
                }
              >
                <option value="">misurandola</option>
                <option value="rapporto">dividendo</option>
                <option value="differenza">sottraendo</option>
              </select>
              {m.calcolo != null && (
                <>
                  <FonteMisura
                    misure={misure}
                    escludi={m.id}
                    valore={m.calcolo_a}
                    onScegli={(v) => modifica(i, { calcolo_a: v })}
                  />
                  <span className="regola-parola">
                    {m.calcolo === 'rapporto' ? 'per' : 'meno'}
                  </span>
                  <FonteMisura
                    misure={misure}
                    escludi={m.id}
                    valore={m.calcolo_b}
                    onScegli={(v) => modifica(i, { calcolo_b: v })}
                  />
                </>
              )}
            </div>
          </div>
        )
      })}

      <button
        onClick={() =>
          onChange([
            ...misure,
            {
              id: null,
              nome: '',
              unita: null,
              per_prova: 1,
              riassunto: 'migliore',
              calcolo: null,
              calcolo_a: null,
              calcolo_b: null,
              cutoff: null,
              cutoff_direzione: null
            }
          ])
        }
      >
        <Plus size={16} /> Aggiungi misura
      </button>
    </div>
  )
}

// Le misure che si possono usare come fonte di un calcolo: solo quelle gia'
// salvate (hanno un id) e diverse da quella che si sta impostando.
function FonteMisura({
  misure,
  escludi,
  valore,
  onScegli
}: {
  misure: MisuraTest[]
  escludi: number | null
  valore: number | null
  onScegli: (v: number | null) => void
}): React.JSX.Element {
  const scelte = misure.filter((m) => m.id != null && m.id !== escludi)
  if (scelte.length === 0) {
    return <span className="hint">salva prima le misure da usare nel calcolo</span>
  }
  return (
    <select
      value={valore ?? ''}
      onChange={(e) => onScegli(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">— scegli —</option>
      {scelte.map((m) => (
        <option key={m.id} value={m.id ?? undefined}>
          {m.nome || 'senza nome'}
        </option>
      ))}
    </select>
  )
}
