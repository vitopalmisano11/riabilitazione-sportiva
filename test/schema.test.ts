// Schema del database: migrazioni, vincoli, cascate, archivi di versioni diverse.
import { afterAll, beforeAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3-multiple-ciphers'
import { MIGRATIONS, runMigrations, VERSIONE_SCHEMA } from '../src/main/migrations'
import { closeDb, getDb, initDb } from '../src/main/db'
import { existsSync } from 'node:fs'

let dir = ''
let db: Database.Database
const count = (table: string): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'riab-schema-'))
  db = new Database(join(dir, 'test.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
})
afterAll(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

test('Le migrazioni si applicano, anche due volte, e creano gli indici', () => {
  runMigrations(db)
  runMigrations(db) // idempotente
  assert.equal(db.pragma('user_version', { simple: true }), 62)
  // gli indici delle ricerche frequenti ci sono
  for (const indice of [
    'idx_segno_valori_seduta',
    'idx_compilazione_punteggi_compilazione',
    'idx_sedute_data',
    'idx_seduta_esercizi_esercizio',
    'idx_seduta_esercizi_sezione'
  ]) {
    assert.ok(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(indice),
      indice
    )
  }
})

test("L'elenco degli esercizi conta gli usi con l'indice, senza rileggere tutte le sedute", () => {
  // Senza l'indice, con qualche anno di sedute, l'elenco ci metteva secondi e
  // il programma restava fermo a ogni seduta aperta (migrazione 62).
  const piano = (
    db
      .prepare(
        'EXPLAIN QUERY PLAN SELECT e.id, (SELECT COUNT(*) FROM seduta_esercizi se WHERE se.esercizio_id = e.id) FROM esercizi e'
      )
      .all() as { detail: string }[]
  )
    .map((r) => r.detail)
    .join(' | ')
  assert.match(piano, /SEARCH se USING (COVERING )?INDEX idx_seduta_esercizi_esercizio/)
})

test('Vincoli e cascate: cosa si puo\' eliminare e cosa no', () => {
  // Seed di un template completo
  const patId = db.prepare('INSERT INTO patologie (nome) VALUES (?)').run('Ricostruzione LCA').lastInsertRowid
  const faseId = db
    .prepare('INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, ?, 0)')
    .run(patId, 'Fase iniziale').lastInsertRowid
  const obId = db
    .prepare('INSERT INTO obiettivi (fase_id, nome, ordine) VALUES (?, ?, 0)')
    .run(faseId, 'Controllo del dolore e gonfiore').lastInsertRowid
  const catId = db.prepare('INSERT INTO categorie (nome) VALUES (?)').run('Mobilizzazione').lastInsertRowid
  // v1.3: le categorie hanno un ordine esplicito
  assert.equal(
    (db.prepare('SELECT ordine FROM categorie WHERE id = ?').get(catId) as { ordine: number }).ordine,
    0
  )
  db.prepare('INSERT INTO obiettivo_categorie (obiettivo_id, categoria_id) VALUES (?, ?)').run(obId, catId)
  const esId = db
    .prepare(
      "INSERT INTO esercizi (nome, categoria_id, serie_default, ripetizioni_default, link) VALUES ('Mobilizzazione rotulea', ?, '3', '10', 'https://esempio.it/video')"
    )
    .run(catId).lastInsertRowid
  assert.equal(
    (db.prepare('SELECT link FROM esercizi WHERE id = ?').get(esId) as { link: string }).link,
    'https://esempio.it/video'
  )
  // v1.4: immagine opzionale sull'esercizio, assente finche' non la si carica
  assert.equal(
    (db.prepare('SELECT immagine FROM esercizi WHERE id = ?').get(esId) as { immagine: null })
      .immagine,
    null
  )
  db.prepare('UPDATE esercizi SET immagine = ? WHERE id = ?').run('data:image/png;base64,AAAA', esId)
  assert.equal(
    (
      db.prepare('SELECT (immagine IS NOT NULL) AS ha FROM esercizi WHERE id = ?').get(esId) as {
        ha: number
      }
    ).ha,
    1
  )

  // UNIQUE: patologia duplicata rifiutata
  assert.throws(() => db.prepare('INSERT INTO patologie (nome) VALUES (?)').run('Ricostruzione LCA'))

  // FK: una categoria con esercizi non si può eliminare
  assert.throws(() => db.prepare('DELETE FROM categorie WHERE id = ?').run(catId), /FOREIGN KEY/)

  // Un paziente assegnato blocca l'eliminazione di patologia e fase corrente
  const pazId = db
    .prepare(
      "INSERT INTO pazienti (nome, cognome, patologia_id, fase_corrente_id) VALUES ('Mario', 'Rossi', ?, ?)"
    )
    .run(patId, faseId).lastInsertRowid
  assert.throws(() => db.prepare('DELETE FROM patologie WHERE id = ?').run(patId), /FOREIGN KEY/)
  assert.throws(() => db.prepare('DELETE FROM fasi WHERE id = ?').run(faseId), /FOREIGN KEY/)
  db.prepare('DELETE FROM pazienti WHERE id = ?').run(pazId)

  // Gruppi (v1.5: dove segui il paziente): stesso comportamento delle patologie,
  // un paziente assegnato blocca l'eliminazione del gruppo, cosi' non si perde
  // mai a chi appartiene.
  const gruppoId = db.prepare('INSERT INTO gruppi (nome, ordine) VALUES (?, 0)').run('Centro').lastInsertRowid
  const pazGruppoId = db
    .prepare("INSERT INTO pazienti (nome, cognome, gruppo_id) VALUES ('Paziente', 'Prova', ?)")
    .run(gruppoId).lastInsertRowid
  assert.throws(() => db.prepare('DELETE FROM gruppi WHERE id = ?').run(gruppoId), /FOREIGN KEY/)
  assert.equal(
    (db.prepare('SELECT gruppo_id FROM pazienti WHERE id = ?').get(pazGruppoId) as { gruppo_id: number })
      .gruppo_id,
    gruppoId
  )
  db.prepare('DELETE FROM pazienti WHERE id = ?').run(pazGruppoId)
  db.prepare('DELETE FROM gruppi WHERE id = ?').run(gruppoId)
  assert.equal(count('gruppi'), 0)

  // Sedute (v1.1: con sezioni e recupero): un esercizio usato nel diario non si
  // può eliminare (va archiviato), ma eliminare il paziente elimina in cascata
  // sedute, sezioni ed esercizi collegati. Obiettivi raggiunti e test seguono il paziente.
  const pazId2 = db
    .prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Anna', 'Bianchi')")
    .run().lastInsertRowid
  const sedId = db
    .prepare("INSERT INTO sedute (paziente_id, data, fase_id) VALUES (?, '2026-08-10', ?)")
    .run(pazId2, faseId).lastInsertRowid
  const sezTemplateId = db
    .prepare("INSERT INTO sezioni (fase_id, nome, ordine) VALUES (?, 'Riscaldamento', 0)")
    .run(faseId).lastInsertRowid
  db.prepare('INSERT INTO sezione_categorie (sezione_id, categoria_id, ordine) VALUES (?, ?, 0)').run(
    sezTemplateId,
    catId
  )
  const sedSezId = db
    .prepare("INSERT INTO seduta_sezioni (seduta_id, sezione_id, nome, ordine) VALUES (?, ?, 'Riscaldamento', 0)")
    .run(sedId, sezTemplateId).lastInsertRowid
  db.prepare(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ripetizioni, recupero, ordine, seduta_sezione_id) VALUES (?, ?, '3', '10', '1 min', 0, ?)"
  ).run(sedId, esId, sedSezId)
  db.prepare('INSERT INTO paziente_obiettivi (paziente_id, obiettivo_id) VALUES (?, ?)').run(pazId2, obId)
  const testId = db
    .prepare("INSERT INTO test_avanzamento (fase_id, nome, ordine) VALUES (?, 'Hop test (cm)', 0)")
    .run(faseId).lastInsertRowid
  db.prepare("INSERT INTO paziente_test (paziente_id, test_id, eseguito, valore) VALUES (?, ?, 1, '120')").run(
    pazId2,
    testId
  )
  assert.throws(() => db.prepare('DELETE FROM esercizi WHERE id = ?').run(esId), /FOREIGN KEY/)
  db.prepare('DELETE FROM pazienti WHERE id = ?').run(pazId2)
  assert.equal(count('sedute'), 0)
  assert.equal(count('seduta_sezioni'), 0)
  assert.equal(count('seduta_esercizi'), 0)
  assert.equal(count('paziente_obiettivi'), 0)
  assert.equal(count('paziente_test'), 0)
  // il template della fase resta intatto
  assert.equal(count('sezioni'), 1)
  assert.equal(count('test_avanzamento'), 1)

  // CASCADE: eliminare la patologia elimina fasi, obiettivi, sezioni, test e associazioni…
  db.prepare('DELETE FROM patologie WHERE id = ?').run(patId)
  assert.equal(count('fasi'), 0)
  assert.equal(count('obiettivi'), 0)
  assert.equal(count('obiettivo_categorie'), 0)
  assert.equal(count('sezioni'), 0)
  assert.equal(count('sezione_categorie'), 0)
  assert.equal(count('test_avanzamento'), 0)
  // …ma la libreria esercizi resta intatta
  assert.equal(count('esercizi'), 1)
  assert.equal(count('categorie'), 1)
})

