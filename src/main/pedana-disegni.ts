// I disegni dei test con la pedana nei documenti (cartella, report di
// screening): l'andamento nel tempo e il tracciato della stabilometria.
//
// Sono SVG con gli stili scritti dentro (attributi e style), non classi: i
// documenti hanno fogli di stile diversi e la stessa figura deve uscire uguale
// in tutti. I colori sono quelli dei report di screening: blu il lato destro,
// rosso il sinistro.
import { esc } from './html'
import { formattaValore, type LatoPedana, type SeriePedana } from '../shared/pedana'
import { tracciatoSvg } from '../shared/pedana-curve'

export const BLU = '#2563eb'
export const ROSSO = '#d64545'

const GRIGIO = '#8b93a0'
const FILO = '#dfe4ea'

const ggMm = (iso: string): string => {
  const [, m, d] = iso.split('-')
  return d && m ? `${d}/${m}` : iso
}

export interface PuntoPedana {
  data: string
  dx: number | null
  sx: number | null
  // test bilaterali: una linea sola
  unico: number | null
}

// L'andamento di una misura nel tempo: una linea per lato, o una sola per i
// test bilaterali. I punti stanno a distanza uguale in ordine di data, come
// nei report di screening. Con meno di due punti non c'e' niente da
// confrontare: stringa vuota.
export function andamentoPedanaSvg(
  punti: PuntoPedana[],
  unita: string | null,
  perLato: boolean
): string {
  if (punti.length < 2) return ''
  const L = 420
  const A = 170
  const bordo = { su: 18, giu: 30, sx: 48, dx: 16 }

  const valori = punti
    .flatMap((p) => (perLato ? [p.dx, p.sx] : [p.unico]))
    .filter((v): v is number => v != null)
  if (valori.length === 0) return ''
  let min = Math.min(...valori)
  let max = Math.max(...valori)
  if (min === max) {
    min -= 1
    max += 1
  }
  const respiro = (max - min) * 0.12
  min -= respiro
  max += respiro

  const x = (i: number): number =>
    bordo.sx + (i * (L - bordo.sx - bordo.dx)) / Math.max(1, punti.length - 1)
  const y = (v: number): number =>
    A - bordo.giu - ((v - min) / (max - min)) * (A - bordo.su - bordo.giu)

  const linea = (campo: 'dx' | 'sx' | 'unico', colore: string): string => {
    const presi = punti
      .map((p, i) => ({ i, v: p[campo] }))
      .filter((p): p is { i: number; v: number } => p.v != null)
    if (presi.length === 0) return ''
    const d = presi.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')
    const pallini = presi
      .map((p) => `<circle cx="${x(p.i)}" cy="${y(p.v)}" r="3.5" fill="${colore}"/>`)
      .join('')
    return `<path d="${d}" fill="none" stroke="${colore}" stroke-width="2"/>${pallini}`
  }

  const testo = (xx: number, yy: number, t: string, ancora: string): string =>
    `<text x="${xx}" y="${yy}" font-size="9" fill="${GRIGIO}" text-anchor="${ancora}">${esc(t)}</text>`

  return `<svg viewBox="0 0 ${L} ${A}" style="width:100%;height:auto" role="img" aria-label="Andamento nel tempo">
    <line x1="${bordo.sx}" y1="${bordo.su}" x2="${bordo.sx}" y2="${A - bordo.giu}" stroke="${FILO}"/>
    <line x1="${bordo.sx}" y1="${A - bordo.giu}" x2="${L - bordo.dx}" y2="${A - bordo.giu}" stroke="${FILO}"/>
    ${testo(bordo.sx - 6, y(max - respiro) + 4, formattaValore(max - respiro, null), 'end')}
    ${testo(bordo.sx - 6, y(min + respiro) + 4, formattaValore(min + respiro, null), 'end')}
    ${perLato ? linea('dx', BLU) + linea('sx', ROSSO) : linea('unico', BLU)}
    ${punti.map((p, i) => testo(x(i), A - 10, ggMm(p.data), 'middle')).join('')}
    ${testo(L - bordo.dx, bordo.su - 4, unita ?? '', 'end')}
  </svg>`
}

// Il tracciato del centro di pressione (statokinesigramma), con l'ovale al 95%:
// lo stesso disegno della pagina (shared/pedana-curve.ts). `larghezza` e' la
// misura a cui lo si stampa (un tracciato quadrato a tutta pagina sarebbe
// enorme); `raggio` tiene alla stessa scala due tracciati a confronto.
export function stabilogrammaSvg(
  serie: SeriePedana,
  larghezza = '65mm',
  raggio?: number,
  lato: LatoPedana | null = null
): string {
  return tracciatoSvg(serie, { larghezza, raggio, lato, stile: 'report' })
}
