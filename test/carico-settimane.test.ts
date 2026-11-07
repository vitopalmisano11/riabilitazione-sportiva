// Il carico settimana per settimana (shared/carico-settimane.ts) e la sua lettura
// dall'archivio (caricoPaziente in main/dose.ts).
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  avvisoCarico,
  caricoSettimane,
  esitoCarico,
  type SedutaCarico,
  type SettimanaCarico
} from '../src/shared/carico-settimane'
import type { CategoriaConto, RigaConto } from '../src/shared/dose'
import { caricoPaziente, salvaDoseFase } from '../src/main/dose'
import { creaEsercizio, impostaContaCome } from '../src/main/esercizi'
import { impostaSeduteSettimana } from '../src/main/pazienti'
import { creaSeduta } from '../src/main/sedute'
import type { SedutaInput } from '../src/shared/types'

archivioDiProva()

// 1 = pliometria estensiva, 2 = rinforzo (forza), 3 = quadricipite dentro al rinforzo
const CATEGORIE: CategoriaConto[] = [
  { id: 1, padre_id: null, conta_come: 'plio_est' },
  { id: 2, padre_id: null, conta_come: 'forza' },
  { id: 3, padre_id: 2, conta_come: null }
]
const plio = (serie: string, rip: string): RigaConto => ({
  categoria_id: 1,
  gambe: 'due',
  serie,
  cluster: null,
  ripetizioni: rip
})
const quad = (serie: string, rip = '10'): RigaConto => ({
  categoria_id: 3,
  gambe: 'due',
  serie,
  cluster: null,
  ripetizioni: rip
})
const seduta = (data: string, righe: RigaConto[], altro: Partial<SedutaCarico> = {}): SedutaCarico => ({
  data,
  fase_id: 10,
  fase_nome: 'RTP 1',
  campo: 0,
  dolore: null,
  sforzo: null,
  righe,
  ...altro
})
const DOSI = {
  10: [
    { chiave: 'plio_est', minimo: 80, massimo: 120 },
    { chiave: 'forza:3', minimo: 3, massimo: null }
  ]
}

test("L'esito: sopra e' troppo, sotto e' poco, ma non in una settimana non finita", () => {
  assert.equal(esitoCarico(100, 80, 120, false), 'ok')
  assert.equal(esitoCarico(130, 80, 120, false), 'troppo')
  assert.equal(esitoCarico(50, 80, 120, false), 'poco')
  assert.equal(esitoCarico(50, 80, 120, true), null)
  assert.equal(esitoCarico(130, 80, 120, true), 'troppo')
  assert.equal(esitoCarico(5, 3, null, false), 'ok')
  assert.equal(esitoCarico(5, null, null, false), null)
})

