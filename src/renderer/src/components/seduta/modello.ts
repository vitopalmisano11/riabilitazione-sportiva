// La seduta in costruzione, senza React: le forme dei dati e tutto quello che
// le trasforma. SedutaBuilder e i suoi pezzi chiamano queste funzioni; le prove
// in test/costruzione-seduta.test.ts le chiamano direttamente.
//
// Niente DOM e niente window qui dentro: questo file si compila anche con le
// prove, che girano senza browser.
import type {
  AndamentoRiferito,
  Categoria,
  EsercizioConCategoria,
  EsitoProgressione,
  EsitoSeduta,
  SedutaEsercizioDettaglio,
  SedutaInput,
  Segno,
  StatoProgressione,
  UltimaVolta
} from '../../../../shared/types'
import { caricoTesto, recuperoTesto, rirTesto, volumeTesto } from '../../../../shared/dosaggio'
import { sposta } from '../../sposta'

// Una riga della seduta in costruzione. chiaveVolo e' una chiave locale, mai
// salvata e mai vista dal database: serve solo a dare alla lista di React
// qualcosa di stabile per le righe "al volo" (esercizio_id null), che
// altrimenti sarebbero tutte indistinguibili l'una dall'altra.
export type RigaBuilder = SedutaEsercizioDettaglio & { chiaveVolo?: number }

export interface SezioneBuilder {
  sezione_id: number | null
  nome: string
  righe: RigaBuilder[]
}

// I campi della seduta fuori dagli esercizi.
export interface CampiSeduta {
  data: string
  // L'orario dell'appuntamento: facoltativo, serve a ordinare la settimana.
  ora: string
  faseId: number | null
  faseNome: string | null
  // Di cosa e' fatta la giornata. Testo libero, con i suggerimenti di quelli
  // gia' usati.
  focus: string
  // Come e' andata: due numeri da 0 a 10, vuoti se non li si chiede.
  dolore: string
  sforzo: string
  // La misura di oggi dei segni di riferimento, come e' stata scritta.
  misure: Record<number, string>
  note: string
  // Il diario: come sta tornando e cosa gli si fa oggi.
  riferitoAndamento: AndamentoRiferito | null
  riferito: string
  tecnicaIds: number[]
  trattamento: string
  // Come sono andati gli esercizi delle progressioni, per progressione. Non
  // segnare niente vuol dire "continua": non c'e' un terzo valore.
  esiti: Record<number, EsitoProgressione>
}

// Quello che si sta componendo, messo da parte cosi' com'e'. La forma e'
// quella scritta dalle versioni di prima: una bozza lasciata da loro si
// riprende uguale.
export interface BozzaSeduta {
  data: string
  ora?: string
  faseId: number | null
  focus?: string
  riferitoAndamento?: AndamentoRiferito | null
  riferito?: string
  tecnicaIds?: number[]
  trattamento?: string
  // Solo se ce ne sono: una bozza senza esiti ha la stessa forma di sempre.
  esiti?: Record<number, EsitoProgressione>
  note: string
  sezioni: SezioneBuilder[]
}

export type CampoRiga =
  | 'serie'
  | 'cluster'
  | 'ripetizioni'
  | 'rir'
  | 'carico'
  | 'recupero_cluster'
  | 'recupero'
  | 'nota'

// ---- le sezioni, con la loro storia per Ctrl+Z ----

export interface StatoSezioni {
  sezioni: SezioneBuilder[]
  // com'erano le sezioni prima di ogni cambiamento, dal piu' vecchio
  storia: { sezioni: SezioneBuilder[]; cosa: string }[]
}

export type AzioneSezioni =
  // senza storia: il caricamento, una lettera scritta in una casella, un
  // passo intermedio di un trascinamento
  | { tipo: 'imposta'; sezioni: SezioneBuilder[] }
  | { tipo: 'valore'; sez: number; riga: number; campo: CampoRiga; valore: string }
  // con storia: si annullano con Ctrl+Z
  | { tipo: 'aggiungi'; sez: number; esercizio: EsercizioConCategoria }
  | { tipo: 'alVolo'; sez: number; nome: string; chiave: number }
  | { tipo: 'ricopia'; sez: number; riga: number; ultima: UltimaVolta }
  | { tipo: 'togliRiga'; sez: number; riga: number }
  | { tipo: 'rinomina'; sez: number; nome: string }
  | { tipo: 'togliSezione'; sez: number }
  | { tipo: 'nuovaSezione'; nome: string }
  | { tipo: 'spostaSezione'; da: number; a: number; primo: boolean }
  | { tipo: 'spostaRiga'; sez: number; da: number; a: number; primo: boolean }
  | { tipo: 'annulla' }