// Un paziente nasce in trattamento e senza recensione: e' quello che deve
// vedere chi apre l'app dopo un aggiornamento, senza dover sistemare niente.
test('Follow-up: stato del paziente e promemoria', () => {
  // paziente suo: quelli di prima sono stati cancellati dai test sulla cascata
  const pazFu = db
    .prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Giulia', 'Verdi')")
    .run().lastInsertRowid
  const stato = db
    .prepare('SELECT stato, follow_up_il, contattato_il, recensione FROM pazienti WHERE id = ?')
    .get(pazFu) as {
    stato: string
    follow_up_il: string | null
    contattato_il: string | null
    recensione: number
  }
  assert.deepEqual(stato, {
    stato: 'trattamento',
    follow_up_il: null,
    contattato_il: null,
    recensione: 0
  })

  db.prepare("UPDATE pazienti SET stato = 'concluso', follow_up_il = '2026-10-01' WHERE id = ?")
    .run(pazFu)
  db.prepare('UPDATE pazienti SET recensione = 1 WHERE id = ?').run(pazFu)
  const dopo = db
    .prepare('SELECT stato, follow_up_il, recensione FROM pazienti WHERE id = ?')
    .get(pazFu) as { stato: string; follow_up_il: string; recensione: number }
  assert.deepEqual(dopo, { stato: 'concluso', follow_up_il: '2026-10-01', recensione: 1 })

  // "contattato" segna la data di oggi e libera il prossimo appuntamento
  db.prepare(
    "UPDATE pazienti SET contattato_il = date('now', 'localtime'), follow_up_il = NULL WHERE id = ?"
  ).run(pazFu)
  const contattato = db
    .prepare('SELECT follow_up_il, contattato_il FROM pazienti WHERE id = ?')
    .get(pazFu) as { follow_up_il: string | null; contattato_il: string | null }
  assert.equal(contattato.follow_up_il, null)
  assert.match(contattato.contattato_il ?? '', /^\d{4}-\d{2}-\d{2}$/)

  // si torna in trattamento senza perdere la recensione gia' segnata
  db.prepare("UPDATE pazienti SET stato = 'trattamento', follow_up_il = NULL WHERE id = ?")
    .run(pazFu)
  const ripreso = db.prepare('SELECT stato, recensione FROM pazienti WHERE id = ?').get(pazFu) as {
    stato: string
    recensione: number
  }
  assert.deepEqual(ripreso, { stato: 'trattamento', recensione: 1 })
})

