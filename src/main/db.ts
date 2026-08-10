import Database from 'better-sqlite3-multiple-ciphers'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function initDb(path: string): void {
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database non inizializzato')
  return db
}
