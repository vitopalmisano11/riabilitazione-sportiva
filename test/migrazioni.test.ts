// Le migrazioni delle versioni rilasciate non si toccano, e un archivio di
// qualunque versione passata si aggiorna senza perdere niente.
//
// L'archivio di chi usa il programma si aggiorna da solo al primo accesso, e le
// migrazioni non si annullano: se una gia' rilasciata cambia, chi ha quella
// versione si ritrova con uno schema diverso da quello che il programma si
// aspetta. Per questo `test/migrazioni-rilasciate.json` ricorda l'impronta
// delle migrazioni di ogni versione uscita. Dopo ogni rilascio che aggiunge
// migrazioni si aggiunge una riga (vedi CLAUDE.md, "Release").
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3-multiple-ciphers'
import { MIGRATIONS, registraFunzioniMigrazioni, runMigrations } from '../src/main/migrations'

interface Rilascio {
  versione: string
  migrazioni: number
  sha256: string
}
const rilasci = JSON.parse(
  readFileSync(new URL('./migrazioni-rilasciate.json', import.meta.url), 'utf-8')
) as Rilascio[]

const impronta = (n: number): string =>
  createHash('sha256').update(MIGRATIONS.slice(0, n).join('\u0000')).digest('hex')

test('Le migrazioni gia\' rilasciate non sono cambiate', () => {
  assert.ok(rilasci.length >= 5)
  for (const r of rilasci) {
    assert.ok(MIGRATIONS.length >= r.migrazioni, `mancano migrazioni della ${r.versione}`)
    assert.equal(
      impronta(r.migrazioni),
      r.sha256,
      `Le migrazioni della ${r.versione} sono state modificate: non si fa mai, si aggiunge una migrazione nuova in coda.`
    )
  }
  // ogni rilascio ne ha almeno quante il precedente
  for (let i = 1; i < rilasci.length; i++) {
    assert.ok(rilasci[i].migrazioni >= rilasci[i - 1].migrazioni)
  }
})

// Un archivio come l'avrebbe lasciato quella versione: solo le sue migrazioni
// applicate, con dentro un paziente e una seduta.
test('Un archivio di ogni versione rilasciata si aggiorna senza perdere niente', () => {
  for (const r of rilasci) {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    // le funzioni SQL che certe migrazioni chiamano (la 56) c'erano gia' in quella versione
    registraFunzioniMigrazioni(db)
    for (let i = 0; i < r.migrazioni; i++) {
      db.exec(MIGRATIONS[i])
      db.pragma(`user_version = ${i + 1}`)
    }
    const pz = Number(
      db.prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Archivio', ?)").run(`v${r.versione}`)
        .lastInsertRowid
    )
    const seduta = Number(
      db
        .prepare("INSERT INTO sedute (paziente_id, data, note) VALUES (?, '2025-03-01', 'di una volta')")
        .run(pz).lastInsertRowid
    )

    runMigrations(db)

    const dove = `archivio della ${r.versione}`
    assert.equal(db.pragma('user_version', { simple: true }), MIGRATIONS.length, dove)
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok', dove)
    assert.deepEqual(db.pragma('foreign_key_check'), [], dove)
    assert.deepEqual(
      db.prepare('SELECT nome, cognome FROM pazienti WHERE id = ?').get(pz),
      { nome: 'Archivio', cognome: `v${r.versione}` },
      dove
    )
    const s = db.prepare('SELECT paziente_id, data, note FROM sedute WHERE id = ?').get(seduta)
    assert.deepEqual(s, { paziente_id: pz, data: '2025-03-01', note: 'di una volta' }, dove)
    // quello che le versioni dopo hanno aggiunto parte da un valore neutro
    const nuovo = db.prepare('SELECT stato, recensione FROM pazienti WHERE id = ?').get(pz)
    assert.deepEqual(nuovo, { stato: 'trattamento', recensione: 0 }, dove)
    db.close()
  }
})
