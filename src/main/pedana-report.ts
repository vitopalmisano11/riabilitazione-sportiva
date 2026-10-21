// I test con la pedana nei documenti: la cartella clinica (storico completo),
// la relazione della valutazione (una tabella e due frasi) e il report di
// screening (i test che si scelgono di richiamare, a confronto).
//
// I numeri vengono tutti da riepilogoPedana (shared/pedana.ts): lo stesso
// calcolo della pagina Pedana, quindi un documento non puo' dire cose diverse
// da quelle che si leggono nell'app.
import { archivioPedana } from './pedana'
import { esc } from './html'
import { data, type Blocco, type SezioneComposta } from './cartella-comune'
import { ciambella } from './report-screening-disegni'
import {
  andamentoPedanaSvg,
  BLU,
  ROSSO,
  stabilogrammaSvg,
  type PuntoPedana
} from './pedana-disegni'
import {
  condizioniLeggibili,
  formattaValore,
  latiDellaMisura,
  riepilogoPedana,
  valoreDellaMisura,
  type GiornoPedana,
  type GruppoPedana,
  type SeriePedana,
  type TestPedanaSalvato
} from '../shared/pedana'
import { curvaSvg, curvePedana, raggioTracciato, titoloLato } from '../shared/pedana-curve'

// I gruppi di test di un paziente; con `idsTest` solo le registrazioni scelte
// (il report di screening richiama quelle che si spuntano).
export function gruppiPedana(pazienteId: number, idsTest?: number[]): GruppoPedana[] {
  const archivio = archivioPedana(pazienteId)
  if (idsTest) {
    const scelti = new Set(idsTest)
    archivio.test = archivio.test.filter((t) => scelti.has(t.id))
  }
  return riepilogoPedana(archivio)
}

const fmt = formattaValore

const dataRiga = (r: GiornoPedana): string =>
  r.dataFine ? `${data(r.data)} – ${data(r.dataFine)}` : data(r.data)

// Dal piu' vecchio al piu' recente: e' l'ordine in cui si legge una storia.
const cronologico = (g: GruppoPedana): GiornoPedana[] => [...g.giorni].reverse()

const conLsi = (g: GruppoPedana): boolean => g.famiglia === 'forza' && g.perLato

function intestazioniStorico(g: GruppoPedana): string[] {
  if (!g.perLato) return ['Data', g.misura.nome || 'Valore']
  return [
    'Data',
    'Destro',
    'Sinistro',
    ...(conLsi(g) ? [g.latoInteressato ? 'LSI' : 'Fra i lati'] : [])
  ]
}

function cellaStorico(g: GruppoPedana, r: GiornoPedana): string[] {
  const u = g.misura.unita
  if (!g.perLato) return [dataRiga(r), fmt(r.unico, u)]
  return [
    dataRiga(r),
    fmt(r.dx, u),
    fmt(r.sx, u),
    ...(conLsi(g) ? [r.lsi !== null ? fmt(r.lsi, '%') : '—'] : [])
  ]
}

