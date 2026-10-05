// I modi di calcolo dei punteggi (shared/punteggi-questionario.ts), con i numeri
// delle scale vere: ODI, KOOS, IKDC. E il calcolo dentro al questionario salvato.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import { calcola, leggiQuestionario, salvaQuestionario } from '../src/main/questionari'
import { estremiDomanda, valorePunteggio } from '../src/shared/punteggi-questionario'
import type { DomandaQuestionario, QuestionarioCompleto } from '../src/shared/types'

archivioDiProva()

const voci = (valori: number[], min: number, max: number): { valore: number; min: number; max: number }[] =>
  valori.map((valore) => ({ valore, min, max }))

test('ODI: percentuale sul massimo delle risposte date', () => {
  // 10 domande da 0 a 5, totale 20: 20 / 50 = 40%
  assert.equal(valorePunteggio('percentuale', voci([2, 2, 2, 2, 2, 2, 2, 2, 2, 2], 0, 5)), 40)
  // una domanda senza risposta: 18 / 45, sempre 40% (la somma direbbe 18)
  const nove = voci([2, 2, 2, 2, 2, 2, 2, 2, 2], 0, 5)
  assert.equal(valorePunteggio('percentuale', nove), 40)
  assert.equal(valorePunteggio('somma', nove), 18)
})

test('KOOS: percentuale inversa, 100 = nessun problema', () => {
  // dolore: 9 domande da 0 a 4, somma 9 -> 100 - 9/36*100 = 75
  assert.equal(valorePunteggio('percentuale_inversa', voci([1, 1, 1, 1, 1, 1, 1, 1, 1], 0, 4)), 75)
  assert.equal(valorePunteggio('percentuale_inversa', voci([0, 0, 0], 0, 4)), 100)
  assert.equal(valorePunteggio('percentuale_inversa', voci([4, 4], 0, 4)), 0)
})

test('IKDC: domande con scale diverse, e una scala che parte da 1', () => {
  // una da 0 a 10 (risposta 5) e una da 0 a 4 (risposta 2): 7 / 14 = 50%
  assert.equal(
    valorePunteggio('percentuale', [
      { valore: 5, min: 0, max: 10 },
      { valore: 2, min: 0, max: 4 }
    ]),
    50
  )
  // scala da 1 a 5: 3 e 3 sono a meta'
  assert.equal(valorePunteggio('percentuale', voci([3, 3], 1, 5)), 50)
  // un decimale
  assert.equal(valorePunteggio('percentuale', voci([1], 0, 3)), 33.3)
})

test('Media e casi vuoti', () => {
  assert.equal(valorePunteggio('media', voci([2, 3, 5], 0, 10)), 3.3)
  assert.equal(valorePunteggio('media', []), 0)
  assert.equal(valorePunteggio('percentuale', []), 0)
  assert.equal(valorePunteggio('somma', []), 0)
})

test('Estremi di una domanda: si/no, scala, scelta', () => {
  const base = { scala_min: null, scala_max: null, opzioni: [] } as unknown as DomandaQuestionario
  assert.deepEqual(estremiDomanda({ ...base, tipo: 'si_no' }), { min: 0, max: 1 })
  assert.deepEqual(estremiDomanda({ ...base, tipo: 'scala', scala_min: 1, scala_max: 7 }), { min: 1, max: 7 })
  assert.deepEqual(
    estremiDomanda({
      ...base,
      tipo: 'scelta',
      opzioni: [
        { id: 1, etichetta: 'a', punteggio: 5 },
        { id: 2, etichetta: 'b', punteggio: 0 },
        { id: 3, etichetta: 'c', punteggio: 2 }
      ]
    }),
    { min: 0, max: 5 }
  )
})

test('Nel questionario salvato: il tipo si salva, si rilegge e decide il calcolo', () => {
  const qid = Number(getDb().prepare("INSERT INTO questionari (nome) VALUES ('Mini ODI')").run().lastInsertRowid)
  const domanda = (n: number): DomandaQuestionario => ({
    id: -n,
    testo: `Domanda ${n}`,
    tipo: 'scala',
    scala_min: 0,
    scala_max: 5,
    etichetta_min: null,
    etichetta_max: null,
    opzioni: []
  })
  const dati: QuestionarioCompleto = {
    questionario: leggiQuestionario(qid).questionario,
    domande: [domanda(1), domanda(2), domanda(3), domanda(4)],
    punteggi: [
      { id: -101, nome: 'Totale', tipo: 'somma', domanda_ids: [-1, -2, -3, -4] },
      { id: -102, nome: 'Disabilità %', tipo: 'percentuale', domanda_ids: [-1, -2, -3, -4] }
    ],
    fasce: []
  }
  salvaQuestionario(dati)
  const letto = leggiQuestionario(qid)
  assert.deepEqual(
    letto.punteggi.map((p) => [p.nome, p.tipo]),
    [
      ['Totale', 'somma'],
      ['Disabilità %', 'percentuale']
    ]
  )
  const ids = letto.domande.map((d) => d.id as number)
  // tre risposte su quattro: 1 + 2 + 3 = 6 su 15 = 40%
  const r = calcola(qid, [
    { domanda_id: ids[0], valore: 1 },
    { domanda_id: ids[1], valore: 2 },
    { domanda_id: ids[2], valore: 3 }
  ])
  assert.deepEqual(
    r.punteggi.map((p) => [p.nome, p.valore]),
    [
      ['Totale', 6],
      ['Disabilità %', 40]
    ]
  )

  // un tipo sconosciuto non si salva
  const sbagliato = { ...letto, punteggi: [{ ...letto.punteggi[0], tipo: 'radice' as never }] }
  assert.throws(() => salvaQuestionario(sbagliato), /modo di calcolo sconosciuto/)
  assert.equal(leggiQuestionario(qid).punteggi.length, 2, 'un salvataggio rifiutato non cambia niente')
})
