// Il doppio salvataggio (audit B8): un salvataggio alla volta, e chi lo chiede
// mentre e' in corso aspetta quello invece di farne un altro.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { unoAllaVolta } from '../src/renderer/src/unoAllaVolta'

// un lavoro che finisce solo quando lo si dice
function lavoroManuale(): { lavoro: () => Promise<number>; chiamate: () => number; finisci: (v: number) => void; fallisci: (e: Error) => void } {
  let chiamate = 0
  let ok: (v: number) => void = () => undefined
  let ko: (e: Error) => void = () => undefined
  return {
    lavoro: () => {
      chiamate++
      return new Promise<number>((res, rej) => {
        ok = res
        ko = rej
      })
    },
    chiamate: () => chiamate,
    finisci: (v) => ok(v),
    fallisci: (e) => ko(e)
  }
}

test('Due richieste insieme fanno un solo lavoro, e hanno lo stesso risultato', async () => {
  const m = lavoroManuale()
  const salva = unoAllaVolta(m.lavoro)
  const a = salva() // Ctrl+S
  const b = salva() // ...premuto di nuovo
  const c = salva() // ...e l'uscita che salva
  assert.equal(m.chiamate(), 1)
  m.finisci(7)
  assert.deepEqual(await Promise.all([a, b, c]), [7, 7, 7])
})

test('Finito il lavoro, la richiesta dopo ne fa partire uno nuovo', async () => {
  const m = lavoroManuale()
  const salva = unoAllaVolta(m.lavoro)
  const a = salva()
  m.finisci(1)
  await a
  const b = salva()
  assert.equal(m.chiamate(), 2)
  m.finisci(2)
  assert.equal(await b, 2)
})

test('Un lavoro fallito si riprova: l\'errore non resta attaccato', async () => {
  const m = lavoroManuale()
  const salva = unoAllaVolta(m.lavoro)
  const a = salva()
  const b = salva()
  m.fallisci(new Error('disco pieno'))
  await assert.rejects(a, /disco pieno/)
  await assert.rejects(b, /disco pieno/)
  const c = salva() // si puo' riprovare
  assert.equal(m.chiamate(), 2)
  m.finisci(3)
  assert.equal(await c, 3)
})
