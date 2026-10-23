// Le curve dei test con la pedana: la forza nel tempo di ogni ripetizione, la
// forza e il carico sui due lati durante un salto, l'oscillazione nel tempo
// della stabilometria.
//
// Una curva e' una descrizione neutra (linee, eventi, unita'); curvaSvg la
// disegna. Lo stesso disegno serve alla pagina Pedana e ai documenti (cartella,
// report di screening): per questo e' una stringa SVG con gli stili scritti
// dentro, senza classi, e vive in `shared`.
import {
  famigliaDi,
  formattaValore,
  type LatoPedana,
  type SeriePedana,
  type TestPedanaSalvato
} from './pedana'

// Come nei report di screening: blu il lato destro, rosso il sinistro.
export const COLORE_DX = '#2563eb'
export const COLORE_SX = '#d64545'
const COLORE_NEUTRO = '#334155'
const COLORE_ML = '#0f766e'
const COLORE_AP = '#b45309'

const GRIGIO = '#8b93a0'
// le righe di appoggio (peso corporeo, momenti del salto) restano chiare e sottili:
// la curva dei dati e' sempre quella che si legge per prima
const RIFERIMENTO = '#b6bdc8'
const FILO = 'var(--border, #dfe4ea)'

export interface LineaCurva {
  // vuota: la linea non compare in legenda (le ripetizioni di uno stesso lato)
  etichetta: string
  colore: string
  x: number[]
  y: number[]
  spessore: number
  opacita: number
  tratteggio?: boolean
}

export interface EventoCurva {
  x: number
  etichetta: string
}

export interface Curva {
  chiave: string
  titolo: string
  unitaX: string
  unitaY: string
  linee: LineaCurva[]
  eventi: EventoCurva[]
  // gli estremi dell'asse verticale, se vanno tenuti uguali a quelli di un'altra curva
  // (due lati a confronto)
  intervalloY?: [number, number]
}

const NOME_EVENTO: Record<string, string> = {
  inizio_movimento: 'Inizio',
  velocita_zero: 'Fondo',
  stacco: 'Stacco',
  atterraggio: 'Atterraggio'
}

const GRAVITA = 9.80665

const colorePerLato = (lato: LatoPedana | null): string =>
  lato === 'dx' ? COLORE_DX : lato === 'sx' ? COLORE_SX : COLORE_NEUTRO

// " — piede destro": nei test monopodalici il lato e' il piede d'appoggio
export const titoloLato = (lato: LatoPedana | null): string =>
  lato === 'dx' ? ' — piede destro' : lato === 'sx' ? ' — piede sinistro' : ''

const nomeLato = (lato: LatoPedana | null): string =>
  lato === 'dx' ? 'Destro' : lato === 'sx' ? 'Sinistro' : ''

// I tempi arrivano in millisecondi: si leggono meglio in secondi.
const inSecondi = (
  x: number[],
  unita: string | null | undefined
): { x: number[]; unita: string } =>
  unita === 'ms' ? { x: x.map((v) => v / 1000), unita: 's' } : { x, unita: unita ?? '' }

const centrata = (y: number[]): number[] => {
  const media = y.reduce((a, b) => a + b, 0) / y.length
  return y.map((v) => v - media)
}

const picco = (y: number[]): number => y.reduce((m, v) => (v > m ? v : m), -Infinity)

function eventiDelSalto(test: TestPedanaSalvato): EventoCurva[] {
  const grezzi = test.condizioni.eventi_serie_ms
  if (typeof grezzi !== 'object' || grezzi === null) return []
  return Object.entries(grezzi as Record<string, unknown>)
    .filter(([nome, t]) => NOME_EVENTO[nome] && typeof t === 'number' && Number.isFinite(t))
    .map(([nome, t]) => ({ x: (t as number) / 1000, etichetta: NOME_EVENTO[nome] }))
    .sort((a, b) => a.x - b.x)
}

