// I test fatti con la pedana di forza: il file che arriva dall'app della
// pedana, come lo si legge e i numeri che se ne ricavano.
//
// Il file e' un JSON ("pedana-report", versione 1). Qui sta tutto cio' che non
// tocca il database, cosi' la stessa logica serve all'importazione, alla
// scheda del paziente e ai report. Il formato e' descritto in
// docs/formato-pedana.md.
import { arrotonda, asimmetria, DECIMALI_MISURA, DECIMALI_PERCENTUALE, lsi, riassumi } from './misure'

export type LatoPedana = 'dx' | 'sx'
export type VersoMisura = 'alto' | 'basso'

export interface ValorePedana {
  lato: LatoPedana | null
  prova: number | null
  valore: number
}

export interface MisuraPedana {
  codice: string
  nome: string
  unita: string | null
  per_prova: boolean
  // 'alto': piu' e' alto meglio e' (forza, altezza); 'basso': meglio se basso
  // (tempi, oscillazioni); null: non c'e' un verso (la quota di carico a sinistra)
  meglio: VersoMisura | null
  valori: ValorePedana[]
}

// Una curva o un tracciato: i punti stanno in array di numeri, con i nomi che
// l'app della pedana ha scelto (x, y, y_ml, y_ap, y_sx, y_dx...).
export interface SeriePedana {
  codice: string
  nome: string
  asse_x: { nome: string; unita: string | null } | null
  asse_y: { nome: string; unita: string | null } | null
  frequenza_hz: number | null
  lato: LatoPedana | null
  prova: number | null
  canali: Record<string, number[]>
  // solo lo statokinesigramma, e solo nei file recenti: l'ovale che contiene il
  // 95% dei punti (assente nei file vecchi, e allora non si disegna)
  ellisse: EllissePedana | null
}

export interface EllissePedana {
  centro_x_mm: number | null
  centro_y_mm: number | null
  semiasse_maggiore_mm: number | null
  semiasse_minore_mm: number | null
  angolo_gradi: number | null
  // il contorno gia' calcolato, chiuso, negli stessi assi della traiettoria
  x: number[]
  y: number[]
}

export interface RegistrazionePedana {
  id: string
  data: string
  ora: string | null
  test: { codice: string; nome: string; categoria: string | null }
  condizioni: Record<string, unknown>
  peso_kg: number | null
  avvertenze: string[]
  riassunto: string[]
  misure: MisuraPedana[]
  serie: SeriePedana[]
}

export interface DispositivoPedana {
  tipo: string | null
  modello: string | null
  frequenza_hz: number | null
  portata_nominale_kg: number | null
}

export interface FilePedana {
  creato_il: string | null
  app: string | null
  dispositivo: DispositivoPedana
  paziente_nome: string | null
  // l'ultimo peso noto nell'app della pedana: vale per le registrazioni che non hanno il loro
  peso_kg: number | null
  registrazioni: RegistrazionePedana[]
}

// I limiti servono a non farsi mettere in ginocchio da un file sbagliato: un
// referto onesto e' molto sotto tutti questi numeri.
export const PESO_MASSIMO_FILE_PEDANA = 60 * 1024 * 1024
const MAX_REGISTRAZIONI = 2000
const MAX_MISURE = 60
const MAX_VALORI = 400
const MAX_SERIE = 60
const MAX_PUNTI = 200_000
const MAX_AVVERTENZE = 20

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/
const REGEX_ORA = /^\d{2}:\d{2}$/

type Oggetto = Record<string, unknown>

const èOggetto = (v: unknown): v is Oggetto => typeof v === 'object' && v !== null && !Array.isArray(v)

const testo = (v: unknown, massimo = 300): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, massimo)
  return t === '' ? null : t
}

const numero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const lato = (v: unknown): LatoPedana | null => (v === 'dx' || v === 'sx' ? v : null)

