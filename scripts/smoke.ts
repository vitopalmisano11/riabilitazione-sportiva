// Smoke test del database: migrazioni + vincoli principali.
// Uso: npm run smoke  (richiede il modulo nativo compilato per Node, non per Electron:
// se fallisce con NODE_MODULE_VERSION, eseguire prima
// `npm rebuild better-sqlite3-multiple-ciphers`. Dopo il test, per far ripartire
// l'app, ripristinare la build per Electron con `npx @electron/rebuild -f -m .`
// — serve il flag -f perché la cache di rebuild non si accorge del cambio di ABI.)
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3-multiple-ciphers'
import { runMigrations } from '../src/main/migrations'
import { generaDocx, generaHtml } from '../src/main/export-doc'
import { cambiaPasswordAuth, loginAuth, recoverAuth, setupAuth } from '../src/main/auth'
import { getDb, initDb, isPlaintextDb } from '../src/main/db'
import { calcola, salvaQuestionario } from '../src/main/questionari'
import { spostaFileDati } from '../src/main/file-dati'
import { existsSync, writeFileSync } from 'node:fs'

const dir = mkdtempSync(join(tmpdir(), 'riab-smoke-'))
const db = new Database(join(dir, 'test.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

runMigrations(db)
runMigrations(db) // idempotente
assert.equal(db.pragma('user_version', { simple: true }), 7)

const count = (table: string): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n

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

db.close()
rmSync(dir, { recursive: true, force: true })

// Export: generazione HTML (per il PDF) e DOCX da dati campione
const pazExport = {
  nome: 'Mario',
  cognome: 'Rossi',
  tipo_intervento: 'Ricostruzione LCA dx',
  data_intervento: '2026-05-01',
  patologia_nome: 'Ricostruzione LCA'
}
const seduteExport = [
  {
    data: '2026-08-10',
    fase_nome: 'Fase iniziale',
    note: 'Buona risposta, <attenzione> al gonfiore',
    obiettivi: ['Controllo del dolore e gonfiore'],
    sezioni: [
      {
        nome: 'Riscaldamento',
        esercizi: [
          {
            nome: 'Mobilizzazione & scivolamenti rotulei',
            categoria_nome: 'Mobilizzazione',
            serie: '3',
            ripetizioni: '10',
            carico: null,
            recupero: '1 min',
            nota: 'lento'
          }
        ]
      }
    ]
  }
]
const html = generaHtml(pazExport, seduteExport)
assert.ok(html.includes('Rossi') && html.includes('Seduta del 10/08/2026'))
assert.ok(html.includes('Mobilizzazione &amp; scivolamenti rotulei')) // escaping HTML
assert.ok(html.includes('Riscaldamento') && html.includes('Recupero') && html.includes('1 min'))

// --- Autenticazione e cifratura ---
const dirAuth = mkdtempSync(join(tmpdir(), 'riab-auth-'))
const authPath = join(dirAuth, 'auth.json')
const dbPath = join(dirAuth, 'dati.db')

// Database in chiaro preesistente con dati (simula la migrazione al primo setup)
const plain = new Database(dbPath)
plain.pragma('journal_mode = WAL')
runMigrations(plain)
plain.prepare('INSERT INTO categorie (nome) VALUES (?)').run('Rinforzo')
plain.close()
assert.ok(isPlaintextDb(dbPath))

const { dekHex, recoveryKey } = setupAuth(authPath, 'password-segreta')
assert.equal(loginAuth(authPath, 'password-segreta'), dekHex)
assert.throws(() => loginAuth(authPath, 'password-sbagliata'), /Password errata/)

// initDb cifra in place il db in chiaro e lo apre: i dati sopravvivono
initDb(dbPath, dekHex)
assert.equal(
  (getDb().prepare('SELECT COUNT(*) AS n FROM categorie').get() as { n: number }).n,
  1
)

// --- Questionari: punteggi e fasce sul caso a due punteggi ---
// Nove domande si/no (la nona vale 1 sopra una certa risposta), un punteggio
// Totale su tutte e un Sub sulle ultime cinque, tre fasce lette in ordine.
{
  const qId = Number(
    getDb().prepare("INSERT INTO questionari (nome, ordine) VALUES ('Prova', 0)").run()
      .lastInsertRowid
  )
  // Le domande non ancora salvate hanno un id negativo, assegnato
  // dall'interfaccia. Qui si passano in ordine sparso apposta: i riferimenti
  // devono seguire l'id, non la posizione nell'elenco (era il difetto per cui
  // un punteggio poteva risultare vuoto dopo un riordino).
  const domande = Array.from({ length: 9 }, (_, i) => ({
    id: -(i + 1),
    testo: `Domanda ${i + 1}`,
    tipo: 'si_no' as const,
    scala_min: null,
    scala_max: null,
    opzioni: []
  }))
  const mescolate = [...domande.slice(4), ...domande.slice(0, 4)]
  salvaQuestionario({
    questionario: { id: qId, nome: 'Prova', istruzioni: null, ordine: 0, archiviato: 0 },
    domande: mescolate,
    punteggi: [
      { id: -101, nome: 'Totale', domanda_ids: domande.map((d) => d.id) },
      { id: -102, nome: 'Sub', domanda_ids: [-5, -6, -7, -8, -9] }
    ],
    fasce: [
      { id: null, etichetta: 'Basso', punteggio_id: -101, minimo: null, massimo: 3,
        punteggio2_id: null, minimo2: null, massimo2: null },
      { id: null, etichetta: 'Alto', punteggio_id: -101, minimo: 4, massimo: null,
        punteggio2_id: -102, minimo2: 4, massimo2: null },
      { id: null, etichetta: 'Medio', punteggio_id: -101, minimo: 4, massimo: null,
        punteggio2_id: null, minimo2: null, massimo2: null }
    ]
  })

  // Il "Totale" deve contenere tutte e nove le domande, non un sottoinsieme:
  // e' esattamente cio' che si rompeva prima, in silenzio.
  const perNome = (nome: string): number =>
    (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM punteggio_domande pd
           JOIN questionario_punteggi p ON p.id = pd.punteggio_id
           WHERE p.questionario_id = ? AND p.nome = ?`
        )
        .get(qId, nome) as { n: number }
    ).n
  assert.equal(perNome('Totale'), 9)
  assert.equal(perNome('Sub'), 5)

  const salvato = getDb()
    .prepare('SELECT id, testo FROM questionario_domande WHERE questionario_id = ?')
    .all(qId) as { id: number; testo: string }[]
  assert.equal(salvato.length, 9)
  // si risponde "si" alle domande indicate per numero, qualunque sia il loro ordine
  const rispondi = (uni: number[]): { domanda_id: number; valore: number }[] =>
    salvato.map((d) => ({
      domanda_id: d.id,
      valore: uni.includes(Number(d.testo.replace('Domanda ', ''))) ? 1 : 0
    }))

  // due sole risposte affermative -> totale 2 -> fascia bassa
  let esito = calcola(qId, rispondi([1, 2]))
  assert.deepEqual(esito.punteggi, [
    { nome: 'Totale', valore: 2 },
    { nome: 'Sub', valore: 0 }
  ])
  assert.equal(esito.fascia, 'Basso')

  // totale 5 ma sub 1: la regola "Alto" non si avvera, vince "Medio"
  esito = calcola(qId, rispondi([1, 2, 3, 4, 5]))
  assert.equal(esito.fascia, 'Medio')

  // totale 5 e sub 5: vince "Alto", che viene prima di "Medio"
  esito = calcola(qId, rispondi([5, 6, 7, 8, 9]))
  assert.deepEqual(esito.punteggi, [
    { nome: 'Totale', valore: 5 },
    { nome: 'Sub', valore: 5 }
  ])
  assert.equal(esito.fascia, 'Alto')
}

getDb().close()
assert.ok(!isPlaintextDb(dbPath))
// senza chiave il file non è leggibile
assert.throws(() => {
  const senzaChiave = new Database(dbPath)
  try {
    senzaChiave.prepare('SELECT count(*) FROM sqlite_master').get()
  } finally {
    senzaChiave.close()
  }
})

// Recovery key: accetta formattazione "sporca" e imposta una nuova password
const dekRecuperata = recoverAuth(authPath, recoveryKey.toLowerCase().replace(/-/g, ' '), 'nuova-password')
assert.equal(dekRecuperata, dekHex)
assert.equal(loginAuth(authPath, 'nuova-password'), dekHex)
assert.throws(() => loginAuth(authPath, 'password-segreta'), /Password errata/)

// Cambio password: la recovery key resta valida
cambiaPasswordAuth(authPath, 'nuova-password', 'password-numero-tre')
assert.equal(loginAuth(authPath, 'password-numero-tre'), dekHex)
assert.equal(recoverAuth(authPath, recoveryKey, 'password-numero-tre'), dekHex)

rmSync(dirAuth, { recursive: true, force: true })

// --- Spostamento cartella dati ---
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

void (async () => {
  const docxBuf = await generaDocx(pazExport, seduteExport)
  assert.ok(docxBuf.length > 1000 && docxBuf[0] === 0x50 && docxBuf[1] === 0x4b) // magic 'PK' (zip)
  console.log('Smoke test OK: migrazioni, vincoli, export e cifratura funzionano.')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
