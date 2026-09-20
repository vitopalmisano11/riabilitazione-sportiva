// Riordino per trascinamento, condiviso da tutte le liste dell'app.
//
// Si trascina la riga stessa: niente iconcina a puntini da cercare. Il
// trascinamento pero' non parte se il mouse si e' appoggiato su una casella di
// testo, su un menu o su un pulsante — li' serve a scrivere, a scegliere o a
// premere, e trascinando si evidenzia il testo come in qualunque altro
// programma.
//
// Gli elementi si spostano mentre trascini, non al rilascio: passata la meta'
// di quello sotto al cursore, i due si scambiano di posto e scivolano nella
// posizione nuova. Cosi' quello che vedi mentre trascini e' gia' il risultato,
// e non c'e' da immaginarselo.
//
// Uso tipico:
//   const { contenitore, presa } = useRiordino<number>((da, a) =>
//     salva(sposta(elementi, da, a))
//   )
//   <li {...contenitore(idx)} {...presa(idx)}> … </li>
//
// Chi scrive nell'archivio a ogni spostamento usa useRiordinoSalvato: l'ordine
// si vede subito e si salva una volta sola, quando il trascinamento finisce.
//
// Liste annidate: basta un'istanza dell'hook per livello. Quando si trascina al
// livello interno, quello esterno ha `preso` a null e ignora l'evento da solo.
import { useRef, useState, useLayoutEffect, type DragEvent, type MouseEvent } from 'react'

// Chiave che identifica una posizione. Per le liste annidate si usa una
// stringa tipo "2:0" (sezione 2, riga 0), decodificata da chi la riceve.
type Chiave = string | number

// Quanto dura lo scivolamento di un elemento nella posizione nuova.
const DURATA = 170

