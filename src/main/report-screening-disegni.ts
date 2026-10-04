// I disegni del report dello screening: la ciambella dx/sx e il grafico
// dell'andamento fra gli screening (report-screening.ts).
import { esc } from './html'
import { data, numero } from './report-screening-comune'

// ---- disegni ----

const ROSSO = '#d64545'
const BLU = '#2563eb'

// La ciambella dei due lati: l'ampiezza di ogni spicchio e' proporzionale al
// valore, quindi il disegno mostra subito da che parte pende.
export function ciambella(dx: number | null, sx: number | null): string {
  const R = 52
  const spessore = 22
  const totale = (dx ?? 0) + (sx ?? 0)
  if (totale <= 0) {
    return `<svg viewBox="0 0 140 140" class="ciambella">
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="#e4e9f0" stroke-width="${spessore}"/>
      <text x="70" y="75" class="vuoto">nessun valore</text></svg>`
  }
  const quota = (sx ?? 0) / totale
  const circonferenza = 2 * Math.PI * R
  // Il primo arco parte in alto e gira in senso orario.
  return `<svg viewBox="0 0 140 140" class="ciambella">
    <g transform="rotate(-90 70 70)">
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="${BLU}" stroke-width="${spessore}"/>
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="${ROSSO}" stroke-width="${spessore}"
        stroke-dasharray="${(circonferenza * quota).toFixed(2)} ${circonferenza.toFixed(2)}"/>
    </g>
  </svg>`
}

export interface PuntoStorico {
  data: string
  dx: number | null
  sx: number | null
}

// L'andamento nel tempo: una linea per lato, i punti sulle date delle sedute.
// Con una sola seduta non c'e' niente da confrontare e il grafico non si stampa.
export function andamento(punti: PuntoStorico[], soglia: number | null, unita: string | null): string {
  if (punti.length < 2) return ''
  const L = 420
  const A = 170
  const bordo = { su: 18, giu: 30, sx: 44, dx: 16 }

  const valori = punti.flatMap((p) => [p.dx, p.sx]).filter((v): v is number => v != null)
  if (valori.length === 0) return ''
  const candidati = soglia != null ? [...valori, soglia] : valori
  let min = Math.min(...candidati)
  let max = Math.max(...candidati)
  if (min === max) {
    min -= 1
    max += 1
  }
  // un po' d'aria sopra e sotto, altrimenti i punti toccano il bordo
  const respiro = (max - min) * 0.12
  min -= respiro
  max += respiro

  const x = (i: number): number =>
    bordo.sx + (i * (L - bordo.sx - bordo.dx)) / Math.max(1, punti.length - 1)
  const y = (v: number): number =>
    A - bordo.giu - ((v - min) / (max - min)) * (A - bordo.su - bordo.giu)

  const linea = (lato: 'dx' | 'sx', colore: string): string => {
    const presi = punti
      .map((p, i) => ({ i, v: p[lato] }))
      .filter((p): p is { i: number; v: number } => p.v != null)
    if (presi.length === 0) return ''
    const d = presi.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')
    const pallini = presi
      .map((p) => `<circle cx="${x(p.i)}" cy="${y(p.v)}" r="3.5" fill="${colore}"/>`)
      .join('')
    return `<path d="${d}" fill="none" stroke="${colore}" stroke-width="2"/>${pallini}`
  }

  const rigaSoglia =
    soglia == null
      ? ''
      : `<line x1="${bordo.sx}" y1="${y(soglia)}" x2="${L - bordo.dx}" y2="${y(soglia)}"
           stroke="${ROSSO}" stroke-width="1.4" stroke-dasharray="6 4"/>
         <text x="${L - bordo.dx}" y="${y(soglia) - 4}" class="etichetta-soglia">riferimento</text>`

  const etichette = punti
    .map(
      (p, i) =>
        `<text x="${x(i)}" y="${A - 10}" class="etichetta-x">${esc(data(p.data).slice(0, 5))}</text>`
    )
    .join('')

  return `<svg viewBox="0 0 ${L} ${A}" class="andamento">
    <line x1="${bordo.sx}" y1="${bordo.su}" x2="${bordo.sx}" y2="${A - bordo.giu}" stroke="#dfe4ea"/>
    <line x1="${bordo.sx}" y1="${A - bordo.giu}" x2="${L - bordo.dx}" y2="${A - bordo.giu}" stroke="#dfe4ea"/>
    <text x="${bordo.sx - 6}" y="${y(max - respiro) + 4}" class="etichetta-y">${numero(max - respiro)}</text>
    <text x="${bordo.sx - 6}" y="${y(min + respiro) + 4}" class="etichetta-y">${numero(min + respiro)}</text>
    ${rigaSoglia}
    ${linea('dx', BLU)}
    ${linea('sx', ROSSO)}
    ${etichette}
    <text x="${L - bordo.dx}" y="${bordo.su - 4}" class="etichetta-unita">${esc(unita ?? '')}</text>
  </svg>`
}