function leggiMisura(grezza: unknown, dove: string): MisuraPedana | null {
  if (!èOggetto(grezza)) return null
  const codice = testo(grezza.codice, 80)
  const nome = testo(grezza.nome, 120)
  if (!codice || !nome) throw new Error(`${dove}: una misura non ha codice o nome.`)
  const valori: ValorePedana[] = []
  for (const v of Array.isArray(grezza.valori) ? grezza.valori.slice(0, MAX_VALORI) : []) {
    if (!èOggetto(v)) continue
    // un valore non numerico (o infinito) si scarta: meglio un buco che un 0
    // che farebbe media con quelli veri
    const valore = numero(v.valore)
    if (valore === null) continue
    const prova = numero(v.prova)
    valori.push({
      lato: lato(v.lato),
      prova: prova !== null && Number.isInteger(prova) && prova >= 1 ? prova : null,
      valore
    })
  }
  return {
    codice,
    nome,
    unita: testo(grezza.unita, 20),
    per_prova: grezza.per_prova === true,
    meglio: grezza.meglio === 'alto' || grezza.meglio === 'basso' ? grezza.meglio : null,
    valori
  }
}

// L'ovale di uno statokinesigramma. Se manca o non e' un contorno utilizzabile
// non e' un errore: semplicemente non si disegna.
function leggiEllisse(grezza: unknown): EllissePedana | null {
  if (!èOggetto(grezza)) return null
  const lista = (v: unknown): number[] | null =>
    Array.isArray(v) && v.length <= MAX_PUNTI && v.every((p) => typeof p === 'number' && Number.isFinite(p))
      ? (v as number[])
      : null
  const x = lista(grezza.x)
  const y = lista(grezza.y)
  if (!x || !y || x.length < 3 || x.length !== y.length) return null
  return {
    centro_x_mm: numero(grezza.centro_x_mm),
    centro_y_mm: numero(grezza.centro_y_mm),
    semiasse_maggiore_mm: numero(grezza.semiasse_maggiore_mm),
    semiasse_minore_mm: numero(grezza.semiasse_minore_mm),
    angolo_gradi: numero(grezza.angolo_gradi),
    x,
    y
  }
}

function leggiSerie(grezza: unknown): SeriePedana | null {
  if (!èOggetto(grezza)) return null
  const codice = testo(grezza.codice, 80)
  const nome = testo(grezza.nome, 120)
  if (!codice || !nome) return null
  const asse = (a: unknown): { nome: string; unita: string | null } | null =>
    èOggetto(a) && testo(a.nome, 60) ? { nome: testo(a.nome, 60)!, unita: testo(a.unita, 20) } : null
  const canali: Record<string, number[]> = {}
  for (const [chiave, v] of Object.entries(grezza)) {
    if (!/^(x|y|y_[a-z0-9_]{1,20})$/.test(chiave) || !Array.isArray(v)) continue
    const punti = v.slice(0, MAX_PUNTI)
    if (!punti.every((p) => typeof p === 'number' && Number.isFinite(p))) continue
    canali[chiave] = punti as number[]
  }
  const lunghezze = new Set(Object.values(canali).map((c) => c.length))
  // liste di lunghezza diversa non si possono disegnare: la serie si scarta e
  // restano le misure
  if (lunghezze.size !== 1) return null
  const prova = numero(grezza.prova)
  return {
    codice,
    nome,
    asse_x: asse(grezza.asse_x),
    asse_y: asse(grezza.asse_y),
    frequenza_hz: numero(grezza.frequenza_hz),
    lato: lato(grezza.lato),
    prova: prova !== null && Number.isInteger(prova) && prova >= 1 ? prova : null,
    canali,
    ellisse: codice === 'stabilogramma' ? leggiEllisse(grezza.ellisse) : null
  }
}

