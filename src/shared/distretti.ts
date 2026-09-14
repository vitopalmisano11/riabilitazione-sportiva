// I gruppi dei test di un distretto.
//
// Stanno qui, e non nella pagina della libreria, perche' servono a due mondi:
// la valutazione sullo schermo e la relazione scritta, che li nomina nelle
// frasi. Con un elenco solo le parole sono le stesse.
import type { GruppoTest } from './types'

// L'ordine e' quello in cui i gruppi compaiono nella valutazione: si scende dal
// dolore alla struttura, poi il neurologico, e in fondo quello che resta.
export const GRUPPI: { valore: GruppoTest; etichetta: string }[] = [
  { valore: 'provocazione', etichetta: 'Provocazione del dolore' },
  { valore: 'forza', etichetta: 'Forza muscolare' },
  { valore: 'legamentosa', etichetta: 'Stabilità legamentosa' },
  { valore: 'flessibilita', etichetta: 'Test di flessibilità' },
  { valore: 'neurologico', etichetta: 'Esame neurologico' },
  { valore: 'altri', etichetta: 'Altri test' }
]
