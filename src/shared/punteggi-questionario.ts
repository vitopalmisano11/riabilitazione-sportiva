// Come si calcola un punteggio di questionario dalle risposte.
//
// Fino alla migrazione 57 c'era solo la somma, e una risposta mancante valeva
// 0. Molte scale validate pero' si esprimono in percentuale del massimo
// possibile, contando solo le domande a cui si e' risposto: l'ODI (0 = nessuna
// disabilita'), l'IKDC soggettivo, le sottoscale del KOOS (rovesciate: 100 =
// nessun problema). Qui ci sono i modi di calcolo; quale usare lo decide chi
// configura il questionario, scala per scala.
//
// Niente database e niente Electron: lo usano il calcolo vero (main/questionari.ts)
// e le prove.
import type { DomandaQuestionario, TipoPunteggio } from './types'

export const TIPI_PUNTEGGIO: { valore: TipoPunteggio; etichetta: string; spiegazione: string }[] = [
  {
    valore: 'somma',
    etichetta: 'Somma delle risposte',
    spiegazione: 'Si sommano i valori delle risposte. Una domanda senza risposta conta 0.'
  },
  {
    valore: 'percentuale',
    etichetta: 'Percentuale del massimo (0–100)',
    spiegazione:
      'Quanto della scala è stato raggiunto, contando solo le domande a cui ha risposto: 0 = tutte al minimo, 100 = tutte al massimo. Come l’ODI o l’IKDC soggettivo.'
  },
  {
    valore: 'percentuale_inversa',
    etichetta: 'Percentuale inversa (100 = nessun problema)',
    spiegazione:
      'Come la percentuale, ma rovesciata: 100 = tutte le risposte al minimo. Per le scale in cui il minimo è “nessun problema”, come le sottoscale del KOOS.'
  },
  {
    valore: 'media',
    etichetta: 'Media delle risposte',
    spiegazione: 'La media dei valori delle domande a cui ha risposto.'
  }
]

export const tipoPunteggioValido = (t: unknown): t is TipoPunteggio =>
  TIPI_PUNTEGGIO.some((x) => x.valore === t)

// Il valore piu' basso e piu' alto che una domanda puo' dare.
export function estremiDomanda(d: Pick<DomandaQuestionario, 'tipo' | 'scala_min' | 'scala_max' | 'opzioni'>): {
  min: number
  max: number
} {
  if (d.tipo === 'si_no') return { min: 0, max: 1 }
  if (d.tipo === 'scala') return { min: d.scala_min ?? 0, max: d.scala_max ?? 0 }
  const punti = d.opzioni.map((o) => o.punteggio)
  return punti.length === 0 ? { min: 0, max: 0 } : { min: Math.min(...punti), max: Math.max(...punti) }
}

const unDecimale = (n: number): number => Math.round(n * 10) / 10

// Il valore di un punteggio. `risposte` sono quelle date alle domande del
// punteggio, ognuna con gli estremi della sua domanda; `domande` quante sono in
// tutto (per la somma, dove una risposta mancante vale 0 come sempre).
export function valorePunteggio(
  tipo: TipoPunteggio,
  risposte: { valore: number; min: number; max: number }[]
): number {
  const somma = risposte.reduce((s, r) => s + r.valore, 0)
  switch (tipo) {
    case 'somma':
      return somma
    case 'media':
      return risposte.length === 0 ? 0 : unDecimale(somma / risposte.length)
    case 'percentuale':
    case 'percentuale_inversa': {
      const daMinimo = risposte.reduce((s, r) => s + (r.valore - r.min), 0)
      const ampiezza = risposte.reduce((s, r) => s + (r.max - r.min), 0)
      if (ampiezza <= 0) return 0
      const percentuale = (daMinimo / ampiezza) * 100
      return unDecimale(tipo === 'percentuale' ? percentuale : 100 - percentuale)
    }
  }
}