const MASSIMO_STORIA = 50

export function rigaDaLibreria(e: EsercizioConCategoria): RigaBuilder {
  return {
    esercizio_id: e.id,
    nome_libero: null,
    nome: e.nome,
    categoria_nome: e.categoria_nome,
    unita_carico: e.unita_carico,
    serie: e.serie_default,
    cluster: e.cluster_default,
    ripetizioni: e.ripetizioni_default,
    rir: e.rir_default,
    carico: e.carico_default,
    recupero_cluster: e.recupero_cluster_default,
    recupero: e.recupero_default,
    nota: null,
    link: e.link,
    ha_immagine: e.ha_immagine
  }
}

// Un esercizio "al volo": una variante scritta li' per li', che vale solo
// per questa seduta. Non tocca la libreria e non ha categoria, dosaggi di
// default, foto o link: solo il nome, e i campi della riga (serie,
// ripetizioni, carico...) restano da compilare come per tutti gli altri.
export function rigaAlVolo(nome: string, chiave: number): RigaBuilder {
  return {
    esercizio_id: null,
    nome_libero: nome,
    nome,
    categoria_nome: null,
    unita_carico: null,
    serie: null,
    cluster: null,
    ripetizioni: null,
    rir: null,
    carico: null,
    recupero_cluster: null,
    recupero: null,
    nota: null,
    link: null,
    ha_immagine: 0,
    chiaveVolo: chiave
  }
}

const inSezione = (
  sezioni: SezioneBuilder[],
  idx: number,
  cambia: (s: SezioneBuilder) => SezioneBuilder
): SezioneBuilder[] => sezioni.map((s, i) => (i === idx ? cambia(s) : s))

const inRiga = (
  sezioni: SezioneBuilder[],
  sez: number,
  riga: number,
  cambia: (r: RigaBuilder) => RigaBuilder
): SezioneBuilder[] =>
  inSezione(sezioni, sez, (s) => ({ ...s, righe: s.righe.map((r, j) => (j === riga ? cambia(r) : r)) }))

// Il nuovo stato delle sezioni dopo un'azione, e cosa e' successo (per la
// storia e per l'avviso). null = l'azione non cambia niente.
function applica(sezioni: SezioneBuilder[], a: AzioneSezioni): { sezioni: SezioneBuilder[]; cosa: string } | null {
  switch (a.tipo) {
    case 'aggiungi': {
      const s = sezioni[a.sez]
      if (!s || s.righe.some((r) => r.esercizio_id === a.esercizio.id)) return null
      // L'esercizio nuovo si infila subito dopo l'ultimo della sua categoria,
      // non in fondo: cosi' l'elenco resta raggruppato da solo e ogni categoria
      // ha una sola intestazione, anche aggiungendo gli esercizi in ordine sparso.
      let dopo = -1
      s.righe.forEach((r, k) => {
        if (r.categoria_nome === a.esercizio.categoria_nome) dopo = k
      })
      const righe = [...s.righe]
      righe.splice(dopo + 1 === 0 ? righe.length : dopo + 1, 0, rigaDaLibreria(a.esercizio))
      return { sezioni: inSezione(sezioni, a.sez, (x) => ({ ...x, righe })), cosa: `aggiunto ${a.esercizio.nome}` }
    }
    case 'alVolo': {
      const nome = a.nome.trim()
      if (!nome || !sezioni[a.sez]) return null
      // Nessun raggruppamento per categoria: un esercizio al volo non ne ha
      // una, quindi finisce semplicemente in fondo alla sezione.
      return {
        sezioni: inSezione(sezioni, a.sez, (s) => ({ ...s, righe: [...s.righe, rigaAlVolo(nome, a.chiave)] })),
        cosa: `aggiunto ${nome} (solo per questa seduta)`
      }
    }
    case 'ricopia': {
      // Rimette in riga i numeri dell'ultima volta, tutti insieme: da li' si
      // decide se aumentare o no, che e' il gesto vero della progressione.
      const nome = sezioni[a.sez]?.righe[a.riga]?.nome ?? 'un esercizio'
      const u = a.ultima
      return {
        sezioni: inRiga(sezioni, a.sez, a.riga, (r) => ({
          ...r,
          serie: u.serie,
          cluster: u.cluster,
          ripetizioni: u.ripetizioni,
          rir: u.rir,
          carico: u.carico,
          recupero_cluster: u.recupero_cluster,
          recupero: u.recupero
        })),
        cosa: `ricopiati i numeri di ${nome}`
      }
    }
    case 'togliRiga': {
      const nome = sezioni[a.sez]?.righe[a.riga]?.nome ?? 'esercizio'
      return {
        sezioni: inSezione(sezioni, a.sez, (s) => ({ ...s, righe: s.righe.filter((_, j) => j !== a.riga) })),
        cosa: `tolto ${nome}`
      }
    }
    case 'rinomina': {
      const nome = a.nome.trim()
      if (!nome) return null
      return { sezioni: inSezione(sezioni, a.sez, (s) => ({ ...s, nome })), cosa: 'rinominata una sezione' }
    }
    case 'togliSezione': {
      const s = sezioni[a.sez]
      if (!s) return null
      return { sezioni: sezioni.filter((_, i) => i !== a.sez), cosa: `tolta la sezione ${s.nome}` }
    }
    case 'nuovaSezione': {
      const nome = a.nome.trim()
      if (!nome) return null
      return { sezioni: [...sezioni, { sezione_id: null, nome, righe: [] }], cosa: `aggiunta la sezione ${nome}` }
    }
    case 'spostaSezione':
      return { sezioni: sposta(sezioni, a.da, a.a), cosa: 'spostata una sezione' }
    case 'spostaRiga':
      return {
        sezioni: inSezione(sezioni, a.sez, (s) => ({ ...s, righe: sposta(s.righe, a.da, a.a) })),
        cosa: 'spostato un esercizio'
      }
    default:
      return null
  }
}