// Una serie con i canali che servono, o null se mancano o non sono utilizzabili.
function canali(serie: SeriePedana, ...nomi: string[]): number[][] | null {
  const liste = nomi.map((n) => serie.canali[n])
  if (liste.some((l) => !l || l.length < 2)) return null
  return liste
}

// Le curve di un gruppo di test della stessa riga (per esempio il destro e il
// sinistro della stessa seduta). Le ripetizioni di forza dei due lati stanno
// nello stesso disegno: e' il confronto che interessa. Il resto, una curva per
// registrazione.
export function curvePedana(test: TestPedanaSalvato[]): Curva[] {
  const curve: Curva[] = []

  // ---- forza isometrica: tutte le ripetizioni, la migliore in evidenza. Un disegno
  // per lato, uno di fianco all'altro e con la stessa scala: con i due lati nello
  // stesso disegno le sei linee si sovrapponevano e non si leggeva piu' niente.
  const forza = test.filter((t) => famigliaDi(t.test_codice) === 'forza')
  const lineePerLato = new Map<LatoPedana | null, LineaCurva[]>()
  let unitaTempo = 's'
  let unitaForza = ''
  for (const t of forza) {
    const serie = t.serie.filter((s) => s.codice === 'forza_tempo' && canali(s, 'x', 'y'))
    const perLato = new Map<LatoPedana | null, SeriePedana[]>()
    for (const s of serie) {
      const lato = s.lato ?? t.lato
      perLato.set(lato, [...(perLato.get(lato) ?? []), s])
    }
    for (const [lato, ripetizioni] of perLato) {
      const migliore = ripetizioni.reduce((a, b) => (picco(b.canali.y) > picco(a.canali.y) ? b : a))
      const linee = lineePerLato.get(lato) ?? []
      for (const s of ripetizioni) {
        const tempo = inSecondi(s.canali.x, s.asse_x?.unita)
        unitaTempo = tempo.unita
        unitaForza = s.asse_y?.unita ?? unitaForza
        const buona = s === migliore
        linee.push({
          etichetta: buona ? nomeLato(lato) : '',
          colore: colorePerLato(lato),
          x: tempo.x,
          y: s.canali.y,
          spessore: buona ? 2.8 : 1.3,
          opacita: buona ? 1 : 0.45
        })
      }
      lineePerLato.set(lato, linee)
    }
  }
  // il destro prima del sinistro, come nella stabilometria
  const latiForza = [...lineePerLato.keys()].sort((a, b) => (a === 'dx' ? 0 : 1) - (b === 'dx' ? 0 : 1))
  const primaForza = curve.length
  for (const lato of latiForza) {
    curve.push({
      chiave: `forza-${lato ?? 'unico'}`,
      titolo: `Forza nel tempo${lato ? ` — ${nomeLato(lato).toLowerCase()}` : ''} (migliore ripetizione in evidenza)`,
      unitaX: unitaTempo,
      unitaY: unitaForza,
      linee: lineePerLato.get(lato)!.sort((a, b) => a.spessore - b.spessore),
      eventi: []
    })
  }
  const curveForza = curve.slice(primaForza)
  if (curveForza.length > 1) {
    const tutti = curveForza.flatMap((c) => c.linee.flatMap((l) => l.y))
    const intervallo: [number, number] = [Math.min(...tutti), Math.max(...tutti)]
    for (const c of curveForza) c.intervalloY = intervallo
  }

  // ---- salti: forza e carico sui due lati, con i momenti del salto
  for (const t of test.filter((x) => famigliaDi(x.test_codice) === 'salto')) {
    const eventi = eventiDelSalto(t)
    for (const s of t.serie) {
      if (s.codice === 'forza_tempo') {
        const c = canali(s, 'x', 'y')
        if (!c) continue
        const tempo = inSecondi(c[0], s.asse_x?.unita)
        const unita = s.asse_y?.unita ?? ''
        const linee: LineaCurva[] = [
          {
            etichetta: 'Forza',
            colore: COLORE_NEUTRO,
            x: tempo.x,
            y: c[1],
            spessore: 2.6,
            opacita: 1
          }
        ]
        // con la forza in newton il peso del corpo e' la riga di riferimento
        if (t.peso_kg != null && unita === 'N') {
          linee.push({
            etichetta: 'Peso corporeo',
            colore: RIFERIMENTO,
            x: [tempo.x[0], tempo.x[tempo.x.length - 1]],
            y: [t.peso_kg * GRAVITA, t.peso_kg * GRAVITA],
            spessore: 0.9,
            opacita: 1,
            tratteggio: true
          })
        }
        curve.push({
          chiave: `salto-forza-${t.id}`,
          titolo: 'Forza durante il salto',
          unitaX: tempo.unita,
          unitaY: unita,
          linee,
          eventi
        })
      } else if (s.codice === 'carico_lati_tempo') {
        const c = canali(s, 'x', 'y_sx', 'y_dx')
        if (!c) continue
        const tempo = inSecondi(c[0], s.asse_x?.unita)
        curve.push({
          chiave: `salto-lati-${t.id}`,
          titolo: 'Carico sui due lati durante il salto',
          unitaX: tempo.unita,
          unitaY: s.asse_y?.unita ?? '',
          linee: [
            {
              etichetta: 'Destro',
              colore: COLORE_DX,
              x: tempo.x,
              y: c[2],
              // piu' spessa e disegnata prima: quando i due lati coincidono, il blu
              // resta visibile ai lati della linea rossa
              spessore: 4.6,
              opacita: 1
            },
            {
              etichetta: 'Sinistro',
              colore: COLORE_SX,
              x: tempo.x,
              y: c[1],
              spessore: 2,
              opacita: 1
            }
          ],
          eventi
        })
      }
    }
  }

  // ---- stabilometria: lo spostamento nel tempo nelle due direzioni
  // il destro prima del sinistro: nel confronto stanno sempre allo stesso posto
  const stabilometrie = test
    .filter((x) => famigliaDi(x.test_codice) === 'stabilometria')
    .sort((a, b) => (a.lato === 'dx' ? 0 : 1) - (b.lato === 'dx' ? 0 : 1))
  const primaStab = curve.length
  for (const t of stabilometrie) {
    for (const s of t.serie) {
      if (s.codice !== 'stabilogramma_tempo') continue
      const c = canali(s, 'x', 'y_ml', 'y_ap')
      if (!c) continue
      const tempo = inSecondi(c[0], s.asse_x?.unita)
      // ognuna delle due direzioni e' centrata sulla propria media: si vede
      // quanto oscilla, non dove e' posato il piede
      const ml = centrata(c[1])
      const ap = centrata(c[2])
      curve.push({
        chiave: `stabilometria-${t.id}`,
        titolo: `Oscillazione nel tempo${titoloLato(t.lato)}`,
        unitaX: tempo.unita,
        unitaY: `${s.asse_y?.unita ?? 'mm'} dalla media`,
        linee: [
          {
            etichetta: 'Destra–sinistra',
            colore: COLORE_ML,
            x: tempo.x,
            y: ml,
            spessore: 2,
            opacita: 1
          },
          {
            etichetta: 'Avanti–indietro',
            colore: COLORE_AP,
            x: tempo.x,
            y: ap,
            spessore: 2,
            opacita: 1
          }
        ],
        eventi: []
      })
    }
  }
  // piu' curve di oscillazione a confronto: stessa scala, altrimenti l'occhio e'
  // ingannato (un'oscillazione piccola sembrerebbe grande come una grande)
  const stab = curve.slice(primaStab)
  if (stab.length > 1) {
    const tutti = stab.flatMap((c) => c.linee.flatMap((l) => l.y))
    const intervallo: [number, number] = [Math.min(...tutti), Math.max(...tutti)]
    for (const c of stab) c.intervalloY = intervallo
  }
  return curve
}