test('Campo sport (v48): si scrive e si rilegge, e resta vuoto se non c\'e\'', () => {
  const pazSport = db
    .prepare("INSERT INTO pazienti (nome, cognome, sport) VALUES ('Sara', 'Prova', 'Calcio (portiere)')")
    .run().lastInsertRowid
  assert.equal(
    (db.prepare('SELECT sport FROM pazienti WHERE id = ?').get(pazSport) as { sport: string }).sport,
    'Calcio (portiere)'
  )
  db.prepare('UPDATE pazienti SET sport = ? WHERE id = ?').run('Pallavolo', pazSport)
  assert.equal(
    (db.prepare('SELECT sport FROM pazienti WHERE id = ?').get(pazSport) as { sport: string }).sport,
    'Pallavolo'
  )
  const pazSenzaSport = db
    .prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Noemi', 'Prova')")
    .run().lastInsertRowid
  assert.equal(
    (db.prepare('SELECT sport FROM pazienti WHERE id = ?').get(pazSenzaSport) as { sport: string | null })
      .sport,
    null
  )
})

test('Migrazioni: archivio piu\' nuovo del programma, e copia prima di aggiornare', () => {
  const versione = (d: Database.Database): number => d.pragma('user_version', { simple: true }) as number

  // Un archivio di una versione piu' recente non si apre e non si tocca.
  const nuovo = new Database(':memory:')
  runMigrations(nuovo)
  nuovo.exec('CREATE TABLE dal_futuro (x INTEGER)')
  nuovo.pragma(`user_version = ${VERSIONE_SCHEMA + 3}`)
  assert.throws(() => runMigrations(nuovo), /versione più recente/)
  assert.equal(versione(nuovo), VERSIONE_SCHEMA + 3)
  nuovo.close()

  // Un archivio nuovo (versione 0) non ha niente da proteggere: nessuna copia.
  const chiamate: number[] = []
  const vuoto = new Database(':memory:')
  runMigrations(vuoto, (v) => chiamate.push(v))
  assert.equal(chiamate.length, 0)
  assert.equal(versione(vuoto), VERSIONE_SCHEMA)

  // Uno gia' aggiornato non ne ha bisogno.
  runMigrations(vuoto, (v) => chiamate.push(v))
  assert.equal(chiamate.length, 0)

  // Con una migrazione da applicare, la copia si chiama una volta, prima, con la versione di partenza.
  MIGRATIONS.push('CREATE TABLE prova_aggiornamento (x INTEGER)')
  try {
    let esisteAllaCopia: boolean | null = null
    runMigrations(vuoto, (v) => {
      chiamate.push(v)
      esisteAllaCopia = vuoto.prepare("SELECT 1 FROM sqlite_master WHERE name = 'prova_aggiornamento'").get() !== undefined
    })
    assert.deepEqual(chiamate, [VERSIONE_SCHEMA])
    assert.equal(esisteAllaCopia, false, 'la copia va fatta prima della migrazione')
    assert.equal(versione(vuoto), VERSIONE_SCHEMA + 1)

    // Se la copia non riesce, la migrazione non parte e l'archivio resta com'era.
    MIGRATIONS.push('CREATE TABLE seconda_prova (x INTEGER)')
    assert.throws(
      () =>
        runMigrations(vuoto, () => {
          throw new Error('disco pieno')
        }),
      /disco pieno/
    )
    assert.equal(versione(vuoto), VERSIONE_SCHEMA + 1)
    assert.equal(vuoto.prepare("SELECT 1 FROM sqlite_master WHERE name = 'seconda_prova'").get(), undefined)
  } finally {
    MIGRATIONS.length = VERSIONE_SCHEMA
    vuoto.close()
  }
})