export function riduciSezioni(stato: StatoSezioni, a: AzioneSezioni): StatoSezioni {
  switch (a.tipo) {
    case 'imposta':
      return { ...stato, sezioni: a.sezioni }
    case 'valore':
      // una lettera scritta non entra nella storia: Ctrl+Z dentro a una
      // casella annulla il testo, come sempre
      return { ...stato, sezioni: inRiga(stato.sezioni, a.sez, a.riga, (r) => ({ ...r, [a.campo]: a.valore })) }
    case 'annulla': {
      const ultima = stato.storia[stato.storia.length - 1]
      if (!ultima) return stato
      return { sezioni: ultima.sezioni, storia: stato.storia.slice(0, -1) }
    }
    default: {
      const fatto = applica(stato.sezioni, a)
      if (!fatto) return stato
      // Trascinando, le sezioni si spostano passo passo: nella storia ne finisce
      // uno solo, quello di partenza, altrimenti annullare uno spostamento
      // vorrebbe dire premere Ctrl+Z una volta per ogni posto scavalcato.
      const conStoria = !('primo' in a) || a.primo
      if (!conStoria) return { ...stato, sezioni: fatto.sezioni }
      const storia = [...stato.storia, { sezioni: stato.sezioni, cosa: fatto.cosa }].slice(-MASSIMO_STORIA)
      return { sezioni: fatto.sezioni, storia }
    }
  }
}

// ---- cosa proporre e cosa mostrare ----

// Esercizi proposti per una sezione: quelli delle sue categorie, nell'ordine
// configurato. Agganciare una categoria vuol dire prendere anche quelle che ci
// stanno dentro: la sezione "Rinforzo" propone quadricipite e spalla senza che
// siano state spuntate una per una.
export function proposte(
  s: SezioneBuilder,
  templateCats: Record<number, number[]>,
  categorie: Categoria[],
  libreria: EsercizioConCategoria[]
): EsercizioConCategoria[] {
  if (s.sezione_id == null) return []
  const cats = templateCats[s.sezione_id] ?? []
  const conDentro: number[] = []
  for (const cid of cats) {
    if (!conDentro.includes(cid)) conDentro.push(cid)
    for (const c of categorie) {
      if (c.padre_id === cid && !conDentro.includes(c.id)) conDentro.push(c.id)
    }
  }
  return conDentro.flatMap((cid) => libreria.filter((e) => e.categoria_id === cid))
}

// Cosa elencare sotto alla casella di ricerca di una sezione. Cercando si trova
// per nome, ma anche per categoria: spesso non si ha in mente un esercizio
// preciso ("mi serve qualcosa di propriocettiva"), si ha in mente il tipo di lavoro.
export function daProporre(
  s: SezioneBuilder,
  testoRicerca: string,
  templateCats: Record<number, number[]>,
  categorie: Categoria[],
  libreria: EsercizioConCategoria[]
): EsercizioConCategoria[] {
  const ricerca = testoRicerca.trim().toLowerCase()
  const presenti = new Set(s.righe.map((r) => r.esercizio_id))
  const nomeCategoria = (cid: number): string => categorie.find((c) => c.id === cid)?.nome ?? '?'
  if (ricerca.length >= 2) {
    return libreria
      .filter(
        (e) =>
          !presenti.has(e.id) &&
          (e.nome.toLowerCase().includes(ricerca) || nomeCategoria(e.categoria_id).toLowerCase().includes(ricerca))
      )
      .slice(0, 12)
  }
  return proposte(s, templateCats, categorie, libreria).filter((e) => !presenti.has(e.id))
}

