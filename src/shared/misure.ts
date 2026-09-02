// Regole di calcolo di una misura, in un posto solo.
//
// Le stesse identiche funzioni servono a due mondi: le caselle che si compilano
// a schermo e il report che si stampa. Tenerle qui e' l'unico modo perche' il
// numero scritto nel PDF sia lo stesso che il fisioterapista ha visto mentre
// misurava.
import type { RiassuntoMisura } from './types'

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
