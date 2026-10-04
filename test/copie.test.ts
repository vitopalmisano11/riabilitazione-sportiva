// Copie di sicurezza: il promemoria per l'ultima copia fuori dal computer.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { avvisoCopiaFuori, giorniDallaCopiaFuori } from '../src/shared/copie'

test('Promemoria: l\'ultima copia fuori dal computer', () => {
  const giorno = (a: number, m: number, g: number, h = 12): Date => new Date(a, m - 1, g, h)
  const fa = (d: Date): string => d.toISOString()
  assert.equal(giorniDallaCopiaFuori(null), null)
  assert.equal(giorniDallaCopiaFuori('non una data'), null)
  // giorni di calendario, non ore: da tarda sera a primo mattino e' un giorno
  assert.equal(giorniDallaCopiaFuori(fa(giorno(2026, 9, 1, 23)), giorno(2026, 9, 2, 0)), 1)
  assert.equal(giorniDallaCopiaFuori(fa(giorno(2026, 9, 1)), giorno(2026, 9, 1)), 0)
  const info = (ultima: string | null, inOneDrive = false): Parameters<typeof avvisoCopiaFuori>[0] => ({
    inOneDrive,
    attivo: true,
    ultimaCopiaFuori: ultima
  })
  // mai fatta una copia fuori
  assert.match(avvisoCopiaFuori(info(null), giorno(2026, 9, 1))!, /Non hai ancora portato una copia fuori/)
  // recente: niente da dire
  assert.equal(avvisoCopiaFuori(info(fa(giorno(2026, 9, 1))), giorno(2026, 9, 30)), null) // 29 giorni
  // da 30 giorni in su si ricorda, con il numero
  assert.match(avvisoCopiaFuori(info(fa(giorno(2026, 9, 1))), giorno(2026, 10, 1))!, /di 30 giorni fa/)
  // con le copie gia' in OneDrive sono fuori da sole: non si dice niente
  assert.equal(avvisoCopiaFuori(info(null, true), giorno(2026, 10, 1)), null)
  assert.equal(avvisoCopiaFuori(info(fa(giorno(2025, 1, 1)), true), giorno(2026, 10, 1)), null)
})
