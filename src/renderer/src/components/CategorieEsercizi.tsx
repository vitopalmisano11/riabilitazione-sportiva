import { useState } from 'react'
import { Check, CornerLeftUp, Pencil, Plus, X } from 'lucide-react'
import type { Categoria } from '../../../shared/types'
import Aiuto from './Aiuto'
import SceltaConRicerca from './SceltaConRicerca'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

// Le categorie degli esercizi, su due colonne.
//
// A sinistra il tipo di lavoro (rinforzo, mobilità, pliometria), a destra i
// distretti di quello scelto. In un elenco solo — anche rientrato — le due cose
// restavano mescolate, e per spostare una categoria dentro un'altra bisognava
// aprire una finestra e compilare una casella: due passaggi per un'operazione
// che qui si fa da dove la si sta guardando.
export default function CategorieEsercizi({
  categorie,
  ricerca,
  onNuova,
  onModifica,
  onCambiato
}: {
  categorie: Categoria[]
  ricerca: string
  // La finestra con nome, dosaggio a cluster e RIR.
  onNuova: () => void
  onModifica: (c: Categoria) => void
  onCambiato: () => Promise<void> | void
}): React.JSX.Element {
  const [selId, setSelId] = useState<number | null>(null)
  const [nuovoAperto, setNuovoAperto] = useState(false)
  const [nomeNuovo, setNomeNuovo] = useState('')

  const q = ricerca.trim().toLowerCase()
  const figliDi = (id: number): Categoria[] => categorie.filter((c) => c.padre_id === id)
  const macro = categorie.filter((c) => c.padre_id == null)

  // Cercando restano i tipi di lavoro che corrispondono e quelli che hanno
  // dentro un distretto che corrisponde.
  const macroVisibili =
    q === ''
      ? macro
      : macro.filter(
          (m) =>
            m.nome.toLowerCase().includes(q) ||
            figliDi(m.id).some((f) => f.nome.toLowerCase().includes(q))
        )

  const sel = macro.find((m) => m.id === selId) ?? macroVisibili[0] ?? null
  const distretti = sel ? figliDi(sel.id) : []
  const distrettiVisibili =
    q === '' || sel?.nome.toLowerCase().includes(q)
      ? distretti
      : distretti.filter((f) => f.nome.toLowerCase().includes(q))

  const esegui = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await onCambiato()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // L'ordine si salva sempre per intero: i tipi di lavoro in fila, e dopo
  // ognuno i suoi distretti.
  const ordineCompleto = (elenco: Categoria[], padre?: Categoria, figli?: Categoria[]): number[] =>
    elenco.flatMap((m) => [
      m.id,
      ...(padre && m.id === padre.id ? (figli ?? []) : figliDi(m.id)).map((f) => f.id)
    ])

  const { contenitore: contMacro, presa: presaMacro } = useRiordino<number>((da, a) =>
    void esegui(() => window.api.categorie.reorder(ordineCompleto(sposta(macro, da, a))))
  )
  const { contenitore: contFiglio, presa: presaFiglio } = useRiordino<number>((da, a) => {
    if (!sel) return
    void esegui(() =>
      window.api.categorie.reorder(ordineCompleto(macro, sel, sposta(distretti, da, a)))
    )
  })

  const aggiungiDistretto = (): void => {
    const nome = nomeNuovo.trim()
    if (nome === '' || !sel) return
    void esegui(async () => {
      const id = await window.api.categorie.create(nome)
      await window.api.categorie.setPadre(id, sel.id)
      setNomeNuovo('')
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
    await esegui(() => window.api.categorie.remove(c.id))
  }

  const etichette = (c: Categoria): React.JSX.Element => (
    <>
      {c.dosaggio_cluster === 1 && <span className="badge">cluster</span>}
      {c.dosaggio_rir === 1 && <span className="badge">RIR</span>}
    </>
  )

  // Le categorie che si possono spostare dentro a quella scelta: quelle a sé
  // che non hanno distretti dentro (di livelli se ne scende uno solo).
  const spostabili = macro.filter((m) => m.id !== sel?.id && figliDi(m.id).length === 0)

  return (
    <div className="categorie-due-colonne">
      <section className="colonna-categorie">
        <div className="card-header-row">
          <h3>
            Tipo di lavoro
            <Aiuto testo="Rinforzo, mobilità, pliometria: il lavoro che si fa, non la parte del corpo. Scegliendone uno, a destra compaiono i suoi distretti. Una sezione della fase agganciata a un tipo di lavoro propone anche tutti i distretti che ci stanno dentro." />
          </h3>
          <button className="btn-aggiungi-lista" onClick={onNuova}>
            <Plus size={16} /> Nuovo
          </button>
        </div>

        {macroVisibili.length === 0 ? (
          <p className="hint">
            {q === '' ? 'Nessuna categoria: creane una qui sopra.' : 'Nessuna con questo nome.'}
          </p>
        ) : (
          <ul className="elenco-categorie">
            {macroVisibili.map((m) => {
              const i = macro.indexOf(m)
              const dnd = contMacro(i)
              const quanti = figliDi(m.id).length
              return (
                <li
                  key={m.id}
                  {...dnd}
                  {...presaMacro(i)}
                  className={[m.id === sel?.id ? 'scelta' : '', dnd.className]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelId(m.id)}
                >
                  <span className="nome-categoria">{m.nome}</span>
                  {etichette(m)}
                  {quanti > 0 && <span className="conta-distretti">{quanti}</span>}
                  <span className="row-actions">
                    <button title="Modifica" onClick={() => onModifica(m)}>
                      <Pencil size={16} />
                    </button>
                    <button className="danger" title="Elimina" onClick={() => void elimina(m)}>
                      <X size={16} />
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="colonna-distretti">
        {sel == null ? (
          <p className="hint">Scegli un tipo di lavoro per vedere i suoi distretti.</p>
        ) : (
          <>
            <div className="card-header-row">
              <h3>
                Distretti di &ldquo;{sel.nome}&rdquo;
                <Aiuto testo="Le parti del corpo dentro a questo tipo di lavoro: quadricipite, spalla, cervicale. Un esercizio si mette nel distretto, e chi cerca per tipo di lavoro lo trova lo stesso." />
              </h3>
              {!nuovoAperto && (
                <button className="btn-aggiungi-lista" onClick={() => setNuovoAperto(true)}>
                  <Plus size={16} /> Nuovo distretto
                </button>
              )}
            </div>

            {nuovoAperto && (
              <div className="riga-nuovo-distretto">
                <input
                  autoFocus
                  placeholder="es. Quadricipite"
                  value={nomeNuovo}
                  onChange={(e) => setNomeNuovo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') aggiungiDistretto()
                    if (e.key === 'Escape') setNuovoAperto(false)
                  }}
                />
                <button className="primary" title="Aggiungi" onClick={aggiungiDistretto}>
                  <Check size={16} />
                </button>
                <button title="Chiudi" onClick={() => setNuovoAperto(false)}>
                  <X size={16} />
                </button>
              </div>
            )}

            {distrettiVisibili.length === 0 ? (
              <p className="hint">Nessun distretto: gli esercizi stanno direttamente qui.</p>
            ) : (
              <ul className="elenco-categorie">
                {distrettiVisibili.map((f) => {
                  const i = distretti.indexOf(f)
                  const dnd = contFiglio(i)
                  return (
                    <li
                      key={f.id}
                      {...dnd}
                      {...presaFiglio(i)}
                      className={dnd.className}
                    >
                      <span className="nome-categoria">{f.nome}</span>
                      {etichette(f)}
                      <span className="row-actions">
                        <button title="Modifica" onClick={() => onModifica(f)}>
                          <Pencil size={16} />
                        </button>
                        {/* Torna a essere un tipo di lavoro a sé: gli esercizi
                            che ci stanno dentro restano dove sono. */}
                        <button
                          title="Portalo fuori: torna un tipo di lavoro a sé"
                          onClick={() =>
                            void esegui(() => window.api.categorie.setPadre(f.id, null))
                          }
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
          </>
        )}
      </section>
    </div>
  )
}
