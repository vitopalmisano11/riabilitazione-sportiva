// I disegni della cartella del paziente: il grafico dell'andamento dei sintomi e
// le figure della body chart (la foto del corpo e il piede in vettoriale).
import { readFileSync } from 'fs'
import { join } from 'path'
import { esc } from './html'
import {
  ARCO_PROFILO,
  DITA_DORSO,
  DITA_PIANTA,
  DORSO,
  MALLEOLI_DORSO,
  MALLEOLO_PROFILO,
  PIANTA,
  PIEDE_ALTEZZA,
  PIEDE_LARGHEZZA,
  PROFILO,
  RIFERIMENTI_DORSO,
  RIFERIMENTI_PIANTA,
  RIFERIMENTI_PROFILO,
  type Ellisse
} from '../shared/figure-piede'
import { ALTEZZA, LARGHEZZA } from '../shared/figure'
import {
  eTratto,
  percorsoTratto,
  spessoreTratto,
  stratiTratto,
  type Punto
} from '../shared/tratti'
import { data, pieno, testo } from './cartella-comune'

// ---- andamento dei sintomi ----
//
// Gli stessi due grafici della raccolta anamnestica — le 24 ore e l'andamento
// dall'esordio — con tutti i sintomi dentro lo stesso disegno, una linea per
// colore. Uno per sintomo non direbbe la cosa che conta di piu': se peggiorano
// insieme o uno per volta.
//
// La posizione orizzontale arriva gia' calcolata da 0 a 1, perche' i due
// grafici la decidono in modo diverso: le ore sono in scala, le date sono
// equidistanti (un paziente puo' dire "cinque anni fa", e in scala reale i punti
// recenti finirebbero ammassati in pochi millimetri).
export interface SerieSintomo {
  colore: string
  punti: { x: number; dolore: number }[]
}

export function graficoAndamento(
  serie: SerieSintomo[],
  tacche: { x: number; testo: string }[],
  nomeAsse: string
): string {
  // Riquadro largo e basso: i due grafici stanno affiancati e insieme riempiono
  // la riga, senza rubare mezza pagina in altezza.
  const L = 400
  const A = 200
  const M = { su: 12, giu: 42, sx: 26, dx: 12 }
  const largo = L - M.sx - M.dx
  const alto = A - M.su - M.giu
  const px = (x: number): number => M.sx + x * largo
  const py = (d: number): number => M.su + (1 - d / 10) * alto

  const griglia = [0, 2, 4, 6, 8, 10]
    .map(
      (d) =>
        `<line x1="${M.sx}" y1="${py(d)}" x2="${L - M.dx}" y2="${py(d)}" stroke="#e4e9f0"/>
         <text x="${M.sx - 6}" y="${py(d) + 3}" class="asse">${d}</text>`
    )
    .join('')

  // La prima tacca ancorata a sinistra e l'ultima a destra: centrate, uscirebbero
  // dal disegno e verrebbero tagliate.
  const sotto = tacche
    .map((t) => {
      const dove = t.x < 0.02 ? ' inizio' : t.x > 0.98 ? ' fine' : ''
      return `<text x="${px(t.x)}" y="${A - M.giu + 16}" class="asse-x${dove}">${esc(
        t.testo
      )}</text>`
    })
    .join('')

  const linee = serie
    .map((serieSintomo) => {
      const ordinati = [...serieSintomo.punti].sort((a, b) => a.x - b.x)
      const linea =
        ordinati.length > 1
          ? `<polyline points="${ordinati
              .map((q) => `${px(q.x)},${py(q.dolore)}`)
              .join(' ')}" fill="none" stroke="${serieSintomo.colore}" stroke-width="2"/>`
          : ''
      const pallini = ordinati
        .map(
          (q) => `<circle cx="${px(q.x)}" cy="${py(q.dolore)}" r="3.5" fill="${serieSintomo.colore}"/>`
        )
        .join('')
      return `${linea}${pallini}`
    })
    .join('')

  return `<svg viewBox="0 0 ${L} ${A}">
    ${griglia}${sotto}${linee}
    <text x="${L / 2}" y="${A - 8}" class="asse-x">${esc(nomeAsse)}</text>
  </svg>`
}

// ---- body chart ----

export const NOME_SEGNO: Record<string, string> = {
  rigidita: 'Rigidità percepita',
  dolore: 'Area dolorosa',
  scossa: 'Scossa elettrica',
  parestesie: 'Parestesie',
  tratto: 'Disegno a mano libera',
  sfumato: 'Area tenue (dolore minore o sensibilità ridotta)'
}