// ---- il disegno ------------------------------------------------------------------

const n = (v: number): string => v.toFixed(1)

const escSvg = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Le tacche di un asse: passi tondi (1, 2, 5 per una potenza di dieci), circa
// `quante` fra il minimo e il massimo.
function tacche(min: number, max: number, quante: number): number[] {
  const grezzo = (max - min) / quante
  if (!(grezzo > 0)) return [min]
  const potenza = Math.pow(10, Math.floor(Math.log10(grezzo)))
  const passo = [1, 2, 5, 10].map((m) => m * potenza).find((p) => p >= grezzo) ?? 10 * potenza
  const fuori: number[] = []
  for (let v = Math.ceil(min / passo - 1e-9) * passo; v <= max + passo * 1e-9; v += passo) {
    fuori.push(Math.round(v / passo) * passo)
  }
  return fuori
}

export function curvaSvg(curva: Curva): string {
  const linee = curva.linee.filter((l) => l.x.length >= 2 && l.x.length === l.y.length)
  if (linee.length === 0) return ''

  const L = 440
  const A = 230
  const conEventi = curva.eventi.length > 0
  const bordo = { su: conEventi ? 32 : 30, giu: 62, sx: 46, dx: 20 }

  const xs = linee.flatMap((l) => l.x)
  const ys = [...linee.flatMap((l) => l.y), ...(curva.intervalloY ?? [])]
  // anche i momenti segnati stanno dentro al disegno
  const xMin = Math.min(...xs, ...curva.eventi.map((e) => e.x))
  const xMax = Math.max(...xs, ...curva.eventi.map((e) => e.x))
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)
  if (xMax === xMin) return ''
  // una curva di forza parte da zero: i piccoli scarti sotto lo zero sono rumore
  if (yMin >= -0.05 * Math.max(yMax, 1)) yMin = Math.min(0, yMin)
  if (yMax === yMin) yMax = yMin + 1
  yMax += (yMax - yMin) * 0.05

  const px = (v: number): number =>
    bordo.sx + ((v - xMin) / (xMax - xMin)) * (L - bordo.sx - bordo.dx)
  const py = (v: number): number =>
    A - bordo.giu - ((v - yMin) / (yMax - yMin)) * (A - bordo.su - bordo.giu)
  const testo = (x: number, y: number, t: string, ancora: string, colore = GRIGIO): string =>
    `<text x="${n(x)}" y="${n(y)}" font-size="11" fill="${colore}" text-anchor="${ancora}">${escSvg(t)}</text>`

  const tacheY = tacche(yMin, yMax, 4)
  const tacheX = tacche(xMin, xMax, 6)
  const griglia =
    tacheY
      .map(
        (v) =>
          `<line x1="${bordo.sx}" y1="${n(py(v))}" x2="${L - bordo.dx}" y2="${n(py(v))}" style="stroke:${FILO}"/>` +
          testo(bordo.sx - 5, py(v) + 4, formattaValore(v, null), 'end')
      )
      .join('') +
    tacheX
      .map(
        (v) =>
          `<line x1="${n(px(v))}" y1="${A - bordo.giu}" x2="${n(px(v))}" y2="${A - bordo.giu + 4}" style="stroke:${FILO}"/>` +
          testo(px(v), A - bordo.giu + 16, formattaValore(v, null), 'middle')
      )
      .join('')

  // lo zero dell'asse verticale, se la curva lo attraversa
  const zero =
    yMin < 0 && yMax > 0
      ? `<line x1="${bordo.sx}" y1="${n(py(0))}" x2="${L - bordo.dx}" y2="${n(py(0))}" stroke="${GRIGIO}" stroke-width="0.8"/>`
      : ''

  const eventi = curva.eventi
    .map((e, i) => {
      const x = px(e.x)
      // vicino ai bordi l'etichetta si appoggia alla linea invece di uscire dal disegno
      const ancora = x > L - bordo.dx - 45 ? 'end' : x < bordo.sx + 25 ? 'start' : 'middle'
      return (
        `<line x1="${n(x)}" y1="${bordo.su}" x2="${n(x)}" y2="${A - bordo.giu}" stroke="${RIFERIMENTO}" stroke-width="0.8" stroke-dasharray="2 4"/>` +
        testo(x, bordo.su - 6 - (i % 2) * 12, e.etichetta, ancora, '#555b66')
      )
    })
    .join('')

  const percorsi = [...linee]
    .sort((a, b) => Number(!!b.tratteggio) - Number(!!a.tratteggio))
    .map((l) => {
      const d = l.x.map((v, i) => `${i === 0 ? 'M' : 'L'}${n(px(v))},${n(py(l.y[i]))}`).join('')
      return `<path d="${d}" fill="none" stroke="${l.colore}" stroke-width="${l.spessore}" stroke-opacity="${l.opacita}" stroke-linejoin="round"${l.tratteggio ? ' stroke-dasharray="5 4"' : ''}/>`
    })
    .join('')

  // la legenda in fila sotto l'asse, una voce per etichetta
  let xLegenda = bordo.sx
  const viste = new Set<string>()
  const legenda = linee
    .filter((l) => l.etichetta && !viste.has(l.etichetta) && viste.add(l.etichetta))
    .map((l) => {
      const voce =
        `<line x1="${n(xLegenda)}" y1="${A - 10}" x2="${n(xLegenda + 16)}" y2="${A - 10}" stroke="${l.colore}" stroke-width="2.2"${l.tratteggio ? ' stroke-dasharray="5 4"' : ''}/>` +
        testo(xLegenda + 21, A - 6, l.etichetta, 'start', '#555b66')
      xLegenda += 21 + l.etichetta.length * 5.6 + 16
      return voce
    })
    .join('')

  const unitaX = curva.unitaX ? `Tempo (${curva.unitaX})` : 'Tempo'
  return `<svg viewBox="0 0 ${L} ${A}" style="width:100%;height:auto;display:block" role="img" aria-label="${escSvg(curva.titolo)}">
    ${griglia}
    <line x1="${bordo.sx}" y1="${bordo.su}" x2="${bordo.sx}" y2="${A - bordo.giu}" style="stroke:${FILO}"/>
    <line x1="${bordo.sx}" y1="${A - bordo.giu}" x2="${L - bordo.dx}" y2="${A - bordo.giu}" style="stroke:${FILO}"/>
    ${zero}${eventi}${percorsi}
    ${testo(bordo.sx, A - bordo.giu + 33, unitaX, 'start')}
    ${curva.unitaY ? testo(4, 12, curva.unitaY, 'start') : ''}
    ${legenda}
  </svg>`
}

