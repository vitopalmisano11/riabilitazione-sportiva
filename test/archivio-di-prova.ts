// Ogni file di prova lavora su un archivio tutto suo, cifrato come quello vero,
// in una cartella temporanea che sparisce alla fine. Le prove di uno stesso
// file girano in fila sullo stesso archivio; file diversi non si vedono.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll } from 'vitest'
import { closeDb, initDb } from '../src/main/db'

export const DEK_DI_PROVA = 'ab'.repeat(32)

export function archivioDiProva(): { cartella: () => string } {
  let dir = ''
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'riab-prova-'))
    initDb(join(dir, 'prova.db'), DEK_DI_PROVA)
  })
  afterAll(() => {
    closeDb()
    rmSync(dir, { recursive: true, force: true })
  })
  return { cartella: () => dir }
}
