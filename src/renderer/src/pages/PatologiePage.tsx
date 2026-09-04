import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, GripVertical, Pencil, Plus, X } from 'lucide-react'
import type {
  Categoria,
  Distretto,
  Fase,
  Obiettivo,
  Patologia,
  SezioneConCategorie,
  TestAvanzamento
} from '../../../shared/types'
import CrudList from '../components/CrudList'
import { sposta, useRiordino } from '../riordino'
import { toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg } from '../lib'

type Tab = 'struttura' | 'obiettivi' | 'test'

const TABS: { key: Tab; label: string }[] = [
  { key: 'struttura', label: 'Struttura della seduta' },
  { key: 'obiettivi', label: 'Obiettivi' },
  { key: 'test', label: 'Test di avanzamento' }
]

// Flusso progressivo: 1) scegli patologia -> 2) scegli fase -> 3) editor della fase
export default function PatologiePage(): React.JSX.Element {
  const [patologie, setPatologie] = useState<Patologia[]>([])
  const [selPatId, setSelPatId] = useState<number | null>(null)
  const [fasi, setFasi] = useState<Fase[]>([])
  const [selFaseId, setSelFaseId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('struttura')

  const loadPatologie = useCallback(
    (): Promise<void> => window.api.patologie.list().then(setPatologie),
    []
  )
  const loadFasi = useCallback((): Promise<void> => {
    if (selPatId == null) {
      setFasi([])
      return Promise.resolve()
    }
    return window.api.fasi.list(selPatId).then(setFasi)
  }, [selPatId])

  useEffect(() => {
    void loadPatologie()
  }, [loadPatologie])

  useEffect(() => {
    setSelFaseId(null)
    setTab('struttura')
    void loadFasi()
  }, [selPatId, loadFasi])

  const patSel = patologie.find((p) => p.id === selPatId) ?? null
  const faseSel = fasi.find((f) => f.id === selFaseId) ?? null

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>Patologie e fasi</h2>
      </header>

      {patSel && (
        <div className="briciole">
          <button className="briciola" onClick={() => setSelPatId(null)}>
            Patologie
          </button>
          <ChevronRight size={16} />
          <button
            className="briciola"
            disabled={faseSel == null}
            onClick={() => setSelFaseId(null)}
          >
            {patSel.nome}
          </button>
          {faseSel && (
            <>
              <ChevronRight size={16} />
              <span className="briciola corrente">{faseSel.nome}</span>
            </>
          )}
        </div>
      )}

      {patSel == null ? (
        <Step1Patologie patologie={patologie} onSelect={setSelPatId} onChanged={loadPatologie} />
      ) : faseSel == null ? (
        <Step2Fasi patologia={patSel} fasi={fasi} onSelect={setSelFaseId} onChanged={loadFasi} />
      ) : (
        <section className="card">
          <div className="config-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={tab === t.key ? 'active' : ''}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'struttura' && <StrutturaTab key={faseSel.id} faseId={faseSel.id} />}
          {tab === 'obiettivi' && <ObiettiviTab key={faseSel.id} faseId={faseSel.id} />}
          {tab === 'test' && <TestTab key={faseSel.id} faseId={faseSel.id} />}
        </section>
      )}
    </div>
  )
}