test('Le settimane: dalla piu\' recente, con quelle vuote in mezzo, la dose moltiplicata', () => {
  const r = caricoSettimane({
    sedute: [
      // settimana del 2 novembre: due sedute, una al campo
      seduta('2025-11-03', [plio('3', '30'), quad('3')], { dolore: 3, sforzo: 6 }),
      seduta('2025-11-05', [plio('2', '20'), quad('2')], { dolore: 2, sforzo: 7 }),
      seduta('2025-11-07', [plio('10', '10')], { campo: 1, fase_nome: 'Campo', fase_id: 11, dolore: 4 }),
      // la settimana del 10 novembre e' vuota; quella del 17 una seduta senza fase
      seduta('2025-11-18', [quad('4')], { fase_id: null, fase_nome: null }),
      // nel futuro: non c'e'
      seduta('2025-12-30', [plio('9', '9')])
    ],
    dosi: DOSI,
    categorie: CATEGORIE,
    frequenza: 3,
    oggi: '2025-11-20'
  })

  assert.deepEqual(
    r.settimane.map((s) => s.lunedi),
    ['2025-11-17', '2025-11-10', '2025-11-03']
  )
  assert.deepEqual(r.chiavi.sort(), ['forza:3', 'plio_est'])

  const [ultima, vuota, prima] = r.settimane
  assert.equal(ultima.inCorso, true)
  assert.equal(ultima.fase, null)
  // senza fase non si giudica
  assert.deepEqual(ultima.voci['forza:3'], { fatto: 4, da: null, a: null, esito: null })

  assert.equal(vuota.sedute, 0)
  assert.deepEqual(vuota.voci, {})
  assert.equal(vuota.dolore, null)

  assert.equal(prima.sedute, 2)
  assert.equal(prima.seduteCampo, 1)
  assert.equal(prima.fase, 'RTP 1', 'la fase al campo non e\' quella della settimana')
  // pliometria: 90 + 40 = 130 (il campo non conta), dose 80-120 per 2 sedute
  assert.deepEqual(prima.voci.plio_est, { fatto: 130, da: 160, a: 240, esito: 'poco' })
  // forza: 3 + 2 serie, almeno 3 per 3 sedute a settimana
  assert.deepEqual(prima.voci['forza:3'], { fatto: 5, da: 9, a: null, esito: 'poco' })
  // dolore e sforzo: la media di tutte, anche quella al campo
  assert.equal(prima.dolore, 3)
  assert.equal(prima.sforzo, 6.5)
})

test('Senza sedute a settimana la forza si moltiplica per le sedute fatte', () => {
  const r = caricoSettimane({
    sedute: [seduta('2025-11-03', [quad('3')]), seduta('2025-11-05', [quad('3')])],
    dosi: DOSI,
    categorie: CATEGORIE,
    frequenza: null,
    oggi: '2025-12-01'
  })
  assert.deepEqual(r.settimane[0].voci['forza:3'], { fatto: 6, da: 6, a: null, esito: 'ok' })
  // la pliometria ha la dose ma non e' stata fatta: zero, ed e' poco
  assert.deepEqual(r.settimane[0].voci.plio_est, { fatto: 0, da: 160, a: 240, esito: 'poco' })
})

test("Niente sedute: niente settimane e niente avviso", () => {
  assert.deepEqual(caricoSettimane({ sedute: [], dosi: {}, categorie: CATEGORIE, frequenza: null, oggi: '2025-11-01' }), {
    settimane: [],
    chiavi: [],
    avviso: null
  })
})

const sett = (dolore: number | null, plioEst: number, sedute = 2): SettimanaCarico => ({
  lunedi: '',
  domenica: '',
  inCorso: false,
  sedute,
  seduteCampo: 0,
  fase: null,
  voci: { plio_est: { fatto: plioEst, da: null, a: null, esito: null } },
  dolore,
  sforzo: null
})

test("L'avviso: il dolore sale due settimane di fila mentre sale il carico", () => {
  // dalla piu' recente
  assert.deepEqual(avvisoCarico([sett(4, 240), sett(3, 180), sett(2, 120)], ['plio_est']), {
    chiave: 'plio_est',
    valori: [120, 180, 240],
    dolori: [2, 3, 4]
  })
  // il dolore scende: niente
  assert.equal(avvisoCarico([sett(2, 240), sett(3, 180), sett(4, 120)], ['plio_est']), null)
  // il dolore sale di poco (meno di un punto in tutto): niente
  assert.equal(avvisoCarico([sett(2.6, 240), sett(2.3, 180), sett(2, 120)], ['plio_est']), null)
  // il carico scende: niente
  assert.equal(avvisoCarico([sett(4, 100), sett(3, 180), sett(2, 120)], ['plio_est']), null)
  // una settimana vuota in mezzo: niente
  assert.equal(avvisoCarico([sett(4, 240), sett(null, 0, 0), sett(2, 120)], ['plio_est']), null)
  // meno di tre settimane: niente
  assert.equal(avvisoCarico([sett(4, 240), sett(2, 120)], ['plio_est']), null)
})