test('Migrazione 55: i punteggi gia\' salvati si agganciano al loro punteggio, per nome', () => {
  const cartella55 = mkdtempSync(join(tmpdir(), 'riab-m55-'))
  const vecchio = new Database(join(cartella55, 'prima-della-55.db'))
  vecchio.pragma('foreign_keys = ON')
  for (let i = 0; i < 54; i++) {
    vecchio.exec(MIGRATIONS[i])
    vecchio.pragma(`user_version = ${i + 1}`)
  }
  const ins = (sql: string, ...a: unknown[]): number => Number(vecchio.prepare(sql).run(...a).lastInsertRowid)
  const q1 = ins("INSERT INTO questionari (nome) VALUES ('Q uno')")
  const q2 = ins("INSERT INTO questionari (nome) VALUES ('Q due')")
  const tot1 = ins("INSERT INTO questionario_punteggi (questionario_id, nome, ordine) VALUES (?, 'Totale', 0)", q1)
  const sub1 = ins("INSERT INTO questionario_punteggi (questionario_id, nome, ordine) VALUES (?, 'Sub', 1)", q1)
  const tot2 = ins("INSERT INTO questionario_punteggi (questionario_id, nome, ordine) VALUES (?, 'Totale', 0)", q2)
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Mig', 'Cinquantacinque')")
  const c1 = ins("INSERT INTO paziente_questionari (paziente_id, questionario_id, data) VALUES (?, ?, '2026-01-01')", pz, q1)
  const c2 = ins("INSERT INTO paziente_questionari (paziente_id, questionario_id, data) VALUES (?, ?, '2026-01-02')", pz, q2)
  const punto = vecchio.prepare(
    'INSERT INTO compilazione_punteggi (compilazione_id, nome, valore, ordine) VALUES (?, ?, ?, ?)'
  )
  punto.run(c1, 'Totale', 10, 0)
  punto.run(c1, 'Sub', 3, 1)
  punto.run(c1, 'Tolto da tempo', 1, 2)
  punto.run(c2, 'Totale', 7, 0)
  runMigrations(vecchio)
  assert.equal(vecchio.pragma('user_version', { simple: true }), MIGRATIONS.length)
  const agganci = vecchio
    .prepare('SELECT compilazione_id AS c, nome, punteggio_id AS p FROM compilazione_punteggi ORDER BY c, ordine')
    .all() as { c: number; nome: string; p: number | null }[]
  assert.deepEqual(agganci, [
    { c: c1, nome: 'Totale', p: tot1 },
    { c: c1, nome: 'Sub', p: sub1 },
    { c: c1, nome: 'Tolto da tempo', p: null }, // non c'e' piu': resta il nome
    { c: c2, nome: 'Totale', p: tot2 } // lo stesso nome, ma del suo questionario
  ])
  // togliendo il punteggio dal questionario il rimando si azzera, il valore resta
  vecchio.prepare('DELETE FROM questionario_punteggi WHERE id = ?').run(sub1)
  assert.deepEqual(
    vecchio.prepare("SELECT punteggio_id AS p, valore FROM compilazione_punteggi WHERE nome = 'Sub'").get(),
    { p: null, valore: 3 }
  )
  vecchio.close()
  rmSync(cartella55, { recursive: true, force: true })
})

test('initDb davanti a un archivio piu\' nuovo: errore chiaro, e il file non resta agganciato', () => {
  const dirN = mkdtempSync(join(tmpdir(), 'riab-nuovo-'))
  const dbN = join(dirN, 'n.db')
  const dekN = 'ab'.repeat(32)
  initDb(dbN, dekN)
  closeDb()
  const raw = new Database(dbN)
  raw.pragma("cipher='sqlcipher'")
  raw.pragma(`key='${dekN}'`)
  raw.pragma(`user_version = ${VERSIONE_SCHEMA + 2}`)
  raw.close()
  assert.throws(() => initDb(dbN, dekN), /versione più recente/)
  assert.throws(() => getDb(), /non inizializzato/)
  rmSync(dirN, { recursive: true, force: true }) // su Windows fallirebbe se restasse aperto
  assert.ok(!existsSync(dirN))
})
