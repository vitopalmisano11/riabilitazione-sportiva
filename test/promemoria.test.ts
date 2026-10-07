// Promemoria: rifare un questionario o uno screening a una certa data.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import assert from 'node:assert/strict'
import { getDb } from '../src/main/db'
import {
  contaInScadenza,
  creaPromemoria,
  elencoPromemoria,
  eliminaPromemoria,
  segnaFatto
} from '../src/main/promemoria'
import { salvaCompilazione } from '../src/main/questionari'
import { creaScreening } from '../src/main/screening-sessioni'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

test('Promemoria: si creano, scadono, si chiudono da soli e a mano', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Pro', 'Memoria')")
  const altro = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Altro', 'Paziente')")
  const koos = ins("INSERT INTO questionari (nome, ordine) VALUES ('KOOS', 0)")
  const protocollo = ins("INSERT INTO screening_protocolli (nome, sport) VALUES ('RTP calcio', 'Calcio')")

  // senza data valida o senza niente da ripetere non si crea
  assert.throws(
    () => creaPromemoria({ paziente_id: pz, tipo: 'questionario', riferimento_id: koos, scadenza: '2026-02-30', nota: null }),
    /non è una data valida/
  )
  assert.throws(
    () => creaPromemoria({ paziente_id: pz, tipo: 'questionario', riferimento_id: 9999, scadenza: '2026-10-01', nota: null }),
    /Questionario non trovato/
  )

  const passato = creaPromemoria({ paziente_id: pz, tipo: 'questionario', riferimento_id: koos, scadenza: '2020-01-01', nota: ' dopo sei settimane ' })
  const futuro = creaPromemoria({ paziente_id: pz, tipo: 'screening', riferimento_id: protocollo, scadenza: '2999-01-01', nota: null })
  creaPromemoria({ paziente_id: altro, tipo: 'questionario', riferimento_id: koos, scadenza: '2020-01-02', nota: null })

  // gli aperti di tutti, dal piu' vicino; quelli di un paziente solo suoi
  assert.equal(elencoPromemoria(null).length, 3)
  const suoi = elencoPromemoria(pz)
  assert.equal(suoi.length, 2)
  assert.equal(suoi.find((p) => p.id === passato)?.riferimento_nome, 'KOOS')
  assert.equal(suoi.find((p) => p.id === passato)?.nota, 'dopo sei settimane')
  assert.equal(suoi.find((p) => p.id === futuro)?.riferimento_nome, 'RTP calcio')

  // in scadenza: solo quelli con la data arrivata
  assert.equal(contaInScadenza(), 2)

  // compilando quel questionario per quel paziente il suo promemoria si chiude;
  // quello dell'altro paziente no
  const domanda = ins("INSERT INTO questionario_domande (questionario_id, testo, tipo, ordine) VALUES (?, 'D', 'si_no', 0)", koos)
  salvaCompilazione({
    paziente_id: pz,
    questionario_id: koos,
    data: '2026-10-01',
    note: null,
    risposte: [{ domanda_id: domanda, valore: 1 }]
  })
  assert.notEqual(elencoPromemoria(pz).find((p) => p.id === passato)?.fatto_il, null)
  assert.equal(elencoPromemoria(null).length, 2)
  assert.equal(contaInScadenza(), 1)

  // aprendo lo screening di quel protocollo si chiude anche l'altro
  creaScreening(pz, protocollo, '2026-10-02')
  assert.ok(elencoPromemoria(pz).every((p) => p.fatto_il != null))
  assert.equal(elencoPromemoria(null).length, 1)

  // a mano si puo' rimettere da fare e togliere
  segnaFatto(futuro, false)
  assert.equal(elencoPromemoria(pz).find((p) => p.id === futuro)?.fatto_il, null)
  eliminaPromemoria(futuro)
  assert.equal(elencoPromemoria(pz).length, 1)

  // eliminato un questionario mai compilato, il suo promemoria va con lui (uno
  // gia' compilato non si elimina, si archivia)
  const mai = ins("INSERT INTO questionari (nome, ordine) VALUES ('Mai compilato', 1)")
  creaPromemoria({ paziente_id: pz, tipo: 'questionario', riferimento_id: mai, scadenza: '2026-11-01', nota: null })
  assert.equal(elencoPromemoria(pz).length, 2)
  c.prepare('DELETE FROM questionari WHERE id = ?').run(mai)
  assert.equal(elencoPromemoria(pz).length, 1)
})
