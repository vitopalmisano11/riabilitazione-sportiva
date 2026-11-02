// La dose: il conto di contatti e serie (shared/dose.ts), la dose della fase,
// le altre sedute della settimana, le sedute a settimana del paziente e il
// segno monopodalico sulla riga della seduta.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  contaRighe,
  controllaDose,
  intervalloTesto,
  primoNumero,
  quanto,
  settimanaDi,
  tipoDiCategoria,
  type CategoriaConto
} from '../src/shared/dose'
import { nomeConMonopodalico } from '../src/shared/varianti'
import { doseSettimana, leggiDoseFase, salvaDoseFase } from '../src/main/dose'
import { creaEsercizio, elencoEsercizi, impostaContaCome } from '../src/main/esercizi'
import { impostaSeduteSettimana } from '../src/main/pazienti'
import { creaSeduta, leggiSeduta, programmaSeduta } from '../src/main/sedute'
import { ultimaVoltaPerPaziente } from '../src/main/ultima-volta'
import { datiScheda } from '../src/main/scheda-dati'
import type { SedutaInput } from '../src/shared/types'

archivioDiProva()

test('I numeri scritti: "8-10" vale 8, un tempo non e\' un numero', () => {
  assert.equal(primoNumero('8-10'), 8)
  assert.equal(primoNumero('10 per gamba'), 10)
  assert.equal(primoNumero(' 12 '), 12)
  assert.equal(primoNumero('30"'), null)
  assert.equal(primoNumero("45''"), null)
  assert.equal(primoNumero('40 sec'), null)
  assert.equal(primoNumero('2 min'), null)
  assert.equal(primoNumero('max'), null)
  assert.equal(primoNumero(null), null)
})

test('Il conto: contatti per la pliometria (a una gamba doppio), serie per la forza', () => {
  const riga = { categoria_id: 1, gambe: 'due' as const, monopodalico: 0 as const, cluster: null }
  // 3 × 10 a due gambe = 30 contatti; a una gamba (segnato o sempre) = 60
  assert.equal(quanto({ ...riga, serie: '3', ripetizioni: '10' }, 'plio_est'), 30)
  assert.equal(quanto({ ...riga, monopodalico: 1, serie: '3', ripetizioni: '10' }, 'plio_est'), 60)
  assert.equal(quanto({ ...riga, gambe: 'una', serie: '3', ripetizioni: '10' }, 'plio_est'), 60)
  // a cluster: 3 serie × (3 cluster × 4) = 36, come negli appunti
  assert.equal(quanto({ ...riga, serie: '3', cluster: '3', ripetizioni: '4' }, 'plio_est'), 36)
  // la forza conta le serie, a una gamba come a due
  assert.equal(quanto({ ...riga, monopodalico: 1, serie: '3', ripetizioni: '8-10' }, 'forza'), 3)
  // un'isometria a tempo resta fuori
  assert.equal(quanto({ ...riga, serie: '5', ripetizioni: '45"' }, 'forza'), 0)
})

test('La categoria si conta come la sua, o come quella che la contiene', () => {
  const cats: CategoriaConto[] = [
    { id: 1, padre_id: null, conta_come: 'forza' },
    { id: 2, padre_id: 1, conta_come: null },
    { id: 3, padre_id: null, conta_come: null },
    { id: 4, padre_id: 1, conta_come: 'potenza' }
  ]
  assert.equal(tipoDiCategoria(2, cats), 'forza')
  assert.equal(tipoDiCategoria(3, cats), null)
  assert.equal(tipoDiCategoria(4, cats), 'potenza')
  const conto = contaRighe(
    [
      { categoria_id: 2, gambe: 'due', serie: '3', cluster: null, ripetizioni: '10' },
      { categoria_id: 2, gambe: 'scelta', monopodalico: 1, serie: '2', cluster: null, ripetizioni: '8' },
      { categoria_id: 3, gambe: 'due', serie: '3', cluster: null, ripetizioni: '10' },
      { categoria_id: null, gambe: null, serie: '3', cluster: null, ripetizioni: '10' }
    ],
    cats
  )
  assert.deepEqual(conto, { 'forza:2': 5 })
})

