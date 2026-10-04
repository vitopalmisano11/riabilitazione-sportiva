// Spostamento della cartella dati.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spostaFileDati } from '../src/main/file-dati'
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

test('Spostare la cartella dati: si sposta, e non sovrascrive', () => {
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
})

// Una destinazione con dentro anche solo un pezzo di un altro archivio (le
// chiavi, o un giornale) non si accetta, e non si sposta niente: un database
// con le chiavi sbagliate non si aprirebbe piu'.
test('Una destinazione con un pezzo di un altro archivio non si accetta', () => {
  for (const pezzo of ['auth.json', 'riabilitazione.db-wal', 'riabilitazione.db-shm']) {
    const da = mkdtempSync(join(tmpdir(), 'riab-cartella-da-'))
    const a = mkdtempSync(join(tmpdir(), 'riab-cartella-a-'))
    writeFileSync(join(da, 'riabilitazione.db'), 'db-mio')
    writeFileSync(join(da, 'auth.json'), '{"mio":true}')
    writeFileSync(join(a, pezzo), 'di-un-altro')
    assert.throws(() => spostaFileDati(da, a), /file di un archivio/, pezzo)
    assert.equal(readFileSync(join(da, 'riabilitazione.db'), 'utf-8'), 'db-mio')
    assert.equal(readFileSync(join(da, 'auth.json'), 'utf-8'), '{"mio":true}')
    assert.ok(!existsSync(join(a, 'riabilitazione.db')), 'niente deve essere stato spostato')
    assert.equal(readFileSync(join(a, pezzo), 'utf-8'), 'di-un-altro', 'il file di un altro non si tocca')
    rmSync(da, { recursive: true, force: true })
    rmSync(a, { recursive: true, force: true })
  }
})

test('Se un file non si sposta, quelli gia\' spostati tornano al loro posto', () => {
  const da = mkdtempSync(join(tmpdir(), 'riab-cartella-da-'))
  const a = mkdtempSync(join(tmpdir(), 'riab-cartella-a-'))
  writeFileSync(join(da, 'riabilitazione.db'), 'db-mio')
  writeFileSync(join(da, 'riabilitazione.db-wal'), 'wal-mio')
  writeFileSync(join(da, 'auth.json'), '{"mio":true}')
  let mossi = 0
  const cheSiRompe = (origine: string, dest: string): void => {
    if (origine.endsWith('auth.json')) throw new Error('file bloccato')
    mossi++
    renameSync(origine, dest)
  }
  assert.throws(() => spostaFileDati(da, a, cheSiRompe), /file bloccato/)
  assert.ok(mossi >= 2, 'il database e il giornale erano già stati spostati')
  assert.equal(readFileSync(join(da, 'riabilitazione.db'), 'utf-8'), 'db-mio')
  assert.equal(readFileSync(join(da, 'riabilitazione.db-wal'), 'utf-8'), 'wal-mio')
  assert.equal(readFileSync(join(da, 'auth.json'), 'utf-8'), '{"mio":true}')
  assert.deepEqual(readdirSync(a), [], 'la destinazione deve essere tornata vuota')
  rmSync(da, { recursive: true, force: true })
  rmSync(a, { recursive: true, force: true })
})