export const NOME_VISTA: Record<string, string> = {
  fronte: 'Davanti',
  retro: 'Dietro',
  destra: 'Lato destro',
  sinistra: 'Lato sinistro',
  dorso: 'Dorso',
  pianta: 'Pianta',
  esterno: 'Lato esterno',
  interno: 'Lato interno'
}

// Le viste dipendono dal tipo di body chart: il corpo intero si guarda da
// quattro lati, il piede da sopra, da sotto e dai due profili.
export const VISTE_DI: Record<string, string[]> = {
  corpo: ['fronte', 'retro', 'destra', 'sinistra'],
  piede: ['dorso', 'pianta', 'esterno', 'interno']
}

// Il numero dell'intensita' accanto al segno: nel foglio stampato non c'e' modo
// di passarci sopra col mouse, e senza il numero il segno dice dove ma non
// quanto.
export function intensita(v: number | null, r: number): string {
  if (v == null) return ''
  return `<text x="${r + 5}" y="${-r + 4}" class="intensita">${v}</text>`
}

function simbolo(tipo: string, r: number): string {
  if (tipo === 'dolore') return `<circle class="s-dolore" r="${r}"/>`
  if (tipo === 'parestesie') return `<circle class="s-parestesie" r="${r}"/>`
  if (tipo === 'rigidita') {
    const p = r / 2
    return `<g class="s-rigidita">${[-1, 0, 1]
      .map(
        (i) =>
          `<line x1="${i * p - r * 0.55}" y1="${r * 0.75}" x2="${i * p + r * 0.55}" y2="${
            -r * 0.75
          }"/>`
      )
      .join('')}</g>`
  }
  const s = r / 6
  return `<path class="s-scossa" d="M${-1.5 * s},${-6 * s} L${2.5 * s},${-6 * s} L${0.2 * s},${
    -0.5 * s
  } L${3 * s},${-0.5 * s} L${-2 * s},${6 * s} L${-0.2 * s},${1 * s} L${-2.6 * s},${1 * s} Z"/>`
}

export interface SegnoRiga {
  vista: string
  tipo: string
  x: number
  y: number
  dimensione: number
  intensita: number | null
  // solo per i tratti a mano libera
  punti?: Punto[] | null
}

// Un tratto a mano libera: il pieno e' una passata sola, il tenue ne sovrappone
// quattro (vedi stratiTratto). Le coordinate sono gia' quelle della figura.
function tratto(s: SegnoRiga, larghezza: number, altezza: number): string {
  if (!s.punti || s.punti.length === 0) return ''
  const d = percorsoTratto(s.punti, larghezza, altezza)
  return stratiTratto(s.tipo, spessoreTratto(s.tipo, s.dimensione, larghezza))
    .map(
      (p) =>
        `<path class="s-tratto" d="${d}" stroke-width="${Math.round(p.spessore * 10) / 10}"${
          p.opacita < 1 ? ` stroke-opacity="${p.opacita}"` : ''
        }/>`
    )
    .join('')
}

// I segni di una vista, sulla figura. I tratti vanno sotto: i simboli e i numeri
// restano leggibili anche dove si e' campito.
function marchiSulla(
  segni: SegnoRiga[],
  vista: string,
  larghezza: number,
  altezza: number,
  raggio: number
): string {
  const suVista = segni.filter((s) => s.vista === vista)
  const tratti = suVista
    .filter((s) => eTratto(s.tipo))
    .map((s) => tratto(s, larghezza, altezza))
    .join('')
  const simboli = suVista
    .filter((s) => !eTratto(s.tipo))
    .map(
      (s) =>
        `<g transform="translate(${s.x * larghezza} ${s.y * altezza})">${simbolo(
          s.tipo,
          raggio * s.dimensione
        )}${intensita(s.intensita, raggio * s.dimensione)}</g>`
    )
    .join('')
  return `${tratti}${simboli}`
}

// Lo stile sta dentro l'SVG e non nel foglio di stile del documento: cosi' la
// stessa figura si disegna uguale nel PDF e nell'anteprima.
const STILE_FIGURA = `
  .bordo { fill: #1f2937; stroke: #1f2937; stroke-width: 4; stroke-linejoin: round; }
  .pieno { fill: #fff; }
  .dettagli { fill: none; stroke: #9aa3af; stroke-width: 1.6; stroke-linecap: round; }
  .s-dolore { fill: none; stroke: #d64545; stroke-width: 4; }
  .s-rigidita line { stroke: #d64545; stroke-width: 3.4; stroke-linecap: round; }
  .s-scossa { fill: #d64545; }
  .s-parestesie { fill: #d64545; opacity: 0.28; }
  .s-tratto { fill: none; stroke: #d64545; stroke-linecap: round; stroke-linejoin: round; }
  /* Il numero si legge anche sopra alle linee della sagoma: gli si disegna
     intorno un contorno bianco, che sta sotto al numero e copre quello che
     c'e' dietro. */
  .intensita { font-size: 20px; font-weight: 700; fill: #b03030;
               paint-order: stroke; stroke: #fff; stroke-width: 4px;
               stroke-linejoin: round;
               font-family: 'Segoe UI', system-ui, sans-serif; }
`