function leggiRegistrazione(grezza: unknown, indice: number): RegistrazionePedana {
  const dove = `Registrazione ${indice + 1}`
  if (!èOggetto(grezza)) throw new Error(`${dove}: formato non valido.`)
  const id = testo(grezza.id, 120)
  if (!id) throw new Error(`${dove}: manca l'identificativo (serve a non importarla due volte).`)
  const data = testo(grezza.data, 10)
  if (!data || !REGEX_DATA.test(data)) throw new Error(`${dove}: la data non è valida (serve AAAA-MM-GG).`)
  const t = grezza.test
  if (!èOggetto(t) || !testo(t.codice, 80) || !testo(t.nome, 120)) {
    throw new Error(`${dove}: manca il test (codice e nome).`)
  }
  const ora = testo(grezza.ora, 5)
  const misure = (Array.isArray(grezza.misure) ? grezza.misure.slice(0, MAX_MISURE) : [])
    .map((m) => leggiMisura(m, dove))
    .filter((m): m is MisuraPedana => m !== null && m.valori.length > 0)
  const serie = (Array.isArray(grezza.serie) ? grezza.serie.slice(0, MAX_SERIE) : [])
    .map(leggiSerie)
    .filter((s): s is SeriePedana => s !== null)
  const stringhe = (v: unknown): string[] =>
    (Array.isArray(v) ? v : [])
      .map((x) => testo(x, 500))
      .filter((x): x is string => x !== null)
      .slice(0, MAX_AVVERTENZE)
  const peso = numero(grezza.peso_corporeo_kg)
  return {
    id,
    data,
    ora: ora && REGEX_ORA.test(ora) ? ora : null,
    test: {
      codice: testo(t.codice, 80)!,
      nome: nomeTestPulito(testo(t.nome, 120)!),
      categoria: testo(t.categoria, 80)
    },
    condizioni: èOggetto(grezza.condizioni) ? grezza.condizioni : {},
    peso_kg: peso !== null && peso > 0 && peso < 500 ? peso : null,
    avvertenze: stringhe(grezza.avvertenze),
    riassunto: stringhe(grezza.riassunto),
    misure,
    serie
  }
}

