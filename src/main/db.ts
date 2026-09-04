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

// Un controllo di salute dell'archivio: che le pagine del file non siano
// rovinate e che nessuna riga punti a qualcosa che non c'e' piu'. E' il
// controllo che si fa dopo uno spegnimento brutto del computer, quando si ha il
// dubbio di aver rotto qualcosa senza accorgersene.
export interface EsitoArchivio {
  ok: boolean
  messaggio: string
  pazienti: number
  sedute: number
}

export function controllaArchivio(): EsitoArchivio {
  const conn = getDb()
  const conta = (tabella: string): number =>
    (conn.prepare(`SELECT COUNT(*) AS n FROM ${tabella}`).get() as { n: number }).n
  const pazienti = conta('pazienti')
  const sedute = conta('sedute')

  const male = conn.pragma('integrity_check', { simple: true })
  if (male !== 'ok') {
    return {
      ok: false,
      messaggio: `Il file dell'archivio risulta danneggiato (${String(male)}). Ripristina la copia di sicurezza più recente.`,
      pazienti,
      sedute
    }
  }

  // Righe orfane: un collegamento che punta a qualcosa di sparito.
  const rotti = conn.pragma('foreign_key_check') as unknown[]
  if (rotti.length > 0) {
    return {
      ok: false,
      messaggio: `Ci sono ${rotti.length} collegamenti rotti fra le tabelle. L'archivio si apre lo stesso, ma qualcosa potrebbe non comparire: fammelo sapere.`,
      pazienti,
      sedute
    }
  }

  return { ok: true, messaggio: 'Tutto in ordine.', pazienti, sedute }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database non inizializzato')
  return db
}