test('Il controllo: la pliometria per seduta, la forza divisa sulle sedute che restano', () => {
  const dosi = [
    { chiave: 'plio_est', minimo: 80, massimo: 120 },
    { chiave: 'forza:2', minimo: 3, massimo: 6 },
    { chiave: 'plio_int', minimo: null, massimo: null }
  ]
  // 3 sedute a settimana, una gia' fatta con 3 serie: in settimana 9–18, ne
  // mancano 6–15 su 2 sedute → da 3 a 7 oggi
  const c = controllaDose(dosi, { plio_est: 90, 'forza:2': 2 }, { frequenza: 3, altreSedute: 1, altre: { 'forza:2': 3 } })
  assert.equal(c.length, 2, 'una voce senza numeri non si controlla')
  assert.deepEqual(
    c.map((x) => [x.chiave, x.esito, x.da, x.a]),
    [
      ['plio_est', 'ok', 80, 120],
      ['forza:2', 'poco', 3, 7]
    ]
  )
  assert.deepEqual(c[1].settimana, { fatte: 3, da: 9, a: 18, restano: 2 })
  // senza le sedute a settimana la forza si controlla per seduta
  const senza = controllaDose(dosi, { 'forza:2': 8 }, { frequenza: null, altreSedute: 0, altre: {} })
  assert.equal(senza[1].esito, 'troppo')
  assert.equal(senza[1].settimana, null)
  // piu' sedute del previsto: resta questa
  const oltre = controllaDose(dosi, {}, { frequenza: 2, altreSedute: 3, altre: { 'forza:2': 12 } })
  assert.deepEqual([oltre[1].da, oltre[1].a, oltre[1].settimana?.restano], [0, 0, 1])
  assert.equal(intervalloTesto(3, null), 'almeno 3')
  assert.equal(intervalloTesto(null, 40), 'al massimo 40')
  assert.equal(intervalloTesto(80, 120), 'da 80 a 120')
})

test('La settimana va dal lunedi\' alla domenica', () => {
  assert.deepEqual(settimanaDi('2026-11-04'), ['2026-11-02', '2026-11-08']) // mercoledi'
  assert.deepEqual(settimanaDi('2026-11-02'), ['2026-11-02', '2026-11-08']) // lunedi'
  assert.deepEqual(settimanaDi('2026-11-08'), ['2026-11-02', '2026-11-08']) // domenica
  assert.deepEqual(settimanaDi('2026-12-31'), ['2026-12-28', '2027-01-03'])
})

test('Il nome sulla scheda: "Squat monopodalico" solo se segnato', () => {
  assert.equal(nomeConMonopodalico('Squat', 1), 'Squat monopodalico')
  assert.equal(nomeConMonopodalico('Squat', 0), 'Squat')
  assert.equal(nomeConMonopodalico('Squat', undefined), 'Squat')
})

