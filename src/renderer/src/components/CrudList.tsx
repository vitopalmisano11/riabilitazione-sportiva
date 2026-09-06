import { useState } from 'react'
import { GripVertical, Pencil, Plus, X } from 'lucide-react'
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
  // Servono a chi aggiunge e rinomina sul posto; chi apre una finestra sua
  // passa onNuovo e onModifica al loro posto.
  onAdd?: (nome: string) => Promise<unknown>
  onRename?: (id: number, nome: string) => Promise<unknown>
  onDelete: (id: number) => Promise<unknown>
  onReorder?: (ids: number[]) => Promise<unknown>
  // Cosa c'e' scritto sul pulsante che aggiunge ("Nuova sezione") e cosa si
  // legge dentro alla casella quando si apre.
  etichettaAggiungi?: string
  addPlaceholder?: string
  emptyHint?: string
  // Un'aggiunta accanto al nome (un'etichetta) e un pulsante in piu' fra le
  // azioni della riga: servono a chi ha bisogno di una voce in piu' senza
  // cambiare la lista per tutti gli altri.
  // Il "?" accanto al titolo della lista, quando c'e' qualcosa da spiegare.
  aiuto?: string
  // Chi ha piu' di un campo da compilare si apre una finestra sua: passando
  // queste due, la matita e il pulsante in fondo la chiamano invece di
  // rinominare sul posto.
  onNuovo?: () => void
  onModifica?: (item: CrudItem) => void
  // Qualcosa da mostrare accanto al nome (un'etichetta di stato).
  dopoNome?: (item: CrudItem) => React.ReactNode
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
  etichettaAggiungi,
  addPlaceholder,
  emptyHint,
  aiuto,
  onNuovo,
  onModifica,
  dopoNome
}: Props): React.JSX.Element {
  const [nuovo, setNuovo] = useState('')
  // La casella per aggiungere compare solo quando serve: a riposo l'elenco non
  // ha in fondo un campo vuoto che sembra sempre in attesa di qualcosa.
  const [aperta, setAperta] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editNome, setEditNome] = useState('')

  async function run(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Dopo l'aggiunta la casella resta aperta e vuota: quando se ne mettono
  // cinque di fila, chiuderla ogni volta sarebbe cinque clic in piu'.
  const add = (): void => {
    const n = nuovo.trim()
    if (!n || !onAdd) return
    void run(async () => {
      await onAdd(n)
      setNuovo('')
    })
  }

  const saveRename = (): void => {
    const n = editNome.trim()
    if (!n || editId == null || !onRename) return
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
        {(onNuovo || onAdd) && (
          <button
            className="btn-aggiungi-lista"
            onClick={() => (onNuovo ? onNuovo() : setAperta(true))}
          >
            <Plus size={15} /> {etichettaAggiungi ?? 'Aggiungi'}
          </button>
        )}
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
                {dopoNome?.(item)}
                <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                  {onReorder && (
                    <button {...maniglia(idx)}>
                      <GripVertical size={16} />
                    </button>
                  )}
                  <button
                    title={onModifica ? 'Modifica' : 'Rinomina'}
                    onClick={() => {
                      if (onModifica) {
                        onModifica(item)
                        return
                      }
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
      {aperta && onAdd && (
        <div className="add-row">
          <input
            autoFocus
            placeholder={addPlaceholder ?? 'Nuovo…'}
            value={nuovo}
            onChange={(e) => setNuovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
              if (e.key === 'Escape') {
                setNuovo('')
                setAperta(false)
              }
            }}
          />
          <button onClick={add}>OK</button>
          <button
            title="Chiudi"
            onClick={() => {
              setNuovo('')
              setAperta(false)
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </section>
  )
}
