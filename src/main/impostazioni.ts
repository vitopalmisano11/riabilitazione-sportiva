// Impostazioni dell'app. Il file impostazioni.json resta sempre in userData
// (posizione fissa); indica dove si trova la cartella dati (db + auth),
// di default Documenti/Riabilitazione per rendere banale il backup manuale.
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spostaFileDati } from './file-dati'

interface Impostazioni {
  cartellaDati?: string
  cartellaExport?: string
  cartellaBackup?: string
  backupAttivo?: boolean
  backupDaTenere?: number
}

const percorsoFile = (): string => join(app.getPath('userData'), 'impostazioni.json')

function leggi(): Impostazioni {
  try {
    return JSON.parse(readFileSync(percorsoFile(), 'utf-8')) as Impostazioni
  } catch {
    return {}
  }
}

function salva(patch: Impostazioni): void {
  writeFileSync(percorsoFile(), JSON.stringify({ ...leggi(), ...patch }, null, 2))
}

// In sviluppo il default è una cartella a parte, per non lavorare sui dati veri.
const nomeCartellaDati = (): string =>
  app.isPackaged ? 'Riabilitazione' : 'Riabilitazione (dev)'

export function cartellaDati(): string {
  const dir = leggi().cartellaDati || join(app.getPath('documents'), nomeCartellaDati())
  mkdirSync(dir, { recursive: true })
  return dir
}

export function impostaCartellaDati(dir: string): void {
  salva({ cartellaDati: dir })
}

export function cartellaExport(): string {
  return leggi().cartellaExport || app.getPath('documents')
}

export function impostaCartellaExport(dir: string): void {
  salva({ cartellaExport: dir })
}

// Le copie di sicurezza: di default in una sottocartella dell'archivio, ma si
// puo' puntare altrove — dentro OneDrive, per esempio, e finiscono online da
// sole.
export function cartellaBackup(): string {
  const dir = leggi().cartellaBackup || join(cartellaDati(), 'Backup')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function impostaCartellaBackup(dir: string): void {
  salva({ cartellaBackup: dir })
}

export function backupAttivo(): boolean {
  return leggi().backupAttivo !== false
}

export function impostaBackupAttivo(attivo: boolean): void {
  salva({ backupAttivo: attivo })
}

export function backupDaTenere(): number {
  const n = leggi().backupDaTenere
  return typeof n === 'number' && n > 0 ? n : 10
}

export function impostaBackupDaTenere(n: number): void {
  salva({ backupDaTenere: Math.max(1, Math.min(100, Math.round(n))) })
}

// Migrazione una tantum: le versioni precedenti salvavano db e auth in userData.
export function migraDaUserData(): void {
  const legacy = join(app.getPath('userData'), 'riabilitazione.db')
  const dest = cartellaDati()
  if (existsSync(legacy) && !existsSync(join(dest, 'riabilitazione.db'))) {
    spostaFileDati(app.getPath('userData'), dest)
  }
}
