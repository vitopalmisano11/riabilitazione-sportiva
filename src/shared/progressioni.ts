// Dove e' arrivato un paziente in una progressione di esercizi a step.
//
// Lo step non e' salvato da nessuna parte: si ricostruisce rileggendo, in
// ordine, l'esito di ogni seduta. "avanza" porta allo step dopo, "indietro" a
// quello prima (che torna da fare), qualunque altra cosa lascia dov'e'. Cosi'
// non c'e' un dato da tenere allineato a mano: se una seduta si elimina o si
// corregge, lo step si ricalcola da solo.
import type { EsitoProgressione } from './types'

export interface EsitoDatato {
  data: string
  esito: EsitoProgressione
}

export interface PosizioneProgressione {
  // L'indice (da 0) dello step da lavorare adesso; uguale al numero di step
  // quando sono stati superati tutti.
  posizione: number
  // Per ogni step, il giorno in cui e' stato superato (null se non lo e').
  superato_il: (string | null)[]
  // Per ogni step, il giorno in cui si e' tornati su di lui con "indietro",
  // finche' non lo si supera di nuovo.
  rivisto_il: (string | null)[]
  // Da quando il paziente e' all'ultimo step raggiunto (null: dall'inizio).
  attuale_dal: string | null
}

// `esiti` va dato nell'ordine delle sedute (la piu' vecchia prima).
export function posizioneInProgressione(numeroStep: number, esiti: EsitoDatato[]): PosizioneProgressione {
  const superato_il: (string | null)[] = Array(numeroStep).fill(null)
  const rivisto_il: (string | null)[] = Array(numeroStep).fill(null)
  let posizione = 0
  let attuale_dal: string | null = null
  for (const e of esiti) {
    if (e.esito === 'avanza' && posizione < numeroStep) {
      superato_il[posizione] = e.data
      rivisto_il[posizione] = null
      posizione++
      attuale_dal = e.data
    } else if (e.esito === 'indietro' && posizione > 0) {
      posizione--
      superato_il[posizione] = null
      rivisto_il[posizione] = e.data
      attuale_dal = e.data
    }
  }
  return { posizione, superato_il, rivisto_il, attuale_dal }
}