// Legge il testo del file e lo controlla. Se il file non e' di questo tipo o
// non e' valido lancia un errore che si puo' mostrare cosi' com'e'.
export function leggiFilePedana(contenuto: string): FilePedana {
  let grezzo: unknown
  try {
    grezzo = JSON.parse(contenuto.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('Il file non è leggibile: non è un file esportato dall’app della pedana.')
  }
  if (!èOggetto(grezzo) || grezzo.formato !== 'pedana-report') {
    throw new Error('Questo non è un file esportato dall’app della pedana (“pedana-report”).')
  }
  const versione = numero(grezzo.versione)
  if (versione !== 1) {
    throw new Error(
      `Versione del file non supportata (${versione ?? 'mancante'}): questo gestionale legge la versione 1.`
    )
  }
  if (!èOggetto(grezzo.paziente)) throw new Error('Nel file mancano i dati del paziente.')
  if (!Array.isArray(grezzo.registrazioni)) throw new Error('Nel file non ci sono registrazioni.')
  if (grezzo.registrazioni.length > MAX_REGISTRAZIONI) {
    throw new Error(`Il file ha troppe registrazioni (più di ${MAX_REGISTRAZIONI}).`)
  }
  const registrazioni = grezzo.registrazioni.map(leggiRegistrazione)
  const ids = new Set<string>()
  for (const r of registrazioni) {
    if (ids.has(r.id)) throw new Error(`Nel file lo stesso identificativo compare due volte (${r.id}).`)
    ids.add(r.id)
  }
  const d = èOggetto(grezzo.dispositivo) ? grezzo.dispositivo : {}
  const a = èOggetto(grezzo.app) ? grezzo.app : {}
  const p = èOggetto(grezzo.paziente) ? grezzo.paziente : {}
  return {
    creato_il: testo(grezzo.creato_il, 40),
    app: [testo(a.nome, 60), testo(a.versione, 20)].filter(Boolean).join(' ') || null,
    dispositivo: {
      tipo: testo(d.tipo, 60),
      modello: testo(d.modello, 80),
      frequenza_hz: numero(d.frequenza_hz),
      portata_nominale_kg: numero(d.portata_nominale_kg)
    },
    paziente_nome: testo(p.nome_completo, 120),
    peso_kg: numero(p.peso_corporeo_kg) !== null && numero(p.peso_corporeo_kg)! > 0 ? numero(p.peso_corporeo_kg) : null,
    registrazioni
  }
}

// Il nome di un test senza parentesi dentro le parentesi: l'app della pedana
// scrive "Spalla (Y (135°))", qui si legge "Spalla (Y 135°)". Si applica quando
// si legge il file e quando si leggono i test gia' salvati.
export function nomeTestPulito(nome: string): string {
  let livello = 0
  let fuori = ''
  for (const c of nome) {
    if (c === '(') {
      livello++
      fuori += livello > 1 ? ' ' : c
    } else if (c === ')' && livello > 0) {
      fuori += livello > 1 ? '' : c
      livello--
    } else {
      fuori += c
    }
  }
  return fuori.replace(/\s{2,}/g, ' ').replace(/\(\s+/g, '(').trim()
}

// ---- Cosa si ricava dai numeri -------------------------------------------

export type FamigliaPedana = 'forza' | 'salto' | 'stabilometria' | 'altro'

export function famigliaDi(codiceTest: string): FamigliaPedana {
  const radice = codiceTest.split('.')[0]
  return radice === 'forza' || radice === 'salto' || radice === 'stabilometria' ? radice : 'altro'
}

// La misura che si legge per prima di ogni famiglia di test: quella che si
// confronta nel tempo e fra i due lati. Per la forza il picco della
// ripetizione migliore; se manca, il picco medio, e in ultimo il picco delle
// singole prove (di cui si prende il migliore).
const MISURA_PRINCIPALE: Record<FamigliaPedana, string[]> = {
  forza: ['picco_migliore_kg', 'picco_medio_kg', 'picco_kg'],
  salto: ['altezza_cm'],
  stabilometria: ['velocita_media_mm_s'],
  altro: []
}

export function misuraPrincipale<T extends { codice: string }>(
  codiceTest: string,
  misure: T[]
): T | null {
  for (const voluta of MISURA_PRINCIPALE[famigliaDi(codiceTest)]) {
    const m = misure.find((x) => x.codice === voluta)
    if (m) return m
  }
  return misure[0] ?? null
}

// Il valore che conta fra le prove (la migliore), per lato. Se il verso non e'
// noto si prende la media: non si puo' dire quale sia la migliore.
export function valoreDellaMisura(m: MisuraPedana, latoScelto: LatoPedana | null): number | null {
  const prove = m.valori.filter((v) => v.lato === latoScelto).map((v) => v.valore)
  if (m.meglio === null) return riassumi(prove, 'media')
  return riassumi(prove, 'migliore', m.meglio === 'basso' ? 'max' : 'min')
}

export function latiDellaMisura(m: MisuraPedana): (LatoPedana | null)[] {
  const visti = new Set<LatoPedana | null>()
  for (const v of m.valori) visti.add(v.lato)
  return [...visti]
}

export function decimali(unita: string | null): number {
  return unita === '%' ? DECIMALI_PERCENTUALE : DECIMALI_MISURA
}

export function formattaValore(valore: number | null, unita: string | null): string {
  if (valore === null) return '—'
  const t = arrotonda(valore, decimali(unita)).toString().replace('.', ',')
  return unita ? `${t} ${unita}` : t
}

// L'LSI fra due registrazioni dello stesso test, una per lato: lato
// interessato ÷ lato sano (o il contrario se meno e' meglio). Senza sapere il
// lato interessato resta il rapporto fra il minore e il maggiore.
export interface ConfrontoLati {
  dx: number | null
  sx: number | null
  lsi: number | null
  asimmetria: number | null
  latoInteressato: LatoPedana | null
}

export function confrontaLati(
  dx: number | null,
  sx: number | null,
  latoInteressato: LatoPedana | null,
  meglio: VersoMisura | null
): ConfrontoLati {
  return {
    dx,
    sx,
    lsi: lsi(dx, sx, latoInteressato, meglio === 'basso' ? 'max' : 'min'),
    asimmetria: asimmetria(dx, sx),
    latoInteressato
  }
}

// ---- Quello che passa fra la pagina e il processo principale ------------------

export interface RegistrazioneAnteprima {
  id: string
  data: string
  ora: string | null
  test_codice: string
  test_nome: string
  lato: LatoPedana | null
  num_valori: number
  ha_serie: boolean
  avvertenze: string[]
  // gia' nell'archivio di questo paziente: non verra' importata di nuovo
  gia_importata: boolean
}

// Un paziente che potrebbe essere quello del file, col grado di somiglianza
// del nome (da 0 a 1: 1 = stesse parole, in qualunque ordine).
export interface CandidatoPaziente {
  id: number
  nome: string
  cognome: string
  somiglianza: number
}

// Cosa c'e' nel file scelto, prima di importare. Il token riconosce il file
// letto quando si conferma: il contenuto resta nel processo principale.
// Il paziente non si abbina da solo: `proposto` e' solo il suggerimento da
// confermare (quello da cui si e' partiti, o il piu' somigliante).
export interface AnteprimaPedana {
  token: string
  nome_file: string
  app: string | null
  dispositivo: DispositivoPedana
  paziente_nome_file: string | null
  peso_kg: number | null
  candidati: CandidatoPaziente[]
  proposto: number | null
  registrazioni: RegistrazioneAnteprima[]
}

export interface EsitoImportPedana {
  importate: number
  saltate: number
}

export interface TestPedanaSalvato {
  id: number
  data: string
  ora: string | null
  test_codice: string
  test_nome: string
  categoria: string | null
  lato: LatoPedana | null
  peso_kg: number | null
  dispositivo_tipo: string | null
  dispositivo_modello: string | null
  condizioni: Record<string, unknown>
  avvertenze: string[]
  riassunto: string[]
  misure: MisuraPedana[]
  serie: SeriePedana[]
}

export interface ArchivioPedana {
  test: TestPedanaSalvato[]
  // il lato interessato scelto per un test (per codice del test)
  lati_interessati: Record<string, LatoPedana>
  // quello della scheda del paziente: vale dove per il test non e' stato scelto
  arto_operato: LatoPedana | null
}

// Il lato interessato per un test (la chiave e' quella di chiaveTestPedana):
// quello scelto per quel test, altrimenti l'arto operato del paziente,
// altrimenti nessuno.
export function latoInteressatoPer(
  chiaveTest: string,
  archivio: Pick<ArchivioPedana, 'lati_interessati' | 'arto_operato'>
): LatoPedana | null {
  return archivio.lati_interessati[chiaveTest] ?? archivio.arto_operato ?? null
}

// ---- Il riepilogo di un test nel tempo -------------------------------------

// Un test si riconosce dal codice. Fa eccezione il test personalizzato
// (`forza.custom`): il codice e' lo stesso per tutti, il nome scritto
// dall'utente li distingue. E' anche la chiave con cui si ricorda il lato
// interessato scelto per un test.
export function chiaveTestPedana(codice: string, nome: string): string {
  return codice === 'forza.custom' ? `${codice}|${nome}` : codice
}

// Due registrazioni di lati opposti dello stesso test si considerano lo
// stesso confronto se sono state fatte a non piu' di questi giorni una
// dall'altra: un lato il lunedi' e l'altro il martedi' e' un solo test.
export const GIORNI_VICINI_LATI = 7

export interface GiornoPedana {
  // una riga dell'elenco: un giorno, o la coppia destro/sinistro di giorni vicini
  data: string
  // il secondo giorno, se la coppia e' stata fatta in due giorni diversi
  dataFine: string | null
  dx: number | null
  sx: number | null
  // test bilaterali (salto, stabilometria): un valore solo
  unico: number | null
  // solo per la forza, dove c'e' un lato debole e uno forte
  lsi: number | null
  asimmetria: number | null
  avvertenze: string[]
  // le registrazioni della riga, la piu' recente prima
  test: TestPedanaSalvato[]
}

export interface GruppoPedana {
  chiave: string
  codice: string
  nome: string
  famiglia: FamigliaPedana
  // la misura che si legge nel riepilogo (vuota se nessun test ne ha)
  misura: { codice: string; nome: string; unita: string | null; meglio: VersoMisura | null }
  // c'e' almeno un valore per lato: ha senso il confronto e il lato interessato
  perLato: boolean
  latoInteressato: LatoPedana | null
  // dal giorno piu' recente
  giorni: GiornoPedana[]
  // la frase sul confronto piu' recente fra i due arti (solo forza)
  frase: string | null
  // quanto e' cambiato dal primo all'ultimo valore, in percentuale del primo
  variazione: {
    dal: string
    dx: number | null
    sx: number | null
    unico: number | null
  } | null
}

const variazionePct = (primo: number | null, ultimo: number | null): number | null =>
  primo !== null && ultimo !== null && primo !== 0
    ? arrotonda(((ultimo - primo) / Math.abs(primo)) * 100, 0)
    : null

const giorniFra = (a: string, b: string): number =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

// "Arto destro più forte di 12% rispetto al sinistro": di quanto il lato forte
// supera il debole, in percentuale del debole. Sotto l'1% sono uguali.
export function fraseForzaLati(dx: number | null, sx: number | null): string | null {
  if (dx === null || sx === null || dx <= 0 || sx <= 0) return null
  const forte = Math.max(dx, sx)
  const debole = Math.min(dx, sx)
  const percento = Math.round(((forte - debole) / debole) * 100)
  if (percento < 1) return 'Forza simmetrica fra i due arti.'
  return dx > sx
    ? `Arto destro più forte di ${percento}% rispetto al sinistro.`
    : `Arto sinistro più forte di ${percento}% rispetto al destro.`
}

function valorePrincipale(
  t: TestPedanaSalvato,
  codiceMisura: string,
  latoVoluto: LatoPedana | null
): number | null {
  const m = t.misure.find((x) => x.codice === codiceMisura)
  return m ? valoreDellaMisura(m, latoVoluto) : null
}

// Le righe di un test di forza: un lato solo per registrazione, quindi il
// confronto si ottiene mettendo insieme una registrazione destra e una
// sinistra fatte a pochi giorni di distanza (la piu' vicina, a parita' la
// prima). Chi resta senza compagno e' una riga con un lato solo.
function righeForza(
  test: TestPedanaSalvato[],
  codiceMisura: string,
  latoInteressato: LatoPedana | null,
  meglio: VersoMisura | null
): GiornoPedana[] {
  const ordine = [...test].sort(
    (a, b) =>
      a.data.localeCompare(b.data) || (a.ora ?? '').localeCompare(b.ora ?? '') || a.id - b.id
  )
  const usati = new Set<number>()
  const righe: GiornoPedana[] = []

  for (const t of ordine) {
    if (usati.has(t.id)) continue
    usati.add(t.id)
    let compagno: TestPedanaSalvato | null = null
    if (t.lato) {
      let migliore = Infinity
      for (const altro of ordine) {
        if (usati.has(altro.id) || altro.lato === null || altro.lato === t.lato) continue
        const distanza = giorniFra(t.data, altro.data)
        if (distanza <= GIORNI_VICINI_LATI && distanza < migliore) {
          migliore = distanza
          compagno = altro
        }
      }
    }
    if (compagno) usati.add(compagno.id)

    const coppia = compagno ? [t, compagno] : [t]
    let dx: number | null = null
    let sx: number | null = null
    for (const x of coppia) {
      if (x.lato === 'dx') dx = valorePrincipale(x, codiceMisura, 'dx')
      else if (x.lato === 'sx') sx = valorePrincipale(x, codiceMisura, 'sx')
    }
    const c = confrontaLati(dx, sx, latoInteressato, meglio)
    righe.push({
      data: t.data,
      dataFine: compagno && compagno.data !== t.data ? compagno.data : null,
      dx,
      sx,
      unico: null,
      lsi: c.lsi,
      asimmetria: c.asimmetria,
      avvertenze: [...new Set(coppia.flatMap((x) => x.avvertenze))],
      test: [...coppia].reverse()
    })
  }
  return righe.sort((a, b) => (b.dataFine ?? b.data).localeCompare(a.dataFine ?? a.data))
}

// Le altre famiglie: un giorno una riga, senza confronto fra i lati.
function righePerGiorno(test: TestPedanaSalvato[], codiceMisura: string): GiornoPedana[] {
  const perData = new Map<string, TestPedanaSalvato[]>()
  for (const t of test) {
    const lista = perData.get(t.data) ?? []
    lista.push(t)
    perData.set(t.data, lista)
  }
  const righe: GiornoPedana[] = []
  for (const [data, deiGiorno] of perData) {
    let dx: number | null = null
    let sx: number | null = null
    let unico: number | null = null
    for (const t of deiGiorno) {
      const m = t.misure.find((x) => x.codice === codiceMisura)
      if (!m) continue
      for (const l of latiDellaMisura(m)) {
        const v = valoreDellaMisura(m, l)
        if (l === 'dx') dx ??= v
        else if (l === 'sx') sx ??= v
        else unico ??= v
      }
    }
    righe.push({
      data,
      dataFine: null,
      dx,
      sx,
      unico,
      lsi: null,
      asimmetria: null,
      avvertenze: [...new Set(deiGiorno.flatMap((t) => t.avvertenze))],
      test: deiGiorno
    })
  }
  return righe
}

// Quanto e' cambiato un valore dal primo all'ultimo giorno in cui c'e'.
function variazioneDi(
  righeDalPiuRecente: GiornoPedana[],
  campo: 'dx' | 'sx' | 'unico'
): { dal: string; pct: number | null } | null {
  const conValore = righeDalPiuRecente.filter((r) => r[campo] !== null)
  if (conValore.length < 2) return null
  const ultimo = conValore[0]
  const primo = conValore[conValore.length - 1]
  return { dal: primo.data, pct: variazionePct(primo[campo], ultimo[campo]) }
}

// Il nome di un gruppo di test. Se i nomi non sono tutti uguali perche' dicono
// il lato ("Monopodalico sinistro" / "Monopodalico destro"), il gruppo li
// mette insieme e il lato si legge nelle righe e nelle colonne.
function nomeDelGruppo(nomi: string[]): string {
  if (new Set(nomi).size === 1) return nomi[0]
  const neutro = nomi[0]
    .replace(/\s+(destro|sinistro|destra|sinistra|dx|sx)\b/gi, '')
    .replace(/\s+([,;)])/g, '$1')
    .trim()
  return neutro || nomi[0]
}

export function riepilogoPedana(archivio: ArchivioPedana): GruppoPedana[] {
  const perChiave = new Map<string, TestPedanaSalvato[]>()
  for (const t of archivio.test) {
    const chiave = chiaveTestPedana(t.test_codice, t.test_nome)
    const lista = perChiave.get(chiave) ?? []
    lista.push(t)
    perChiave.set(chiave, lista)
  }

  const gruppi: GruppoPedana[] = []
  for (const [chiave, test] of perChiave) {
    const codice = test[0].test_codice
    const famiglia = famigliaDi(codice)
    const principale = misuraPrincipale(
      codice,
      test.flatMap((t) => t.misure)
    )
    // un test senza nessuna misura (nessuna ripetizione valida) resta in
    // elenco, con i suoi avvisi
    const misura = principale
      ? {
          codice: principale.codice,
          nome: principale.nome,
          unita: principale.unita,
          meglio: principale.meglio
        }
      : { codice: '', nome: '', unita: null, meglio: null }
    const latoInteressato = latoInteressatoPer(chiave, archivio)
    const perLato = test.some((t) => t.lato !== null)

    // test e' gia' dal piu' recente (vedi archivioPedana)
    const giorni =
      famiglia === 'forza'
        ? righeForza(test, misura.codice, latoInteressato, misura.meglio)
        : righePerGiorno(test, misura.codice)

    const conLati = giorni.find((g) => g.dx !== null && g.sx !== null)
    const dx = variazioneDi(giorni, 'dx')
    const sx = variazioneDi(giorni, 'sx')
    const unico = variazioneDi(giorni, 'unico')
    gruppi.push({
      chiave,
      codice,
      nome: nomeDelGruppo(test.map((t) => t.test_nome)),
      famiglia,
      misura,
      perLato,
      latoInteressato,
      giorni,
      frase: famiglia === 'forza' && conLati ? fraseForzaLati(conLati.dx, conLati.sx) : null,
      variazione:
        dx || sx || unico
          ? {
              dal: [dx?.dal, sx?.dal, unico?.dal].filter((d): d is string => !!d).sort()[0],
              dx: dx?.pct ?? null,
              sx: sx?.pct ?? null,
              unico: unico?.pct ?? null
            }
          : null
    })
  }
  return gruppi
}

// ---- Il nome del paziente nel file ---------------------------------------------

const paroleDelNome = (testo: string): string[] =>
  testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

// Differiscono al piu' di una lettera (una in piu', una in meno o una sbagliata).
function unaLetteraDiversa(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)
  const [corta, lunga] = a.length < b.length ? [a, b] : [b, a]
  return corta.slice(i) === lunga.slice(i + 1)
}

