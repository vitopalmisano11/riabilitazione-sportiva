// Impostazioni dell'app. Il file impostazioni.json resta sempre in userData
// (posizione fissa); indica dove si trova la cartella dati (db + auth),
// di default Documenti/Riabilitazione per rendere banale il backup manuale.
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spostaFileDati } from './file-dati'

interface Impostazioni {
  cartellaDati: string
}

const percorsoFile = (): string => join(app.getPath('userData'), 'impostazioni.json')

export function cartellaDati(): string {
  let dir: string | null = null
  try {
    dir = (JSON.parse(readFileSync(percorsoFile(), 'utf-8')) as Impostazioni).cartellaDati || null
  } catch {
    // file assente o illeggibile: si usa il default
  }
  if (!dir) dir = join(app.getPath('documents'), 'Riabilitazione')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function impostaCartellaDati(dir: string): void {
  writeFileSync(percorsoFile(), JSON.stringify({ cartellaDati: dir }, null, 2))
}

// Migrazione una tantum: le versioni precedenti salvavano db e auth in userData.
export function migraDaUserData(): void {
  const legacy = join(app.getPath('userData'), 'riabilitazione.db')
  const dest = cartellaDati()
  if (existsSync(legacy) && !existsSync(join(dest, 'riabilitazione.db'))) {
    spostaFileDati(app.getPath('userData'), dest)
  }
}
