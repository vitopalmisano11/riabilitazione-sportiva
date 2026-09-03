// Cartella completa del paziente.
//
// Legge dal database tutto quello che riguarda il paziente e lo riduce a
// "blocchi": titoli, paragrafi, coppie etichetta/valore, tabelle, elenchi e le
// figure della body chart. Da questi nasce l'HTML, e dall'HTML il PDF. Tenerli
// separati dal formato serve a mostrare in anteprima esattamente il documento
// che poi si salva.
//
// Le body chart si ridisegnano con gli stessi tracciati dell'app
// (src/shared/figure.ts): nel documento appaiono come le hai segnate.
import { getDb } from './db'
import { COLORI_SINTOMI } from '../shared/sintomi'
import { coloriTema } from '../shared/temi'
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
import {
  ALTEZZA,
  BRACCIO,
  GAMBA,
  LARGHEZZA,
  PIEDE,
  PROFILO_BRACCIO,
  PROFILO_GAMBA,
  PROFILO_PIEDE,
  PROFILO_TRONCO,
  DETTAGLI_FRONTE,
  DETTAGLI_PROFILO,
  DETTAGLI_RETRO,
  TESTA_FRONTE,
  TESTA_PROFILO,
  TRONCO,
  type Forma,
  type Linea
} from '../shared/figure'
import type { SezioneCartella } from '../shared/types'

export const SEZIONI: { chiave: SezioneCartella; titolo: string }[] = [
  { chiave: 'anagrafica', titolo: 'Dati del paziente' },
  { chiave: 'anamnesi', titolo: 'Anamnesi prossima' },
  // La body chart sta fra le due anamnesi: e' il disegno di quello che il
  // paziente ha appena raccontato, e leggerlo dopo l'anamnesi remota vorrebbe
  // dire tornare indietro.
  { chiave: 'bodychart', titolo: 'Body chart' },
  { chiave: 'remota', titolo: 'Anamnesi remota' },
  { chiave: 'valutazioni', titolo: 'Valutazione obiettiva' },
  { chiave: 'questionari', titolo: 'Questionari' },
  { chiave: 'obiettivi', titolo: 'Obiettivi terapeutici' },
  { chiave: 'sedute', titolo: 'Diario delle sedute' }
]

// ---- forma dei contenuti ----

export type Blocco =
  | { tipo: 'sottotitolo'; testo: string }
  | { tipo: 'testo'; titolo?: string; corpo: string }
  | { tipo: 'coppie'; voci: [string, string][] }
  | { tipo: 'elenco'; voci: string[] }
  | { tipo: 'tabella'; intestazioni: string[]; righe: string[][] }
  | { tipo: 'figure'; viste: { didascalia: string; svg: string }[] }
  | { tipo: 'riquadro'; titolo: string; colore?: string; blocchi: Blocco[] }
  | {
      tipo: 'grafici'
      grafici: { titolo: string; svg: string }[]
      legenda: { colore: string; testo: string }[]
    }

export interface SezioneComposta {
  titolo: string
  blocchi: Blocco[]
}

export interface Cartella {
  nome: string
  cognome: string
  sezioni: SezioneComposta[]
}

