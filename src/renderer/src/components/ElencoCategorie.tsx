import { useState } from 'react'
import { GripVertical, Pencil, Plus, X } from 'lucide-react'
import { toastErrore } from './Toast'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

// Primo passo di una configurazione a livelli: le categorie che raggruppano
// questionari o test. La stessa schermata serve a entrambi, cambiano solo i
// testi e i canali con cui parla al database.
export interface ApiCategorie {
  create(nome: string): Promise<number>
  update(id: number, nome: string): Promise<void>
  remove(id: number): Promise<void>
  reorder(ids: number[]): Promise<void>
}

export interface VoceCategoria {
  id: number
  nome: string
}

export default function ElencoCategorie({
  categorie,
  api,
  etichettaNuova,
  esempio,
  avvisoElimina,
  onApri,
  onChanged
}: {
  categorie: VoceCategoria[]
  api: ApiCategorie
  etichettaNuova: string
  esempio: string
  avvisoElimina: string
  onApri: (id: number) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [nuovaAperta, setNuovaAperta] = useState(false)
  const [nome, setNome] = useState('')
  const [edit, setEdit] = useState<{ id: number; nome: string } | null>(null)

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const { contenitore, maniglia } = useRiordino<number>((da, a) => {
    const ids = sposta(categorie, da, a).map((c) => c.id)
    void run(async () => {
      await api.reorder(ids)
      await onChanged()
    })
  })

  const crea = (): void => {
    const n = nome.trim()
    if (!n) return
    void run(async () => {
      const id = await api.create(n)
      setNome('')
      setNuovaAperta(false)
      await onChanged()
      onApri(id)
    })
  }

  const salvaRinomina = (): void => {
    if (!edit || !edit.nome.trim()) return
    void run(async () => {
      await api.update(edit.id, edit.nome.trim())
      setEdit(null)
      await onChanged()
    })
  }

  return (
    <section className="card step-card">
      <div className="step-head">
        <div className="step-title">
          <span className="step-num">1</span>
          <h3>Scegli la categoria</h3>
        </div>
        <button
          className="primary btn-icona"
          title={etichettaNuova}
          onClick={() => setNuovaAperta(true)}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="scelta-tiles">
        {categorie.map((c, idx) => {
          const dnd = contenitore(idx)
          return (
            <div
              key={c.id}
              {...dnd}
              className={['scelta-tile', dnd.className].filter(Boolean).join(' ')}
              onClick={() => onApri(c.id)}
            >
              {edit && edit.id === c.id ? (
                <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={edit.nome}
                    onChange={(e) => setEdit({ id: c.id, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvaRinomina()
                      if (e.key === 'Escape') setEdit(null)
                    }}
                  />
                  <button onClick={salvaRinomina}>OK</button>
                </span>
              ) : (
                <>
                  <span className="scelta-tile-nome">{c.nome}</span>
                  <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                    <button {...maniglia(idx)}>
                      <GripVertical size={16} />
                    </button>
                    <button title="Rinomina" onClick={() => setEdit({ id: c.id, nome: c.nome })}>
                      <Pencil size={16} />
                    </button>
                    <button
                      title="Elimina"
                      className="danger"
                      onClick={() => {
                        if (confirm(`Eliminare la categoria "${c.nome}"?\n${avvisoElimina}`)) {
                          void run(async () => {
                            await api.remove(c.id)
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
      {categorie.length === 0 && (
        <p className="hint">Nessuna categoria: aggiungine una col pulsante + qui sopra ({esempio}).</p>
      )}

      {nuovaAperta && (
        <div className="modal-overlay" onClick={() => setNuovaAperta(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>{etichettaNuova}</h3>
            <label>
              Nome della categoria
              <input
                autoFocus
                placeholder={esempio}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') crea()
                  if (e.key === 'Escape') setNuovaAperta(false)
                }}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setNuovaAperta(false)}>Annulla</button>
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
