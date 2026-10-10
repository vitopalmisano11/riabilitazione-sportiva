// Le stime del massimale: da una serie e dalla velocita' del bilanciere.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { stimaDaSerie, stimaDaVelocita } from '../src/shared/massimali'

test('Massimale da una serie: una ripetizione e il carico stesso, il resto segue Epley', () => {
  // era il difetto: 100 kg × 1 davano 103,3
  assert.equal(stimaDaSerie(100, 1), 100)
  assert.equal(stimaDaSerie(100, 1, 0), 100)
  assert.equal(stimaDaSerie(100, 10), 133.3)
  // 8 ripetizioni con 2 di riserva valgono come 10
  assert.equal(stimaDaSerie(80, 8, 2), stimaDaSerie(80, 10))
  assert.equal(stimaDaSerie(80, 8, 2), 106.7)
})

test('Massimale dalla velocita: la retta carico-velocita arriva alla soglia', () => {
  // v = 1,2 - 0,009 × carico: a 0,30 m/s il carico e 100 kg
  const punti = [60, 70, 80].map((carico) => ({ carico, velocita: 1.2 - 0.009 * carico }))
  const s = stimaDaVelocita(punti, 0.3)
  assert.ok(s)
  assert.equal(s.massimale, 100)
  assert.equal(s.r2, 1)
  assert.deepEqual(s.avvisi, [])
})

test('Massimale dalla velocita: serve una retta che scende, e gli avvisi dicono quando fidarsi poco', () => {
  const v = (carico: number, velocita: number) => ({ carico, velocita })
  // un solo carico, o due uguali: niente retta
  assert.equal(stimaDaVelocita([v(60, 0.8)], 0.3), null)
  assert.equal(stimaDaVelocita([v(60, 0.8), v(60, 0.7)], 0.3), null)
  // piu' carico non rallenta: i dati non dicono niente
  assert.equal(stimaDaVelocita([v(60, 0.6), v(80, 0.8)], 0.3), null)
  // voci vuote o non valide si saltano
  assert.equal(stimaDaVelocita([v(60, 0.8), v(Number.NaN, 0.5)], 0.3), null)
  assert.equal(stimaDaVelocita([v(60, 0.8), v(70, 0.7)], 0), null)

  // due carichi soli: si stima, ma con l'avviso
  const due = stimaDaVelocita([v(60, 0.8), v(80, 0.6)], 0.3)
  assert.ok(due)
  assert.equal(due.massimale, 110)
  assert.ok(due.avvisi.some((a) => a.includes('due carichi')))

  // carichi tutti leggeri rispetto al massimale stimato: estrapolazione lunga
  const leggeri = stimaDaVelocita([v(40, 1.0), v(50, 0.9), v(60, 0.8)], 0.3)
  assert.ok(leggeri)
  assert.ok(leggeri.avvisi.some((a) => a.includes('più pesante')))

  // punti sparsi: non stanno su una retta
  const sparsi = stimaDaVelocita([v(60, 0.8), v(70, 0.5), v(80, 0.75), v(90, 0.45)], 0.3)
  assert.ok(sparsi)
  assert.ok(sparsi.avvisi.some((a) => a.includes('retta')) || sparsi.r2 >= 0.9)
})