// Quanto il nome scritto nel file somiglia a un paziente: senza distinguere
// maiuscole e accenti, con nome e cognome in qualunque ordine ("Mario Rossi" e
// "Rossi Mario" sono la stessa persona), tollerando una lettera sbagliata nelle
// parole lunghe. 1 = stesse parole; 0.5 = una parola su due.
export function somiglianzaNomi(nomeNelFile: string, cognome: string, nome: string): number {
  const nelFile = paroleDelNome(nomeNelFile)
  const libere = paroleDelNome(`${cognome} ${nome}`)
  if (nelFile.length === 0 || libere.length === 0) return 0
  const totale = Math.max(nelFile.length, libere.length)
  let trovate = 0
  for (const parola of nelFile) {
    const i = libere.findIndex(
      (q) => q === parola || (parola.length >= 5 && q.length >= 5 && unaLetteraDiversa(parola, q))
    )
    if (i < 0) continue
    libere.splice(i, 1)
    trovate++
  }
  return trovate / totale
}

// Sotto questa soglia un paziente non si propone nemmeno come candidato.
export const SOGLIA_CANDIDATO = 0.5

// ---- Come e' stato fatto un test, in parole ----------------------------------

const ETICHETTE_CONDIZIONI: Record<string, (v: unknown) => string | null> = {
  sorgente: (v) => {
    const nomi: Record<string, string> = {
      total: 'tutta la pedana',
      topLeft: 'cella in alto a sinistra',
      topRight: 'cella in alto a destra',
      bottomLeft: 'cella in basso a sinistra',
      bottomRight: 'cella in basso a destra'
    }
    return typeof v === 'string' ? `Forza letta da: ${nomi[v] ?? v}` : null
  },
  variante: (v) => (typeof v === 'string' ? `Variante: ${v}` : null),
  durata_s: (v) => (typeof v === 'number' ? `Durata: ${v} s` : null),
  riposo_kg: (v) => (typeof v === 'number' ? `Carico a riposo: ${v} kg` : null),
  ripetizioni_non_valide: (v) =>
    typeof v === 'number' && v > 0
      ? `${v} ${v === 1 ? 'ripetizione non valida' : 'ripetizioni non valide'}`
      : null,
  altezza_cassetto_cm: (v) => (typeof v === 'number' ? `Altezza del cassetto: ${v} cm` : null),
  appoggio: (v) =>
    typeof v === 'string'
      ? `Appoggio: ${v.replace('monopodalico_sx', 'monopodalico sinistro').replace('monopodalico_dx', 'monopodalico destro')}`
      : null,
  occhi: (v) => (typeof v === 'string' ? `Occhi ${v}` : null),
  posizione_media_ml_mm: (v) =>
    typeof v === 'number' ? `Posizione media medio-laterale: ${v} mm` : null,
  posizione_media_ap_mm: (v) =>
    typeof v === 'number' ? `Posizione media antero-posteriore: ${v} mm` : null,
  eventi_serie_ms: (v) =>
    èOggetto(v)
      ? `Eventi nel salto (ms dall'inizio): ${Object.entries(v)
          .filter(([, t]) => typeof t === 'number')
          .map(([nome, t]) => `${nome.replace(/_/g, ' ')} ${t}`)
          .join(', ')}`
      : null
}

// Le condizioni di una registrazione come righe leggibili. Quelle che non si
// conoscono si saltano (l'app della pedana puo' aggiungerne): restano comunque
// salvate. Gli assi del tracciato (x_positivo, y_positivo) servono a
// disegnarlo, non a leggerlo.
export function condizioniLeggibili(condizioni: Record<string, unknown>): string[] {
  return Object.entries(condizioni)
    .map(([chiave, valore]) => ETICHETTE_CONDIZIONI[chiave]?.(valore) ?? null)
    .filter((riga): riga is string => riga !== null)
}
