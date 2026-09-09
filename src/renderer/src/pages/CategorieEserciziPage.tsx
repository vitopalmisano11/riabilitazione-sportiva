import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronRight, CornerLeftUp, Pencil, Plus, X } from 'lucide-react'
import type { Categoria } from '../../../shared/types'
import Aiuto from '../components/Aiuto'
import SceltaConRicerca from '../components/SceltaConRicerca'
import { toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

// Le categorie degli esercizi, in una sezione tutta loro.
//
// Prima stavano in un riquadro dentro alla libreria: uno spazio stretto in cui
// due elenchi non ci stavano, e in cui non si capiva quale categoria contenesse
// quale. Qui hanno la pagina intera e lo stesso passo delle patologie: prima si
// sceglie il tipo di lavoro fra le piastrelle, poi si lavora sui suoi
// distretti. Un livello solo di profondita': rinforzo → quadricipite, e basta.

// La finestra del nome e delle spunte, uguale per una categoria e per un
// distretto.
interface FormCat {
  id: number | null
  nome: string
  cluster: boolean
  rir: boolean
  // Dentro a quale categoria nasce (null = e' un tipo di lavoro a se').
  padre: number | null
}

export default function CategorieEserciziPage({
  tornaAllInizio
}: {
  tornaAllInizio: number
}): React.JSX.Element {
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [ricerca, setRicerca] = useState('')
  const [form, setForm] = useState<FormCat | null>(null)
  const [nuovoDistretto, setNuovoDistretto] = useState<string | null>(null)

  const carica = useCallback(
    (): Promise<void> => window.api.categorie.list().then(setCategorie),
    []
  )
  useEffect(() => {
    void carica()
  }, [carica])

  // Ripremendo la voce del menu si torna all'elenco.
  useEffect(() => {
    if (tornaAllInizio === 0) return
    setSelId(null)
  }, [tornaAllInizio])

  const figliDi = (id: number): Categoria[] => categorie.filter((c) => c.padre_id === id)
  const macro = categorie.filter((c) => c.padre_id == null)
  const sel = macro.find((m) => m.id === selId) ?? null
  const distretti = sel ? figliDi(sel.id) : []

  const q = ricerca.trim().toLowerCase()
  const trovate =
    q === ''
      ? macro
      : macro.filter(
          (m) =>
            m.nome.toLowerCase().includes(q) ||
            figliDi(m.id).some((f) => f.nome.toLowerCase().includes(q))
        )

  const esegui = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // L'ordine si salva per intero: i tipi di lavoro in fila, e dopo ognuno i
  // suoi distretti.
  const ordine = (elenco: Categoria[], padre?: Categoria, figli?: Categoria[]): number[] =>
    elenco.flatMap((m) => [
      m.id,
      ...(padre && m.id === padre.id ? (figli ?? []) : figliDi(m.id)).map((f) => f.id)
    ])

  const { contenitore: contMacro, presa: presaMacro } = useRiordino<number>((da, a) =>
    void esegui(() => window.api.categorie.reorder(ordine(sposta(macro, da, a))))
  )
  const { contenitore: contFiglio, presa: presaFiglio } = useRiordino<number>((da, a) => {
    if (!sel) return
    void esegui(() =>
      window.api.categorie.reorder(ordine(macro, sel, sposta(distretti, da, a)))
    )
  })

  const salva = async (): Promise<void> => {
    if (!form) return
    const nome = form.nome.trim()
    if (nome === '') {
      toastErrore('Il nome è obbligatorio.')
      return
    }
    await esegui(async () => {
      const id =
        form.id == null
          ? await window.api.categorie.create(nome)
          : (await window.api.categorie.update(form.id, nome), form.id)
      await window.api.categorie.setCluster(id, form.cluster)
      await window.api.categorie.setRir(id, form.rir)
      if (form.id == null && form.padre != null) {
        await window.api.categorie.setPadre(id, form.padre)
      }
      setForm(null)
    })
  }

  const aggiungiDistretto = (): void => {
    const nome = (nuovoDistretto ?? '').trim()
    if (nome === '' || !sel) return
    void esegui(async () => {
      const id = await window.api.categorie.create(nome)
      await window.api.categorie.setPadre(id, sel.id)
      setNuovoDistretto('')
    })
  }

  const elimina = async (c: Categoria): Promise<void> => {
    const dentro = figliDi(c.id)
    const avviso =
      dentro.length === 0
        ? ''
        : `\nI ${dentro.length} distretti che ci stanno dentro non vengono eliminati: tornano tipi di lavoro a sé.`
    if (
      !(await chiedi(
        `Eliminare "${c.nome}"?${avviso}\nFinisce nel cestino: puoi rimetterla a posto da Impostazioni entro un mese.`
      ))
    ) {
      return
    }
    await esegui(async () => {
      await window.api.categorie.remove(c.id)
      if (selId === c.id) setSelId(null)
    })
  }

  const apriModifica = (c: Categoria): void =>
    setForm({
      id: c.id,
      nome: c.nome,
      cluster: c.dosaggio_cluster === 1,
      rir: c.dosaggio_rir === 1,
      padre: c.padre_id
    })

  const etichette = (c: Categoria): React.JSX.Element => (
    <>
      {c.dosaggio_cluster === 1 && <span className="badge">cluster</span>}
      {c.dosaggio_rir === 1 && <span className="badge">RIR</span>}
    </>
  )

  // Le categorie che si possono spostare dentro a quella scelta: quelle a sé
  // che non hanno distretti dentro, perché di livelli se ne scende uno solo.
  const spostabili = macro.filter((m) => m.id !== sel?.id && figliDi(m.id).length === 0)

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>Categorie esercizi</h2>
      </header>

      {sel && (
        <div className="briciole">
          <button className="briciola" onClick={() => setSelId(null)}>
            Categorie
          </button>
          <ChevronRight size={16} />
          <span className="briciola corrente">{sel.nome}</span>
        </div>
      )}

      {sel == null ? (
        <>
          <div className="ricerca-sopra">
            <input
              type="search"
              placeholder="Cerca categoria o distretto…"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
            />
            <button
              className="primary"
              onClick={() =>
                setForm({ id: null, nome: '', cluster: false, rir: false, padre: null })
              }
            >
              <Plus size={18} /> Nuova categoria
            </button>
          </div>

          <p className="hint">
            <Aiuto testo="Il tipo di lavoro sta nelle piastrelle: rinforzo, mobilità, pliometria. Aprendone una ci si mettono dentro i distretti — quadricipite, spalla, cervicale — e gli esercizi si assegnano al distretto. Una sezione della fase agganciata al tipo di lavoro propone anche tutti i suoi distretti." />
            Scegli un tipo di lavoro per gestire i suoi distretti.
          </p>

          <div className="scelta-tiles">
            {trovate.map((m, idx) => {
              const dnd = contMacro(idx)
              const quanti = figliDi(m.id).length
              return (
                <div
                  key={m.id}
                  {...dnd}
                  {...presaMacro(idx)}
                  className={['scelta-tile', dnd.className].filter(Boolean).join(' ')}
                  title="Apri · trascina per spostare"
                  onClick={() => setSelId(m.id)}
                >
                  <span className="scelta-tile-nome">{m.nome}</span>
                  <span className="riga-pillola">
                    {etichette(m)}
                    {quanti > 0 && (
                      <span className="conta-distretti">
                        {quanti === 1 ? '1 distretto' : `${quanti} distretti`}
                      </span>
                    )}
                  </span>
                  <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                    <button title="Modifica" onClick={() => apriModifica(m)}>
                      <Pencil size={16} />
                    </button>
                    <button className="danger" title="Elimina" onClick={() => void elimina(m)}>
                      <X size={16} />
                    </button>
                  </span>
                </div>
              )
            })}
            {trovate.length === 0 && (
              <p className="hint">
                {q === '' ? 'Nessuna categoria: creane una qui sopra.' : 'Nessuna con questo nome.'}
              </p>
            )}
          </div>
        </>
      ) : (
        <section className="card">
          <div className="card-header-row">
            <h3>
              Distretti di &ldquo;{sel.nome}&rdquo;
              <Aiuto testo="Le parti del corpo dentro a questo tipo di lavoro: quadricipite, spalla, cervicale. Un esercizio si mette nel distretto, e chi cerca per tipo di lavoro lo trova lo stesso. Se questo lavoro non ha bisogno di distretti, lascia l'elenco vuoto e metti gli esercizi direttamente qui." />
            </h3>
            {nuovoDistretto == null && (
              <button className="btn-aggiungi-lista" onClick={() => setNuovoDistretto('')}>
                <Plus size={16} /> Nuovo distretto
              </button>
            )}
          </div>

          {nuovoDistretto != null && (
            <div className="riga-nuovo-distretto">
              <input
                autoFocus
                placeholder="es. Quadricipite"
                value={nuovoDistretto}
                onChange={(e) => setNuovoDistretto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') aggiungiDistretto()
                  if (e.key === 'Escape') setNuovoDistretto(null)
                }}
              />
              <button className="primary" title="Aggiungi" onClick={aggiungiDistretto}>
                <Check size={16} />
              </button>
              <button title="Chiudi" onClick={() => setNuovoDistretto(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          {distretti.length === 0 ? (
            <p className="hint">
              Nessun distretto: gli esercizi di questo lavoro stanno direttamente qui.
            </p>
          ) : (
            <ul className="elenco-categorie">
              {distretti.map((f, idx) => {
                const dnd = contFiglio(idx)
                return (
                  <li key={f.id} {...dnd} {...presaFiglio(idx)} className={dnd.className}>
                    <span className="nome-categoria">{f.nome}</span>
                    {etichette(f)}
                    <span className="row-actions">
                      <button title="Modifica" onClick={() => apriModifica(f)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        title="Portalo fuori: torna un tipo di lavoro a sé"
                        onClick={() => void esegui(() => window.api.categorie.setPadre(f.id, null))}
                      >
                        <CornerLeftUp size={16} />
                      </button>
                      <button className="danger" title="Elimina" onClick={() => void elimina(f)}>
                        <X size={16} />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Riorganizzare quello che c'e' gia': si sceglie una categoria e
              diventa un distretto di questa, senza aprire nessuna finestra. */}
          {spostabili.length > 0 && (
            <label className="field sposta-dentro">
              Sposta qui una categoria che hai già
              <SceltaConRicerca
                voci={spostabili}
                valore=""
                segnaposto="Scrivi o scegli…"
                onCambia={(id) => {
                  if (id === '') return
                  void esegui(() => window.api.categorie.setPadre(id, sel.id))
                }}
              />
            </label>
          )}
        </section>
      )}

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {form.id == null
                ? form.padre == null
                  ? 'Nuova categoria'
                  : 'Nuovo distretto'
                : 'Modifica'}
            </h3>
            <label>
              Nome
              <input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void salva()
                }}
              />
            </label>

            <label className="checkbox-inline riga-staccata">
              <input
                type="checkbox"
                checked={form.cluster}
                onChange={(e) => setForm({ ...form, cluster: e.target.checked })}
              />
              Dosaggio a cluster
              <Aiuto testo="Gli esercizi di questa categoria si dosano spezzando la serie in blocchi con una pausa breve dentro: 4 serie da 3 cluster da 2 ripetizioni, 15 secondi tra i cluster e 2 minuti tra le serie. Nel loro form compaiono i campi in più; le altre categorie restano come sono." />
            </label>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={form.rir}
                onChange={(e) => setForm({ ...form, rir: e.target.checked })}
              />
              Ripetizioni di riserva (RIR)
              <Aiuto testo="Quante ripetizioni restano in canna a fine serie: RIR 2 vuol dire fermarsi due prima del cedimento. Dice quanto è pesante la serie meglio del carico da solo, e serve nella forza più che nella mobilità. Spuntandola, gli esercizi di questa categoria hanno una casellina in più nella seduta." />
            </label>

            <div className="modal-actions">
              <button onClick={() => setForm(null)}>Annulla</button>
              <button className="primary" onClick={() => void salva()}>
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
