// Le migrazioni delle versioni rilasciate non si toccano, e un archivio di
// qualunque versione passata si aggiorna senza perdere niente.
//
// L'archivio di chi usa il programma si aggiorna da solo al primo accesso, e le
// migrazioni non si annullano: se una gia' rilasciata cambia, chi ha quella
// versione si ritrova con uno schema diverso da quello che il programma si
// aspetta. Per questo `test/migrazioni-rilasciate.json` ricorda l'impronta
// delle migrazioni di ogni versione uscita. Dopo ogni rilascio che aggiunge
// migrazioni si aggiunge una riga (vedi CLAUDE.md, "Release").
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3-multiple-ciphers'
import { MIGRATIONS, registraFunzioniMigrazioni, runMigrations } from '../src/main/migrations'

interface Rilascio {
  versione: string
  migrazioni: number
  sha256: string
}
const rilasci = JSON.parse(
  readFileSync(new URL('./migrazioni-rilasciate.json', import.meta.url), 'utf-8')
) as Rilascio[]

const impronta = (n: number): string =>
  createHash('sha256').update(MIGRATIONS.slice(0, n).join('\u0000')).digest('hex')

test('Le migrazioni gia\' rilasciate non sono cambiate', () => {
  assert.ok(rilasci.length >= 5)
  for (const r of rilasci) {
    assert.ok(MIGRATIONS.length >= r.migrazioni, `mancano migrazioni della ${r.versione}`)
    assert.equal(
      impronta(r.migrazioni),
      r.sha256,
      `Le migrazioni della ${r.versione} sono state modificate: non si fa mai, si aggiunge una migrazione nuova in coda.`
    )
  }
  // ogni rilascio ne ha almeno quante il precedente
  for (let i = 1; i < rilasci.length; i++) {
    assert.ok(rilasci[i].migrazioni >= rilasci[i - 1].migrazioni)
  }
})

// Un archivio come l'avrebbe lasciato quella versione: solo le sue migrazioni
// applicate, con dentro un paziente e una seduta.
test('Un archivio di ogni versione rilasciata si aggiorna senza perdere niente', () => {
  for (const r of rilasci) {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    // le funzioni SQL che certe migrazioni chiamano (la 56) c'erano gia' in quella versione
    registraFunzioniMigrazioni(db)
    for (let i = 0; i < r.migrazioni; i++) {
      db.exec(MIGRATIONS[i])
      db.pragma(`user_version = ${i + 1}`)
    }
    const pz = Number(
      db.prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Archivio', ?)").run(`v${r.versione}`)
        .lastInsertRowid
    )
    const seduta = Number(
      db
        .prepare("INSERT INTO sedute (paziente_id, data, note) VALUES (?, '2025-03-01', 'di una volta')")
        .run(pz).lastInsertRowid
    )

    runMigrations(db)

    const dove = `archivio della ${r.versione}`
    assert.equal(db.pragma('user_version', { simple: true }), MIGRATIONS.length, dove)
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok', dove)
    assert.deepEqual(db.pragma('foreign_key_check'), [], dove)
    assert.deepEqual(
      db.prepare('SELECT nome, cognome FROM pazienti WHERE id = ?').get(pz),
      { nome: 'Archivio', cognome: `v${r.versione}` },
      dove
    )
    const s = db.prepare('SELECT paziente_id, data, note FROM sedute WHERE id = ?').get(seduta)
    assert.deepEqual(s, { paziente_id: pz, data: '2025-03-01', note: 'di una volta' }, dove)
    // quello che le versioni dopo hanno aggiunto parte da un valore neutro
    const nuovo = db.prepare('SELECT stato, recensione FROM pazienti WHERE id = ?').get(pz)
    assert.deepEqual(nuovo, { stato: 'trattamento', recensione: 0 }, dove)
    db.close()
  }
})

