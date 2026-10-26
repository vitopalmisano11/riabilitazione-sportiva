import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronRight, CornerLeftUp, Pencil, Plus, Settings2, X } from 'lucide-react'
import type { Categoria, EsercizioConCategoria } from '../../../shared/types'
import Aiuto from './Aiuto'
import SceltaConRicerca from './SceltaConRicerca'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import Modale from './Modale'
import { errMsg } from '../lib'
import { useRiordinoSalvato } from '../riordino'
import { daPrecarico, ricorda } from '../precarico'

// La prima pagina della libreria: le categorie degli esercizi.
//
// L'elenco piatto di tutti gli esercizi serviva a poco: a un esercizio si arriva
// dalla sua categoria. Qui le categorie hanno tutta la larghezza e lo stesso
// passo delle patologie: prima si sceglie il tipo di lavoro fra le piastrelle,
// poi si lavora sui suoi distretti e sui suoi esercizi. Un livello solo di
// profondita': rinforzo → quadricipite, e basta. La tabella degli esercizi la
// disegna la libreria (`renderEsercizi`): qui si decide solo quali mostrarle.

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

export default function CategorieEsercizi({
  tornaAllInizio,
  onCambiato,
  esercizi,
  ricerca,
  onRicerca,
  renderEsercizi
}: {
  tornaAllInizio: number
  // La libreria ricarica i suoi esercizi: cambiando una categoria cambia
  // quello che si legge nelle righe.
  onCambiato: () => Promise<void> | void
  esercizi: EsercizioConCategoria[]
  // La ricerca sta nella libreria: aprendo una categoria resta la stessa
  // casella, e filtra gli esercizi di quella categoria.
  ricerca: string
  onRicerca: (testo: string) => void
  // La tabella degli esercizi con i suoi comandi. `categoriaNuovo` e' la
  // categoria in cui nasce un esercizio creato da li' ('' = da scegliere);
  // `mostraCategoria` dice se la colonna della categoria serve, o se
  // ripeterebbe lo stesso nome su ogni riga.
  renderEsercizi: (
    lista: EsercizioConCategoria[],
    categoriaNuovo: number | '',
    mostraCategoria: boolean
  ) => React.ReactNode
}): React.JSX.Element {
  const [categorie, setCategorie] = useState<Categoria[]>(() => daPrecarico('categorie', []))
  const [selId, setSelId] = useState<number | null>(null)
  // Il distretto scelto per restringere gli esercizi (null = tutta la categoria).
  const [distrettoId, setDistrettoId] = useState<number | null>(null)
  // I comandi dei distretti (rinomina, elimina, sposta) stanno in un pannello
  // chiuso: si usano di rado, e aperti spingevano gli esercizi in fondo.
  const [gestisci, setGestisci] = useState(false)
  const [form, setForm] = useState<FormCat | null>(null)
  const [nuovoDistretto, setNuovoDistretto] = useState<string | null>(null)
  const [spostaAperto, setSpostaAperto] = useState(false)

  const carica = useCallback(
    (): Promise<void> => window.api.categorie.list().then(ricorda('categorie')).then(setCategorie),
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

  useEffect(() => {
    setSpostaAperto(false)
    setNuovoDistretto(null)
    setDistrettoId(null)
    setGestisci(false)
    // Cercare e poi aprire una categoria non deve lasciare l'elenco gia'
    // ristretto da una parola che non c'entra piu'.
    onRicerca('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])

  // In ordine alfabetico, con le regole dell'italiano: "à" viene dopo "a", non
  // in fondo a tutto come farebbe un confronto fra codici.
  const alfabetico = (a: Categoria, b: Categoria): number => a.nome.localeCompare(b.nome, 'it')
  const figliDi = (id: number): Categoria[] =>
    categorie.filter((c) => c.padre_id === id).sort(alfabetico)
  const macro = categorie.filter((c) => c.padre_id == null).sort(alfabetico)
  // Le piastrelle seguono l'ordine che ha deciso chi usa il programma (si
  // trascinano); a parita' vale l'alfabetico, per le categorie nuove o mai mosse.
  const macroInOrdine = [...macro].sort((a, b) => a.ordine - b.ordine || alfabetico(a, b))
  const sel = macro.find((m) => m.id === selId) ?? null
  const distretti = sel ? figliDi(sel.id) : []

  const q = ricerca.trim().toLowerCase()
  const dellaRicerca = (e: EsercizioConCategoria): boolean =>
    q === '' || e.nome.toLowerCase().includes(q)
  // Una categoria e i suoi distretti: gli esercizi stanno nell'uno o negli altri.
  const idDentro = (id: number): number[] => [id, ...figliDi(id).map((f) => f.id)]
  const trovatiEsercizi = q === '' ? [] : esercizi.filter(dellaRicerca)
  const trovate =
    q === ''
      ? macroInOrdine
      : macroInOrdine.filter(
          (m) =>
            m.nome.toLowerCase().includes(q) ||
            figliDi(m.id).some((f) => f.nome.toLowerCase().includes(q))
        )
  const eserciziAperti = sel
    ? esercizi.filter(
        (e) =>
          dellaRicerca(e) &&
          (distrettoId != null
            ? e.categoria_id === distrettoId
            : idDentro(sel.id).includes(e.categoria_id))
      )
    : []

  const esegui = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await carica()
      await onCambiato()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Si trascina solo l'elenco intero: durante una ricerca le piastrelle sono
  // un pezzo dell'elenco, e salvarne l'ordine metterebbe in disordine il resto.
  const { ordine: piastrelle, contenitore, presa } = useRiordinoSalvato(trovate, (ids) =>
    esegui(() => window.api.categorie.reorder(ids))
  )

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
      if (distrettoId === c.id) setDistrettoId(null)
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
    <div className="step-flow">
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
              placeholder="Cerca categoria, distretto o esercizio…"
              value={ricerca}
              onChange={(e) => onRicerca(e.target.value)}
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
            <b>Scegli la categoria</b>
            <Aiuto testo="Trascina le piastrelle per metterle nell'ordine che ti è più comodo: le più usate per prime, quelle simili vicine. Il tipo di lavoro sta nelle piastrelle: rinforzo, mobilità, pliometria. Aprendone una ci si mettono dentro i distretti — quadricipite, spalla, cervicale — e gli esercizi si assegnano al distretto. Una sezione della fase agganciata al tipo di lavoro propone anche tutti i suoi distretti. Aprendo una piastrella trovi gli esercizi di quel lavoro." />
          </p>

          <div className="scelta-tiles">
            {piastrelle.map((m, idx) => {
              const quanti = figliDi(m.id).length
              const dnd = q === '' ? contenitore(idx) : undefined
              return (
                <div
                  key={m.id}
                  {...dnd}
                  {...(dnd ? presa(idx) : {})}
                  className={['scelta-tile', dnd?.className].filter(Boolean).join(' ')}
                  title={q === '' ? 'Apri · trascina per spostare' : undefined}
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
            {trovate.length === 0 && trovatiEsercizi.length === 0 && (
              <p className="hint">
                {q === '' ? 'Nessuna categoria.' : 'Nessuna con questo nome.'}
              </p>
            )}
          </div>

          {/* Cercando per nome si trovano anche gli esercizi, di qualunque
              categoria: e' l'unico caso in cui si vedono fuori dalla loro. */}
          {trovatiEsercizi.length > 0 && (
            <section className="card">
              <h3>Esercizi trovati</h3>
              {renderEsercizi(trovatiEsercizi, '', true)}
            </section>
          )}
        </>
      ) : (
        <section className="card">
          {/* I distretti come pulsantini sopra la tabella: servono quasi sempre
              solo a restringere l'elenco degli esercizi. */}
          <div className="filtro-distretti">
            {distretti.length > 0 && (
              <>
                <button
                  className={`pillola-distretto${distrettoId == null ? ' attivo' : ''}`}
                  onClick={() => setDistrettoId(null)}
                >
                  Tutti
                </button>
                {distretti.map((f) => (
                  <button
                    key={f.id}
                    className={`pillola-distretto${distrettoId === f.id ? ' attivo' : ''}`}
                    onClick={() => setDistrettoId(f.id)}
                  >
                    {f.nome}
                  </button>
                ))}
              </>
            )}
            <span className="spacer" />
            <button
              className={`btn-aggiungi-lista${gestisci ? ' attivo' : ''}`}
              onClick={() => setGestisci(!gestisci)}
            >
              <Settings2 size={16} />{' '}
              {distretti.length === 0 ? 'Aggiungi distretti' : 'Gestisci distretti'}
            </button>
          </div>

          {gestisci && (
            <div className="pannello-distretti">
              <div className="card-header-row">
                <h4>
                  Distretti di &ldquo;{sel.nome}&rdquo;
                  <Aiuto testo="Le parti del corpo dentro a questo tipo di lavoro: quadricipite, spalla, cervicale. Un esercizio si mette nel distretto, e chi cerca per tipo di lavoro lo trova lo stesso. Se questo lavoro non ha bisogno di distretti, lascia l'elenco vuoto e metti gli esercizi direttamente qui." />
                </h4>
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
                  {distretti.map((f) => (
                    <li key={f.id}>
                      <span className="nome-categoria">{f.nome}</span>
                      {etichette(f)}
                      <span className="row-actions">
                        <button title="Modifica" onClick={() => apriModifica(f)}>
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Portalo fuori: torna un tipo di lavoro a sé"
                          onClick={() => {
                            if (distrettoId === f.id) setDistrettoId(null)
                            void esegui(() => window.api.categorie.setPadre(f.id, null))
                          }}
                        >
                          <CornerLeftUp size={16} />
                        </button>
                        <button className="danger" title="Elimina" onClick={() => void elimina(f)}>
                          <X size={16} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Riorganizzare quello che c'e' gia': si fa una volta ogni tanto. */}
              {spostabili.length > 0 &&
                (spostaAperto ? (
                  <label className="field sposta-dentro">
                    Quale categoria diventa un distretto di &ldquo;{sel.nome}&rdquo;?
                    <SceltaConRicerca
                      autoFocus
                      voci={spostabili}
                      valore=""
                      segnaposto="Scrivi o scegli…"
                      onCambia={(id) => {
                        if (id === '') return
                        setSpostaAperto(false)
                        void esegui(() => window.api.categorie.setPadre(id, sel.id))
                      }}
                    />
                  </label>
                ) : (
                  <button className="briciola link-sposta" onClick={() => setSpostaAperto(true)}>
                    Sposta qui una categoria che hai già
                  </button>
                ))}
            </div>
          )}

          {/* La colonna della categoria serve solo guardando tutti i distretti
              insieme: altrimenti ripete lo stesso nome su ogni riga. */}
          {renderEsercizi(
            eserciziAperti,
            distrettoId ?? sel.id,
            distretti.length > 0 && distrettoId == null
          )}
        </section>
      )}

      {form && (
        // Cliccando fuori (o premendo Invio) si salva; si butta via solo una
        // categoria nuova ancora senza nome. "Annulla" resta per uscire senza
        // salvare.
        <Modale
          onConferma={() => {
            if (form.id == null && !form.nome.trim()) setForm(null)
            else void salva()
          }}
        >
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
                  // Gia' gestito qui: senza preventDefault, Invio arriverebbe
                  // anche alla finestra sopra e salverebbe due volte.
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void salva()
                  }
                }}
              />
            </label>

            <label className="checkbox-inline riga-staccata">
              <input
                type="checkbox"
                className="interruttore"
                checked={form.cluster}
                onChange={(e) => setForm({ ...form, cluster: e.target.checked })}
              />
              Dosaggio a cluster
              <Aiuto testo="Gli esercizi di questa categoria si dosano spezzando la serie in blocchi con una pausa breve dentro: 4 serie da 3 cluster da 2 ripetizioni, 15 secondi tra i cluster e 2 minuti tra le serie. Nel loro form compaiono i campi in più; le altre categorie restano come sono." />
            </label>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                className="interruttore"
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
        </Modale>
      )}
    </div>
  )
}
