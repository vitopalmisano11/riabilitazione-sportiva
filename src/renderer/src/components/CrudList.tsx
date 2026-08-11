import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, X } from 'lucide-react'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'

export interface CrudItem {
  id: number
  nome: string
}

interface Props {
  title: string
  items: CrudItem[]
  selectedId?: number | null
  onSelect?: (id: number) => void
  onAdd: (nome: string) => Promise<unknown>
  onRename: (id: number, nome: string) => Promise<unknown>
  onDelete: (id: number) => Promise<unknown>
  onReorder?: (ids: number[]) => Promise<unknown>
  addPlaceholder?: string
  emptyHint?: string
}

export default function CrudList({
  title,
  items,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  addPlaceholder,
  emptyHint
}: Props): React.JSX.Element {
  const [nuovo, setNuovo] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editNome, setEditNome] = useState('')

  async function run(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const add = (): void => {
    const n = nuovo.trim()
    if (!n) return
    void run(async () => {
      await onAdd(n)
      setNuovo('')
    })
  }

  const saveRename = (): void => {
    const n = editNome.trim()
    if (!n || editId == null) return
    void run(async () => {
      await onRename(editId, n)
      setEditId(null)
    })
  }

  const move = (idx: number, dir: -1 | 1): void => {
    if (!onReorder) return
    const ids = items.map((i) => i.id)
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    void run(() => onReorder(ids))
  }

  return (
    <section className="crud-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item, idx) => (
          <li
            key={item.id}
            className={[
              selectedId === item.id ? 'selected' : '',
              onSelect ? 'selectable' : ''
            ].join(' ')}
            onClick={() => onSelect?.(item.id)}
          >
            {editId === item.id ? (
              <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename()
                    if (e.key === 'Escape') setEditId(null)
                  }}
                />
                <button onClick={saveRename}>OK</button>
              </span>
            ) : (
              <>
                <span className="item-nome">{item.nome}</span>
                <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                  {onReorder && (
                    <>
                      <button title="Sposta su" disabled={idx === 0} onClick={() => move(idx, -1)}>
                        <ArrowUp size={16} />
                      </button>
                      <button
                        title="Sposta giù"
                        disabled={idx === items.length - 1}
                        onClick={() => move(idx, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                    </>
                  )}
                  <button
                    title="Rinomina"
                    onClick={() => {
                      setEditId(item.id)
                      setEditNome(item.nome)
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    title="Elimina"
                    className="danger"
                    onClick={() => {
                      if (confirm(`Eliminare "${item.nome}"?`)) void run(() => onDelete(item.id))
                    }}
                  >
                    <X size={16} />
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="empty">{emptyHint ?? 'Nessun elemento'}</li>}
      </ul>
      <div className="add-row">
        <input
          placeholder={addPlaceholder ?? 'Nuovo…'}
          value={nuovo}
          onChange={(e) => setNuovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button onClick={add}>Aggiungi</button>
      </div>
    </section>
  )
}
