// Regole di calcolo di una misura, in un posto solo.
//
// Le stesse identiche funzioni servono a due mondi: le caselle che si compilano
// a schermo e il report che si stampa. Tenerle qui e' l'unico modo perche' il
// numero scritto nel PDF sia lo stesso che il fisioterapista ha visto mentre
// misurava.
import type { DirezioneCutoff, MisuraTest, RiassuntoMisura } from './types'

// Da che parte sta il meglio. 'max' vuol dire "meno e' meglio" (i tempi: un
// salto a cronometro, un cambio di direzione); 'min' o nessuna indicazione
// vuol dire "piu' e' meglio" (altezze, distanze, forza).
export function menoEMeglio(direzione: DirezioneCutoff | null | undefined): boolean {
  return direzione === 'max'
}

// Precisione con cui si mostrano e si giudicano i numeri: le misure con due
// decimali, le percentuali (LSI, simmetria) con uno. Il confronto con la soglia
// si fa sul numero arrotondato come lo si vede: prima si leggeva "LSI 90,0% —
// sotto la soglia di 90%", perche' sotto c'era un 89,96.
export const DECIMALI_MISURA = 2
export const DECIMALI_PERCENTUALE = 1

export function arrotonda(valore: number, decimali: number): number {
  const fattore = 10 ** decimali
  return Math.round((valore + Number.EPSILON) * fattore) / fattore
}

// Il valore che conta fra le prove: la migliore, la media o la peggiore, a
// seconda di come e' definita la misura in libreria. "Migliore" dipende dal
// verso: fra due tempi e' il piu' basso.
export function riassumi(
  prove: (number | null)[],
  come: RiassuntoMisura,
  direzione: DirezioneCutoff | null = null
): number | null {
  const presi = prove.filter((x): x is number => x != null && Number.isFinite(x))
  if (presi.length === 0) return null
  if (come === 'media') return presi.reduce((a, b) => a + b, 0) / presi.length
  const alto = Math.max(...presi)
  const basso = Math.min(...presi)
  const migliore = menoEMeglio(direzione) ? basso : alto
  const peggiore = menoEMeglio(direzione) ? alto : basso
  return come === 'peggiore' ? peggiore : migliore
}

// Il confronto fra i due lati, in percentuale.
//
// Sapendo qual e' il lato interessato e' l'LSI, e sotto il 100% vuol dire
// deficit del lato interessato: interessato ÷ sano quando piu' e' meglio, sano ÷
// interessato quando meno e' meglio (un tempo piu' lungo sul lato operato e' un
// deficit, e non deve dare piu' del 100%). Senza sapere il lato resta il
// rapporto fra il minore e il maggiore: dice quanto sono diversi, non in che
// verso, e vale per tutte e due le direzioni.
export function lsi(
  dx: number | null,
  sx: number | null,
  latoInteressato: 'dx' | 'sx' | null,
  direzione: DirezioneCutoff | null = null
): number | null {
  if (dx == null || sx == null) return null
  if (latoInteressato != null) {
    const interessato = latoInteressato === 'dx' ? dx : sx
    const sano = latoInteressato === 'dx' ? sx : dx
    if (menoEMeglio(direzione)) return interessato > 0 ? (sano / interessato) * 100 : null
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

// Un valore rispetto alla sua soglia, giudicato al numero di decimali con cui
// lo si mostra. `direzione` 'max': superato stando sotto (o uguale).
export function superaSoglia(
  valore: number | null,
  soglia: number | null,
  direzione: DirezioneCutoff | null,
  decimali: number
): boolean | null {
  if (valore == null || soglia == null) return null
  const v = arrotonda(valore, decimali)
  return menoEMeglio(direzione) ? v <= soglia : v >= soglia
}

// L'LSI rispetto alla sua soglia: superato o no, ma solo se una soglia c'e':
// senza soglia l'app mostra il numero e non lo giudica. L'LSI e' gia' girato
// nel verso giusto, quindi sopra la soglia e' sempre bene.
export function esito(valoreLsi: number | null, soglia: number | null): boolean | null {
  return superaSoglia(valoreLsi, soglia, 'min', DECIMALI_PERCENTUALE)
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
  lato: 'dx' | 'sx' | null,
  visitate: number[] = []
): number | null {
  if (misura.calcolo != null && misura.calcolo_a != null && misura.calcolo_b != null) {
    // Un giro chiuso (A da B, B da A) non ha un valore: si ferma qui invece di
    // girare senza fine. Il salvataggio non li lascia piu' fare, ma i dati
    // scritti prima potrebbero averli.
    if (misura.id != null && visitate.includes(misura.id)) return null
    const dietro = misura.id == null ? visitate : [...visitate, misura.id]
    const a = tutte.find((m) => m.id === misura.calcolo_a)
    const b = tutte.find((m) => m.id === misura.calcolo_b)
    return combina(
      a ? valoreDi(valori, a, tutte, lato, dietro) : null,
      b ? valoreDi(valori, b, tutte, lato, dietro) : null,
      misura.calcolo
    )
  }
  const prove = valori
    .filter((v) => v.misura_id === misura.id && v.lato === lato)
    .map((v) => v.valore)
  return riassumi(prove, misura.riassunto, misura.cutoff_direzione)
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