// La 66 ricostruisce la tabella dei promemoria: quelli che c'erano restano uguali
// e il vincolo ora ne ammette anche uno per la pedana.
test('La migrazione 66 conserva i promemoria di prima', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  registraFunzioniMigrazioni(db)
  for (let i = 0; i < 65; i++) {
    db.exec(MIGRATIONS[i])
    db.pragma(`user_version = ${i + 1}`)
  }
  const pz = Number(db.prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Pro', 'Memoria')").run().lastInsertRowid)
  const q = Number(db.prepare("INSERT INTO questionari (nome, ordine) VALUES ('KOOS', 0)").run().lastInsertRowid)
  const p = Number(db.prepare("INSERT INTO screening_protocolli (nome, sport) VALUES ('RTP', 'Calcio')").run().lastInsertRowid)
  db.prepare("INSERT INTO promemoria (paziente_id, tipo, questionario_id, scadenza, nota) VALUES (?, 'questionario', ?, '2026-11-01', 'nota')").run(pz, q)
  db.prepare("INSERT INTO promemoria (paziente_id, tipo, protocollo_id, scadenza, fatto_il) VALUES (?, 'screening', ?, '2026-10-01', '2026-10-02')").run(pz, p)

  runMigrations(db)

  assert.deepEqual(
    db.prepare('SELECT tipo, questionario_id, protocollo_id, pedana_chiave, scadenza, nota, fatto_il FROM promemoria ORDER BY id').all(),
    [
      { tipo: 'questionario', questionario_id: q, protocollo_id: null, pedana_chiave: null, scadenza: '2026-11-01', nota: 'nota', fatto_il: null },
      { tipo: 'screening', questionario_id: null, protocollo_id: p, pedana_chiave: null, scadenza: '2026-10-01', nota: null, fatto_il: '2026-10-02' }
    ]
  )
  db.prepare("INSERT INTO promemoria (paziente_id, tipo, pedana_chiave, pedana_nome, scadenza) VALUES (?, 'pedana', 'forza.hamstring', 'Forza', '2026-12-01')").run(pz)
  // uno e uno solo fra questionario, protocollo e test della pedana
  assert.throws(() => db.prepare("INSERT INTO promemoria (paziente_id, tipo, scadenza) VALUES (?, 'pedana', '2026-12-01')").run(pz))
  assert.throws(() => db.prepare("INSERT INTO promemoria (paziente_id, tipo, questionario_id, pedana_chiave, scadenza) VALUES (?, 'x', ?, 'a', '2026-12-01')").run(pz, q))
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  db.close()
})

// La 68 ricostruisce progressione_step per togliere il divieto di ripetere lo
// stesso esercizio e dare una dose a ogni step: gli step di prima restano.
test("La migrazione 68 conserva gli step di prima e ammette lo stesso esercizio piu' volte", () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  registraFunzioniMigrazioni(db)
  for (let i = 0; i < 67; i++) {
    db.exec(MIGRATIONS[i])
    db.pragma(`user_version = ${i + 1}`)
  }
  const cat = Number(db.prepare("INSERT INTO categorie (nome, ordine) VALUES ('Corsa', 0)").run().lastInsertRowid)
  const e1 = Number(db.prepare("INSERT INTO esercizi (nome, categoria_id) VALUES ('Wall sit', ?)").run(cat).lastInsertRowid)
  const e2 = Number(db.prepare("INSERT INTO esercizi (nome, categoria_id) VALUES ('Squat', ?)").run(cat).lastInsertRowid)
  const p = Number(db.prepare("INSERT INTO progressioni (nome, ordine) VALUES ('Vertical', 0)").run().lastInsertRowid)
  const ins = db.prepare('INSERT INTO progressione_step (progressione_id, esercizio_id, requisito, ordine) VALUES (?, ?, ?, ?)')
  ins.run(p, e1, null, 0)
  ins.run(p, e2, 'front squat di qualita', 1)
  // prima il doppione era vietato
  assert.throws(() => ins.run(p, e1, null, 2))

  runMigrations(db)

  assert.deepEqual(
    db.prepare('SELECT esercizio_id, requisito, ordine, serie, ripetizioni, recupero FROM progressione_step ORDER BY ordine').all(),
    [
      { esercizio_id: e1, requisito: null, ordine: 0, serie: null, ripetizioni: null, recupero: null },
      { esercizio_id: e2, requisito: 'front squat di qualita', ordine: 1, serie: null, ripetizioni: null, recupero: null }
    ]
  )
  // ora lo stesso esercizio puo' tornare, con la sua dose
  db.prepare('INSERT INTO progressione_step (progressione_id, esercizio_id, serie, ripetizioni, ordine) VALUES (?, ?, ?, ?, ?)').run(p, e1, '5', "3'", 2)
  // eliminare la progressione porta via i suoi step, come prima
  db.prepare('DELETE FROM progressioni WHERE id = ?').run(p)
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM progressione_step').get() as { n: number }).n, 0)
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  db.close()
})
