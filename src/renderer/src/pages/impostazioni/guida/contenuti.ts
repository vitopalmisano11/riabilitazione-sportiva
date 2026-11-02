import type { ArgomentoGuida } from './modello'
import { esercizi } from './argomenti/esercizi'
import { progressioni } from './argomenti/progressioni'
import { dose } from './argomenti/dose'
import { percorso } from './argomenti/percorso'
import { screening } from './argomenti/screening'
import { pedana } from './argomenti/pedana'
import { questionari } from './argomenti/questionari'
import { dati } from './argomenti/dati'

// Gli argomenti della guida, nell'ordine in cui compaiono a sinistra: prima la
// libreria e le funzioni che si costruiscono una sopra l'altra (esercizi →
// progressioni → dose), poi il resto della configurazione, in fondo i dati.
// Una voce nuova e' un file in argomenti/ piu' una riga qui.
export const ARGOMENTI: ArgomentoGuida[] = [
  esercizi,
  progressioni,
  dose,
  percorso,
  screening,
  pedana,
  questionari,
  dati
]