export interface PropsContenitore {
  draggable: boolean
  ref: (el: HTMLElement | null) => void
  onDragStart: (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
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

// Chi ha chiesto a Windows di ridurre le animazioni non vede scivolare niente:
// gli elementi si trovano subito al loro posto.
function animazioniRidotte(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export function useRiordino<K extends Chiave>(
  // `primo` e' vero solo al primo spostamento di un trascinamento: serve a chi
  // tiene una cronologia (Ctrl+Z) per registrarne un passo solo, invece di uno
  // per ogni elemento scavalcato. Tornando false lo spostamento si considera
  // rifiutato (per esempio una riga trascinata in un'altra sezione).
  onRiordina: (da: K, a: K, primo: boolean) => void | boolean,
  // Chiamata quando il trascinamento finisce, se qualcosa si e' spostato: e' il
  // momento di scrivere nell'archivio, una volta sola.
  onFine?: () => void
): Riordino<K> {
  const [preso, setPreso] = useState<K | null>(null)
  // Il trascinamento si abilita solo mentre si tiene premuta la maniglia.
  const [abilitato, setAbilitato] = useState<K | null>(null)

  // Lo stato del trascinamento sta anche in dei riferimenti: gli eventi di
  // trascinamento arrivano fitti, e due possono capitare prima che la pagina si
  // sia ridisegnata. Leggendo lo stato "vecchio" lo stesso elemento verrebbe
  // spostato due volte.
  const presoOra = useRef<K | null>(null)
  const primoSpostamento = useRef(true)
  const spostatoQualcosa = useRef(false)
  const ultimoPunto = useRef<{ x: number; y: number } | null>(null)
  const nelFrame = useRef(false)

  // Gli elementi della lista: servono a misurare dov'erano prima di uno
  // spostamento, per farli scivolare da li' alla posizione nuova.
  const nodi = useRef(new Map<K, HTMLElement>())
  const misure = useRef<Map<HTMLElement, DOMRect> | null>(null)
  const scivolate = useRef(new Map<HTMLElement, Animation>())

  // Subito dopo che la pagina si e' ridisegnata: ogni elemento che ha cambiato
  // posto riparte da dov'era e scivola fino a dov'e' adesso.
  useLayoutEffect(() => {
    const prima = misure.current
    misure.current = null
    if (!prima) return
    for (const el of nodi.current.values()) {
      const dov_era = prima.get(el)
      if (!dov_era || !el.isConnected) continue
      // Lo scivolamento in corso si annulla prima di misurare: altrimenti la
      // misura sarebbe la posizione di mezzo dell'animazione, non quella vera.
      scivolate.current.get(el)?.cancel()
      scivolate.current.delete(el)
      const ora = el.getBoundingClientRect()
      const dx = dov_era.left - ora.left
      const dy = dov_era.top - ora.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      const scivolata = el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: DURATA, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
      )
      scivolate.current.set(el, scivolata)
      void scivolata.finished.then(() => scivolate.current.delete(el)).catch(() => undefined)
    }
  })

  const azzera = (): void => {
    const eraSpostato = spostatoQualcosa.current
    presoOra.current = null
    primoSpostamento.current = true
    spostatoQualcosa.current = false
    ultimoPunto.current = null
    setPreso(null)
    setAbilitato(null)
    if (eraSpostato) onFine?.()
  }

  // Lo scambio avviene solo dopo aver superato la meta' dell'elemento sotto al
  // cursore, nel verso in cui si sta andando: senza, due elementi di altezza
  // diversa si scambierebbero avanti e indietro al minimo tremolio del mouse.
  const oltreLaMeta = (e: DragEvent<HTMLElement>): boolean => {
    const r = e.currentTarget.getBoundingClientRect()
    const p = ultimoPunto.current
    ultimoPunto.current = { x: e.clientX, y: e.clientY }
    const dx = p ? e.clientX - p.x : 0
    const dy = p ? e.clientY - p.y : 0
    if (Math.abs(dy) >= Math.abs(dx)) {
      const meta = r.top + r.height / 2
      return dy >= 0 ? e.clientY > meta : e.clientY < meta
    }
    const meta = r.left + r.width / 2
    return dx >= 0 ? e.clientX > meta : e.clientX < meta
  }

  return {
    contenitore: (chiave) => ({
      draggable: abilitato === chiave,
      ref: (el) => {
        if (el) nodi.current.set(chiave, el)
        else nodi.current.delete(chiave)
      },
      onDragStart: (e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        // senza dati alcuni browser non avviano il trascinamento
        e.dataTransfer.setData('text/plain', String(chiave))
        presoOra.current = chiave
        primoSpostamento.current = true
        spostatoQualcosa.current = false
        ultimoPunto.current = { x: e.clientX, y: e.clientY }
        setPreso(chiave)
      },
      onDragOver: (e) => {
        // Se non stiamo trascinando a questo livello lasciamo passare l'evento
        // al livello esterno (es. una riga sopra la sua sezione).
        const attuale = presoOra.current
        if (attuale == null) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        // e' l'elemento che si sta trascinando: dopo uno scambio il cursore ci
        // sta sopra quasi sempre, e li' non c'e' niente da fare
        if (attuale === chiave) return
        // uno scambio per fotogramma: cosi' il prossimo evento lavora sempre
        // sull'elenco gia' aggiornato
        if (nelFrame.current) return
        if (!oltreLaMeta(e)) return

        if (!animazioniRidotte()) {
          misure.current = new Map(
            [...nodi.current.values()]
              .filter((el) => el.isConnected)
              .map((el) => [el, el.getBoundingClientRect()])
          )
        }
        if (onRiordina(attuale, chiave, primoSpostamento.current) === false) {
          misure.current = null
          return
        }
        primoSpostamento.current = false
        spostatoQualcosa.current = true
        presoOra.current = chiave
        setPreso(chiave)
        nelFrame.current = true
        requestAnimationFrame(() => {
          nelFrame.current = false
        })
      },
      onDrop: (e) => {
        if (presoOra.current == null) return
        e.preventDefault()
        e.stopPropagation()
        azzera()
      },
      onDragEnd: azzera,
      className: preso === chiave ? 'in-movimento' : ''
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

// Liste il cui ordine sta nell'archivio: mentre trascini l'ordine nuovo si vede
// subito, e si scrive una volta sola quando lasci. Senza, ogni elemento
// scavalcato vorrebbe dire una scrittura e una rilettura, con l'elenco che
// arriva in ritardo sul cursore.
export function useRiordinoSalvato<T extends { id: number }>(
  voci: T[],
  salva: (ids: number[]) => Promise<unknown> | void
): { ordine: T[]; contenitore: (i: number) => PropsContenitore; presa: (i: number) => PropsPresa } {
  const [provvisorio, setProvvisorio] = useState<T[] | null>(null)
  const ordine = provvisorio ?? voci

  const { contenitore, presa } = useRiordino<number>(
    (da, a) => setProvvisorio(sposta(ordine, da, a)),
    () => {
      // L'ordine provvisorio resta finche' l'archivio non ha risposto: toglierlo
      // prima farebbe rimbalzare l'elenco all'ordine di partenza per un istante.
      void Promise.resolve(salva(ordine.map((v) => v.id))).finally(() => setProvvisorio(null))
    }
  )

  return { ordine, contenitore, presa }
}

// Sposta un elemento dalla posizione `da` alla posizione `a`, senza mutare l'originale.
export function sposta<T>(lista: T[], da: number, a: number): T[] {
  if (da === a || da < 0 || a < 0 || da >= lista.length || a >= lista.length) return lista
  const next = [...lista]
  const [elemento] = next.splice(da, 1)
  next.splice(a, 0, elemento)
  return next
}