function Step1Patologie({
  patologie,
  onSelect,
  onChanged
}: {
  patologie: Patologia[]
  onSelect: (id: number) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [ricerca, setRicerca] = useState('')
  const [nuovaAperta, setNuovaAperta] = useState(false)
  const [edit, setEdit] = useState<{ id: number; nome: string } | null>(null)

  const q = ricerca.trim().toLowerCase()
  const filtrate = patologie.filter((p) => q === '' || p.nome.toLowerCase().includes(q))

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const aggiungi = (nome: string): void => {
    const n = nome.trim()
    if (!n) return
    void run(async () => {
      await window.api.patologie.create(n)
      setNuovaAperta(false)
      await onChanged()
    })
  }

  const salvaRename = (): void => {
    if (!edit || !edit.nome.trim()) return
    void run(async () => {
      await window.api.patologie.update(edit.id, edit.nome.trim())
      setEdit(null)
      await onChanged()
    })
  }

  const { contenitore, maniglia } = useRiordino<number>((da, a) => {
    const ids = sposta(patologie, da, a).map((p) => p.id)
    void run(async () => {
      await window.api.patologie.reorder(ids)
      await onChanged()
    })
  })

  return (
    <section className="card step-card">
      <div className="step-head">
        <div className="step-title">
          <span className="step-num">1</span>
          <h3>Scegli la patologia</h3>
        </div>
        <div className="ricerca-con-azione">
          <input
            type="search"
            className="ricerca-compatta"
            placeholder="Cerca patologia…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
          <button
            className="primary btn-icona"
            title="Aggiungi una patologia"
            onClick={() => setNuovaAperta(true)}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      <div className="scelta-tiles">
        {filtrate.map((p, idx) => {
          const dnd = contenitore(idx)
          return (
          <div
            key={p.id}
            {...dnd}
            className={['scelta-tile', dnd.className].filter(Boolean).join(' ')}
            onClick={() => onSelect(p.id)}
          >
            {edit && edit.id === p.id ? (
              <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={edit.nome}
                  onChange={(e) => setEdit({ id: p.id, nome: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvaRename()
                    if (e.key === 'Escape') setEdit(null)
                  }}
                />
                <button onClick={salvaRename}>OK</button>
              </span>
            ) : (
              <>
                <span className="scelta-tile-nome">{p.nome}</span>
                <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                  <button {...maniglia(idx)}>
                    <GripVertical size={16} />
                  </button>
                  <button title="Rinomina" onClick={() => setEdit({ id: p.id, nome: p.nome })}>
                    <Pencil size={16} />
                  </button>
                  <button
                    title="Elimina"
                    className="danger"
                    onClick={async () => {
                      if (await chiedi(`Eliminare "${p.nome}" con tutte le sue fasi?`)) {
                        void run(async () => {
                          await window.api.patologie.remove(p.id)
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
      {filtrate.length === 0 && (
        <p className="hint">
          {patologie.length === 0
            ? 'Nessuna patologia: aggiungine una col pulsante + qui sopra (es. Ricostruzione LCA).'
            : 'Nessun risultato per la ricerca.'}
        </p>
      )}
      {nuovaAperta && (
        <NuovaPatologiaModal onAnnulla={() => setNuovaAperta(false)} onConferma={aggiungi} />
      )}
    </section>
  )
}

function NuovaPatologiaModal({
  onAnnulla,
  onConferma
}: {
  onAnnulla: () => void
  onConferma: (nome: string) => void
}): React.JSX.Element {
  const [nome, setNome] = useState('')

  return (
    <div className="modal-overlay" onClick={onAnnulla}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <h3>Nuova patologia</h3>
        <label>
          Nome della patologia
          <input
            autoFocus
            placeholder="es. Ricostruzione LCA"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConferma(nome)
              if (e.key === 'Escape') onAnnulla()
            }}
          />
        </label>
        <div className="modal-actions">
          <button onClick={onAnnulla}>Annulla</button>
          <button className="primary" disabled={!nome.trim()} onClick={() => onConferma(nome)}>
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  )
}

function Step2Fasi({
  patologia,
  fasi,
  onSelect,
  onChanged
}: {
  patologia: Patologia
  fasi: Fase[]
  onSelect: (id: number) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [nuova, setNuova] = useState('')
  const [edit, setEdit] = useState<{ id: number; nome: string } | null>(null)

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const aggiungi = (): void => {
    const n = nuova.trim()
    if (!n) return
    void run(async () => {
      await window.api.fasi.create(patologia.id, n)
      setNuova('')
      await onChanged()
    })
  }

  const salvaRename = (): void => {
    if (!edit || !edit.nome.trim()) return
    void run(async () => {
      await window.api.fasi.update(edit.id, edit.nome.trim())
      setEdit(null)
      await onChanged()
    })
  }

  const { contenitore, maniglia } = useRiordino<number>((da, a) => {
    const ids = sposta(fasi, da, a).map((f) => f.id)
    void run(async () => {
      await window.api.fasi.reorder(ids)
      await onChanged()
    })
  })

  return (
    <section className="card step-card">
      <div className="step-title">
        <span className="step-num">2</span>
        <h3>Scegli la fase di &ldquo;{patologia.nome}&rdquo;</h3>
      </div>

      <DistrettiPatologia patologiaId={patologia.id} />
      <div className="scelta-tiles">
        {fasi.map((f, idx) => {
          const dnd = contenitore(idx)
          return (
          <div
            key={f.id}
            {...dnd}
            className={['scelta-tile', dnd.className].filter(Boolean).join(' ')}
            onClick={() => onSelect(f.id)}
          >
            {edit?.id === f.id ? (
              <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={edit.nome}
                  onChange={(e) => setEdit({ id: f.id, nome: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvaRename()
                    if (e.key === 'Escape') setEdit(null)
                  }}
                />
                <button onClick={salvaRename}>OK</button>
              </span>
            ) : (
              <>
                <span className="scelta-tile-nome">{f.nome}</span>
                <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                  <button {...maniglia(idx)}>
                    <GripVertical size={16} />
                  </button>
                  <button title="Rinomina" onClick={() => setEdit({ id: f.id, nome: f.nome })}>
                    <Pencil size={16} />
                  </button>
                  <button
                    title="Elimina"
                    className="danger"
                    onClick={async () => {
                      if (
                        await chiedi(
                          `Eliminare la fase "${f.nome}"?\nVerranno eliminati i suoi obiettivi, sezioni e test.`
                        )
                      ) {
                        void run(async () => {
                          await window.api.fasi.remove(f.id)
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
        <div className="scelta-tile scelta-tile-add" onClick={(e) => e.stopPropagation()}>
          <input
            placeholder="Nuova fase…"
            value={nuova}
            onChange={(e) => setNuova(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aggiungi()
            }}
          />
          <button onClick={aggiungi}>
            <Plus size={16} /> Aggiungi
          </button>
        </div>
      </div>
      {fasi.length === 0 && (
        <p className="hint">Nessuna fase ancora: creala qui sopra (es. Fase iniziale).</p>
      )}
    </section>
  )
}

// La struttura della seduta: sezioni ordinate, ognuna con le sue categorie (ordinate).
function StrutturaTab({ faseId }: { faseId: number }): React.JSX.Element {
  const [sezioni, setSezioni] = useState<SezioneConCategorie[]>([])
  const [selSez, setSelSez] = useState<number | null>(null)
  const [categorie, setCategorie] = useState<Categoria[]>([])

  const load = useCallback(
    (): Promise<void> => window.api.sezioni.list(faseId).then(setSezioni),
    [faseId]
  )

  useEffect(() => {
    void load()
    void window.api.categorie.list().then(setCategorie)
  }, [load])

  const sez = sezioni.find((s) => s.id === selSez) ?? null

  const salvaCategorie = async (ids: number[]): Promise<void> => {
    if (selSez == null) return
    try {
      await window.api.sezioni.setCategorie(selSez, ids)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const toggleCategoria = (cid: number, attiva: boolean): void => {
    if (!sez) return
    const ids = attiva ? [...sez.categoria_ids, cid] : sez.categoria_ids.filter((id) => id !== cid)
    void salvaCategorie(ids)
  }

  const nomeCategoria = (cid: number): string => categorie.find((c) => c.id === cid)?.nome ?? '?'
  const nonAssociate = categorie.filter((c) => !sez?.categoria_ids.includes(c.id))

  return (
    <div className="struttura-tab">
      <CrudList
        title="Sezioni della seduta"
        items={sezioni}
        selectedId={selSez}
        onSelect={setSelSez}
        onAdd={async (n) => {
          await window.api.sezioni.create(faseId, n)
          await load()
        }}
        onRename={async (id, n) => {
          await window.api.sezioni.update(id, n)
          await load()
        }}
        onDelete={async (id) => {
          await window.api.sezioni.remove(id)
          if (selSez === id) setSelSez(null)
          await load()
        }}
        onReorder={async (ids) => {
          await window.api.sezioni.reorder(ids)
          await load()
        }}
        addPlaceholder="Nuova sezione… (es. Riscaldamento)"
        emptyHint="Es. Riscaldamento, Mobilità, Rinforzo, Pliometria"
      />
      <section className="crud-list">
        <h3>Categorie della sezione</h3>
        {sez == null ? (
          <p className="hint">Seleziona una sezione</p>
        ) : categorie.length === 0 ? (
          <p className="hint">Nessuna categoria disponibile: creale in &ldquo;Categorie esercizi&rdquo;.</p>
        ) : (
          <>
            <ul className="checkbox-list">
              {sez.categoria_ids.map((cid) => (
                <li key={cid}>
                  <label>
                    <input type="checkbox" checked onChange={() => toggleCategoria(cid, false)} />
                    {nomeCategoria(cid)}
                  </label>
                </li>
              ))}
              {sez.categoria_ids.length === 0 && (
                <li className="empty">Nessuna categoria associata: spunta qui sotto.</li>
              )}
            </ul>
            {nonAssociate.length > 0 && (
              <>
                <div className="sotto-titolo">Altre categorie</div>
                <ul className="checkbox-list">
                  {nonAssociate.map((c) => (
                    <li key={c.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => toggleCategoria(c.id, true)}
                        />
                        {c.nome}
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function ObiettiviTab({ faseId }: { faseId: number }): React.JSX.Element {
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([])

  const load = useCallback(
    (): Promise<void> => window.api.obiettivi.list(faseId).then(setObiettivi),
    [faseId]
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <p className="hint tab-hint">
        Gli obiettivi si spuntano come &ldquo;raggiunti&rdquo; nella scheda del paziente, non a
        ogni seduta.
      </p>
      <CrudList
        title="Obiettivi della fase"
        items={obiettivi}
        onAdd={async (n) => {
          await window.api.obiettivi.create(faseId, n)
          await load()
        }}
        onRename={async (id, n) => {
          await window.api.obiettivi.update(id, n)
          await load()
        }}
        onDelete={async (id) => {
          await window.api.obiettivi.remove(id)
          await load()
        }}
        onReorder={async (ids) => {
          await window.api.obiettivi.reorder(ids)
          await load()
        }}
        addPlaceholder="Nuovo obiettivo…"
        emptyHint="Es. Controllo del dolore e gonfiore"
      />
    </div>
  )
}

function TestTab({ faseId }: { faseId: number }): React.JSX.Element {
  const [tests, setTests] = useState<TestAvanzamento[]>([])

  const load = useCallback(
    (): Promise<void> => window.api.testAvanzamento.list(faseId).then(setTests),
    [faseId]
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <p className="hint tab-hint">
        Checklist informativa per il passaggio alla fase successiva (opzionale, non blocca
        l&apos;avanzamento). Indica l&apos;unità di misura nel nome, es. &ldquo;Hop test
        (cm)&rdquo;.
      </p>
      <CrudList
        title="Test di avanzamento"
        items={tests}
        onAdd={async (n) => {
          await window.api.testAvanzamento.create(faseId, n)
          await load()
        }}
        onRename={async (id, n) => {
          await window.api.testAvanzamento.update(id, n)
          await load()
        }}
        onDelete={async (id) => {
          await window.api.testAvanzamento.remove(id)
          await load()
        }}
        onReorder={async (ids) => {
          await window.api.testAvanzamento.reorder(ids)
          await load()
        }}
        addPlaceholder="Nuovo test… (es. Hop test (cm))"
        emptyHint="Nessun test definito per questa fase (facoltativo)."
      />
    </div>
  )
}

// I distretti abituali di questa patologia: diventano la preselezione quando si
// apre una valutazione obiettiva del paziente. Non vincolano nulla, si possono
// sempre cambiare al momento.
function DistrettiPatologia({ patologiaId }: { patologiaId: number }): React.JSX.Element {
  const [distretti, setDistretti] = useState<Distretto[]>([])
  const [scelti, setScelti] = useState<number[]>([])

  useEffect(() => {
    void window.api.distretti.list().then(setDistretti)
    void window.api.patologie.distretti(patologiaId).then(setScelti)
  }, [patologiaId])

  const alterna = (id: number): void => {
    const nuovi = scelti.includes(id) ? scelti.filter((x) => x !== id) : [...scelti, id]
    setScelti(nuovi)
    window.api.patologie
      .setDistretti(patologiaId, nuovi)
      .catch((e) => toastErrore(errMsg(e)))
  }

  if (distretti.length === 0) return <></>

  return (
    <details className="blocco-apribile">
      <summary>Distretti da valutare ({scelti.length})</summary>
      <div className="contenuto-apribile">
        <p className="hint">
          Compariranno già spuntati aprendo una valutazione obiettiva di un paziente con questa
          patologia.
        </p>
        <ul className="checkbox-list">
          {distretti.map((d) => (
            <li key={d.id}>
              <label>
                <input
                  type="checkbox"
                  checked={scelti.includes(d.id)}
                  onChange={() => alterna(d.id)}
                />
                {d.nome}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
