import { useState } from 'react'
import { GripVertical, Pencil, X } from 'lucide-react'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import Aiuto from './Aiuto'

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
  // Un'aggiunta accanto al nome (un'etichetta) e un pulsante in piu' fra le
  // azioni della riga: servono a chi ha bisogno di una voce in piu' senza
  // cambiare la lista per tutti gli altri.
  // Il "?" accanto al titolo della lista, quando c'e' qualcosa da spiegare.
  aiuto?: string
  azioniExtra?: (item: CrudItem) => React.ReactNode
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
  emptyHint,
  aiuto,
  azioniExtra
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

  const { contenitore, maniglia } = useRiordino<number>((da, a) => {
    if (!onReorder) return
    const ids = sposta(items, da, a).map((i) => i.id)
    void run(() => onReorder(ids))
  })

  return (
    <section className="crud-list">
      <h3>
        {title}
        {aiuto && <Aiuto testo={aiuto} />}
      </h3>
      <ul>
        {items.map((item, idx) => {
          const dnd = onReorder ? contenitore(idx) : null
          return (
          <li
            key={item.id}
            {...dnd}
            className={[
              selectedId === item.id ? 'selected' : '',
              onSelect ? 'selectable' : '',
              dnd?.className ?? ''
            ]
              .filter(Boolean)
              .join(' ')}
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
                {azioniExtra && (
                  <span className="item-extra" onClick={(e) => e.stopPropagation()}>
                    {azioniExtra(item)}
                  </span>
                )}
                <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                  {onReorder && (
                    <button {...maniglia(idx)}>
                      <GripVertical size={16} />
                    </button>
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
                    onClick={async () => {
                      if (await chiedi(`Eliminare "${item.nome}"?`)) void run(() => onDelete(item.id))
                    }}
                  >
                    <X size={16} />
                  </button>
                </span>
              </>
            )}
          </li>
          )
        })}
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
