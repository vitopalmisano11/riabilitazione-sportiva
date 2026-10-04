// Le sezioni della cartella del paziente: ognuna legge dal database quello che
// la riguarda e lo riduce a blocchi (vedi cartella-comune.ts). Per cambiare cosa
// compare in una sezione si lavora qui; l'ordine e la resa in HTML stanno in
// export-cartella.ts.
import { getDb } from './db'
import { COLORI_SINTOMI } from '../shared/sintomi'
import {
  TIPI_NEURO,
  durataTesto,
  faseDurata,
  tipiNeuro,
  type UnitaDurata
} from '../shared/sintomi'
import {
  type Blocco,
  coppie,
  data,
  eta,
  pieno,
  testo
} from './cartella-comune'
import {
  NOME_SEGNO,
  NOME_VISTA,
  type SegnoRiga,
  type SerieSintomo,
  VISTE_DI,
  figuraPiedeSvg,
  figuraSvg,
  graficoAndamento,
  intensita
} from './cartella-grafici'

// ---- sezioni ----

export function sezAnagrafica(p: Record<string, unknown>): Blocco[] {
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

// "3 settimane (fase acuta), da dopo la partita": il numero con la fase e il
// testo libero, quello che c'e'.
function daQuantoTempo(x: Record<string, unknown>): string | null {
  const numero = x.durata_numero == null ? null : Number(x.durata_numero)
  const unita = (x.durata_unita as UnitaDurata | null) ?? null
  const durata = durataTesto(numero, unita)
  const fase = faseDurata(numero, unita)
  const parti = [
    durata ? `${durata}${fase ? ` (fase ${fase})` : ''}` : null,
    pieno(x.da_quanto) ? String(x.da_quanto) : null
  ].filter((p): p is string => p != null)
  return parti.length > 0 ? parti.join(', ') : null
}

function intensitaNprs(x: Record<string, unknown>): string | null {
  const parti = (
    [
      ['attuale', x.nprs_attuale],
      ['peggiore', x.nprs_peggiore],
      ['migliore', x.nprs_migliore]
    ] as [string, unknown][]
  )
    .filter(([, v]) => v != null)
    .map(([nome, v]) => `${nome} ${v}/10`)
  return parti.length > 0 ? parti.join(' · ') : null
}

// "sì — formicolio o parestesie, perdita di forza — gamba sinistra"
function neurologici(a: Record<string, unknown> | undefined): string | null {
  const tipi = tipiNeuro(a?.neuro_tipi as string | null)
    .map((t) => TIPI_NEURO.find((x) => x.valore === t)?.frase)
    .filter((x): x is string => x != null)
  const risposta = siNoDettaglio(a?.neuro_sn, tipi.length ? tipi.join(', ') : null)
  const dettaglio = pieno(a?.sintomi_neurologici) ? String(a?.sintomi_neurologici) : null
  if (risposta && dettaglio) return `${risposta} — ${dettaglio}`
  return risposta ?? dettaglio
}

// Il si'/no col dettaglio accanto: "sì — si sveglia verso le 4".
function siNoDettaglio(sn: unknown, dettaglio: unknown): string | null {
  const risposta = sn === 1 ? 'sì' : sn === 0 ? 'no' : null
  const d = pieno(dettaglio) ? String(dettaglio) : null
  if (risposta && d) return `${risposta} — ${d}`
  return risposta ?? d
}

export function sezAnamnesi(pazienteId: number): Blocco[] {
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
        ['Da quanto tempo', daQuantoTempo(x)],
        // si registra "primo" o "recidiva": sul foglio va la parola intera
        ['Episodio', x.episodio === 'primo' ? 'primo episodio' : x.episodio],
        ['Esordio', x.esordio_modo],
        ['Traumatico', x.traumatico == null ? null : x.traumatico ? 'sì' : 'no'],
        ['Come è iniziato', x.esordio],
        ['Intensità del dolore (NPRS)', intensitaNprs(x)],
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
      ['Dolore o sintomi notturni', siNoDettaglio(a?.notturno_sn, a?.dolore_notturno)],
      ['Disturbi del sonno', siNoDettaglio(a?.sonno_sn, a?.disturbi_sonno)],
      ['Tosse o starnuto', a?.tosse_starnuto],
      ['Sintomi neurologici', neurologici(a)]
    ]),
    ...testo('Relazione fra i sintomi', a?.relazione_sintomi),
    ...testo('Attività', att?.attivita),
    ...testo('Partecipazione', att?.partecipazione),
    ...testo('Impairment psicologici e fattori interni', att?.fattori_interni),
    ...testo('Note', a?.note)
  ]
}

