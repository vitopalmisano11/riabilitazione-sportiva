// Smoke test del database: migrazioni + vincoli principali.
// Uso: npm run smoke  (richiede il modulo nativo compilato per Node, non per Electron:
// se fallisce con NODE_MODULE_VERSION, eseguire prima
// `npm rebuild better-sqlite3-multiple-ciphers`. Dopo il test, per far ripartire
// l'app, ripristinare la build per Electron con `npx @electron/rebuild -f -m .`
// — serve il flag -f perché la cache di rebuild non si accorge del cambio di ABI.)
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3-multiple-ciphers'
import { runMigrations } from '../src/main/migrations'

const dir = mkdtempSync(join(tmpdir(), 'riab-smoke-'))
const db = new Database(join(dir, 'test.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

runMigrations(db)
runMigrations(db) // idempotente
assert.equal(db.pragma('user_version', { simple: true }), 1)

const count = (table: string): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

// Seed di un template completo
const patId = db.prepare('INSERT INTO patologie (nome) VALUES (?)').run('Ricostruzione LCA').lastInsertRowid
const faseId = db
  .prepare('INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, ?, 0)')
  .run(patId, 'Fase iniziale').lastInsertRowid
const obId = db
  .prepare('INSERT INTO obiettivi (fase_id, nome, ordine) VALUES (?, ?, 0)')
  .run(faseId, 'Controllo del dolore e gonfiore').lastInsertRowid
const catId = db.prepare('INSERT INTO categorie (nome) VALUES (?)').run('Mobilizzazione').lastInsertRowid
db.prepare('INSERT INTO obiettivo_categorie (obiettivo_id, categoria_id) VALUES (?, ?)').run(obId, catId)
const esId = db
  .prepare(
    "INSERT INTO esercizi (nome, categoria_id, serie_default, ripetizioni_default) VALUES ('Mobilizzazione rotulea', ?, '3', '10')"
  )
  .run(catId).lastInsertRowid

// UNIQUE: patologia duplicata rifiutata
assert.throws(() => db.prepare('INSERT INTO patologie (nome) VALUES (?)').run('Ricostruzione LCA'))

// FK: una categoria con esercizi non si può eliminare
assert.throws(() => db.prepare('DELETE FROM categorie WHERE id = ?').run(catId), /FOREIGN KEY/)

// Un paziente assegnato blocca l'eliminazione di patologia e fase corrente
const pazId = db
  .prepare(
    "INSERT INTO pazienti (nome, cognome, patologia_id, fase_corrente_id) VALUES ('Mario', 'Rossi', ?, ?)"
  )
  .run(patId, faseId).lastInsertRowid
assert.throws(() => db.prepare('DELETE FROM patologie WHERE id = ?').run(patId), /FOREIGN KEY/)
assert.throws(() => db.prepare('DELETE FROM fasi WHERE id = ?').run(faseId), /FOREIGN KEY/)
db.prepare('DELETE FROM pazienti WHERE id = ?').run(pazId)

// Sedute: un esercizio usato nel diario non si può eliminare (va archiviato),
// ma eliminare il paziente elimina in cascata sedute ed esercizi collegati
const pazId2 = db
  .prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Anna', 'Bianchi')")
  .run().lastInsertRowid
const sedId = db
  .prepare("INSERT INTO sedute (paziente_id, data, fase_id) VALUES (?, '2026-08-10', ?)")
  .run(pazId2, faseId).lastInsertRowid
db.prepare('INSERT INTO seduta_obiettivi (seduta_id, obiettivo_id) VALUES (?, ?)').run(sedId, obId)
db.prepare(
  "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ripetizioni, ordine) VALUES (?, ?, '3', '10', 0)"
).run(sedId, esId)
assert.throws(() => db.prepare('DELETE FROM esercizi WHERE id = ?').run(esId), /FOREIGN KEY/)
db.prepare('DELETE FROM pazienti WHERE id = ?').run(pazId2)
assert.equal(count('sedute'), 0)
assert.equal(count('seduta_obiettivi'), 0)
assert.equal(count('seduta_esercizi'), 0)

// CASCADE: eliminare la patologia elimina fasi, obiettivi e associazioni…
db.prepare('DELETE FROM patologie WHERE id = ?').run(patId)
assert.equal(count('fasi'), 0)
assert.equal(count('obiettivi'), 0)
assert.equal(count('obiettivo_categorie'), 0)
// …ma la libreria esercizi resta intatta
assert.equal(count('esercizi'), 1)
assert.equal(count('categorie'), 1)

db.close()
rmSync(dir, { recursive: true, force: true })
console.log('Smoke test OK: migrazioni e vincoli funzionano.')