function ellissi(e: Ellisse[]): string {
  return e
    .map(
      (x) =>
        `<ellipse cx="${x.cx}" cy="${x.cy}" rx="${x.rx}" ry="${x.ry}"${
          x.rotazione ? ` transform="rotate(${x.rotazione} ${x.cx} ${x.cy})"` : ''
        }/>`
    )
    .join('')
}

// Il piede, con le stesse figure dell'app: ogni vista mostra tutti e due i
// piedi, disegnando il destro e specchiandolo.
export function figuraPiedeSvg(vista: string, segni: SegnoRiga[]): string {
  const dallAlto = vista === 'dorso' || vista === 'pianta'
  const dorso = vista === 'dorso'
  const interno = vista === 'interno'

  const parti = dallAlto
    ? `<path d="${dorso ? DORSO : PIANTA}"/>${ellissi(dorso ? DITA_DORSO : DITA_PIANTA)}`
    : `<path d="${PROFILO}"/>`
  const linee = dallAlto
    ? (dorso ? RIFERIMENTI_DORSO : RIFERIMENTI_PIANTA)
    : interno
      ? [...RIFERIMENTI_PROFILO, ARCO_PROFILO]
      : RIFERIMENTI_PROFILO
  const cerchi = dallAlto
    ? dorso
      ? MALLEOLI_DORSO
      : []
    : [MALLEOLO_PROFILO]
  const dettagli = `<g class="dettagli">${linee.map((d) => `<path d="${d}"/>`).join('')}${ellissi(
    cerchi
  )}</g>`
  const piede = `<g class="bordo">${parti}</g><g class="pieno">${parti}</g>${dettagli}`

  const largoDisegno = dallAlto ? 150 : 210
  const specchiato = `<g transform="translate(${largoDisegno} 0) scale(-1 1)">${piede}</g>`
  const scala = dallAlto ? '' : ' scale(0.71) translate(0 60)'
  const sinistra = dallAlto ? 10 : 6
  const destra = dallAlto ? 170 : 165
  // Guardando la pianta i lati si scambiano: il piede destro passa a destra.
  const primo = dorso || !dallAlto ? (interno ? specchiato : piede) : specchiato
  const secondo = dorso || !dallAlto ? (interno ? piede : specchiato) : piede

  const marchi = marchiSulla(segni, vista, PIEDE_LARGHEZZA, PIEDE_ALTEZZA, 12)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PIEDE_LARGHEZZA} ${PIEDE_ALTEZZA}">
    <style>${STILE_FIGURA}</style>
    <g transform="translate(${sinistra} 0)${scala}">${primo}</g>
    <g transform="translate(${destra} 0)${scala}">${secondo}</g>
    ${marchi}
  </svg>`
}

// Le quattro foto, gia' incorporate come base64: cosi' il PDF resta un unico
// file e non dipende da percorsi esterni che potrebbero non esistere piu'.
// Il percorso si calcola da __dirname (non un import): risalendo di due
// cartelle si arriva alla radice del progetto sia da src/main (in sviluppo e
// nelle prove), sia da out/main (nel programma installato).
const cartellaBodychart = join(__dirname, '../../resources/bodychart')
const IMMAGINE_CORPO_BASE64: Record<string, string> = {
  fronte: readFileSync(join(cartellaBodychart, 'davanti.png')).toString('base64'),
  retro: readFileSync(join(cartellaBodychart, 'dietro.png')).toString('base64'),
  destra: readFileSync(join(cartellaBodychart, 'lato-destro.png')).toString('base64'),
  sinistra: readFileSync(join(cartellaBodychart, 'lato-sinistro.png')).toString('base64')
}

export function figuraSvg(vista: string, segni: SegnoRiga[]): string {
  const marchi = marchiSulla(segni, vista, LARGHEZZA, ALTEZZA, 14)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGHEZZA} ${ALTEZZA}">
    <style>${STILE_FIGURA}</style>
    <image href="data:image/png;base64,${IMMAGINE_CORPO_BASE64[vista]}" x="0" y="0" width="${LARGHEZZA}" height="${ALTEZZA}"/>
    ${marchi}
  </svg>`
}
