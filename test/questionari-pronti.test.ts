// I questionari pronti (IKDC, LESS) che il programma mette da solo nell'archivio:
// ognuno nella sua categoria, una volta sola, senza doppioni.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import { installaQuestionariPronti } from '../src/main/questionari-pronti'

archivioDiProva()

const IKDC = 'IKDC — Valutazione soggettiva del ginocchio'
const LESS = 'LESS — Landing Error Scoring System'

const dove = (nome: string): { categoria: string }[] =>
  getDb()
    .prepare(
      `SELECT c.nome AS categoria FROM questionari q
       JOIN questionario_categorie c ON c.id = q.categoria_id WHERE q.nome = ?`
    )
    .all(nome) as { categoria: string }[]

test('Ogni questionario pronto finisce nella sua categoria, che si crea se manca', () => {
  installaQuestionariPronti()
  assert.deepEqual(dove(IKDC), [{ categoria: 'Ginocchio' }])
  assert.deepEqual(dove(LESS), [{ categoria: 'Qualità del movimento' }])
})

test('Si fa una volta sola: rieseguirla non cambia niente, e quello che si elimina non rinasce', () => {
  const db = getDb()
  const conta = (): number => (db.prepare('SELECT COUNT(*) AS n FROM questionari').get() as { n: number }).n
  const prima = conta()
  installaQuestionariPronti()
  assert.equal(conta(), prima)

  db.prepare('DELETE FROM questionari WHERE nome = ?').run(LESS)
  installaQuestionariPronti()
  assert.deepEqual(dove(LESS), [])
})

test('Una categoria che c\'e\' gia\' si riusa, e un questionario con lo stesso nome non si raddoppia', () => {
  const db = getDb()
  db.prepare('DELETE FROM installazioni').run()
  db.prepare('DELETE FROM questionari').run()
  db.prepare('DELETE FROM questionario_categorie').run()
  // l'utente aveva gia' una categoria "ginocchio" (minuscola) e un suo IKDC
  const cat = Number(
    db.prepare("INSERT INTO questionario_categorie (nome, ordine) VALUES ('ginocchio', 0)").run().lastInsertRowid
  )
  db.prepare('INSERT INTO questionari (nome, categoria_id, ordine) VALUES (?, ?, 0)').run(IKDC, cat)

  installaQuestionariPronti()

  assert.deepEqual(dove(IKDC), [{ categoria: 'ginocchio' }], 'il suo IKDC resta uno solo')
  assert.deepEqual(dove(LESS), [{ categoria: 'Qualità del movimento' }])
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS n FROM questionario_categorie WHERE nome = 'Ginocchio' COLLATE NOCASE").get() as { n: number }).n,
    1
  )
})