// ---- lo statokinesigramma ------------------------------------------------------------

const media = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length

// Il raggio (in mm) del quadrato che contiene il tracciato e l'ovale, attorno
// alla posizione media. Per mettere due tracciati a confronto si disegnano
// entrambi con il raggio maggiore: stessa scala, stessa dimensione.
export function raggioTracciato(serie: SeriePedana): number {
  const xs = serie.canali.x
  const ys = serie.canali.y
  if (!xs || !ys || xs.length < 2) return 10
  const cx = media(xs)
  const cy = media(ys)
  const el = serie.ellisse
  const lontani = [
    ...xs.map((v) => Math.abs(v - cx)),
    ...ys.map((v) => Math.abs(v - cy)),
    ...(el ? el.x.map((v) => Math.abs(v - cx)) : []),
    ...(el ? el.y.map((v) => Math.abs(v - cy)) : [])
  ]
  return Math.max(10, ...lontani) * 1.1
}

// Il tracciato del centro di pressione: x medio-laterale (positivo a destra), y
// antero-posteriore (positivo verso le punte), in mm, con la stessa scala sui due
// assi e il quadro centrato sulla posizione media. Sopra, l'ovale al 95% (se il
// file lo ha). Il punto pieno e' l'inizio, quello vuoto la
// fine. Stringa vuota se non ci sono abbastanza punti.
export function tracciatoSvg(
  serie: SeriePedana,
  opzioni: {
    raggio?: number
    larghezza?: string
    lato?: LatoPedana | null
    // "report": come nell'app della pedana, con avanti/indietro/sx/dx fuori dal
    // riquadro, assi marcati, ovale tratteggiato e senza i punti di inizio e fine
    stile?: 'report'
  } = {}
): string {
  const xs = serie.canali.x
  const ys = serie.canali.y
  if (!xs || !ys || xs.length < 2 || xs.length !== ys.length) return ''
  const LATO = 260
  const report = opzioni.stile === 'report'
  // il margine fuori dal riquadro, dove stanno le scritte dei quattro lati
  const B = report ? 30 : 0
  const S = LATO - 2 * B
  // lo spazio vuoto fra il tracciato e il bordo del riquadro: nel report e'
  // stretto, cosi' il tracciato riempie il quadrato (la scala resta la stessa
  // per i due piedi: e' il raggio comune a decidere)
  const M = report ? 10 : 30
  const cx = media(xs)
  const cy = media(ys)
  const raggio = Math.max(raggioTracciato(serie), opzioni.raggio ?? 0)
  const scala = (S - 2 * M) / (2 * raggio)
  const px = (v: number): number => LATO / 2 + (v - cx) * scala
  const py = (v: number): number => LATO / 2 - (v - cy) * scala
  const passo = [1, 2, 5, 10, 20, 50, 100].find((p) => p * scala >= 28) ?? 100
  const unita = serie.asse_x?.unita ?? 'mm'
  const da = B + M / 2
  const a = LATO - B - M / 2

  // la griglia parte dalla posizione media e va verso i bordi
  const dist: number[] = []
  for (let d = passo; d < raggio; d += passo) dist.push(d, -d)
  const griglia = dist
    .map((d) => {
      const p = n(LATO / 2 + d * scala)
      return (
        `<line x1="${p}" y1="${da}" x2="${p}" y2="${a}" style="stroke:${FILO}"/>` +
        `<line x1="${da}" y1="${p}" x2="${a}" y2="${p}" style="stroke:${FILO}"/>`
      )
    })
    .join('')
  const etichetta = (x: number, y: number, t: string, ancora: string): string =>
    `<text x="${x}" y="${y}" font-size="10" fill="${GRIGIO}" text-anchor="${ancora}">${escSvg(t)}</text>`
  const scritta = (x: number, y: number, t: string, ancora: string): string =>
    `<text x="${x}" y="${y}" font-size="13" font-weight="500" fill="#4b5563" text-anchor="${ancora}">${escSvg(t)}</text>`

  const el = serie.ellisse
  // l'ovale ha il colore del lato (blu il destro, rosso il sinistro, verde senza lato),
  // sfumato: deve restare sotto alla traiettoria senza coprirla
  const coloreOvale =
    opzioni.lato === 'dx' ? COLORE_DX : opzioni.lato === 'sx' ? COLORE_SX : COLORE_ML
  const ovale = el
    ? `<polygon points="${el.x.map((v, i) => `${n(px(v))},${n(py(el.y[i]))}`).join(' ')}" fill="${coloreOvale}" fill-opacity="0.14" stroke="${coloreOvale}" stroke-opacity="${report ? 0.9 : 0.55}" stroke-width="${report ? 1.8 : 1.6}"${report ? ' stroke-dasharray="6 4"' : ''} stroke-linejoin="round"/>`
    : ''
  const punti = xs.map((v, i) => `${n(px(v))},${n(py(ys[i]))}`).join(' ')
  const colorePercorso = report ? coloreOvale : COLORE_NEUTRO

  if (report) {
    // La traiettoria e' sottile e un po' trasparente: dove il piede torna
    // spesso la linea si addensa e si fa scura, invece di diventare una
    // matassa piena. L'ovale ha il riempimento sotto e il contorno, pieno,
    // sopra: e' il numero che conta (l'area) e deve restare leggibile.
    const contornoOvale = el
      ? `<polygon points="${el.x.map((v, i) => `${n(px(v))},${n(py(el.y[i]))}`).join(' ')}" fill="none" stroke="${coloreOvale}" stroke-width="1.8" stroke-linejoin="round"/>`
      : ''
    const fondoOvale = el
      ? `<polygon points="${el.x.map((v, i) => `${n(px(v))},${n(py(el.y[i]))}`).join(' ')}" fill="${coloreOvale}" fill-opacity="0.12" stroke="none"/>`
      : ''
    return `<svg viewBox="0 0 ${LATO} ${LATO}" style="width:${opzioni.larghezza ?? '100%'};height:auto;display:block" role="img" aria-label="Tracciato del centro di pressione">
    <rect x="${B + 0.5}" y="${B + 0.5}" width="${S - 1}" height="${S - 1}" rx="12" fill="#f1f3f9" stroke="#e3e6f0"/>
    ${griglia}
    <line x1="${B}" y1="${LATO / 2}" x2="${LATO - B}" y2="${LATO / 2}" stroke="#a3aab5" stroke-width="1"/>
    <line x1="${LATO / 2}" y1="${B}" x2="${LATO / 2}" y2="${LATO - B}" stroke="#a3aab5" stroke-width="1"/>
    ${fondoOvale}
    <polyline points="${punti}" fill="none" stroke="${colorePercorso}" stroke-width="1" stroke-opacity="0.65" stroke-linejoin="round"/>
    ${contornoOvale}
    ${scritta(LATO / 2, 17, 'avanti', 'middle')}
    ${scritta(LATO / 2, LATO - 8, 'indietro', 'middle')}
    ${scritta(B - 6, LATO / 2 + 5, 'sx', 'end')}
    ${scritta(LATO - B + 6, LATO / 2 + 5, 'dx', 'start')}
    ${etichetta(B + 8, LATO - B - 7, `griglia ${passo} ${unita}`, 'start')}
  </svg>`
  }

  return `<svg viewBox="0 0 ${LATO} ${LATO}" style="width:${opzioni.larghezza ?? '100%'};height:auto;display:block" role="img" aria-label="Tracciato del centro di pressione">
    <rect x="0.5" y="0.5" width="${LATO - 1}" height="${LATO - 1}" rx="4" style="fill:var(--surface, #fff);stroke:${FILO}"/>
    ${griglia}
    <line x1="${M / 2}" y1="${LATO / 2}" x2="${LATO - M / 2}" y2="${LATO / 2}" stroke="#c4cad2"/>
    <line x1="${LATO / 2}" y1="${M / 2}" x2="${LATO / 2}" y2="${LATO - M / 2}" stroke="#c4cad2"/>
    <polyline points="${punti}" fill="none" stroke="${COLORE_NEUTRO}" stroke-width="1.4" stroke-linejoin="round"/>
    ${ovale}
    <circle cx="${n(px(xs[0]))}" cy="${n(py(ys[0]))}" r="3.5" fill="${COLORE_NEUTRO}"/>
    <circle cx="${n(px(xs[xs.length - 1]))}" cy="${n(py(ys[ys.length - 1]))}" r="3.5" style="fill:var(--surface, #fff)" stroke="${COLORE_NEUTRO}" stroke-width="1.6"/>
    ${etichetta(LATO / 2, 11, serie.asse_y?.nome ?? 'Antero-posteriore', 'middle')}
    ${etichetta(LATO - 4, LATO - 5, serie.asse_x?.nome ?? 'Medio-laterale', 'end')}
    ${etichetta(6, LATO - 5, `griglia ${passo} ${unita}`, 'start')}
  </svg>`
}
