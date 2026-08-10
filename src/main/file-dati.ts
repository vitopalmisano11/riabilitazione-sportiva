// Spostamento dei file dati tra cartelle. Nessuna dipendenza da Electron:
// testabile con Node (vedi scripts/smoke.ts).
import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'

export const NOMI_FILE_DATI = [
  'riabilitazione.db',
  'riabilitazione.db-wal',
  'riabilitazione.db-shm',
  'auth.json'
] as const

// rename fallisce tra volumi diversi (EXDEV): fallback copia+elimina.
function sposta(da: string, a: string): void {
  try {
    renameSync(da, a)
  } catch {
    copyFileSync(da, a)
    unlinkSync(da)
  }
}

export function spostaFileDati(daDir: string, aDir: string): void {
  mkdirSync(aDir, { recursive: true })
  if (
    existsSync(join(daDir, 'riabilitazione.db')) &&
    existsSync(join(aDir, 'riabilitazione.db'))
  ) {
    throw new Error("La cartella di destinazione contiene già i dati dell'app.")
  }
  for (const nome of NOMI_FILE_DATI) {
    const da = join(daDir, nome)
    const a = join(aDir, nome)
    if (existsSync(da) && !existsSync(a)) sposta(da, a)
  }
}
