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
import { generaDocx, generaHtml } from '../src/main/export-doc'
import { cambiaPasswordAuth, loginAuth, recoverAuth, setupAuth } from '../src/main/auth'
import { getDb, initDb, isPlaintextDb } from '../src/main/db'
import { spostaFileDati } from '../src/main/file-dati'
import { existsSync, writeFileSync } from 'node:fs'

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

// Export: generazione HTML (per il PDF) e DOCX da dati campione
const pazExport = {
  nome: 'Mario',
  cognome: 'Rossi',
  tipo_intervento: 'Ricostruzione LCA dx',
  data_intervento: '2026-05-01',
  patologia_nome: 'Ricostruzione LCA'
}
const seduteExport = [
  {
    data: '2026-08-10',
    fase_nome: 'Fase iniziale',
    note: 'Buona risposta, <attenzione> al gonfiore',
    obiettivi: ['Controllo del dolore e gonfiore'],
    esercizi: [
      {
        nome: 'Mobilizzazione & scivolamenti rotulei',
        categoria_nome: 'Mobilizzazione',
        serie: '3',
        ripetizioni: '10',
        carico: null,
        nota: 'lento'
      }
    ]
  }
]
const html = generaHtml(pazExport, seduteExport)
assert.ok(html.includes('Rossi') && html.includes('Seduta del 10/08/2026'))
assert.ok(html.includes('Mobilizzazione &amp; scivolamenti rotulei')) // escaping HTML

// --- Autenticazione e cifratura ---
const dirAuth = mkdtempSync(join(tmpdir(), 'riab-auth-'))
const authPath = join(dirAuth, 'auth.json')
const dbPath = join(dirAuth, 'dati.db')

// Database in chiaro preesistente con dati (simula la migrazione al primo setup)
const plain = new Database(dbPath)
plain.pragma('journal_mode = WAL')
runMigrations(plain)
plain.prepare('INSERT INTO categorie (nome) VALUES (?)').run('Rinforzo')
plain.close()
assert.ok(isPlaintextDb(dbPath))

const { dekHex, recoveryKey } = setupAuth(authPath, 'password-segreta')
assert.equal(loginAuth(authPath, 'password-segreta'), dekHex)
assert.throws(() => loginAuth(authPath, 'password-sbagliata'), /Password errata/)

// initDb cifra in place il db in chiaro e lo apre: i dati sopravvivono
initDb(dbPath, dekHex)
assert.equal(
  (getDb().prepare('SELECT COUNT(*) AS n FROM categorie').get() as { n: number }).n,
  1
)
getDb().close()
assert.ok(!isPlaintextDb(dbPath))
// senza chiave il file non è leggibile
assert.throws(() => {
  const senzaChiave = new Database(dbPath)
  try {
    senzaChiave.prepare('SELECT count(*) FROM sqlite_master').get()
  } finally {
    senzaChiave.close()
  }
})

// Recovery key: accetta formattazione "sporca" e imposta una nuova password
const dekRecuperata = recoverAuth(authPath, recoveryKey.toLowerCase().replace(/-/g, ' '), 'nuova-password')
assert.equal(dekRecuperata, dekHex)
assert.equal(loginAuth(authPath, 'nuova-password'), dekHex)
assert.throws(() => loginAuth(authPath, 'password-segreta'), /Password errata/)

// Cambio password: la recovery key resta valida
cambiaPasswordAuth(authPath, 'nuova-password', 'password-numero-tre')
assert.equal(loginAuth(authPath, 'password-numero-tre'), dekHex)
assert.equal(recoverAuth(authPath, recoveryKey, 'password-numero-tre'), dekHex)

rmSync(dirAuth, { recursive: true, force: true })

// --- Spostamento cartella dati ---
const dirA = mkdtempSync(join(tmpdir(), 'riab-cartella-a-'))
const dirB = mkdtempSync(join(tmpdir(), 'riab-cartella-b-'))
writeFileSync(join(dirA, 'riabilitazione.db'), 'finto-db')
writeFileSync(join(dirA, 'auth.json'), '{}')
spostaFileDati(dirA, dirB)
assert.ok(!existsSync(join(dirA, 'riabilitazione.db')))
assert.ok(existsSync(join(dirB, 'riabilitazione.db')))
assert.ok(existsSync(join(dirB, 'auth.json')))
// non sovrascrive una destinazione che contiene già dati
writeFileSync(join(dirA, 'riabilitazione.db'), 'altro-db')
assert.throws(() => spostaFileDati(dirA, dirB), /contiene già/)
rmSync(dirA, { recursive: true, force: true })
rmSync(dirB, { recursive: true, force: true })

void (async () => {
  const docxBuf = await generaDocx(pazExport, seduteExport)
  assert.ok(docxBuf.length > 1000 && docxBuf[0] === 0x50 && docxBuf[1] === 0x4b) // magic 'PK' (zip)
  console.log('Smoke test OK: migrazioni, vincoli, export e cifratura funzionano.')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
