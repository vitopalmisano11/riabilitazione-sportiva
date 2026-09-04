import Database from 'better-sqlite3-multiple-ciphers'
import { closeSync, existsSync, openSync, readSync } from 'fs'
import { runMigrations } from './migrations'

let db: Database.Database | null = null
let dekCorrente: string | null = null

const HEADER_PLAINTEXT = 'SQLite format 3\u0000'

export function isPlaintextDb(path: string): boolean {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(16)
    readSync(fd, buf, 0, 16, 0)
    return buf.toString('latin1') === HEADER_PLAINTEXT
  } finally {
    closeSync(fd)
  }
}

// Cifra in place un database in chiaro (migrazione una tantum al primo setup).
function cifraEsistente(path: string, dekHex: string): void {
  const tmp = new Database(path)
  tmp.pragma('journal_mode = DELETE') // WAL va disattivato prima del rekey
  tmp.pragma(`cipher='sqlcipher'`)
  tmp.pragma(`rekey='${dekHex}'`)
  tmp.close()
}

export function initDb(path: string, dekHex: string): void {
  if (db) {
    db.close()
    db = null
  }
  if (existsSync(path) && isPlaintextDb(path)) {
    cifraEsistente(path, dekHex)
  }
  const conn = new Database(path)
  conn.pragma(`cipher='sqlcipher'`)
  conn.pragma(`key='${dekHex}'`)
  conn.prepare('SELECT count(*) FROM sqlite_master').get() // verifica la chiave
  conn.pragma('journal_mode = WAL')
  conn.pragma('foreign_keys = ON')
  runMigrations(conn)
  db = conn
  dekCorrente = dekHex
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

// Riapre il database in un nuovo percorso con la chiave già sbloccata
// (usato dallo spostamento della cartella dati).
export function riapriDb(path: string): void {
  if (!dekCorrente) throw new Error('Database non sbloccato.')
  initDb(path, dekCorrente)
}

// Apre un altro database con la chiave gia' sbloccata, in sola lettura: serve a
// controllare una copia di sicurezza senza toccare l'archivio in uso.
export function apriAltroDb(path: string): Database.Database {
  if (!dekCorrente) throw new Error('Database non sbloccato.')
  const conn = new Database(path, { readonly: true })
  try {
    conn.pragma(`cipher='sqlcipher'`)
    conn.pragma(`key='${dekCorrente}'`)
    conn.prepare('SELECT count(*) FROM sqlite_master').get() // verifica la chiave
  } catch (e) {
    // Se la chiave non apre il file, la connessione va chiusa lo stesso:
    // altrimenti resta appesa a un file che nessuno potra' piu' spostare.
    conn.close()
    throw e
  }
  return conn
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database non inizializzato')
  return db
}