export function sezRemota(pazienteId: number): Blocco[] {
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
    ...testo('Altre patologie e farmaci', r?.patologie),
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

export function sezBodyChart(pazienteId: number): Blocco[] {
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

export function sezValutazioni(pazienteId: number): Blocco[] {
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

  const paziente = db.prepare('SELECT arto_operato FROM pazienti WHERE id = ?').get(pazienteId) as
    | { arto_operato: 'dx' | 'sx' | null }
    | undefined
  const interessato = paziente?.arto_operato ?? null
  const nomeLato = (l: unknown): string => (l === 'dx' ? 'destra' : l === 'sx' ? 'sinistra' : '')

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
          `SELECT m.id, m.nome, m.gradi, vm.lato, vm.norma, vm.passivo_norma, vm.attivo_restrizione,
                  vm.attivo_dolore, vm.attivo_gradi, vm.passivo_restrizione, vm.passivo_dolore,
                  vm.passivo_gradi
           FROM distretto_movimenti m
           JOIN valutazione_movimenti vm
             ON vm.movimento_id = m.id AND vm.valutazione_id = ?
           WHERE m.distretto_id = ? ORDER BY m.ordine, m.id, vm.lato`
        )
        .all(v.id, d.id) as Record<string, unknown>[]
      const compilati = movimenti.filter(
        (m) =>
          m.attivo_restrizione != null ||
          m.attivo_dolore != null ||
          m.passivo_restrizione != null ||
          m.passivo_dolore != null ||
          m.attivo_gradi != null ||
          m.passivo_gradi != null ||
          m.norma === 1 ||
          m.passivo_norma === 1
      )
      const test = db
        .prepare(
          `SELECT t.nome, t.gruppo, vt.lato, vt.valore, vt.nota
           FROM distretto_test t
           JOIN valutazione_test vt ON vt.test_id = t.id AND vt.valutazione_id = ?
           WHERE t.distretto_id = ? ORDER BY t.ordine, t.id, vt.lato`
        )
        .all(v.id, d.id) as Record<string, unknown>[]
      if (compilati.length === 0 && test.length === 0) return []

      // Stesse colonne della tabella nell'app: restrizione e dolore separati,
      // altrimenti "moder. · moder." non si capisce a quale delle due si
      // riferisce. Le colonne dei gradi compaiono solo se in questo distretto
      // c'e' almeno un movimento che si misura.
      const conGradi = compilati.some((m) => Number(m.gradi) === 1)
      const conLati = compilati.some((m) => m.lato === 'dx' || m.lato === 'sx')

      // Il confronto fra i due lati, dove ci sono i gradi di tutti e due: il
      // lato interessato rispetto al sano, oppure — se non si sa quale sia —
      // quanto sono diversi.
      const confronti: string[] = []
      const perMovimento = new Map<number, Record<string, unknown>[]>()
      for (const m of compilati) {
        const lista = perMovimento.get(Number(m.id)) ?? []
        lista.push(m)
        perMovimento.set(Number(m.id), lista)
      }
      for (const lista of perMovimento.values()) {
        const dx = lista.find((m) => m.lato === 'dx')
        const sx = lista.find((m) => m.lato === 'sx')
        if (!dx || !sx) continue
        for (const [campo, tipo] of [
          ['attivo_gradi', 'attivo'],
          ['passivo_gradi', 'passivo']
        ] as const) {
          const a = dx[campo] == null ? null : Number(dx[campo])
          const b = sx[campo] == null ? null : Number(sx[campo])
          if (a == null || b == null) continue
          let esito = ''
          if (interessato) {
            const int = interessato === 'dx' ? a : b
            const sano = interessato === 'dx' ? b : a
            if (sano !== 0) {
              const d = Math.round(((int - sano) / Math.abs(sano)) * 100)
              esito = ` — lato interessato ${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}%`
            }
          } else if (Math.max(a, b) !== 0) {
            esito = ` — differenza ${Math.round((Math.abs(a - b) / Math.max(a, b)) * 100)}%`
          }
          confronti.push(
            `${String(dx.nome)} ${tipo}: destra ${a}°${interessato === 'dx' ? ' (interessato)' : ''}, sinistra ${b}°${interessato === 'sx' ? ' (interessato)' : ''}${esito}`
          )
        }
      }
      const tabella: Blocco[] =
        compilati.length === 0
          ? []
          : [
              {
                tipo: 'tabella',
                intestazioni: [
                  'Movimento',
                  ...(conLati ? ['Lato'] : []),
                  'Attivo · restrizione',
                  'Attivo · dolore',
                  ...(conGradi ? ['Attivo °'] : []),
                  'Passivo · restrizione',
                  'Passivo · dolore',
                  ...(conGradi ? ['Passivo °'] : [])
                ],
                // "nella norma" nella colonna della restrizione del suo
                // movimento, attivo o passivo; accanto al nome se lo sono tutti
                // e due
                righe: compilati.map((m) => [
                  m.norma === 1 && m.passivo_norma === 1
                    ? `${String(m.nome)} (nella norma)`
                    : String(m.nome),
                  ...(conLati ? [nomeLato(m.lato)] : []),
                  m.norma === 1 && m.passivo_norma !== 1 ? 'nella norma' : g(m.attivo_restrizione),
                  dol(m.attivo_dolore),
                  ...(conGradi ? [num(m.attivo_gradi)] : []),
                  m.passivo_norma === 1 && m.norma !== 1 ? 'nella norma' : g(m.passivo_restrizione),
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
                // Un test per voce: con i due lati "Lachman: destra positivo,
                // sinistra negativo", e la nota del test in fondo.
                tipo: 'elenco',
                voci: [...new Set(test.map((t) => String(t.nome)))].map((nome) => {
                  const righe = test.filter((t) => String(t.nome) === nome)
                  const esiti = righe
                    .filter((t) => t.valore != null || !t.lato)
                    .map((t) => `${t.lato ? `${nomeLato(t.lato)} ` : ''}${t.valore ?? '—'}`)
                  const note = [...new Set(righe.map((t) => t.nota).filter(Boolean))]
                  return `${nome}: ${esiti.join(', ') || '—'}${note.length ? ` (${note.join('; ')})` : ''}`
                })
              }
            ]
      return [
        { tipo: 'sottotitolo', testo: d.nome },
        ...tabella,
        ...(confronti.length > 0 ? testo('Confronto fra i due lati', confronti.join('\n')) : []),
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

export function sezQuestionari(pazienteId: number): Blocco[] {
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

export function sezObiettivi(pazienteId: number): Blocco[] {
  const db = getDb()
  const righe = db
    .prepare(
      'SELECT testo, termine FROM obiettivi_terapeutici WHERE paziente_id = ? ORDER BY ordine, id'
    )
    .all(pazienteId) as { testo: string; termine: string }[]
  // Le aspettative del paziente aprono la sezione: sono il perche' degli
  // obiettivi che seguono.
  const attese = (
    db.prepare('SELECT aspettative FROM pazienti WHERE id = ?').get(pazienteId) as
      | { aspettative: string | null }
      | undefined
  )?.aspettative
  const apertura = testo('Aspettative del paziente', attese)
  if (righe.length === 0) return apertura

  const gruppi: [string, string][] = [
    ['breve', 'Breve termine'],
    ['medio', 'Medio termine'],
    ['lungo', 'Lungo termine']
  ]
  return apertura.concat(
    gruppi.flatMap(([chiave, titolo]): Blocco[] => {
      const suoi = righe.filter((r) => r.termine === chiave)
      if (suoi.length === 0) return []
      return [
        { tipo: 'sottotitolo', testo: titolo },
        { tipo: 'elenco', voci: suoi.map((r) => r.testo) }
      ]
    })
  )
}

// Delle sedute nella cartella restano solo le date: a chi legge serve sapere
// quando e quante, non l'elenco degli esercizi di ogni volta. Il programma
// dettagliato si esporta a parte, dal diario.
// Il diario: per ogni seduta la data e la fase, e — se scritti — cosa ha
// riferito il paziente, il trattamento eseguito e il dolore. Gli esercizi no:
// stanno nei programmi, e qui farebbero una cartella di venti pagine.
const PAROLA_ANDAMENTO: Record<string, string> = {
  meglio: 'meglio',
  uguale: 'uguale',
  peggio: 'peggio'
}

export function sezSedute(pazienteId: number): Blocco[] {
  const sedute = getDb()
    .prepare(
      `SELECT s.data, f.nome AS fase_nome, s.riferito_andamento, s.riferito, s.trattamento,
              s.dolore,
              (SELECT GROUP_CONCAT(t.nome, ', ') FROM seduta_tecniche st
                 JOIN tecniche t ON t.id = st.tecnica_id WHERE st.seduta_id = s.id) AS tecniche
       FROM sedute s LEFT JOIN fasi f ON f.id = s.fase_id
       WHERE s.paziente_id = ? ORDER BY s.data DESC, s.id DESC`
    )
    .all(pazienteId) as {
    data: string
    fase_nome: string | null
    riferito_andamento: string | null
    riferito: string | null
    trattamento: string | null
    dolore: number | null
    tecniche: string | null
  }[]
  if (sedute.length === 0) return []

  return [
    {
      tipo: 'testo',
      corpo: sedute.length === 1 ? '1 seduta svolta' : `${sedute.length} sedute svolte`
    },
    {
      tipo: 'elenco',
      // al massimo 10 per colonna, poi la prossima si affianca: tre colonne
      // per riquadro, trenta sedute per riga
      perColonna: 10,
      voci: sedute.map((s) => {
        const riferisce = [
          s.riferito_andamento ? PAROLA_ANDAMENTO[s.riferito_andamento] : null,
          pieno(s.riferito) ? s.riferito : null
        ]
          .filter(Boolean)
          .join(', ')
        const trattamento = [s.tecniche, pieno(s.trattamento) ? s.trattamento : null]
          .filter(Boolean)
          .join('; ')
        const parti = [
          riferisce ? `riferisce: ${riferisce}` : null,
          trattamento ? `trattamento: ${trattamento}` : null,
          s.dolore != null ? `dolore ${s.dolore}/10` : null
        ].filter(Boolean)
        return `${data(s.data)}${s.fase_nome ? ` — ${s.fase_nome}` : ''}${
          parti.length ? ` · ${parti.join(' · ')}` : ''
        }`
      })
    }
  ]
}
