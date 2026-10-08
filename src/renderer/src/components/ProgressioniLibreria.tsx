import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import type { EsercizioConCategoria, Progressione, ProgressioneGruppo } from '../../../shared/types'
import { errMsg } from '../lib'
import { useRiordinoSalvato } from '../riordino'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import Aiuto from './Aiuto'
import SceltaConRicerca from './SceltaConRicerca'

// La linguetta "Progressioni" della libreria: le scale di esercizi a step
// (es. Vertical braking: wall sit → front squat → drop catch...). Uno step
// rimanda a un esercizio della libreria, che resta li' dov'e': lo stesso
// esercizio puo' essere step di piu' progressioni. A sinistra l'elenco per
// gruppo, a destra la progressione scelta.
export default function ProgressioniLibreria(): React.JSX.Element {
  const [gruppi, setGruppi] = useState<ProgressioneGruppo[]>([])
  const [progressioni, setProgressioni] = useState<Progressione[]>([])
  const [libreria, setLibreria] = useState<EsercizioConCategoria[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [aggiungi, setAggiungi] = useState<'gruppo' | 'progressione' | null>(null)
  const [nome, setNome] = useState('')
  const [gruppoNuova, setGruppoNuova] = useState<number | ''>('')
  const [gruppoInModifica, setGruppoInModifica] = useState<{ id: number; nome: string } | null>(null)

  const carica = useCallback(async (): Promise<void> => {
    try {
      const [g, p] = await Promise.all([window.api.progressioni.gruppi(), window.api.progressioni.list()])
      setGruppi(g)
      setProgressioni(p)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [])

  useEffect(() => {
    void carica()
    void window.api.esercizi.list(false).then(setLibreria)
  }, [carica])

  const conferma = async (): Promise<void> => {
    const n = nome.trim()
    if (!n) return
    try {
      if (aggiungi === 'gruppo') {
        await window.api.progressioni.creaGruppo(n)
      } else {
        const id = await window.api.progressioni.create(n, gruppoNuova === '' ? null : gruppoNuova)
        setSelId(id)
      }
      setNome('')
      setAggiungi(null)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const rinominaGruppo = async (): Promise<void> => {
    if (!gruppoInModifica) return
    const n = gruppoInModifica.nome.trim()
    if (!n) return
    try {
      await window.api.progressioni.rinominaGruppo(gruppoInModifica.id, n)
      setGruppoInModifica(null)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const eliminaGruppo = async (g: ProgressioneGruppo): Promise<void> => {
    const dentro = progressioni.filter((p) => p.gruppo_id === g.id).length
    const testo =
      dentro > 0
        ? `Eliminare il gruppo "${g.nome}"? Le sue ${dentro} progressioni restano, senza gruppo. Si recupera dal cestino.`
        : `Eliminare il gruppo "${g.nome}"?`
    if (!(await chiedi(testo))) return
    try {
      await window.api.progressioni.eliminaGruppo(g.id)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const selezionata = progressioni.find((p) => p.id === selId) ?? null
  const senzaGruppo = progressioni.filter((p) => p.gruppo_id == null)

  const elenco = (lista: Progressione[]): React.JSX.Element => (
    <ul className="elenco-prog">
      {lista.map((p) => (
        <li key={p.id} className={p.id === selId ? 'selected' : ''} onClick={() => setSelId(p.id)}>
          {p.nome}
          <span className="hint"> · {p.step.length === 1 ? '1 step' : `${p.step.length} step`}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="struttura-tab">
      <section className="crud-list">
        <h3>
          Progressioni
          <Aiuto testo="Una progressione è una scala di esercizi da superare uno dopo l'altro (es. Vertical braking). Si raggruppano in gruppi (es. Braking strategies) e si collegano alle fasi di una patologia, in «Patologie e fasi». Servono solo a programmare: non compaiono mai nei referti." />
          <button className="btn-aggiungi-lista" onClick={() => setAggiungi('gruppo')}>
            <Plus size={15} /> Gruppo
          </button>
          <button className="btn-aggiungi-lista" onClick={() => setAggiungi('progressione')}>
            <Plus size={15} /> Progressione
          </button>
        </h3>

        {aggiungi && (
          <div className="add-row">
            {aggiungi === 'progressione' && (
              <div className="add-row-gruppo">
                <SceltaConRicerca
                  voci={gruppi}
                  valore={gruppoNuova}
                  segnaposto="— senza gruppo —"
                  vuoto="— senza gruppo —"
                  onCambia={setGruppoNuova}
                />
              </div>
            )}
            <input
              autoFocus
              placeholder={aggiungi === 'gruppo' ? 'es. Braking strategies' : 'es. Vertical braking'}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void conferma()
                if (e.key === 'Escape') {
                  setNome('')
                  setAggiungi(null)
                }
              }}
            />
            <button onClick={() => void conferma()}>OK</button>
            <button
              title="Chiudi"
              onClick={() => {
                setNome('')
                setAggiungi(null)
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {gruppi.length === 0 && progressioni.length === 0 && !aggiungi && (
          <p className="hint">Es. il gruppo «Braking strategies», con dentro «Vertical braking» e «Horizontal braking».</p>
        )}

        {gruppi.map((g) => (
          <div key={g.id}>
            <div className="prog-gruppo">
              {gruppoInModifica?.id === g.id ? (
                <span className="edit-row">
                  <input
                    autoFocus
                    value={gruppoInModifica.nome}
                    onChange={(e) => setGruppoInModifica({ id: g.id, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void rinominaGruppo()
                      if (e.key === 'Escape') setGruppoInModifica(null)
                    }}
                  />
                  <button onClick={() => void rinominaGruppo()}>OK</button>
                </span>
              ) : (
                <>
                  <span className="item-nome">{g.nome}</span>
                  <span className="item-actions-static">
                    <button title="Rinomina il gruppo" onClick={() => setGruppoInModifica({ id: g.id, nome: g.nome })}>
                      <Pencil size={15} />
                    </button>
                    <button title="Elimina il gruppo" className="danger" onClick={() => void eliminaGruppo(g)}>
                      <X size={15} />
                    </button>
                  </span>
                </>
              )}
            </div>
            {elenco(progressioni.filter((p) => p.gruppo_id === g.id))}
          </div>
        ))}

        {senzaGruppo.length > 0 && (
          <div>
            {gruppi.length > 0 && (
              <div className="prog-gruppo">
                <span className="item-nome">Senza gruppo</span>
              </div>
            )}
            {elenco(senzaGruppo)}
          </div>
        )}
      </section>

      <section className="crud-list">
        {selezionata ? (
          <EditorProgressione
            key={selezionata.id}
            progressione={selezionata}
            gruppi={gruppi}
            libreria={libreria}
            onChanged={carica}
            onEliminata={() => setSelId(null)}
          />
        ) : (
          <>
            <h3>Step della progressione</h3>
            <p className="hint">Scegli una progressione a sinistra, oppure creane una.</p>
          </>
        )}
      </section>
    </div>
  )
}

function EditorProgressione({
  progressione: p,
  gruppi,
  libreria,
  onChanged,
  onEliminata
}: {
  progressione: Progressione
  gruppi: ProgressioneGruppo[]
  libreria: EsercizioConCategoria[]
  onChanged: () => Promise<void>
  onEliminata: () => void
}): React.JSX.Element {
  const [nome, setNome] = useState(p.nome)
  const [criteri, setCriteri] = useState(p.criteri ?? '')
  const [ricerca, setRicerca] = useState('')
  const [aggiungendo, setAggiungendo] = useState(false)

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const salvaCampi = (patch: Partial<{ nome: string; criteri: string; gruppo_id: number | null }>): Promise<void> =>
    run(() =>
      window.api.progressioni.update(p.id, {
        nome: patch.nome ?? nome,
        criteri: (patch.criteri ?? criteri).trim() || null,
        gruppo_id: patch.gruppo_id === undefined ? p.gruppo_id : patch.gruppo_id
      })
    )

  const { ordine, contenitore, presa } = useRiordinoSalvato(p.step, (ids) =>
    run(() => window.api.progressioni.riordinaStep(ids))
  )

  const elimina = async (): Promise<void> => {
    if (!(await chiedi(`Eliminare la progressione "${p.nome}" con i suoi ${p.step.length} step? Si recupera dal cestino.`))) {
      return
    }
    try {
      await window.api.progressioni.remove(p.id)
      onEliminata()
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const gia = new Set(p.step.map((s) => s.esercizio_id))
  const q = ricerca.trim().toLowerCase()
  const trovati = libreria
    .filter((e) => !gia.has(e.id) && (q === '' ? false : e.nome.toLowerCase().includes(q)))
    .slice(0, 10)

  return (
    <div className="editor-progressione">
      <h3>
        {p.nome}
        <button className="btn-aggiungi-lista danger" title="Elimina la progressione" onClick={() => void elimina()}>
          <Trash2 size={15} /> Elimina
        </button>
      </h3>

      <div className="form-row-2">
        <label>
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => nome.trim() && nome.trim() !== p.nome && void salvaCampi({ nome })}
          />
        </label>
        <label>
          Gruppo
          <SceltaConRicerca
            voci={gruppi}
            valore={p.gruppo_id ?? ''}
            segnaposto="— senza gruppo —"
            vuoto="— senza gruppo —"
            onCambia={(id) => void salvaCampi({ gruppo_id: id === '' ? null : id })}
          />
        </label>
      </div>

      <label>
        Criteri per passare allo step dopo
        <textarea
          rows={2}
          value={criteri}
          onChange={(e) => setCriteri(e.target.value)}
          onBlur={() => criteri.trim() !== (p.criteri ?? '') && void salvaCampi({ criteri })}
        />
      </label>

      <div className="sotto-titolo">
        Step, in ordine
        <Aiuto testo="Si supera uno step alla volta. Il «requisito» è quello che deve saper fare per arrivarci (es. «solo se il front squat è di qualità»). Trascina per cambiare l'ordine." />
      </div>

      {p.step.length === 0 && <p className="hint">Nessuno step: aggiungi il primo esercizio.</p>}
      <ul className="step-editor">
        {ordine.map((s, idx) => {
          const dnd = contenitore(idx)
          return (
            <li key={s.id} {...dnd} {...presa(idx)} className={dnd.className}>
              <span className="step-numero">{idx + 1}</span>
              <span className="item-nome">
                {s.esercizio_nome}
                {s.archiviato === 1 && <em className="hint"> (archiviato)</em>}
              </span>
              <RequisitoStep
                valore={s.requisito}
                onSalva={(v) => run(() => window.api.progressioni.aggiornaStep(s.id, v))}
              />
              <button
                className="danger"
                title="Togli dalla progressione"
                onClick={() => void run(() => window.api.progressioni.togliStep(s.id))}
              >
                <X size={16} />
              </button>
            </li>
          )
        })}
      </ul>

      {aggiungendo ? (
        <div className="cerca-step">
          <input
            autoFocus
            type="search"
            placeholder="Cerca l'esercizio nella libreria…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setRicerca('')
                setAggiungendo(false)
              }
            }}
          />
          {q !== '' && trovati.length === 0 && (
            <p className="hint">Nessun esercizio con questo nome (o è già uno step). Crealo prima nella libreria.</p>
          )}
          <ul className="esercizi-proposti">
            {trovati.map((e) => (
              <li key={e.id}>
                <button
                  className="btn-aggiungi-riga"
                  title={`Aggiungi ${e.nome}`}
                  onClick={() => {
                    setRicerca('')
                    void run(() => window.api.progressioni.aggiungiStep(p.id, e.id, null))
                  }}
                >
                  <Plus size={16} />
                </button>
                <span className="item-nome">{e.nome}</span>
                <span className="default-hint">{e.categoria_nome}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button className="btn-aggiungi-lista" onClick={() => setAggiungendo(true)}>
          <Plus size={15} /> Step
        </button>
      )}
    </div>
  )
}

// Il requisito di uno step si scrive sul posto e si salva uscendo dalla casella.
function RequisitoStep({
  valore,
  onSalva
}: {
  valore: string | null
  onSalva: (v: string | null) => Promise<void>
}): React.JSX.Element {
  const [testo, setTesto] = useState(valore ?? '')
  return (
    <input
      placeholder="requisito per arrivarci…"
      value={testo}
      onChange={(e) => setTesto(e.target.value)}
      onBlur={() => testo.trim() !== (valore ?? '') && void onSalva(testo.trim() || null)}
    />
  )
}
