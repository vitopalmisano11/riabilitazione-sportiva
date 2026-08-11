import { useCallback, useEffect, useState } from 'react'
import type {
  Categoria,
  Fase,
  Obiettivo,
  Patologia,
  SezioneConCategorie,
  TestAvanzamento
} from '../../../shared/types'
import CrudList from '../components/CrudList'
import { toastErrore } from '../components/Toast'
import { errMsg } from '../lib'

type Tab = 'struttura' | 'obiettivi' | 'test'

const TABS: { key: Tab; label: string }[] = [
  { key: 'struttura', label: 'Struttura seduta' },
  { key: 'obiettivi', label: 'Obiettivi' },
  { key: 'test', label: 'Test di avanzamento' }
]

export default function PatologiePage(): React.JSX.Element {
  const [patologie, setPatologie] = useState<Patologia[]>([])
  const [selPat, setSelPat] = useState<number | null>(null)
  const [fasi, setFasi] = useState<Fase[]>([])
  const [selFase, setSelFase] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('struttura')

  const loadPatologie = useCallback(
    (): Promise<void> => window.api.patologie.list().then(setPatologie),
    []
  )
  const loadFasi = useCallback((): Promise<void> => {
    if (selPat == null) {
      setFasi([])
      return Promise.resolve()
    }
    return window.api.fasi.list(selPat).then(setFasi)
  }, [selPat])

  useEffect(() => {
    void loadPatologie()
  }, [loadPatologie])

  useEffect(() => {
    setSelFase(null)
    void loadFasi()
  }, [selPat, loadFasi])

  return (
    <div className="page">
      <header className="page-header">
        <h2>Patologie e fasi</h2>
        <p>
          Per ogni fase definisci la <strong>struttura della seduta</strong> (sezioni ordinate con
          le loro categorie di esercizi), gli <strong>obiettivi</strong> e gli eventuali{' '}
          <strong>test di avanzamento</strong> verso la fase successiva.
        </p>
      </header>
      <div className="config-patologie">
        <CrudList
          title="Patologie"
          items={patologie}
          selectedId={selPat}
          onSelect={setSelPat}
          onAdd={async (n) => {
            await window.api.patologie.create(n)
            await loadPatologie()
          }}
          onRename={async (id, n) => {
            await window.api.patologie.update(id, n)
            await loadPatologie()
          }}
          onDelete={async (id) => {
            await window.api.patologie.remove(id)
            if (selPat === id) setSelPat(null)
            await loadPatologie()
          }}
          addPlaceholder="Nuova patologia…"
          emptyHint="Es. Ricostruzione LCA"
        />

        {selPat != null ? (
          <CrudList
            title="Fasi"
            items={fasi}
            selectedId={selFase}
            onSelect={setSelFase}
            onAdd={async (n) => {
              await window.api.fasi.create(selPat, n)
              await loadFasi()
            }}
            onRename={async (id, n) => {
              await window.api.fasi.update(id, n)
              await loadFasi()
            }}
            onDelete={async (id) => {
              await window.api.fasi.remove(id)
              if (selFase === id) setSelFase(null)
              await loadFasi()
            }}
            onReorder={async (ids) => {
              await window.api.fasi.reorder(ids)
              await loadFasi()
            }}
            addPlaceholder="Nuova fase…"
            emptyHint="Es. Fase iniziale"
          />
        ) : (
          <section className="crud-list placeholder">
            <h3>Fasi</h3>
            <p className="hint">Seleziona una patologia</p>
          </section>
        )}

        {selFase != null ? (
          <section className="card fase-dettaglio">
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
            {tab === 'struttura' && <StrutturaTab key={selFase} faseId={selFase} />}
            {tab === 'obiettivi' && <ObiettiviTab key={selFase} faseId={selFase} />}
            {tab === 'test' && <TestTab key={selFase} faseId={selFase} />}
          </section>
        ) : (
          <section className="card fase-dettaglio">
            <p className="hint">Seleziona una fase per configurarla.</p>
          </section>
        )}
      </div>
    </div>
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

  const muoviCategoria = (idx: number, dir: -1 | 1): void => {
    if (!sez) return
    const ids = [...sez.categoria_ids]
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
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
              {sez.categoria_ids.map((cid, idx) => (
                <li key={cid} className="cat-ordinata">
                  <span className="item-actions-static">
                    <button
                      title="Sposta su"
                      disabled={idx === 0}
                      onClick={() => muoviCategoria(idx, -1)}
                    >
                      ↑
                    </button>
                    <button
                      title="Sposta giù"
                      disabled={idx === sez.categoria_ids.length - 1}
                      onClick={() => muoviCategoria(idx, 1)}
                    >
                      ↓
                    </button>
                  </span>
                  <label>
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleCategoria(cid, false)}
                    />
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
