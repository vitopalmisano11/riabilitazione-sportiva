// Riordino per trascinamento, condiviso da tutte le liste dell'app.
//
// Si trascina solo afferrando la maniglia (l'iconcina a puntini): il resto della
// riga resta cliccabile e i campi di testo restano selezionabili, cosa che non
// succederebbe rendendo trascinabile l'intero contenitore.
//
// Uso tipico:
//   const { contenitore, maniglia } = useRiordino<number>((da, a) =>
//     salva(sposta(elementi, da, a))
//   )
//   <li {...contenitore(idx)}> … <button {...maniglia(idx)}><GripVertical /></button> </li>
//
// Liste annidate: basta un'istanza dell'hook per livello. Quando si trascina al
// livello interno, quello esterno ha `preso` a null e ignora l'evento da solo.
import { useState, type DragEvent } from 'react'

// Chiave che identifica una posizione. Per le liste annidate si usa una
// stringa tipo "2:0" (sezione 2, riga 0), decodificata da chi la riceve.
type Chiave = string | number

export interface PropsContenitore {
  draggable: boolean
  onDragStart: (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: (e: DragEvent<HTMLElement>) => void
  onDrop: (e: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  className: string
}

export interface PropsManiglia {
  className: string
  title: string
  onMouseDown: () => void
  onMouseUp: () => void
}

export interface Riordino<K extends Chiave> {
  contenitore: (chiave: K) => PropsContenitore
  maniglia: (chiave: K) => PropsManiglia
}

export function useRiordino<K extends Chiave>(
  onRiordina: (da: K, a: K) => void
): Riordino<K> {
  const [preso, setPreso] = useState<K | null>(null)
  const [sopra, setSopra] = useState<K | null>(null)
  // Il trascinamento si abilita solo mentre si tiene premuta la maniglia.
  const [abilitato, setAbilitato] = useState<K | null>(null)

  const azzera = (): void => {
    setPreso(null)
    setSopra(null)
    setAbilitato(null)
  }

  return {
    contenitore: (chiave) => ({
      draggable: abilitato === chiave,
      onDragStart: (e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        // senza dati alcuni browser non avviano il trascinamento
        e.dataTransfer.setData('text/plain', String(chiave))
        setPreso(chiave)
      },
      onDragOver: (e) => {
        // Se non stiamo trascinando a questo livello lasciamo passare l'evento
        // al livello esterno (es. una riga sopra la sua sezione).
        if (preso == null || preso === chiave) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setSopra(chiave)
      },
      onDragLeave: () => {
        setSopra((s) => (s === chiave ? null : s))
      },
      onDrop: (e) => {
        if (preso == null || preso === chiave) return
        e.preventDefault()
        e.stopPropagation()
        onRiordina(preso, chiave)
        azzera()
      },
      onDragEnd: azzera,
      className: [preso === chiave ? 'in-movimento' : '', sopra === chiave ? 'bersaglio-drop' : '']
        .filter(Boolean)
        .join(' ')
    }),
    maniglia: (chiave) => ({
      className: 'maniglia-riordino',
      title: 'Trascina per spostare',
      onMouseDown: () => setAbilitato(chiave),
      onMouseUp: () => setAbilitato(null)
    })
  }
}

// Sposta un elemento dalla posizione `da` alla posizione `a`, senza mutare l'originale.
export function sposta<T>(lista: T[], da: number, a: number): T[] {
  if (da === a || da < 0 || a < 0 || da >= lista.length || a >= lista.length) return lista
  const next = [...lista]
  const [elemento] = next.splice(da, 1)
  next.splice(a, 0, elemento)
  return next
}
