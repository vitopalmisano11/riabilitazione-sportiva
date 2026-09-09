import { useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import type { Categoria } from '../../../shared/types'
import Aiuto from './Aiuto'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

// Le categorie degli esercizi, a due livelli.
//
// In un elenco piatto "Rinforzo", "Quadricipite" e "Mobilità cervicale" sono
// tutte righe uguali, e non si capisce quale contiene quale. Qui il tipo di
// lavoro sta a sinistra, in grande, e i distretti stanno rientrati sotto di
// lui: il distretto si aggiunge dal "+" della sua categoria, senza dover dire
// da nessuna parte dove va a finire.
export default function CategorieEsercizi({
  categorie,
  ricerca,
  onNuova,
  onModifica,
  onCambiato
}: {
  categorie: Categoria[]
  ricerca: string
  // La finestra con nome, dosaggio a cluster e RIR: serve a creare una
  // categoria e a modificarne una qualsiasi.
  onNuova: () => void
  onModifica: (c: Categoria) => void
  onCambiato: () => Promise<void> | void
}): React.JSX.Element {
  // Dentro a quale categoria si sta scrivendo un distretto nuovo.
  const [apertaIn, setApertaIn] = useState<number | null>(null)
  const [nomeNuovo, setNomeNuovo] = useState('')

  const q = ricerca.trim().toLowerCase()
  const macro = categorie.filter((c) => c.padre_id == null)
  const figliDi = (id: number): Categoria[] => categorie.filter((c) => c.padre_id === id)

  // Cercando restano le categorie che corrispondono (con tutti i loro
  // distretti) e quelle che hanno un distretto che corrisponde (con i soli
  // distretti trovati).
  const visibili = macro
    .map((m) => {
      const suoi = figliDi(m.id)
      if (q === '') return { m, figli: suoi }
      if (m.nome.toLowerCase().includes(q)) return { m, figli: suoi }
      const trovati = suoi.filter((f) => f.nome.toLowerCase().includes(q))
      return trovati.length > 0 ? { m, figli: trovati } : null
    })
    .filter((x): x is { m: Categoria; figli: Categoria[] } => x !== null)

  // L'ordine si salva sempre per intero: le categorie in fila, e dopo ognuna i
  // suoi distretti.
  const salvaOrdine = async (nuovoMacro: Categoria[]): Promise<void> => {
    const ids = nuovoMacro.flatMap((m) => [m.id, ...figliDi(m.id).map((f) => f.id)])
    try {
      await window.api.categorie.reorder(ids)
      await onCambiato()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const salvaOrdineFigli = async (padre: Categoria, nuovi: Categoria[]): Promise<void> => {
    const ids = macro.flatMap((m) =>
      m.id === padre.id ? [m.id, ...nuovi.map((f) => f.id)] : [m.id, ...figliDi(m.id).map((f) => f.id)]
    )
    try {
      await window.api.categorie.reorder(ids)
      await onCambiato()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const { contenitore: contMacro, presa: presaMacro } = useRiordino<number>((da, a) =>
    void salvaOrdine(sposta(macro, da, a))
  )
  // La chiave e' "categoria:posizione": i distretti si riordinano dentro alla
  // loro categoria e non saltano da una all'altra.
  const { contenitore: contFiglio, presa: presaFiglio } = useRiordino<string>((da, a) => {
    const [padreDa, iDa] = da.split(':').map(Number)
    const [padreA, iA] = a.split(':').map(Number)
    if (padreDa !== padreA) return
    const padre = macro.find((m) => m.id === padreDa)
    if (padre) void salvaOrdineFigli(padre, sposta(figliDi(padre.id), iDa, iA))
  })

  const aggiungiDistretto = async (padre: Categoria): Promise<void> => {
    const nome = nomeNuovo.trim()
    if (nome === '') return
    try {
      const id = await window.api.categorie.create(nome)
      await window.api.categorie.setPadre(id, padre.id)
      setNomeNuovo('')
      await onCambiato()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (c: Categoria): Promise<void> => {
    const dentro = figliDi(c.id)
    const avviso =
      dentro.length === 0
        ? ''
        : `\nI ${dentro.length} distretti che ci stanno dentro non vengono eliminati: tornano categorie a sé.`
    if (
      !(await chiedi(
        `Eliminare "${c.nome}"?${avviso}\nFinisce nel cestino: puoi rimetterla a posto da Impostazioni entro un mese.`
      ))
    ) {
      return
    }
    try {
      await window.api.categorie.remove(c.id)
      await onCambiato()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const etichette = (c: Categoria): React.JSX.Element => (
    <>
      {c.dosaggio_cluster === 1 && <span className="badge">cluster</span>}
      {c.dosaggio_rir === 1 && <span className="badge">RIR</span>}
    </>
  )

  return (
    <div className="albero-categorie">
      <div className="card-header-row">
        <h3>
          Categorie
          <Aiuto testo="Il tipo di lavoro sta in grande (rinforzo, mobilità, pliometria) e sotto, rientrati, i distretti che gli appartengono. Il «+» di una categoria aggiunge un distretto dentro di lei. Una sezione della fase agganciata alla categoria propone anche tutti i suoi distretti." />
        </h3>
        <button className="btn-aggiungi-lista" onClick={onNuova}>
          <Plus size={16} /> Nuova categoria
        </button>
      </div>

      {visibili.length === 0 ? (
        <p className="hint">
          {q === '' ? 'Nessuna categoria: creane una qui sopra.' : 'Nessuna categoria con questo nome.'}
        </p>
      ) : (
        visibili.map(({ m, figli }) => {
          const iM = macro.indexOf(m)
          const dnd = contMacro(iM)
          return (
            <div key={m.id} className="ramo-categoria">
              <div
                {...dnd}
                {...presaMacro(iM)}
                className={['riga-categoria', 'categoria-macro', dnd.className]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="nome-categoria">{m.nome}</span>
                {etichette(m)}
                <span className="row-actions">
                  <button
                    title={`Aggiungi un distretto dentro a "${m.nome}"`}
                    onClick={() => {
                      setApertaIn(apertaIn === m.id ? null : m.id)
                      setNomeNuovo('')
                    }}
                  >
                    <Plus size={16} />
                  </button>
                  <button title="Modifica" onClick={() => onModifica(m)}>
                    <Pencil size={16} />
                  </button>
                  <button className="danger" title="Elimina" onClick={() => void elimina(m)}>
                    <X size={16} />
                  </button>
                </span>
              </div>

              {apertaIn === m.id && (
                <div className="riga-nuovo-distretto">
                  <input
                    autoFocus
                    placeholder="es. Quadricipite"
                    value={nomeNuovo}
                    onChange={(e) => setNomeNuovo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void aggiungiDistretto(m)
                      if (e.key === 'Escape') setApertaIn(null)
                    }}
                  />
                  <button
                    className="primary"
                    title="Aggiungi"
                    onClick={() => void aggiungiDistretto(m)}
                  >
                    <Check size={16} />
                  </button>
                  <button title="Chiudi" onClick={() => setApertaIn(null)}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {figli.map((f) => {
                const iF = figliDi(m.id).indexOf(f)
                const dndF = contFiglio(`${m.id}:${iF}`)
                return (
                  <div
                    key={f.id}
                    {...dndF}
                    {...presaFiglio(`${m.id}:${iF}`)}
                    className={['riga-categoria', 'categoria-micro', dndF.className]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="nome-categoria">{f.nome}</span>
                    {etichette(f)}
                    <span className="row-actions">
                      <button title="Modifica" onClick={() => onModifica(f)}>
                        <Pencil size={16} />
                      </button>
                      <button className="danger" title="Elimina" onClick={() => void elimina(f)}>
                        <X size={16} />
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