// ---- suggerimenti dalle progressioni ----

export type StepSuggerito = StatoProgressione['step'][number]

export interface GruppoSuggerito {
  progressione: StatoProgressione
  // l'indice (da 0) dello step da cui si parte
  base: number
  // lo step di partenza e, subito dopo, quello successivo (il primo ha
  // indice 0): ognuno con la sua posizione nella scala
  righe: { step: StepSuggerito; indice: number }[]
}

// Per ogni progressione ancora aperta, lo step a cui e' il paziente e solo
// quello dopo. Se in seduta c'e' gia' un esercizio della scala piu' avanti
// dello step salvato, si parte da quello: non si ripropone il wall sit quando
// in seduta c'e' gia' lo squat. Scrivendo, restano solo gli step il cui
// esercizio ha quel testo nel nome; le progressioni senza nessuno step che
// corrisponde spariscono.
export function suggerimentiProgressioni(
  stati: StatoProgressione[],
  inSeduta: Set<number>,
  testoRicerca: string
): GruppoSuggerito[] {
  const q = testoRicerca.trim().toLowerCase()
  const gruppi: GruppoSuggerito[] = []
  for (const p of stati) {
    if (p.completata) continue
    const piuAvanti = p.step.reduce((max, s, k) => (inSeduta.has(s.esercizio_id) ? k : max), -1)
    const base = Math.max(p.posizione, piuAvanti)
    const righe = p.step
      .slice(base, base + 2)
      .map((step, i) => ({ step, indice: i }))
      .filter((r) => q === '' || r.step.esercizio_nome.toLowerCase().includes(q))
    if (righe.length > 0) gruppi.push({ progressione: p, base, righe })
  }
  return gruppi
}

// I campi del cluster si vedono solo dove servono: nelle categorie che lo
// prevedono (la pliometria estensiva), oppure su una riga che un dosaggio a
// cluster ce l'ha gia' — cosi' una seduta vecchia resta modificabile anche se
// nel frattempo la categoria e' cambiata. Un esercizio "al volo" non ha
// categoria: niente cluster a meno che la riga non abbia gia' un valore.
export const mostraCluster = (r: { categoria_nome: string | null; cluster: string | null }, categorie: Categoria[]): boolean =>
  (r.cluster ?? '') !== '' || categorie.some((c) => c.nome === r.categoria_nome && c.dosaggio_cluster === 1)

// La casellina del RIR compare dove la categoria la prevede, e comunque dove
// un numero c'e' gia'.
export const mostraRir = (r: { categoria_nome: string | null; rir: string | null }, categorie: Categoria[]): boolean =>
  (r.rir ?? '') !== '' || categorie.some((c) => c.nome === r.categoria_nome && c.dosaggio_rir === 1)

// Cosa aveva fatto l'ultima volta, gia' scritto come si legge.
export const testoUltima = (r: SedutaEsercizioDettaglio, u: UltimaVolta): string =>
  [volumeTesto(u), rirTesto(u), caricoTesto(u.carico, r.unita_carico), recuperoTesto(u)].filter(Boolean).join(' · ')

// ---- prima di salvare ----

export const totaleEsercizi = (sezioni: SezioneBuilder[]): number =>
  sezioni.reduce((n, s) => n + s.righe.length, 0)

// Una seduta e' vera se c'e' scritto o messo qualcosa: solo tecniche,
// trattamento, cosa riferisce, note o esercizi.
export const haQualcosa = (c: CampiSeduta, sezioni: SezioneBuilder[]): boolean =>
  totaleEsercizi(sezioni) > 0 ||
  c.tecnicaIds.length > 0 ||
  c.trattamento.trim() !== '' ||
  c.riferito.trim() !== '' ||
  c.riferitoAndamento != null ||
  c.note.trim() !== ''

// Niente da mettere da parte: la bozza non si scrive.
export const bozzaVuota = (c: CampiSeduta, sezioni: SezioneBuilder[]): boolean =>
  totaleEsercizi(sezioni) === 0 &&
  c.note.trim() === '' &&
  c.focus.trim() === '' &&
  c.riferitoAndamento == null &&
  c.riferito.trim() === '' &&
  c.tecnicaIds.length === 0 &&
  c.trattamento.trim() === ''