test("Dall'archivio: sedute fino a oggi, dose della fase, nomi della forza", () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pat = ins("INSERT INTO patologie (nome) VALUES ('LCA carico')")
  const fase = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'RTP 1 carico', 0)", pat)
  const rinforzo = ins("INSERT INTO categorie (nome) VALUES ('Rinforzo carico')")
  const quadId = ins("INSERT INTO categorie (nome, padre_id) VALUES ('Quadricipite carico', ?)", rinforzo)
  const plioId = ins("INSERT INTO categorie (nome) VALUES ('Pliometria carico')")
  impostaContaCome(rinforzo, 'forza')
  impostaContaCome(plioId, 'plio_est')
  salvaDoseFase(fase, [
    { chiave: 'plio_est', minimo: 80, massimo: 120 },
    { chiave: `forza:${quadId}`, minimo: 3, massimo: null }
  ])
  const base = {
    serie_default: null,
    cluster_default: null,
    ripetizioni_default: null,
    rir_default: null,
    carico_default: null,
    unita_carico: null,
    recupero_cluster_default: null,
    recupero_default: null,
    nota_tecnica: null,
    link: null
  }
  const legExt = creaEsercizio({ ...base, nome: 'Leg extension carico', categoria_id: quadId })
  const hop = creaEsercizio({ ...base, nome: 'Hop carico', categoria_id: plioId, gambe: 'una' })

  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Carico', 'Prova')")
  impostaSeduteSettimana(pz, 2)
  const riga = (esercizio_id: number, serie: string, ripetizioni: string) => ({
    esercizio_id,
    nome_libero: null,
    serie,
    cluster: null,
    ripetizioni,
    rir: null,
    carico: null,
    recupero_cluster: null,
    recupero: null,
    nota: null,
    monopodalico: 0 as const,
    sezioneIndex: 0
  })
  const nuova = (data: string, dolore: number | null, esercizi: SedutaInput['esercizi']): number =>
    creaSeduta({
      paziente_id: pz,
      data,
      ora: null,
      fase_id: fase,
      focus: null,
      dolore,
      sforzo: 5,
      segni: [],
      riferito_andamento: null,
      riferito: null,
      tecnica_ids: [],
      trattamento: null,
      note: null,
      sezioni: [{ sezione_id: null, nome: 'Esercizi' }],
      esercizi
    })
  // lunedi' 6 ottobre 2025: 3 × 10 hop a una gamba = 60 contatti, 3 serie di leg extension
  nuova('2025-10-06', 2, [riga(hop, '3', '10'), riga(legExt, '3', '10')])
  nuova('2025-10-08', 4, [riga(hop, '2', '10')])
  // nel futuro lontano: non e' ancora fatta
  nuova('2099-01-05', 9, [riga(hop, '9', '10')])

  const r = caricoPaziente(pz)
  assert.equal(r.frequenza, 2)
  assert.equal(r.settimane.length, 1)
  const [s] = r.settimane
  assert.equal(s.lunedi, '2025-10-06')
  assert.equal(s.fase, 'RTP 1 carico')
  assert.equal(s.dolore, 3)
  assert.equal(s.sforzo, 5)
  // 60 + 40 contatti, dose 80-120 per 2 sedute
  assert.deepEqual(s.voci.plio_est, { fatto: 100, da: 160, a: 240, esito: 'poco' })
  assert.deepEqual(s.voci[`forza:${quadId}`], { fatto: 3, da: 6, a: null, esito: 'poco' })
  assert.deepEqual(r.nomi, { [`forza:${quadId}`]: 'Quadricipite carico' })

  // un paziente senza sedute
  const vuoto = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Senza', 'Sedute')")
  assert.deepEqual(caricoPaziente(vuoto), { settimane: [], chiavi: [], avviso: null, nomi: {}, frequenza: null })
})
