// Riordino per trascinamento, condiviso da tutte le liste dell'app.
//
// Si trascina la riga stessa: niente iconcina a puntini da cercare. Il
// trascinamento pero' non parte se il mouse si e' appoggiato su una casella di
// testo, su un menu o su un pulsante — li' serve a scrivere, a scegliere o a
// premere, e trascinando si evidenzia il testo come in qualunque altro
// programma.
//
// Uso tipico:
//   const { contenitore, presa } = useRiordino<number>((da, a) =>
//     salva(sposta(elementi, da, a))
//   )
//   <li {...contenitore(idx)} {...presa(idx)}> … </li>
//
// Liste annidate: basta un'istanza dell'hook per livello. Quando si trascina al
// livello interno, quello esterno ha `preso` a null e ignora l'evento da solo.
import { useState, type DragEvent, type MouseEvent } from 'react'

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

export interface PropsPresa {
  onMouseDown: (e: MouseEvent<HTMLElement>) => void
  onMouseUp: () => void
}

export interface Riordino<K extends Chiave> {
  contenitore: (chiave: K) => PropsContenitore
  presa: (chiave: K) => PropsPresa
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
    presa: (chiave) => ({
      onMouseDown: (e) => {
        // Appoggiando il mouse dentro a una casella, a un menu o a un pulsante
        // non si sta prendendo la riga: si sta scrivendo, scegliendo o
        // premendo. Senza questo controllo selezionare del testo con il mouse
        // avvierebbe un trascinamento.
        const dove = e.target as HTMLElement | null
        if (dove?.closest('input, textarea, select, button, a, [contenteditable]')) return
        // Liste annidate: prendendo una riga si prende la riga, non la sezione
        // che la contiene. Senza questo si abiliterebbero tutti e due e
        // partirebbe il trascinamento di quella sbagliata.
        e.stopPropagation()
        setAbilitato(chiave)
      },
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
