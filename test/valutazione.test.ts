// Valutazione: duplicare una valutazione.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import assert from 'node:assert/strict'
import { getDb } from '../src/main/db'
import { generaCartella, generaRelazione } from '../src/main/export-cartella'
import { duplicaValutazione, leggiValutazione, salvaValutazione } from '../src/main/valutazione'
import { relazioneValutazione } from '../src/main/relazione-valutazione'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

test('Duplicare una valutazione: i rilievi si copiano, i racconti no', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pzV = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Val', 'Duplica')")
  const dist = ins("INSERT INTO distretti (nome) VALUES ('Spalla')")
  const movi = ins(
    "INSERT INTO distretto_movimenti (distretto_id, nome, gradi, ordine) VALUES (?, 'Abduzione', 1, 0)",
    dist
  )
  const testId = ins(
    "INSERT INTO distretto_test (distretto_id, nome, gruppo, risposta, ordine) VALUES (?, 'Jobe', 'ortopedici', 'posneg', 0)",
    dist
  )
  const primaId = ins(
    "INSERT INTO valutazioni (paziente_id, data, ispezione, note) VALUES (?, '2026-09-01', 'spalla in antepulsione', 'da rivedere')",
    pzV
  )
  ins(
    `INSERT INTO valutazione_distretti (valutazione_id, distretto_id, nota_attivo, nota_passivo)
     VALUES (?, ?, 'dolore a fine corsa', null)`,
    primaId,
    dist
  )
  ins(
    `INSERT INTO valutazione_movimenti (valutazione_id, movimento_id, attivo_restrizione,
       attivo_dolore, attivo_gradi) VALUES (?, ?, 2, 1, 120)`,
    primaId,
    movi
  )
  ins(
    "INSERT INTO valutazione_test (valutazione_id, test_id, valore) VALUES (?, ?, 'positivo')",
    primaId,
    testId
  )

  // una data che non esiste non si salva: niente valutazione con la data sbagliata
  assert.throws(() => duplicaValutazione(primaId, '2026-02-30'), /non è una data valida/)
  assert.throws(() => duplicaValutazione(primaId, 'domani'), /non è una data valida/)
  const copiaId = duplicaValutazione(primaId, '2026-10-01')
  const copia = leggiValutazione(copiaId)
  assert.equal(copia.valutazione.data, '2026-10-01')
  assert.deepEqual(copia.distretto_ids, [dist])
  assert.equal(copia.movimenti[0].attivo_gradi, 120)
  assert.equal(copia.movimenti[0].attivo_restrizione, 2)
  assert.equal(copia.test[0].valore, 'positivo')
  assert.equal(copia.note_movimenti[0].attivo, 'dolore a fine corsa')
  // i testi discorsivi raccontano quel giorno la': non si ricopiano
  assert.equal(copia.valutazione.ispezione, null)
  assert.equal(copia.valutazione.note, null)
  // e l'originale resta com'era
  assert.equal(leggiValutazione(primaId).valutazione.ispezione, 'spalla in antepulsione')

  // Un distretto con il lato: destra e sinistra si salvano separati, il sano
  // puo' essere "nella norma", e la cartella mette a confronto i gradi.
  const pzL = ins("INSERT INTO pazienti (nome, cognome, arto_operato) VALUES ('Lati', 'Due', 'dx')")
  const ginocchio = ins("INSERT INTO distretti (nome, bilaterale) VALUES ('Ginocchio', 1)")
  const flessione = ins(
    "INSERT INTO distretto_movimenti (distretto_id, nome, gradi, ordine) VALUES (?, 'Flessione', 1, 0)",
    ginocchio
  )
  const lachman = ins(
    "INSERT INTO distretto_test (distretto_id, nome, gruppo, risposta, ordine) VALUES (?, 'Lachman', 'ortopedici', 'posneg', 0)",
    ginocchio
  )
  const valL = ins("INSERT INTO valutazioni (paziente_id, data) VALUES (?, '2026-09-10')", pzL)
  const vuotoRilievo = {
    attivo_restrizione: null,
    attivo_dolore: null,
    attivo_gradi: null,
    passivo_restrizione: null,
    passivo_dolore: null,
    passivo_gradi: null,
    nota: null,
    norma: null,
    passivo_norma: null
  }
  salvaValutazione({
    ...leggiValutazione(valL),
    distretto_ids: [ginocchio],
    movimenti: [
      { ...vuotoRilievo, movimento_id: flessione, lato: 'dx', attivo_restrizione: 2, attivo_dolore: 1, attivo_gradi: 110 },
      { ...vuotoRilievo, movimento_id: flessione, lato: 'sx', attivo_gradi: 140, norma: 1, passivo_norma: 1 }
    ],
    test: [
      // con i due lati la nota e' una sola, del test: sta nella riga di destra
      { test_id: lachman, lato: 'dx', valore: 'positivo', nota: 'fine corsa morbido' },
      { test_id: lachman, lato: 'sx', valore: 'negativo', nota: null }
    ]
  })
  const lettaL = leggiValutazione(valL)
  assert.equal(lettaL.movimenti.length, 2)
  assert.equal(lettaL.movimenti.find((m) => m.lato === 'sx')?.norma, 1)
  assert.equal(lettaL.movimenti.find((m) => m.lato === 'sx')?.passivo_norma, 1)
  assert.equal(lettaL.test.length, 2)
  const cartellaL = generaCartella(pzL, ['valutazioni'])
  assert.ok(cartellaL.includes('Flessione attivo: destra 110° (interessato), sinistra 140° — lato interessato −21%'))
  assert.ok(cartellaL.includes('Flessione (nella norma)'))
  assert.ok(cartellaL.includes('Lachman: destra positivo, sinistra negativo (fine corsa morbido)'))

  // La relazione scritta della valutazione: le stesse cose in frasi.
  c.prepare("UPDATE valutazioni SET ispezione = 'tumefazione al ginocchio', carico_locale = 'diminuito', capacita_generale = 'aumentato' WHERE id = ?").run(valL)
  const relV = relazioneValutazione(pzL)
  assert.equal(relV[0].titolo, 'Valutazione del 10/09/2026')
  const testoV = relV[0].paragrafi.join(' ')
  assert.ok(testoV.includes("All'ispezione, osservazione e palpazione: tumefazione al ginocchio."))
  assert.ok(testoV.includes('Movimenti attivi a destra (lato interessato): flessione moderatamente limitata e dolorosa (110°).'))
  assert.ok(testoV.includes('Movimenti attivi a sinistra: flessione nella norma (140°).'))
  assert.ok(testoV.includes('Confronto fra i lati: flessione attiva 110° a destra e 140° a sinistra, −21% sul lato interessato.'))
  assert.ok(testoV.includes('Movimenti passivi a sinistra: flessione nella norma.'))
  assert.ok(
    testoV.includes('Lachman positivo a destra (lato interessato) e negativo a sinistra (fine corsa morbido)')
  )
  assert.ok(testoV.includes('Carico locale diminuito, capacità di carico generale aumentata.'))
  const documentoV = generaRelazione(pzL, 'valutazione')
  assert.ok(documentoV.includes('Relazione della valutazione obiettiva · stampata il'))
})