export function inBozza(c: CampiSeduta, sezioni: SezioneBuilder[]): BozzaSeduta {
  return {
    data: c.data,
    ora: c.ora || undefined,
    faseId: c.faseId,
    focus: c.focus,
    riferitoAndamento: c.riferitoAndamento,
    riferito: c.riferito,
    tecnicaIds: c.tecnicaIds,
    trattamento: c.trattamento,
    esiti: Object.keys(c.esiti).length > 0 ? c.esiti : undefined,
    note: c.note,
    sezioni
  }
}

// I campi da rimettere riprendendo una bozza (la fase la decide chi la riprende).
export function campiDaBozza(b: BozzaSeduta): Partial<CampiSeduta> {
  return {
    data: b.data,
    ora: b.ora ?? '',
    focus: b.focus ?? '',
    note: b.note,
    riferitoAndamento: b.riferitoAndamento ?? null,
    riferito: b.riferito ?? '',
    tecnicaIds: b.tecnicaIds ?? [],
    trattamento: b.trattamento ?? '',
    esiti: b.esiti ?? {}
  }
}

// Gli esiti da scrivere con la seduta: solo di una progressione che ha ancora
// un esercizio in seduta (se l'esercizio e' stato tolto, l'esito non ha piu'
// senso) e solo se la seduta e' di oggi o di un giorno passato: una seduta
// programmata per il futuro non e' ancora andata in nessun modo.
export function esitiDaSalvare(
  esiti: Record<number, EsitoProgressione>,
  stati: StatoProgressione[],
  sezioni: SezioneBuilder[],
  data: string,
  oggi: string
): EsitoSeduta[] {
  if (data > oggi) return []
  const inSeduta = new Set(sezioni.flatMap((s) => s.righe.map((r) => r.esercizio_id)))
  return stati
    .filter((p) => esiti[p.id] != null && p.step.some((s) => inSeduta.has(s.esercizio_id)))
    .map((p) => ({ progressione_id: p.id, esito: esiti[p.id] }))
}

// Una misura scritta ma non numerica ("5-6", "circa 7") non si puo' salvare:
// prima veniva scartata senza dire niente, e sembrava registrata.
export function misuraNonNumerica(segni: Segno[], misure: Record<number, string>): Segno | null {
  return (
    segni.find((g) => {
      const testo = (misure[g.id] ?? '').trim()
      return testo !== '' && Number.isNaN(Number(testo.replace(',', '.')))
    }) ?? null
  )
}

export function inputSeduta(
  pazienteId: number,
  c: CampiSeduta,
  sezioni: SezioneBuilder[],
  segni: Segno[],
  progressioni: EsitoSeduta[] = []
): SedutaInput {
  return {
    paziente_id: pazienteId,
    data: c.data,
    ora: c.ora || null,
    fase_id: c.faseId,
    focus: c.focus.trim() || null,
    dolore: c.dolore === '' ? null : Number(c.dolore),
    sforzo: c.sforzo === '' ? null : Number(c.sforzo),
    // Solo i segni che hai misurato davvero: una casella lasciata vuota non
    // e' uno zero.
    segni: segni
      .map((g) => ({ segno_id: g.id, valore: Number((c.misure[g.id] ?? '').replace(',', '.')) }))
      .filter((v) => (c.misure[v.segno_id] ?? '').trim() !== '' && !Number.isNaN(v.valore)),
    riferito_andamento: c.riferitoAndamento,
    riferito: c.riferito.trim() || null,
    tecnica_ids: c.tecnicaIds,
    trattamento: c.trattamento.trim() || null,
    note: c.note.trim() || null,
    progressioni,
    sezioni: sezioni.map((s) => ({ sezione_id: s.sezione_id, nome: s.nome })),
    esercizi: sezioni.flatMap((s, i) =>
      s.righe.map((r) => ({
        esercizio_id: r.esercizio_id,
        nome_libero: r.nome_libero,
        serie: r.serie?.trim() || null,
        cluster: r.cluster?.trim() || null,
        ripetizioni: r.ripetizioni?.trim() || null,
        rir: r.rir?.trim() || null,
        carico: r.carico?.trim() || null,
        recupero_cluster: r.recupero_cluster?.trim() || null,
        recupero: r.recupero?.trim() || null,
        nota: r.nota?.trim() || null,
        sezioneIndex: i
      }))
    )
  }
}
