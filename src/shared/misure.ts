// Regole di calcolo di una misura, in un posto solo.
//
// Le stesse identiche funzioni servono a due mondi: le caselle che si compilano
// a schermo e il report che si stampa. Tenerle qui e' l'unico modo perche' il
// numero scritto nel PDF sia lo stesso che il fisioterapista ha visto mentre
// misurava.
import type { MisuraTest, RiassuntoMisura } from './types'

// Il valore che conta fra le prove: la migliore, la media o la peggiore, a
// seconda di come e' definita la misura in libreria.
export function riassumi(prove: (number | null)[], come: RiassuntoMisura): number | null {
  const presi = prove.filter((x): x is number => x != null && Number.isFinite(x))
  if (presi.length === 0) return null
  if (come === 'media') return presi.reduce((a, b) => a + b, 0) / presi.length
  if (come === 'peggiore') return Math.min(...presi)
  return Math.max(...presi)
}

// Il confronto fra i due lati, in percentuale.
//
// Sapendo qual e' il lato interessato il rapporto e' interessato ÷ sano: e'
// l'LSI, e sotto il 100% vuol dire deficit. Senza saperlo resta il rapporto fra
// il minore e il maggiore: dice quanto sono diversi, non in che verso.
export function lsi(
  dx: number | null,
  sx: number | null,
  latoInteressato: 'dx' | 'sx' | null
): number | null {
  if (dx == null || sx == null) return null
  if (latoInteressato != null) {
    const interessato = latoInteressato === 'dx' ? dx : sx
    const sano = latoInteressato === 'dx' ? sx : dx
    return sano > 0 ? (interessato / sano) * 100 : null
  }
  const massimo = Math.max(dx, sx)
  return massimo > 0 ? (Math.min(dx, sx) / massimo) * 100 : null
}

// Quanto i due lati si discostano, in percentuale del maggiore: e' il numero
// che nei report di forza sta sotto la ciambella.
export function asimmetria(dx: number | null, sx: number | null): number | null {
  if (dx == null || sx == null) return null
  const massimo = Math.max(dx, sx)
  return massimo > 0 ? (Math.abs(dx - sx) / massimo) * 100 : null
}

// Superato o no, ma solo se una soglia c'e': senza soglia l'app mostra il
// numero e non lo giudica.
export function esito(valoreLsi: number | null, soglia: number | null): boolean | null {
  if (valoreLsi == null || soglia == null) return null
  return valoreLsi >= soglia
}

// Un valore registrato in uno screening.
export interface RigaValore {
  misura_id: number
  lato: 'dx' | 'sx' | null
  prova: number | null
  valore: number
}

// Il valore che conta di una misura in una sessione, per lato: la prova scelta
// fra quelle registrate, oppure il calcolo dalle altre due misure. Serve al
// report e al punteggio del cluster, che devono leggere lo stesso numero.
export function valoreDi(
  valori: RigaValore[],
  misura: MisuraTest,
  tutte: MisuraTest[],
  lato: 'dx' | 'sx' | null
): number | null {
  if (misura.calcolo != null && misura.calcolo_a != null && misura.calcolo_b != null) {
    const a = tutte.find((m) => m.id === misura.calcolo_a)
    const b = tutte.find((m) => m.id === misura.calcolo_b)
    return combina(
      a ? valoreDi(valori, a, tutte, lato) : null,
      b ? valoreDi(valori, b, tutte, lato) : null,
      misura.calcolo
    )
  }
  const prove = valori
    .filter((v) => v.misura_id === misura.id && v.lato === lato)
    .map((v) => v.valore)
  return riassumi(prove, misura.riassunto)
}

// Una misura calcolata da altre due dello stesso test: 'rapporto' e' A ÷ B
// (l'EUR), 'differenza' e' A − B (il COD deficit).
export function combina(
  a: number | null,
  b: number | null,
  come: 'rapporto' | 'differenza'
): number | null {
  if (a == null || b == null) return null
  if (come === 'rapporto') return b === 0 ? null : a / b
  return a - b
}