// ---- utilità ----

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function data(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function eta(nascita: string | null): string {
  if (!nascita) return ''
  const n = new Date(nascita)
  if (Number.isNaN(n.getTime())) return ''
  const o = new Date()
  let anni = o.getFullYear() - n.getFullYear()
  const compiuto =
    o.getMonth() > n.getMonth() || (o.getMonth() === n.getMonth() && o.getDate() >= n.getDate())
  if (!compiuto) anni -= 1
  return anni >= 0 ? ` (${anni} anni)` : ''
}

function pieno(v: unknown): boolean {
  return v != null && String(v).trim() !== ''
}

// Coppie etichetta/valore, saltando quelle vuote. Niente coppie piene, niente
// blocco: le domande non fatte non si stampano.
function coppie(voci: [string, unknown][]): Blocco[] {
  const piene = voci.filter(([, v]) => pieno(v)).map(([k, v]) => [k, String(v)] as [string, string])
  return piene.length === 0 ? [] : [{ tipo: 'coppie', voci: piene }]
}

function testo(titolo: string, corpo: unknown): Blocco[] {
  return pieno(corpo) ? [{ tipo: 'testo', titolo, corpo: String(corpo) }] : []
}

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
interface SerieSintomo {
  colore: string
  punti: { x: number; dolore: number }[]
}

function graficoAndamento(
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

const NOME_SEGNO: Record<string, string> = {
  rigidita: 'Rigidità percepita',
  dolore: 'Area dolorosa',
  scossa: 'Scossa elettrica',
  parestesie: 'Parestesie'
}

const NOME_VISTA: Record<string, string> = {
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
const VISTE_DI: Record<string, string[]> = {
  corpo: ['fronte', 'retro', 'destra', 'sinistra'],
  piede: ['dorso', 'pianta', 'esterno', 'interno']
}

function forme(f: Forma[]): string {
  return f
    .map((x) =>
      x.tipo === 'ellisse'
        ? `<ellipse cx="${x.cx}" cy="${x.cy}" rx="${x.rx}" ry="${x.ry}"/>`
        : `<path d="${x.d}"/>`
    )
    .join('')
}

// Il numero dell'intensita' accanto al segno: nel foglio stampato non c'e' modo
// di passarci sopra col mouse, e senza il numero il segno dice dove ma non
// quanto.
function intensita(v: number | null, r: number): string {
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

interface SegnoRiga {
  vista: string
  tipo: string
  x: number
  y: number
  dimensione: number
  intensita: number | null
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
  .intensita { font-size: 20px; font-weight: 700; fill: #b03030;
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
function figuraPiedeSvg(vista: string, segni: SegnoRiga[]): string {
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

  const marchi = segni
    .filter((s) => s.vista === vista)
    .map(
      (s) =>
        `<g transform="translate(${s.x * PIEDE_LARGHEZZA} ${s.y * PIEDE_ALTEZZA})">${simbolo(
          s.tipo,
          12 * s.dimensione
        )}${intensita(s.intensita, 12 * s.dimensione)}</g>`
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PIEDE_LARGHEZZA} ${PIEDE_ALTEZZA}">
    <style>${STILE_FIGURA}</style>
    <g transform="translate(${sinistra} 0)${scala}">${primo}</g>
    <g transform="translate(${destra} 0)${scala}">${secondo}</g>
    ${marchi}
  </svg>`
}

function figuraSvg(vista: string, segni: SegnoRiga[]): string {
  const profilo = vista === 'sinistra' || vista === 'destra'
  const parti = profilo
    ? forme(TESTA_PROFILO) +
      `<path d="${PROFILO_TRONCO}"/><path d="${PROFILO_BRACCIO}"/>` +
      `<path d="${PROFILO_GAMBA}"/><path d="${PROFILO_PIEDE}"/>`
    : forme(TESTA_FRONTE) +
      `<path d="${TRONCO}"/>` +
      [GAMBA, PIEDE, BRACCIO]
        .map(
          (d) =>
            `<path d="${d}"/><path d="${d}" transform="translate(${LARGHEZZA} 0) scale(-1 1)"/>`
        )
        .join('')
  const specchia = vista === 'destra' ? ` transform="translate(${LARGHEZZA} 0) scale(-1 1)"` : ''

  const linee: Linea[] =
    vista === 'fronte' ? DETTAGLI_FRONTE : vista === 'retro' ? DETTAGLI_RETRO : DETTAGLI_PROFILO
  const dettagli = `<g class="dettagli">${linee
    .map((l) => `<path d="${l.d}"${l.tratteggio ? ` stroke-dasharray="${l.tratteggio}"` : ''}/>`)
    .join('')}</g>`

  const marchi = segni
    .filter((s) => s.vista === vista)
    .map(
      (s) =>
        `<g transform="translate(${s.x * LARGHEZZA} ${s.y * ALTEZZA})">${simbolo(
          s.tipo,
          14 * s.dimensione
        )}${intensita(s.intensita, 14 * s.dimensione)}</g>`
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGHEZZA} ${ALTEZZA}">
    <style>${STILE_FIGURA}</style>
    <g${specchia}><g class="bordo">${parti}</g><g class="pieno">${parti}</g>${dettagli}</g>
    ${marchi}
  </svg>`
}

// ---- sezioni ----

function sezAnagrafica(p: Record<string, unknown>): Blocco[] {
  return coppie([
    [
      'Data di nascita',
      p.data_nascita ? data(p.data_nascita as string) + eta(p.data_nascita as string) : null
    ],
    ['Telefono', p.telefono],
    ['E-mail', p.email],
    ['Lavoro / Hobby', p.lavoro],
    ['Diagnosi', p.diagnosi],
    ['Inviato da', p.inviato_da],
    ['Tipo di intervento', p.tipo_intervento],
    ['Data intervento', p.data_intervento ? data(p.data_intervento as string) : null],
    ['Patologia', p.patologia_nome],
    ['Fase corrente', p.fase_nome]
  ])
}

function sezAnamnesi(pazienteId: number): Blocco[] {
  const db = getDb()
  const a = db
    .prepare('SELECT * FROM anamnesi_prossima WHERE paziente_id = ?')
    .get(pazienteId) as Record<string, unknown> | undefined
  const att = db.prepare('SELECT * FROM anamnesi_attivita WHERE paziente_id = ?').get(pazienteId) as
    | Record<string, unknown>
    | undefined
  const sintomi = db
    .prepare('SELECT * FROM anamnesi_sintomi WHERE paziente_id = ? ORDER BY ordine, id')
    .all(pazienteId) as Record<string, unknown>[]
  if (!a && !att && sintomi.length === 0) return []

  const puntiStmt = db.prepare(
    'SELECT grafico, minuti, data, dolore FROM sintomo_punti WHERE sintomo_id = ? ORDER BY grafico, minuti, data'
  )
  const punti = sintomi.map((x) => puntiStmt.all(x.id) as Record<string, unknown>[])
  const colore = (i: number): string => COLORI_SINTOMI[i % COLORI_SINTOMI.length]

  // Le caratteristiche di ogni sintomo nel suo riquadro, uno sotto l'altro. I
  // valori del dolore non si scrivono: stanno nei due grafici qui sotto, dove il
  // sintomo si riconosce dal colore del riquadro.
  const perSintomo = sintomi.map(
    (x, i): Blocco => ({
      tipo: 'riquadro',
      titolo: `Sintomo ${i + 1}${x.descrizione ? ` — ${x.descrizione}` : ''}`,
      colore: colore(i),
      blocchi: coppie([
        ['Andamento', x.andamento],
        ['Da quanto tempo', x.da_quanto],
        ['Episodio', x.episodio],
        ['Esordio', x.esordio],
        ['Traumatico', x.traumatico == null ? null : x.traumatico ? 'sì' : 'no'],
        ['Comportamento messo in atto', x.comportamento],
        ['Cosa lo aggrava', x.aggrava],
        ['Cosa lo allevia', x.allevia]
      ])
    })
  )

  // Nel grafico dall'esordio le date sono equidistanti e condivise fra i
  // sintomi: e' l'unico modo perche' due linee siano confrontabili.
  const date = [
    ...new Set(
      punti
        .flat()
        .filter((q) => q.grafico === 'esordio' && q.data)
        .map((q) => String(q.data))
    )
  ].sort()

  const dovePunto = (q: Record<string, unknown>, quale: string): number => {
    if (quale === 'giorno') return Number(q.minuti) / (24 * 60)
    const i = date.indexOf(String(q.data))
    return date.length === 1 || i < 0 ? 0.5 : i / (date.length - 1)
  }

  const serie = (quale: string): SerieSintomo[] =>
    punti
      .map((righe, i) => ({
        colore: colore(i),
        punti: righe
          .filter((q) => q.grafico === quale)
          .map((q) => ({ x: dovePunto(q, quale), dolore: Number(q.dolore) }))
      }))
      .filter((serieSintomo) => serieSintomo.punti.length > 0)

  // Al massimo quattro date scritte sotto l'asse: con dieci controlli le
  // etichette si sovrapporrebbero fino a non leggersi.
  const taccheDate = (): { x: number; testo: string }[] => {
    if (date.length === 0) return []
    if (date.length === 1) return [{ x: 0.5, testo: data(date[0]) }]
    const passo = Math.ceil(date.length / 4)
    return date
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => i % passo === 0 || i === date.length - 1)
      .map(({ d, i }) => ({ x: i / (date.length - 1), testo: data(d) }))
  }

  const disegni: { titolo: string; svg: string }[] = []
  const giorno = serie('giorno')
  if (giorno.length > 0) {
    disegni.push({
      titolo: 'Nelle 24 ore',
      svg: graficoAndamento(
        giorno,
        [0, 4, 8, 12, 16, 20, 24].map((h) => ({ x: h / 24, testo: String(h) })),
        'ora del giorno'
      )
    })
  }
  const esordio = serie('esordio')
  if (esordio.length > 0) {
    disegni.push({
      titolo: 'Dall’esordio',
      svg: graficoAndamento(esordio, taccheDate(), 'data')
    })
  }

  const grafici: Blocco[] =
    disegni.length === 0
      ? []
      : [
          {
            tipo: 'grafici',
            grafici: disegni,
            legenda: sintomi
              .map((x, i) => ({
                colore: colore(i),
                testo: `Sintomo ${i + 1}${x.descrizione ? ` — ${x.descrizione}` : ''}`
              }))
              .filter((_, i) => punti[i].length > 0)
          }
        ]

  return [
    ...testo('Motivo del consulto', a?.motivo_consulto),
    ...perSintomo,
    ...grafici,
    ...testo('Note sull’andamento nelle 24 ore', a?.note_giorno),
    ...testo('Note sull’andamento dall’esordio', a?.note_esordio),
    ...coppie([
      ['Dolore o sintomi notturni', a?.dolore_notturno],
      ['Disturbi del sonno', a?.disturbi_sonno],
      ['Tosse o starnuto', a?.tosse_starnuto],
      ['Sintomi neurologici', a?.sintomi_neurologici]
    ]),
    ...testo('Relazione fra i sintomi', a?.relazione_sintomi),
    ...testo('Attività', att?.attivita),
    ...testo('Partecipazione', att?.partecipazione),
    ...testo('Impairment psicologici e fattori interni', att?.fattori_interni),
    ...testo('Note', a?.note)
  ]
}

function sezRemota(pazienteId: number): Blocco[] {
  const db = getDb()
  const r = db.prepare('SELECT * FROM anamnesi_remota WHERE paziente_id = ?').get(pazienteId) as
    | Record<string, unknown>
    | undefined
  const referti = db
    .prepare('SELECT nome, data FROM bioimmagini WHERE paziente_id = ? ORDER BY ordine, id')
    .all(pazienteId) as { nome: string; data: string }[]
  if (!r && referti.length === 0) return []

  const siNo = (v: unknown): string | null => (v == null ? null : v ? 'sì' : 'no')
  const complementari = coppie([
    ['Variazioni di peso', siNo(r?.peso)],
    ['Febbre', siNo(r?.febbre)],
    ['Sudorazione', siNo(r?.sudorazione)],
    ['Nausea o vomito', siNo(r?.nausea)],
    ['Fumo', siNo(r?.fumo)],
    ['Neoplasie', siNo(r?.neoplasie)],
    ['Gravidanza', siNo(r?.gravidanza)],
    ['Pacemaker', siNo(r?.pacemaker)],
    ['Schegge metalliche', siNo(r?.schegge)]
  ])

  return [
    ...testo('Incidenti e traumi precedenti', r?.traumi),
    ...testo('Interventi chirurgici', r?.interventi),
    ...testo('Precedenti riabilitativi', r?.riabilitazioni),
    ...(complementari.length > 0
      ? ([
          { tipo: 'sottotitolo', testo: 'Informazioni cliniche complementari' },
          ...complementari
        ] as Blocco[])
      : []),
    ...testo('Bioimmagini', r?.bioimmagini_note),
    ...(referti.length === 0
      ? []
      : testo(
          'Referti allegati nell’app',
          referti.map((x) => `${x.nome} (${data(x.data)})`).join(' · ')
        ))
  ]
}

function sezBodyChart(pazienteId: number): Blocco[] {
  const db = getDb()
  const charts = db
    .prepare('SELECT * FROM body_chart WHERE paziente_id = ? ORDER BY data DESC, id DESC')
    .all(pazienteId) as { id: number; data: string; note: string | null; tipo: string }[]
  if (charts.length === 0) return []

  const segniStmt = db.prepare(
    'SELECT vista, tipo, x, y, dimensione, intensita FROM body_chart_segni WHERE chart_id = ?'
  )

  return charts.flatMap((c): Blocco[] => {
    const segni = segniStmt.all(c.id) as SegnoRiga[]
    const legenda = segni
      .map(
        (s) =>
          `${NOME_SEGNO[s.tipo] ?? s.tipo}${
            s.intensita != null ? ` (intensità ${s.intensita}/10)` : ''
          }`
      )
      .filter((v, i, a) => a.indexOf(v) === i)
    return [
      {
        tipo: 'sottotitolo',
        testo: `${data(c.data)}${c.tipo === 'piede' ? ' — piede e caviglia' : ''}`
      },
      {
        tipo: 'figure',
        viste: (VISTE_DI[c.tipo] ?? VISTE_DI.corpo).map((v) => ({
          didascalia: NOME_VISTA[v] ?? v,
          svg: c.tipo === 'piede' ? figuraPiedeSvg(v, segni) : figuraSvg(v, segni)
        }))
      },
      ...(legenda.length > 0
        ? ([{ tipo: 'testo', corpo: legenda.join(' · ') }] as Blocco[])
        : []),
      ...testo('Note', c.note)
    ]
  })
}

function sezValutazioni(pazienteId: number): Blocco[] {
  const db = getDb()
  const righe = db
    .prepare('SELECT * FROM valutazioni WHERE paziente_id = ? ORDER BY data DESC, id DESC')
    .all(pazienteId) as Record<string, unknown>[]
  if (righe.length === 0) return []

  // Gli stessi segni che si usano a schermo: +, ++, +++.
  const grado = ['', '+', '++', '+++']
  const g = (x: unknown): string => (x == null ? '' : (grado[Number(x)] ?? ''))
  // Il dolore e' presente o assente: i rilievi vecchi lo avevano graduato, e
  // qualunque valore diverso da zero vuol dire che c'era.
  const dol = (x: unknown): string => (x == null ? '' : Number(x) > 0 ? 'sì' : 'no')
  const num = (x: unknown): string => (x == null ? '' : `${x}°`)

  return righe.flatMap((v): Blocco[] => {
    const distretti = db
      .prepare(
        `SELECT d.id, d.nome, vd.nota_attivo, vd.nota_passivo FROM valutazione_distretti vd
         JOIN distretti d ON d.id = vd.distretto_id
         WHERE vd.valutazione_id = ? ORDER BY d.ordine, d.nome`
      )
      .all(v.id) as {
      id: number
      nome: string
      nota_attivo: string | null
      nota_passivo: string | null
    }[]

    const perDistretto = distretti.flatMap((d): Blocco[] => {
      const movimenti = db
        .prepare(
          `SELECT m.nome, m.gradi, vm.attivo_restrizione, vm.attivo_dolore, vm.attivo_gradi,
                  vm.passivo_restrizione, vm.passivo_dolore, vm.passivo_gradi
           FROM distretto_movimenti m
           LEFT JOIN valutazione_movimenti vm
             ON vm.movimento_id = m.id AND vm.valutazione_id = ?
           WHERE m.distretto_id = ? ORDER BY m.ordine, m.id`
        )
        .all(v.id, d.id) as Record<string, unknown>[]
      const compilati = movimenti.filter(
        (m) =>
          m.attivo_restrizione != null ||
          m.attivo_dolore != null ||
          m.passivo_restrizione != null ||
          m.passivo_dolore != null ||
          m.attivo_gradi != null ||
          m.passivo_gradi != null
      )
      const test = db
        .prepare(
          `SELECT t.nome, t.gruppo, vt.valore, vt.nota
           FROM distretto_test t
           JOIN valutazione_test vt ON vt.test_id = t.id AND vt.valutazione_id = ?
           WHERE t.distretto_id = ? ORDER BY t.ordine, t.id`
        )
        .all(v.id, d.id) as Record<string, unknown>[]
      if (compilati.length === 0 && test.length === 0) return []

      // Stesse colonne della tabella nell'app: restrizione e dolore separati,
      // altrimenti "moder. · moder." non si capisce a quale delle due si
      // riferisce. Le colonne dei gradi compaiono solo se in questo distretto
      // c'e' almeno un movimento che si misura.
      const conGradi = compilati.some((m) => Number(m.gradi) === 1)
      const tabella: Blocco[] =
        compilati.length === 0
          ? []
          : [
              {
                tipo: 'tabella',
                intestazioni: [
                  'Movimento',
                  'Attivo · restrizione',
                  'Attivo · dolore',
                  ...(conGradi ? ['Attivo °'] : []),
                  'Passivo · restrizione',
                  'Passivo · dolore',
                  ...(conGradi ? ['Passivo °'] : [])
                ],
                righe: compilati.map((m) => [
                  String(m.nome),
                  g(m.attivo_restrizione),
                  dol(m.attivo_dolore),
                  ...(conGradi ? [num(m.attivo_gradi)] : []),
                  g(m.passivo_restrizione),
                  dol(m.passivo_dolore),
                  ...(conGradi ? [num(m.passivo_gradi)] : [])
                ])
              }
            ]
      const elencoTest: Blocco[] =
        test.length === 0
          ? []
          : [
              {
                tipo: 'elenco',
                voci: test.map(
                  (t) => `${t.nome}: ${t.valore ?? '—'}${t.nota ? ` (${t.nota})` : ''}`
                )
              }
            ]
      return [
        { tipo: 'sottotitolo', testo: d.nome },
        ...tabella,
        // Le note dei due lati, se ci sono: stanno sotto alla tabella come
        // nella schermata, una per il movimento attivo e una per il passivo.
        ...testo('Note sul movimento attivo', d.nota_attivo),
        ...testo('Note sul movimento passivo', d.nota_passivo),
        ...elencoTest
      ]
    })

    return [
      { tipo: 'sottotitolo', testo: data(v.data as string) },
      ...testo('Ispezione, osservazione e palpazione', v.ispezione),
      ...perDistretto,
      ...coppie([
        ['Carico locale', v.carico_locale],
        ['Carico generale', v.carico_generale],
        ['Capacità di carico locale', v.capacita_locale],
        ['Capacità di carico generale', v.capacita_generale]
      ]),
      ...testo('Note', v.note)
    ]
  })
}

function sezQuestionari(pazienteId: number): Blocco[] {
  const db = getDb()
  const righe = db
    .prepare(
      `SELECT pq.id, pq.data, pq.fascia, pq.note, q.nome
       FROM paziente_questionari pq JOIN questionari q ON q.id = pq.questionario_id
       WHERE pq.paziente_id = ? ORDER BY pq.data DESC, pq.id DESC`
    )
    .all(pazienteId) as Record<string, unknown>[]
  if (righe.length === 0) return []

  const pStmt = db.prepare(
    'SELECT nome, valore FROM compilazione_punteggi WHERE compilazione_id = ? ORDER BY ordine'
  )
  // La colonna dell'esito c'e' solo se almeno un questionario ha una fascia di
  // rischio: molti non ne hanno una, e una colonna di caselle vuote fa pensare
  // a un dato che manca invece che a un dato che non esiste.
  const conFascia = righe.some((r) => r.fascia != null && String(r.fascia).trim() !== '')
  return [
    {
      tipo: 'tabella',
      intestazioni: ['Data', 'Questionario', 'Punteggi', ...(conFascia ? ['Esito'] : [])],
      righe: righe.map((r) => {
        const punteggi = pStmt.all(r.id) as { nome: string; valore: number }[]
        return [
          data(r.data as string),
          String(r.nome),
          punteggi.map((p) => `${p.nome} ${p.valore}`).join(' · '),
          ...(conFascia ? [String(r.fascia ?? '')] : [])
        ]
      })
    }
  ]
}

function sezObiettivi(pazienteId: number): Blocco[] {
  const righe = getDb()
    .prepare(
      'SELECT testo, termine FROM obiettivi_terapeutici WHERE paziente_id = ? ORDER BY ordine, id'
    )
    .all(pazienteId) as { testo: string; termine: string }[]
  if (righe.length === 0) return []

  const gruppi: [string, string][] = [
    ['breve', 'Breve termine'],
    ['medio', 'Medio termine'],
    ['lungo', 'Lungo termine']
  ]
  return gruppi.flatMap(([chiave, titolo]): Blocco[] => {
    const suoi = righe.filter((r) => r.termine === chiave)
    if (suoi.length === 0) return []
    return [
      { tipo: 'sottotitolo', testo: titolo },
      { tipo: 'elenco', voci: suoi.map((r) => r.testo) }
    ]
  })
}

// Delle sedute nella cartella restano solo le date: a chi legge serve sapere
// quando e quante, non l'elenco degli esercizi di ogni volta. Il programma
// dettagliato si esporta a parte, dal diario.
function sezSedute(pazienteId: number): Blocco[] {
  const sedute = getDb()
    .prepare(
      `SELECT s.data, f.nome AS fase_nome
       FROM sedute s LEFT JOIN fasi f ON f.id = s.fase_id
       WHERE s.paziente_id = ? ORDER BY s.data DESC, s.id DESC`
    )
    .all(pazienteId) as { data: string; fase_nome: string | null }[]
  if (sedute.length === 0) return []

  return [
    {
      tipo: 'testo',
      corpo: sedute.length === 1 ? '1 seduta svolta' : `${sedute.length} sedute svolte`
    },
    {
      tipo: 'elenco',
      voci: sedute.map((s) => `${data(s.data)}${s.fase_nome ? ` — ${s.fase_nome}` : ''}`)
    }
  ]
}

// ---- composizione ----

export function componiCartella(pazienteId: number, sezioni: SezioneCartella[]): Cartella {
  const p = getDb()
    .prepare(
      `SELECT pz.*, pat.nome AS patologia_nome, f.nome AS fase_nome
       FROM pazienti pz
       LEFT JOIN patologie pat ON pat.id = pz.patologia_id
       LEFT JOIN fasi f ON f.id = pz.fase_corrente_id
       WHERE pz.id = ?`
    )
    .get(pazienteId) as Record<string, unknown> | undefined
  if (!p) throw new Error('Paziente non trovato.')

  const contenuto: Record<SezioneCartella, () => Blocco[]> = {
    anagrafica: () => sezAnagrafica(p),
    anamnesi: () => sezAnamnesi(pazienteId),
    remota: () => sezRemota(pazienteId),
    bodychart: () => sezBodyChart(pazienteId),
    valutazioni: () => sezValutazioni(pazienteId),
    questionari: () => sezQuestionari(pazienteId),
    obiettivi: () => sezObiettivi(pazienteId),
    sedute: () => sezSedute(pazienteId)
  }

  return {
    nome: String(p.nome),
    cognome: String(p.cognome),
    // una sezione senza niente dentro non si stampa, anche se e' stata spuntata
    sezioni: SEZIONI.filter((s) => sezioni.includes(s.chiave))
      .map((s) => ({ titolo: s.titolo, blocchi: contenuto[s.chiave]() }))
      .filter((s) => s.blocchi.length > 0)
  }
}

export function oggiIso(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ---- resa in HTML (da cui nasce il PDF) ----

function bloccoHtml(b: Blocco): string {
  switch (b.tipo) {
    case 'sottotitolo':
      return `<h3>${esc(b.testo)}</h3>`
    case 'testo':
      return `${b.titolo ? `<h3>${esc(b.titolo)}</h3>` : ''}<p class="testo">${esc(
        b.corpo
      ).replace(/\n/g, '<br>')}</p>`
    case 'coppie':
      return `<dl class="dati">${b.voci
        .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
        .join('')}</dl>`
    case 'elenco':
      return `<ul class="voci">${b.voci.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`
    case 'tabella':
      return `<table><thead><tr>${b.intestazioni
        .map((h) => `<th>${esc(h)}</th>`)
        .join('')}</tr></thead><tbody>${b.righe
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    case 'riquadro':
      return `<div class="riquadro"${
        b.colore ? ` style="border-left-color:${b.colore}"` : ''
      }><h3>${esc(b.titolo)}</h3>${b.blocchi.map(bloccoHtml).join('')}</div>`
    case 'grafici':
      // Grafici e legenda in un contenitore solo: separati, la stampa
      // potrebbe lasciare la legenda sulla pagina dopo.
      return `<div class="grafici"><div class="disegni">${b.grafici
        .map(
          (g) =>
            `<figure><figcaption>${esc(g.titolo)}</figcaption>${g.svg}</figure>`
        )
        .join('')}</div><div class="legenda">${b.legenda
        .map(
          (v) =>
            `<span><i style="background:${v.colore}"></i>${esc(v.testo)}</span>`
        )
        .join('')}</div></div>`
    case 'figure':
      return `<div class="corpi">${b.viste
        .map(
          (v) =>
            `<figure class="corpo">${v.svg}<figcaption>${esc(v.didascalia)}</figcaption></figure>`
        )
        .join('')}</div>`
  }
}

export function generaCartella(pazienteId: number, sezioni: SezioneCartella[]): string {
  const c = componiCartella(pazienteId, sezioni)
  const corpo = c.sezioni
    .map(
      (s) => `<section><h2>${esc(s.titolo)}</h2>${s.blocchi.map(bloccoHtml).join('')}</section>`
    )
    .join('')

  const { accento, intestazione } = coloriTema()

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2733; font-size: 12px; margin: 0; }

  /* Solo a schermo: il documento sta dentro la finestra come un foglio su una
     scrivania, staccato dai bordi. In stampa non vale, i margini li da' @page. */
  @media screen {
    body { background: #eef1f5; padding: 28px 0; }
    .foglio {
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
      padding: 26px 30px;
      border-radius: 6px;
      box-shadow: 0 6px 26px rgba(15, 23, 42, 0.16);
    }
  }
  h1 { font-size: 21px; margin: 0 0 2px; }
  .info { color: #555b66; margin: 0 0 4px; font-size: 11px; }
  h2 { font-size: 15px; border-bottom: 2px solid ${accento}; padding-bottom: 4px; margin: 20px 0 8px; }
  h3 { font-size: 13px; margin: 12px 0 4px; color: ${accento}; }
  /* Ogni sezione dentro il suo riquadro: con anamnesi, valutazione e sedute una
     dopo l'altra, senza una cornice si confondono fra loro. Il titolo fa da
     testata del riquadro. */
  section { page-break-inside: auto; border: 1px solid #dfe4ea; border-radius: 5px;
            padding: 0 12px 10px; margin-bottom: 12px; }
  section > h2 { margin: 0 -12px 10px; padding: 6px 12px; border-bottom: 2px solid ${accento};
                 background: ${intestazione}; border-radius: 5px 5px 0 0; }
  .testo { margin: 0 0 6px; }
  dl.dati { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin: 0 0 8px; }
  dl.dati div { display: flex; gap: 6px; }
  dl.dati dt { color: #6b7280; margin: 0; }
  dl.dati dt::after { content: ':'; }
  dl.dati dd { margin: 0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
  th, td { border: 1px solid #ccd2da; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: ${intestazione}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
  tr { page-break-inside: avoid; }
  /* Un sintomo per riquadro, col filo di colore della sua linea nei grafici. */
  .riquadro { border: 1px solid #e4e8ed; border-left: 3px solid #8b93a0; border-radius: 4px;
              background: #f7f7f6; padding: 2px 10px 6px; margin: 0 0 8px;
              page-break-inside: avoid; }
  .riquadro > h3 { margin: 8px 0 5px; color: #1f2733; }
  .riquadro dl.dati { margin-bottom: 4px; }
  /* I due grafici affiancati, la legenda sotto: e' la disposizione della
     raccolta anamnestica, cosi' chi ha compilato ritrova quello che ha visto. */
  /* I due grafici riempiono la riga, meta' per uno: dicono l'andamento in un
     colpo d'occhio, i valori esatti stanno nei riquadri sopra. */
  .grafici { page-break-inside: avoid; margin: 0 0 10px; }
  .grafici .disegni { display: flex; gap: 12px; }
  .grafici figure { margin: 0; flex: 1; min-width: 0; }
  .grafici figcaption { font-size: 11px; font-weight: 600; color: ${accento}; margin-bottom: 2px; }
  .grafici svg { width: 100%; height: auto; }
  .grafici .asse { font-size: 13px; fill: #8b93a0; text-anchor: end; }
  .grafici .asse-x { font-size: 13px; fill: #8b93a0; text-anchor: middle; }
  .grafici .asse-x.inizio { text-anchor: start; }
  .grafici .asse-x.fine { text-anchor: end; }
  .legenda { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 4px;
             font-size: 10px; color: #555b66; }
  .legenda span { display: flex; align-items: center; gap: 5px; }
  .legenda i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  ul.voci { margin: 0 0 8px; padding-left: 18px; }
  ul.voci li { margin-bottom: 3px; }
  .corpi { display: flex; gap: 6px; page-break-inside: avoid; }
  .corpi figure { margin: 0; flex: 1; text-align: center; }
  .corpi svg { width: 100%; height: auto; max-height: 190mm; }
  .corpi figcaption { font-size: 10px; color: #6b7280; }
  .pie { margin-top: 16px; color: #8b93a0; font-size: 10px; }
</style>
</head>
<body>
<div class="foglio">
  <h1>${esc(c.cognome)} ${esc(c.nome)}</h1>
  <p class="info">Cartella fisioterapica · stampata il ${data(oggiIso())}</p>
  ${corpo || '<p class="testo">Nessun contenuto nelle sezioni scelte.</p>'}
  <p class="pie">Documento generato da Riabilitazione Sportiva. Contiene dati sanitari: trattare con riservatezza.</p>
</div>
</body>
</html>`
}
