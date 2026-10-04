// La ricerca in tutto l'archivio (ricerca.ts): pazienti, diario, anamnesi.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import { cercaInArchivio } from '../src/main/ricerca'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

const ins = (sql: string, ...a: unknown[]): number => Number(getDb().prepare(sql).run(...a).lastInsertRowid)

test('Ricerca: pazienti per nome, anche con maiuscole e accenti diversi', () => {
  const a = ins("INSERT INTO pazienti (nome, cognome, diagnosi) VALUES ('Giosuè', 'Perrone', 'Lesione del crociato')")
  ins("INSERT INTO pazienti (nome, cognome) VALUES ('Anna', 'Bianchi')")
  const nomi = (q: string): string[] => cercaInArchivio(q).filter((r) => r.tipo === 'paziente').map((r) => r.paziente)

  assert.deepEqual(nomi('perrone'), ['Perrone Giosuè'])
  assert.deepEqual(nomi('GIOSUE'), ['Perrone Giosuè'], 'senza accento e in maiuscolo')
  assert.deepEqual(nomi('giosuè perrone'), ['Perrone Giosuè'], 'nome e cognome insieme, in qualunque ordine')
  assert.deepEqual(nomi('perrone giosue'), ['Perrone Giosuè'])
  assert.deepEqual(nomi('bianchi giosue'), [], 'tutte le parole devono esserci')
  assert.deepEqual(nomi('crociato'), ['Perrone Giosuè'], 'anche dalla diagnosi')
  const r = cercaInArchivio('crociato')[0]
  assert.equal(r.campo, 'Diagnosi')
  assert.ok(r.estratto.includes('crociato'))
  assert.equal(r.pazienteId, a)
})

test('Ricerca: troppo corta o vuota non cerca', () => {
  assert.deepEqual(cercaInArchivio(''), [])
  assert.deepEqual(cercaInArchivio('   '), [])
  assert.deepEqual(cercaInArchivio('a'), [])
})

test('Ricerca: il diario, dal piu\' recente, con l\'estratto intorno alla parola', () => {
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Luca', 'Diario')")
  const vecchia = ins("INSERT INTO sedute (paziente_id, data, note) VALUES (?, '2026-01-10', ?)", pz, 'Prima visita, riferisce una fitta alla spalla destra nei movimenti sopra la testa.')
  const nuova = ins("INSERT INTO sedute (paziente_id, data, trattamento) VALUES (?, '2026-03-10', ?)", pz, 'Mobilizzazione della spalla e esercizi di stabilita.')
  ins("INSERT INTO sedute (paziente_id, data, note) VALUES (?, '2026-02-10', 'Tutto bene, solo caviglia')", pz)

  const sedute = cercaInArchivio('SPALLA').filter((r) => r.tipo === 'seduta')
  assert.deepEqual(sedute.map((r) => r.sedutaId), [nuova, vecchia], 'dalla piu\' recente')
  assert.equal(sedute[0].campo, 'Trattamento')
  assert.equal(sedute[1].campo, 'Note')
  assert.equal(sedute[1].data, '2026-01-10')
  assert.equal(sedute[1].pazienteId, pz)
  assert.ok(sedute[1].estratto.toLowerCase().includes('spalla'))
  assert.ok(sedute[1].estratto.length <= 100, 'un pezzo, non tutto il testo')
})

test('Ricerca: anamnesi e il limite di risultati', () => {
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Mara', 'Anamnesi')")
  ins("INSERT INTO anamnesi_prossima (paziente_id, motivo_consulto) VALUES (?, 'Dolore lombare dopo la corsa')", pz)
  const an = cercaInArchivio('lombare').filter((r) => r.tipo === 'anamnesi')
  assert.equal(an.length, 1)
  assert.equal(an[0].campo, 'Motivo della visita')
  assert.equal(an[0].pazienteId, pz)

  for (let i = 0; i < 40; i++) ins("INSERT INTO pazienti (nome, cognome) VALUES (?, 'Moltissimi')", `N${i}`)
  assert.equal(cercaInArchivio('moltissimi').length, 25, 'al massimo venticinque per tipo')
})

test('Ricerca: chi e\' nel cestino non si trova', () => {
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Eli', 'Minato')")
  getDb().prepare('DELETE FROM pazienti WHERE id = ?').run(pz)
  assert.deepEqual(cercaInArchivio('minato'), [])
})
