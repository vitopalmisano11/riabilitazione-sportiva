// Password, chiavi e cifratura dell'archivio: dal primo avvio con un archivio
// in chiaro fino al recupero con la chiave o con la domanda.
// Le prove sono in fila: ognuna parte da dove ha lasciato la precedente.
import { afterAll, beforeAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3-multiple-ciphers'
import { runMigrations } from '../src/main/migrations'
import {
  cambiaPasswordAuth,
  domandaAuth,
  impostaDomandaAuth,
  loginAuth,
  recoverAuth,
  recoverDomandaAuth,
  setupAuth,
  togliDomandaAuth
} from '../src/main/auth'
import { apriAltroDb, closeDb, controllaArchivio, getDb, initDb, isPlaintextDb } from '../src/main/db'

let dirAuth = ''
let authPath = ''
let dbPath = ''
let dekHex = ''
let recoveryKey = ''

beforeAll(() => {
  dirAuth = mkdtempSync(join(tmpdir(), 'riab-auth-'))
  authPath = join(dirAuth, 'auth.json')
  dbPath = join(dirAuth, 'dati.db')
})
afterAll(() => {
  try {
    closeDb()
  } catch {
    // gia' chiuso
  }
  rmSync(dirAuth, { recursive: true, force: true })
})

test('Primo avvio: un archivio in chiaro si cifra senza perdere niente', () => {
  // Database in chiaro preesistente con dati (simula la migrazione al primo setup)
  const plain = new Database(dbPath)
  plain.pragma('journal_mode = WAL')
  runMigrations(plain)
  plain.prepare('INSERT INTO categorie (nome) VALUES (?)').run('Rinforzo')
  plain.close()
  assert.ok(isPlaintextDb(dbPath))

  const chiavi = setupAuth(authPath, 'password-segreta')
  dekHex = chiavi.dekHex
  recoveryKey = chiavi.recoveryKey
  assert.equal(loginAuth(authPath, 'password-segreta'), dekHex)
  assert.throws(() => loginAuth(authPath, 'password-sbagliata'), /Password errata/)

  // initDb cifra in place il db in chiaro e lo apre: i dati sopravvivono
  initDb(dbPath, dekHex)
  assert.equal(
    (getDb().prepare('SELECT COUNT(*) AS n FROM categorie').get() as { n: number }).n,
    1
  )
})

test("Controllo dell'archivio: un database sano lo dice", () => {
  getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Mario', 'Rossi')").run()
  const esito = controllaArchivio()
  assert.ok(esito.ok, esito.messaggio)
  assert.ok(esito.pazienti > 0)
})

test('Senza la chiave il file non si legge', () => {
  getDb().close()
  assert.ok(!isPlaintextDb(dbPath))
  assert.throws(() => {
    const senzaChiave = new Database(dbPath)
    try {
      senzaChiave.prepare('SELECT count(*) FROM sqlite_master').get()
    } finally {
      senzaChiave.close()
    }
  })
})

// E' il cuore del pulsante "Controlla" delle copie di sicurezza: una copia si
// apre in sola lettura con le chiavi di adesso, senza toccare l'archivio in uso.
test('Controllo di una copia: si apre davvero, in disparte', () => {
  const copiaPath = join(dirAuth, 'copia.db')
  copyFileSync(dbPath, copiaPath)
  const copia = apriAltroDb(copiaPath)
  assert.equal(copia.pragma('integrity_check', { simple: true }), 'ok')
  assert.ok((copia.prepare('SELECT COUNT(*) AS n FROM pazienti').get() as { n: number }).n > 0)
  copia.close()
  // un file che non e' un database (o e' rovinato) non passa il controllo
  const rottaPath = join(dirAuth, 'rotta.db')
  writeFileSync(rottaPath, 'questo non e un database')
  assert.throws(() => apriAltroDb(rottaPath))
})

test('Chiave di recupero: accetta formattazione "sporca" e imposta una nuova password', () => {
  const dekRecuperata = recoverAuth(authPath, recoveryKey.toLowerCase().replace(/-/g, ' '), 'nuova-password')
  assert.equal(dekRecuperata, dekHex)
  assert.equal(loginAuth(authPath, 'nuova-password'), dekHex)
  assert.throws(() => loginAuth(authPath, 'password-segreta'), /Password errata/)
})

test('Cambio password: la chiave di recupero resta valida', () => {
  cambiaPasswordAuth(authPath, 'nuova-password', 'password-numero-tre')
  assert.equal(loginAuth(authPath, 'password-numero-tre'), dekHex)
  assert.equal(recoverAuth(authPath, recoveryKey, 'password-numero-tre'), dekHex)
})

// La domanda si imposta con la password, la risposta non bada a maiuscole e
// spazi, e la chiave di recupero resta valida.
test('Domanda di recupero', () => {
  assert.equal(domandaAuth(authPath), null)
  assert.throws(() => impostaDomandaAuth(authPath, 'sbagliata', 'Primo cane?', 'Fido'), /Password errata/)
  // una risposta corta si indovina troppo in fretta: si rifiuta, e non cambia niente
  assert.throws(
    () => impostaDomandaAuth(authPath, 'password-numero-tre', 'Nome del primo cane?', 'Fido'),
    /almeno 8 caratteri/
  )
  assert.throws(
    () => impostaDomandaAuth(authPath, 'password-numero-tre', 'Nome del primo cane?', '  Fido   '),
    /almeno 8 caratteri/
  )
  impostaDomandaAuth(authPath, 'password-numero-tre', 'Nome del primo cane?', 'Fido Bello')
  assert.equal(domandaAuth(authPath), 'Nome del primo cane?')
  assert.throws(() => recoverDomandaAuth(authPath, 'Rex', 'password-quattro'), /Risposta sbagliata/)
  assert.equal(recoverDomandaAuth(authPath, '  fido   BELLO ', 'password-quattro'), dekHex)
  assert.equal(loginAuth(authPath, 'password-quattro'), dekHex)
  assert.equal(recoverAuth(authPath, recoveryKey, 'password-quattro'), dekHex)
  togliDomandaAuth(authPath, 'password-quattro')
  assert.equal(domandaAuth(authPath), null)
  assert.throws(() => recoverDomandaAuth(authPath, 'fido bello', 'password-cinque'), /Non è stata impostata/)
})