test('Dose della fase, sedute a settimana e conto delle altre sedute della settimana', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pat = ins("INSERT INTO patologie (nome) VALUES ('LCA dose')")
  const fase = ins("INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, 'RTP 1', 0)", pat)
  const faseCampo = ins("INSERT INTO fasi (patologia_id, nome, ordine, campo) VALUES (?, 'Campo', 1, 1)", pat)
  const rinforzo = ins("INSERT INTO categorie (nome) VALUES ('Rinforzo dose')")
  const quad = ins("INSERT INTO categorie (nome, padre_id) VALUES ('Quadricipite dose', ?)", rinforzo)
  const plio = ins("INSERT INTO categorie (nome) VALUES ('Pliometria dose')")
  impostaContaCome(rinforzo, 'forza')
  impostaContaCome(plio, 'plio_est')
  assert.throws(() => impostaContaCome(plio, 'corsa' as never), /non valido/)

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
  const legExt = creaEsercizio({ ...base, nome: 'Leg extension dose', categoria_id: quad })
  const hop = creaEsercizio({ ...base, nome: 'Single leg hop dose', categoria_id: plio, gambe: 'una' })
  const cmj = creaEsercizio({ ...base, nome: 'CMJ dose', categoria_id: plio, gambe: 'scelta' })
  const elenco = elencoEsercizi(false) as { id: number; gambe: string }[]
  assert.equal(elenco.find((e) => e.id === legExt)?.gambe, 'due', 'un esercizio nuovo nasce a due gambe')
  assert.equal(elenco.find((e) => e.id === hop)?.gambe, 'una')

  // la dose della fase: si salva intera, le voci vuote non restano
  salvaDoseFase(fase, [
    { chiave: 'plio_est', minimo: 80, massimo: 120 },
    { chiave: `forza:${quad}`, minimo: 3, massimo: null },
    { chiave: 'plio_int', minimo: null, massimo: null }
  ])
  assert.deepEqual(leggiDoseFase(fase), [
    { chiave: `forza:${quad}`, minimo: 3, massimo: null },
    { chiave: 'plio_est', minimo: 80, massimo: 120 }
  ])
  assert.throws(() => salvaDoseFase(fase, [{ chiave: 'plio_est', minimo: 120, massimo: 80 }]), /più alto/)
  assert.throws(() => salvaDoseFase(fase, [{ chiave: 'plio_est', minimo: 2.5, massimo: null }]), /intero/)
  assert.throws(() => salvaDoseFase(fase, [{ chiave: 'forza', minimo: 3, massimo: null }]), /non è valida/)
  assert.equal(leggiDoseFase(fase).length, 2, 'un errore non cancella la dose di prima')

  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Dose', 'Prova')")
  impostaSeduteSettimana(pz, 3)
  assert.throws(() => impostaSeduteSettimana(pz, 0), /da 1 a 14/)
  assert.throws(() => impostaSeduteSettimana(pz, 2.5), /da 1 a 14/)

  const seduta = (data: string, faseId: number, esercizi: SedutaInput['esercizi']): number =>
    creaSeduta({
      paziente_id: pz,
      data,
      ora: null,
      fase_id: faseId,
      focus: null,
      dolore: null,
      sforzo: null,
      segni: [],
      riferito_andamento: null,
      riferito: null,
      tecnica_ids: [],
      trattamento: null,
      note: null,
      sezioni: [{ sezione_id: null, nome: 'Esercizi' }],
      esercizi
    })
  const riga = (esercizio_id: number, serie: string, ripetizioni: string, monopodalico: 0 | 1 = 0) => ({
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
    monopodalico,
    sezioneIndex: 0
  })
  // lunedi': 3 × 10 leg extension, 3 × 10 hop (60), 2 × 15 CMJ a una gamba (60)
  const lun = seduta('2026-11-02', fase, [
    riga(legExt, '3', '10'),
    riga(hop, '3', '10'),
    riga(cmj, '2', '15', 1)
  ])
  // mercoledi' al campo: non conta
  seduta('2026-11-04', faseCampo, [riga(legExt, '4', '8')])
  // la settimana dopo: non conta
  seduta('2026-11-09', fase, [riga(legExt, '4', '8')])

  const sett = doseSettimana(pz, '2026-11-06', null)
  assert.deepEqual(sett, { frequenza: 3, altreSedute: 1, altre: { [`forza:${quad}`]: 3, plio_est: 120 } })
  // riaprendo la seduta di lunedi', lei stessa non e' fra le "altre"
  assert.deepEqual(doseSettimana(pz, '2026-11-02', lun), { frequenza: 3, altreSedute: 0, altre: {} })

  // il segno monopodalico si salva, si rilegge, si copia, e arriva alla scheda
  const letta = leggiSeduta(lun).sezioni[0].esercizi
  assert.deepEqual(
    letta.map((e) => e.monopodalico),
    [0, 0, 1]
  )
  const [copia] = programmaSeduta(lun, ['2026-11-13'])
  assert.equal(leggiSeduta(copia).sezioni[0].esercizi[2].monopodalico, 1)
  assert.equal(datiScheda(lun).sezioni[0].esercizi[2].monopodalico, 1)
  const ultima = ultimaVoltaPerPaziente(pz, null, '2026-11-03').find((u) => u.esercizio_id === cmj)
  assert.equal(ultima?.monopodalico, 1)

  // eliminando la fase se ne va anche la sua dose
  c.prepare('DELETE FROM sedute WHERE paziente_id = ?').run(pz)
  c.prepare('DELETE FROM fasi WHERE id = ?').run(fase)
  assert.equal(leggiDoseFase(fase).length, 0)
})