// "destro +20% · sinistro +5%" (o solo "+20%"): quanto e' cambiato dal primo test.
function testoVariazione(g: GruppoPedana): string | null {
  const v = g.variazione
  if (!v) return null
  const pct = (n: number | null): string | null =>
    n === null ? null : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`
  const parti = g.perLato
    ? [pct(v.dx) && `destro ${pct(v.dx)}`, pct(v.sx) && `sinistro ${pct(v.sx)}`]
    : [pct(v.unico)]
  const dette = parti.filter((x): x is string => !!x)
  return dette.length > 0 ? dette.join(' · ') : null
}

// Tutte le misure dell'ultima riga: una riga per misura, le colonne dei lati
// che ci sono.
function tabellaMisure(r: GiornoPedana): { intestazioni: string[]; righe: string[][] } | null {
  const codici: string[] = []
  const nomi = new Map<string, string>()
  const celle = new Map<string, { dx?: string; sx?: string; unico?: string }>()
  for (const t of r.test) {
    for (const m of t.misure) {
      if (!celle.has(m.codice)) {
        codici.push(m.codice)
        nomi.set(m.codice, m.nome)
        celle.set(m.codice, {})
      }
      const riga = celle.get(m.codice)!
      for (const l of latiDellaMisura(m)) riga[l ?? 'unico'] = fmt(valoreDellaMisura(m, l), m.unita)
    }
  }
  if (codici.length === 0) return null
  const colonne = (['dx', 'sx', 'unico'] as const).filter((c) =>
    codici.some((k) => celle.get(k)![c] !== undefined)
  )
  const nomeColonna = { dx: 'Destro', sx: 'Sinistro', unico: 'Valore' }
  return {
    intestazioni: ['Misura', ...colonne.map((c) => nomeColonna[c])],
    righe: codici.map((k) => [nomi.get(k)!, ...colonne.map((c) => celle.get(k)![c] ?? '—')])
  }
}

const puntiAndamento = (g: GruppoPedana): PuntoPedana[] =>
  cronologico(g).map((r) => ({ data: r.data, dx: r.dx, sx: r.sx, unico: r.unico }))

// I tracciati di una o piu' righe (in ogni riga il destro prima del sinistro), tutti
// alla stessa scala: se ce n'e' piu' d'uno stanno a confronto.
const tracciatiDelleRighe = (
  righe: GiornoPedana[]
): { serie: SeriePedana; titolo: string; riga: GiornoPedana; svg: (larghezza: string) => string }[] => {
  const tutti = righe.flatMap((riga) =>
    riga.test
      .flatMap((t) =>
        t.serie.filter((s) => s.codice === 'stabilogramma').map((serie) => ({ serie, lato: t.lato, riga }))
      )
      .sort((a, b) => (a.lato === 'dx' ? 0 : 1) - (b.lato === 'dx' ? 0 : 1))
  )
  const raggio = Math.max(0, ...tutti.map((t) => raggioTracciato(t.serie)))
  return tutti.map((t) => ({
    serie: t.serie,
    riga: t.riga,
    titolo: `Tracciato del centro di pressione${titoloLato(t.lato)}`,
    svg: (larghezza) => stabilogrammaSvg(t.serie, larghezza, tutti.length > 1 ? raggio : undefined, t.lato)
  }))
}

const tracciatiDi = (
  r: GiornoPedana
): { serie: SeriePedana; titolo: string; svg: (larghezza: string) => string }[] =>
  tracciatiDelleRighe([r])

// Le curve di una riga, gia' disegnate; quelle che non si riescono a disegnare
// (pochi punti) si saltano.
const curveDi = (r: GiornoPedana): { titolo: string; svg: string }[] =>
  curvePedana(r.test)
    .map((c) => ({ titolo: c.titolo, svg: curvaSvg(c) }))
    .filter((c) => c.svg)

// ---- cartella clinica ---------------------------------------------------------

// La sezione completa: per ogni test lo storico, il confronto fra i lati,
// tutte le misure dell'ultimo test, avvisi e condizioni, l'andamento e il
// tracciato della stabilometria.
export function sezPedana(pazienteId: number): Blocco[] {
  const blocchi: Blocco[] = []
  for (const g of gruppiPedana(pazienteId)) {
    const ultima = g.giorni[0]
    blocchi.push({
      tipo: 'sottotitolo',
      testo: g.misura.nome ? `${g.nome} — ${g.misura.nome}` : g.nome
    })
    if (g.frase) blocchi.push({ tipo: 'paragrafi', voci: [{ testo: g.frase }] })
    blocchi.push({
      tipo: 'tabella',
      intestazioni: intestazioniStorico(g),
      righe: cronologico(g).map((r) => cellaStorico(g, r))
    })
    const variazione = testoVariazione(g)
    if (variazione && g.variazione) {
      blocchi.push({
        tipo: 'paragrafi',
        voci: [{ testo: `Dal ${data(g.variazione.dal)}: ${variazione}.` }]
      })
    }

    const misure = tabellaMisure(ultima)
    if (misure) {
      blocchi.push({ tipo: 'sottotitolo', testo: `Ultimo test — ${dataRiga(ultima)}` })
      blocchi.push({ tipo: 'tabella', ...misure })
    }
    const avvertenze = [...new Set(ultima.test.flatMap((t) => t.avvertenze))]
    if (avvertenze.length > 0) {
      blocchi.push({ tipo: 'elenco', voci: avvertenze.map((a) => `Avvertenza: ${a}`) })
    }
    const condizioni = [...new Set(ultima.test.flatMap((t) => condizioniLeggibili(t.condizioni)))]
    if (condizioni.length > 0)
      blocchi.push({ tipo: 'testo', titolo: 'Come è stato fatto', corpo: condizioni.join(' · ') })
    const riassunto = ultima.test.flatMap((t) => t.riassunto)
    if (riassunto.length > 0) blocchi.push({ tipo: 'elenco', voci: riassunto })

    const grafici: { titolo: string; svg: string }[] = []
    const andamento = andamentoPedanaSvg(puntiAndamento(g), g.misura.unita, g.perLato)
    if (andamento) grafici.push({ titolo: 'Andamento nel tempo', svg: andamento })
    for (const t of tracciatiDi(ultima)) {
      const svg = t.svg('65mm')
      if (svg) grafici.push({ titolo: `${t.titolo} — ${dataRiga(ultima)}`, svg })
    }
    if (grafici.length > 0) {
      blocchi.push({
        tipo: 'grafici',
        grafici,
        legenda: g.perLato
          ? [
              { colore: BLU, testo: 'Destro' },
              { colore: ROSSO, testo: 'Sinistro' }
            ]
          : [{ colore: BLU, testo: g.misura.nome || 'Valore' }]
      })
    }
    // le curve dell'ultimo test (forza nel tempo, salto, oscillazione), con la
    // legenda scritta dentro il disegno
    const curve = curveDi(ultima)
    if (curve.length > 0) {
      blocchi.push({
        tipo: 'grafici',
        grafici: curve.map((c) => ({ titolo: `${c.titolo} — ${dataRiga(ultima)}`, svg: c.svg })),
        legenda: []
      })
    }
  }
  return blocchi
}

// ---- relazione della valutazione ----------------------------------------------

// Solo la sintesi: una riga per test con l'ultimo risultato, e una frase per
// i test di forza fatti sui due lati.
export function sintesiPedana(pazienteId: number): SezioneComposta | null {
  const gruppi = gruppiPedana(pazienteId)
  if (gruppi.length === 0) return null

  const righe = gruppi.map((g) => {
    const r = g.giorni[0]
    const u = g.misura.unita
    const risultato = g.perLato
      ? [r.dx !== null && `Dx ${fmt(r.dx, u)}`, r.sx !== null && `Sx ${fmt(r.sx, u)}`]
          .filter((x): x is string => !!x)
          .join(' · ') || '—'
      : fmt(r.unico, u)
    return [
      g.nome,
      dataRiga(r),
      risultato,
      conLsi(g) && r.lsi !== null ? fmt(r.lsi, '%') : '—',
      testoVariazione(g) ?? '—'
    ]
  })
  const blocchi: Blocco[] = [
    {
      tipo: 'tabella',
      intestazioni: ['Test', 'Data', 'Risultato', 'LSI', 'Dal primo test'],
      righe
    }
  ]
  const frasi = gruppi
    .filter((g) => g.frase)
    .map((g) => ({ testo: `${g.nome}: ${g.frase!.charAt(0).toLowerCase()}${g.frase!.slice(1)}` }))
  if (frasi.length > 0) blocchi.push({ tipo: 'paragrafi', voci: frasi })
  return { titolo: 'Test con pedana', blocchi }
}

// ---- report di screening --------------------------------------------------------

// Il trattino lungo nei nomi ("Salto — CMJ") si legge male: il resto va fra parentesi
// (o dopo una virgola se ha gia' delle parentesi).
const nomeBreve = (nome: string): string =>
  nome.replace(/\s+—\s+(.*)$/, (_, resto: string) =>
    resto.includes('(') ? `, ${resto}` : ` (${resto})`
  )

const minuscola = (t: string): string => `${t.charAt(0).toLowerCase()}${t.slice(1)}`
const senzaPunto = (t: string): string => t.replace(/\.\s*$/, '')

// Il giudizio che l'app della pedana scrive in testa alla sua prima frase
// ("Oscillazione marcata: il centro di pressione si e' spostato..."), se c'e'.
function giudizioDelLato(r: GiornoPedana, lato: 'dx' | 'sx'): string | null {
  const prima = r.test.find((t) => t.lato === lato)?.riassunto[0]
  const m = prima ? /^([^:]{3,40}):/.exec(prima) : null
  return m ? minuscola(m[1]) : null
}

const deviazione = (v: number[]): number => {
  const m = v.reduce((a, b) => a + b, 0) / v.length
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)
}

// Di quanto e' cambiato un valore dal primo test: "migliorato", "peggiorato" o
// "invariato" (sotto il 10% e' la variabilita' fra una prova e l'altra).
function esitoVariazione(pct: number | null, meglio: 'alto' | 'basso' | null): 'migliorata' | 'peggiorata' | 'invariata' | null {
  if (pct === null) return null
  if (Math.abs(pct) < 10) return 'invariata'
  return (meglio === 'alto' ? pct > 0 : pct < 0) ? 'migliorata' : 'peggiorata'
}

// Da che parte oscilla di piu' il centro di pressione in un test di stabilometria:
// avanti-indietro, destra-sinistra, o in modo simile nelle due direzioni.
function direzioneOscillazione(t: TestPedanaSalvato): 'ap' | 'ml' | 'simile' | null {
  const tempo = t.serie.find((s) => s.codice === 'stabilogramma_tempo')
  const tracciato = t.serie.find((s) => s.codice === 'stabilogramma')
  const ml = tempo?.canali.y_ml ?? tracciato?.canali.x
  const ap = tempo?.canali.y_ap ?? tracciato?.canali.y
  if (!ml || !ap || ml.length < 2 || ap.length < 2) return null
  const rapporto = deviazione(ap) / (deviazione(ml) || 1e-9)
  return rapporto > 1.25 ? 'ap' : rapporto < 0.8 ? 'ml' : 'simile'
}

const TESTO_DIREZIONE = {
  ap: 'avanti-indietro (punte e talloni)',
  ml: 'da destra a sinistra',
  simile: 'in modo simile nelle due direzioni'
}

// La stabilometria in poche parole, senza date ne' numeri: su quale piede e' piu'
// stabile (velocita' piu' bassa) e verso dove tende a oscillare.
function fraseStabilometria(g: GruppoPedana): string {
  const r = g.giorni[0]
  const dir = (l: 'dx' | 'sx'): 'ap' | 'ml' | 'simile' | null => {
    const t = r.test.find((x) => x.lato === l)
    return t ? direzioneOscillazione(t) : null
  }
  const parti: string[] = []
  const dx = dir('dx')
  const sx = dir('sx')
  if (r.dx !== null && r.sx !== null) {
    const diff = Math.abs(r.dx - r.sx) / Math.max(r.dx, r.sx, 1e-9)
    parti.push(
      diff < 0.1
        ? 'stabilità simile sui due piedi'
        : `più stabile sul piede ${(g.misura.meglio === 'alto' ? r.dx > r.sx : r.dx < r.sx) ? 'destro' : 'sinistro'}`
    )
    if (dx && sx) {
      parti.push(
        dx === sx
          ? `tende a oscillare ${TESTO_DIREZIONE[dx]} su entrambi`
          : `a destra oscilla ${TESTO_DIREZIONE[dx]}, a sinistra ${TESTO_DIREZIONE[sx]}`
      )
    }
  } else {
    const l = r.dx !== null ? 'dx' : r.sx !== null ? 'sx' : null
    const d = l === 'dx' ? dx : l === 'sx' ? sx : null
    if (l) parti.push(`piede ${l === 'dx' ? 'destro' : 'sinistro'}`)
    if (d) parti.push(`tende a oscillare ${TESTO_DIREZIONE[d]}`)
  }
  const frase = parti.join(', ')
  // il confronto col primo test, se ce n'e' piu' d'uno
  const v = g.giorni.length >= 2 ? g.variazione : null
  if (v) {
    const lato = (l: 'dx' | 'sx', nome: string): string | null => {
      const e = esitoVariazione(v[l], g.misura.meglio)
      return e ? `${e} ${nome}` : null
    }
    const dette = [lato('dx', 'a destra'), lato('sx', 'a sinistra')].filter((x): x is string => !!x)
    if (dette.length > 0) return `${frase}; rispetto al primo test stabilità ${dette.join(', ')}`
  }
  return frase
}

const pctDifferenza = (dx: number, sx: number): number =>
  Math.round((Math.abs(dx - sx) / Math.min(dx, sx)) * 100)

// Come e' cambiata la differenza di forza fra gli arti dal primo test all'ultimo
// (o, se non ci sono due test con i due lati, la variazione dei singoli lati).
function cambioDifferenza(g: GruppoPedana): string {
  const conLati = g.giorni.filter((r) => r.dx !== null && r.sx !== null && r.dx > 0 && r.sx > 0)
  if (conLati.length >= 2) {
    const prima = pctDifferenza(conLati[conLati.length - 1].dx!, conLati[conLati.length - 1].sx!)
    const adesso = pctDifferenza(conLati[0].dx!, conLati[0].sx!)
    if (Math.abs(adesso - prima) < 3) return '; differenza fra gli arti invariata rispetto al primo test'
    return `; differenza fra gli arti ${adesso < prima ? 'ridotta' : 'aumentata'} dal ${prima}% al ${adesso}% rispetto al primo test`
  }
  const v = testoVariazione(g)
  return v && g.giorni.length >= 2 ? `; dal primo test: ${v}` : ''
}

// Una frase sola per test, per il riassunto in fondo al report: l'ultimo
// risultato, il confronto fra i lati nei test di forza e quanto e' cambiato dal
// primo test. La stabilometria ha una frase sua, senza numeri.
function fraseRiepilogo(g: GruppoPedana): string {
  if (g.famiglia === 'stabilometria') {
    const frase = fraseStabilometria(g)
    if (frase) return frase
  }
  const r = g.giorni[0]
  // forza: solo la differenza fra i due arti, senza picchi
  if (g.famiglia === 'forza' && g.frase) {
    const lsi = conLsi(g) && r.lsi !== null ? ` (LSI ${fmt(r.lsi, '%')})` : ''
    const base = `${minuscola(senzaPunto(g.frase))}${lsi}`
    return `${base}${cambioDifferenza(g)}`
  }
  const u = g.misura.unita
  const conGiudizio = g.famiglia === 'stabilometria'
  const valori = g.perLato
    ? (['dx', 'sx'] as const)
        .filter((l) => r[l] !== null)
        .map((l) => {
          const giudizio = conGiudizio ? giudizioDelLato(r, l) : null
          return `${l === 'dx' ? 'destro' : 'sinistro'} ${fmt(r[l], u)}${giudizio ? ` (${giudizio})` : ''}`
        })
        .join(', ')
    : fmt(r.unico, u)
  const misura = g.misura.nome ? `${minuscola(g.misura.nome)} ` : ''
  const parti = [`${misura}${valori}`]
  if (g.frase) {
    const lsi = conLsi(g) && r.lsi !== null ? ` (LSI ${fmt(r.lsi, '%')})` : ''
    parti.push(`${minuscola(senzaPunto(g.frase))}${lsi}`)
  }
  const variazione = testoVariazione(g)
  if (variazione && g.variazione) parti.push(`dal primo test: ${variazione}`)
  return parti.join('; ')
}

// Le frasi dei test con pedana scelti: il report di screening le aggiunge al suo
// riassunto finale, un titolo (il nome del test) e una frase ciascuno.
export function frasiRiepilogoPedana(
  pazienteId: number,
  idsTest: number[]
): { titolo: string; frase: string }[] {
  if (idsTest.length === 0) return []
  return gruppiPedana(pazienteId, idsTest).map((g) => ({
    titolo: nomeBreve(g.nome),
    frase: fraseRiepilogo(g)
  }))
}

const nomeLatoNota = (g: GruppoPedana, lato: 'dx' | 'sx'): string =>
  `${g.famiglia === 'stabilometria' ? 'Piede' : 'Lato'} ${lato === 'dx' ? 'destro' : 'sinistro'}`

// Le note dell'app sotto ai grafici. Con i due lati ogni nota sta in una colonna col
// nome del lato (la stessa larghezza dei grafici che ha sopra, cosi' si capisce a
// quale appartiene); le frasi identiche per tutti e due si scrivono una volta sola.
function noteHtml(g: GruppoPedana, r: GiornoPedana): string {
  const conNote = r.test
    .filter((t) => t.riassunto.length > 0)
    .sort((a, b) => (a.lato === 'dx' ? 0 : 1) - (b.lato === 'dx' ? 0 : 1))
  if (conNote.length === 0) return ''
  const elenco = (voci: string[]): string =>
    `<ul class="riassunto-pedana">${voci.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`

  const coiLati = conNote.length > 1 && conNote.every((t) => t.lato)
  if (!coiLati) {
    const voci = [...new Set(conNote.flatMap((t) => t.riassunto))]
    const lato = conNote.length === 1 ? conNote[0].lato : null
    return `<div class="sezione-pedana">${
      lato ? `<p class="titolo-nota">${esc(nomeLatoNota(g, lato))}</p>` : ''
    }${elenco(voci)}</div>`
  }

  const comuni = conNote[0].riassunto.filter((x) => conNote.every((t) => t.riassunto.includes(x)))
  const colonne = conNote
    .map((t) => ({ t, voci: t.riassunto.filter((x) => !comuni.includes(x)) }))
    .filter((c) => c.voci.length > 0)
    .map(
      (c) =>
        `<div><p class="titolo-nota">${esc(nomeLatoNota(g, c.t.lato!))}</p>${elenco(c.voci)}</div>`
    )
    .join('')
  const comune =
    comuni.length > 0
      ? `<p class="titolo-nota">${g.famiglia === 'stabilometria' ? 'Entrambi i piedi' : 'Entrambi i lati'}</p>${elenco(comuni)}`
      : ''
  return `<div class="sezione-pedana">${colonne ? `<div class="coppia-pedana note">${colonne}</div>` : ''}${comune}</div>`
}

// Ogni test ha lo stesso ordine, dall'alto in basso: una riga per data (la data,
// la misura e i valori (l'unita' sta nei valori), tutto sulla stessa riga, senza tabella),
// poi i grafici e le note. Nei test di forza, sotto la riga, la ciambella dei due
// lati e l'andamento; nella stabilometria i due tracciati affiancati e le due
// oscillazioni nel tempo, con le note di ogni piede sotto al suo grafico.
function testoHtml(g: GruppoPedana): string {
  const ultima = g.giorni[0]
  const u = g.misura.unita
  const unita = u ? ` ${esc(u)}` : ''
  const riga = (r: GiornoPedana): string => {
    const lato = (l: 'dx' | 'sx'): string =>
      r[l] === null
        ? ''
        : `<span class="${l}">${l === 'dx' ? 'Destro' : 'Sinistro'} <b>${esc(fmt(r[l], null))}</b>${unita}</span>`
    const lsi =
      conLsi(g) && r.lsi !== null
        ? `<span>${g.latoInteressato ? 'LSI' : 'Fra i lati'} <b>${esc(fmt(r.lsi, '%'))}</b></span>`
        : ''
    const valori = g.perLato
      ? lato('dx') + lato('sx') + lsi
      : `<span class="dx"><b>${esc(fmt(r.unico, null))}</b>${unita}</span>`
    return `<div class="valori-riga"><span class="data">${esc(dataRiga(r))}</span><span class="misura-nome">${esc(g.misura.nome)}</span>${valori}</div>`
  }

  const andamento = andamentoPedanaSvg(puntiAndamento(g), u, g.perLato)
  const senzaAndamento =
    !andamento && g.famiglia !== 'stabilometria'
      ? '<p class="nota-pedana">L’andamento compare dal secondo test.</p>'
      : ''
  const legenda = g.perLato
    ? '<p class="legenda"><span class="pallino blu"></span>Destro<span class="pallino rosso"></span>Sinistro</p>'
    : ''
  const ciambellaHtml =
    conLsi(g) && ultima.dx !== null && ultima.sx !== null
      ? `<div class="confronto-lati"><div class="grafico-lati">
          <div class="lato sinistra"><span class="etichetta">Sinistra</span><span class="numero">${esc(fmt(ultima.sx, u))}</span></div>
          ${ciambella(ultima.dx, ultima.sx)}
          <div class="lato destra"><span class="etichetta">Destra</span><span class="numero">${esc(fmt(ultima.dx, u))}</span></div>
        </div>${g.frase ? `<p class="asimmetria">${esc(g.frase)}</p>` : ''}</div>`
      : ''
  // con piu' date i tracciati della prima e dell'ultima stanno a confronto, alla
  // stessa scala, ognuno con la sua data
  const righeTracciati = g.giorni.length >= 2 ? [g.giorni[g.giorni.length - 1], ultima] : [ultima]
  const confrontoDate = righeTracciati.length > 1
  const tracciatiDate = righeTracciati.map((r) =>
    tracciatiDelleRighe(righeTracciati)
      .filter((t) => t.riga === r)
      .map(
        (t) =>
          `<figure class="g-piccolo"><figcaption class="didascalia-tracciato">${esc(nomeBreve(t.titolo))}${
            confrontoDate ? ` · ${esc(dataRiga(r))}` : ''
          }</figcaption>${t.svg('100%')}</figure>`
      )
  )
  // un lato solo per data: le date stanno nella stessa riga; con due piedi, una riga per data
  const righeFigure = tracciatiDate.every((f) => f.length <= 1) ? [tracciatiDate.flat()] : tracciatiDate
  const tracciati = righeFigure.flat()
  const curve = curveDi(ultima).map(
    (c) => `<figure class="g-largo"><figcaption>${esc(nomeBreve(c.titolo))}</figcaption>${c.svg}</figure>`
  )
  const avvertenze = [...new Set(ultima.test.flatMap((t) => t.avvertenze))]

  // Con due grafici soli (per esempio il tracciato e l'oscillazione di un piede, o la
  // ciambella e la curva della forza) stanno uno di fianco all'altro; con piu'
  // grafici, un gruppo per riga: confronto, tracciati, curve.
  const confronto = [
    ciambellaHtml ? ciambellaHtml.replace('class="confronto-lati"', 'class="confronto-lati g-piccolo"') : '',
    andamento ? `<div class="andamento-pedana g-largo">${andamento}${legenda}</div>` : ''
  ].filter(Boolean)
  const tutti = [...confronto, ...tracciati, ...curve]
  const riga2 = (voci: string[], classe: string): string =>
    voci.length > 0 ? `<div class="sezione-pedana coppia-pedana ${classe}">${voci.join('')}</div>` : ''
  const graficiHtml =
    tutti.length === 2
      ? riga2(tutti, 'due-grafici')
      : riga2(confronto, 'confronto') + righeFigure.map((f) => riga2(f, 'tracciati')).join('') + riga2(curve, 'curve')

  return `<div class="test"><h4>${esc(nomeBreve(g.nome))}</h4>
    <div class="misura">
      <div class="valori-pedana">${cronologico(g).map(riga).join('')}</div>
      ${senzaAndamento}
      ${graficiHtml}
      ${noteHtml(g, ultima)}
      ${avvertenze.map((a) => `<p class="vuoto-test">Avvertenza: ${esc(a)}</p>`).join('')}
    </div>
  </div>`
}

// I test scelti, ognuno nel suo riquadro come gli altri test del report.
// Vuoto se non c'e' niente da mostrare.
export function pedanaHtmlScreening(pazienteId: number, idsTest: number[]): string {
  if (idsTest.length === 0) return ''
  const gruppi = gruppiPedana(pazienteId, idsTest)
  if (gruppi.length === 0) return ''
  return `<section><h3>Test con pedana</h3>${gruppi.map(testoHtml).join('')}</section>`
}
