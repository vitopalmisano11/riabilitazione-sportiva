// I tratti a mano libera della body chart.
//
// Oltre ai simboli messi con un clic, sulla figura si disegna col dito o col
// mouse tenuto premuto: un tratto pieno rosso per il dolore, o un tratto tenue e
// sfumato per le aree dove il dolore e' minore o la sensibilita' e' ridotta.
//
// Sta in `shared` perche' lo usano l'interfaccia e la cartella stampata (che gira
// nel processo principale e non puo' importare niente di React): i due devono
// disegnare lo stesso tratto con lo stesso spessore.

// Un punto del tratto, come frazioni 0..1 del riquadro della figura (come la
// posizione dei simboli: cosi' il tratto resta al suo posto a qualunque
// ingrandimento).
export type Punto = [number, number]

export const eTratto = (tipo: string): boolean => tipo === 'tratto' || tipo === 'sfumato'

// Quanti punti al massimo ha un tratto: oltre, e' un tratto che non finisce piu'
// e che gonfierebbe l'archivio per niente.
export const PUNTI_MASSIMI = 4000

// Lo spessore di partenza, in frazione della larghezza della figura: e' quello
// con cui si segna un'area senza uscire dai contorni ne' faticare a riempirla.
// Il tenue parte piu' largo, perche' serve a campire un'area e non a tracciare
// una linea. `dimensione` del segno lo moltiplica.
export const SPESSORE_TRATTO = 0.04
export const SPESSORE_SFUMATO = 0.08

export const spessoreTratto = (tipo: string, dimensione: number, larghezza: number): number =>
  larghezza * (tipo === 'sfumato' ? SPESSORE_SFUMATO : SPESSORE_TRATTO) * dimensione

// Come si sovrappongono le passate per disegnare il tratto. Il pieno e' una
// passata sola. Il tenue ne sono quattro, ognuna piu' stretta della precedente
// e molto trasparente: il centro risulta piu' carico e il bordo svanisce, senza
// filtri di sfocatura (che non tutti i motori di stampa rendono uguali).
export function stratiTratto(
  tipo: string,
  spessore: number
): { spessore: number; opacita: number }[] {
  if (tipo !== 'sfumato') return [{ spessore, opacita: 1 }]
  return [1, 0.72, 0.46, 0.22].map((f) => ({ spessore: spessore * f, opacita: 0.13 }))
}

const arrotonda = (n: number): number => Math.round(n * 10) / 10

// Il percorso SVG del tratto, ammorbidito: le curve passano per i punti medi fra
// un campione e l'altro, cosi' la linea non resta a spezzata anche se il mouse
// manda pochi punti.
export function percorsoTratto(punti: Punto[], larghezza: number, altezza: number): string {
  const p = punti.map(([x, y]) => [arrotonda(x * larghezza), arrotonda(y * altezza)])
  if (p.length === 0) return ''
  // Un clic senza trascinare: un puntino. Un tratto lungo zero non si vedrebbe
  // in tutti i motori, quindi gli si da' una lunghezza minima.
  if (p.length === 1) return `M${p[0][0]},${p[0][1]} L${p[0][0] + 0.1},${p[0][1]}`
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 1; i < p.length - 1; i++) {
    const mx = arrotonda((p[i][0] + p[i + 1][0]) / 2)
    const my = arrotonda((p[i][1] + p[i + 1][1]) / 2)
    d += ` Q${p[i][0]},${p[i][1]} ${mx},${my}`
  }
  const ultimo = p[p.length - 1]
  return `${d} L${ultimo[0]},${ultimo[1]}`
}

const frazione = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const dentro = (n: number): number => Math.min(1, Math.max(0, n))

// I punti come si scrivono nell'archivio: un testo JSON. Quelli che non sono
// numeri si scartano, il resto si porta dentro la figura e a quattro decimali
// (un decimillesimo di una figura alta 660 e' meno di un decimo di punto).
export function serializzaPunti(punti: Punto[] | null | undefined): string | null {
  if (!punti || punti.length === 0) return null
  const puliti = punti
    .filter((q) => Array.isArray(q) && frazione(q[0]) && frazione(q[1]))
    .slice(0, PUNTI_MASSIMI)
    .map((q) => [Math.round(dentro(q[0]) * 10000) / 10000, Math.round(dentro(q[1]) * 10000) / 10000])
  return puliti.length === 0 ? null : JSON.stringify(puliti)
}

// L'inverso: da quello che c'e' nell'archivio ai punti, o niente se il testo e'
// vuoto o rovinato. Un tratto illeggibile non deve impedire di aprire la chart.
export function leggiPunti(testo: string | null | undefined): Punto[] | null {
  if (!testo) return null
  try {
    const v: unknown = JSON.parse(testo)
    if (!Array.isArray(v)) return null
    const punti = v.filter(
      (q): q is Punto => Array.isArray(q) && frazione(q[0]) && frazione(q[1])
    )
    return punti.length === 0 ? null : punti
  } catch {
    return null
  }
}
