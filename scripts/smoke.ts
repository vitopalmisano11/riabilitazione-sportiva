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
import { apriAltroDb, closeDb, getDb, initDb, isPlaintextDb } from '../src/main/db'
import { generaCartella, SEZIONI } from '../src/main/export-cartella'
import { esportaArchivio } from '../src/main/esporta-archivio'
import {
  elencoCestino,
  eliminaConCestino,
  ripristina,
  svuotaCestino
} from '../src/main/cestino'
import { duplicaValutazione, leggiValutazione } from '../src/main/valutazione'
import { coloriTema, impostaTemaCorrente, temaValido } from '../src/shared/temi'
import { datiScheda } from '../src/main/scheda-dati'
import {
  duplicaProtocollo,
  leggiProtocollo,
  salvaProtocollo
} from '../src/main/screening'
import {
  aggiornaCompilazione,
  elencoCompilazioni,
  leggiQuestionario,
  calcola,
  salvaCompilazione,
  salvaQuestionario
} from '../src/main/questionari'
import { spostaFileDati } from '../src/main/file-dati'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { recuperoEsteso, recuperoTesto, ripetizioniTesto, volumeTesto } from '../src/shared/dosaggio'

const dir = mkdtempSync(join(tmpdir(), 'riab-smoke-'))
const db = new Database(join(dir, 'test.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

runMigrations(db)
runMigrations(db) // idempotente
assert.equal(db.pragma('user_version', { simple: true }), 27)

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

// --- Follow-up: stato del paziente e promemoria ---
// Un paziente nasce in trattamento e senza recensione: e' quello che deve
// vedere chi apre l'app dopo un aggiornamento, senza dover sistemare niente.
{
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
}

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
            cluster: null,
            ripetizioni: '10',
            carico: null,
            recupero_cluster: null,
            recupero: '1 min',
            nota: 'lento'
          },
          {
            // Dosaggio a cluster: la serie si spezza in blocchi con una pausa
            // breve dentro, e sulla carta si deve leggere per esteso.
            nome: 'Balzi a piedi pari',
            categoria_nome: 'Pliometria estensiva',
            serie: '4',
            cluster: '3',
            ripetizioni: '2',
            carico: null,
            recupero_cluster: '15"',
            recupero: "2'",
            nota: null
          }
        ]
      }
    ]
  }
]
const html = generaHtml(pazExport, seduteExport)
assert.ok(html.includes('Rossi') && html.includes('Seduta del 10/08/2026'))
assert.ok(html.includes('Mobilizzazione &amp; scivolamenti rotulei')) // escaping HTML
// La seduta si stampa come elenco puntato per categoria, non piu' come
// tabella: restano il nome della sezione, la categoria e i dettagli in riga.
assert.ok(html.includes('Riscaldamento'))
assert.ok(html.includes('rec. 1 min'))
assert.ok(html.includes('3 × 10'))
// il cluster: "4 × (3 × 2)" e i due recuperi spiegati, non "15\" / 2'"
assert.ok(html.includes('4 × (3 × 2)'), 'volume a cluster')
assert.ok(html.includes(`rec. 15" tra i cluster, 2' tra le serie`), 'recuperi a cluster')
// La scheda normale non porta mai foto, spiegazioni o link, anche se
// l'esercizio li ha: e' quella corta per chi sa gia' cosa fare.
assert.ok(!html.includes('<div class="scheda-es">'))

// La scheda illustrata, da consegnare a chi si allena da solo: foto, come si
// esegue e il link al video, che nel PDF resta cliccabile.
const conFoto = [
  {
    ...seduteExport[0],
    sezioni: [
      {
        nome: 'A casa',
        esercizi: [
          {
            ...seduteExport[0].sezioni[0].esercizi[0],
            nota_tecnica: 'Scendi lentamente, senza inarcare la schiena.',
            link: 'https://www.youtube.com/watch?v=abc',
            immagine: 'data:image/png;base64,iVBORw0KGgo='
          },
          { ...seduteExport[0].sezioni[0].esercizi[0], nome: 'Senza foto' }
        ]
      }
    ]
  }
]
const illustrata = generaHtml(pazExport, conFoto, true)
assert.ok(illustrata.includes('data:image/png;base64,iVBORw0KGgo='))
assert.ok(illustrata.includes('Scendi lentamente'))
// gli esercizi sono numerati, come in un programma da portare a casa
assert.ok(illustrata.includes('<span class="num">1</span>'))
assert.ok(illustrata.includes('<span class="num">2</span>'))
assert.ok(illustrata.includes('href="https://www.youtube.com/watch?v=abc"'))
// il riquadro della foto resta anche dove la foto manca: i cartelli della
// stessa riga devono restare allineati
assert.equal(illustrata.split('<div class="foto">').length - 1, 2)
// ma se nella sezione non c'e' nessuna foto, i riquadri vuoti spariscono
const senzaFoto = generaHtml(pazExport, [seduteExport[0]], true)
assert.ok(
  senzaFoto.includes('<div class="scheda-es">') && !senzaFoto.includes('<div class="foto">')
)

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
  const catId = Number(
    getDb()
      .prepare("INSERT INTO questionario_categorie (nome, ordine) VALUES ('Rachide', 0)")
      .run().lastInsertRowid
  )
  const qId = Number(
    getDb()
      .prepare("INSERT INTO questionari (nome, categoria_id, ordine) VALUES ('Prova', ?, 0)")
      .run(catId).lastInsertRowid
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
    questionario: {
      id: qId,
      categoria_id: catId,
      nome: 'Prova',
      istruzioni: null,
      ordine: 0,
      archiviato: 0
    },
    domande: mescolate,
    // I punteggi arrivano con id negativi, come quelli appena creati
    // nell'interfaccia: le fasce li citano cosi', e il salvataggio deve
    // tradurli nei veri id. Se non lo facesse, la fascia resterebbe agganciata
    // a un punteggio inesistente e l'esito sarebbe sempre vuoto.
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

  // Le fasce salvate devono puntare a punteggi che esistono davvero: un
  // riferimento rimasto negativo o a zero non si avvererebbe mai.
  const riferimenti = getDb()
    .prepare(
      `SELECT f.punteggio_id AS p1, f.punteggio2_id AS p2 FROM questionario_fasce f
       WHERE f.questionario_id = ?`
    )
    .all(qId) as { p1: number | null; p2: number | null }[]
  assert.equal(riferimenti.length, 3)
  const idPunteggi = new Set(
    (
      getDb()
        .prepare('SELECT id FROM questionario_punteggi WHERE questionario_id = ?')
        .all(qId) as { id: number }[]
    ).map((r) => r.id)
  )
  for (const r of riferimenti) {
    if (r.p1 != null) assert.ok(idPunteggi.has(r.p1), 'fascia agganciata a un punteggio inesistente')
    if (r.p2 != null) assert.ok(idPunteggi.has(r.p2), 'fascia agganciata a un punteggio inesistente')
  }

  // Correzione di una compilazione gia' salvata: punteggi e fascia devono
  // essere ricalcolati sulle risposte nuove, non restare quelli di prima.
  const pazQ = Number(
    getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Test', 'Questionario')")
      .run().lastInsertRowid
  )
  const compId = salvaCompilazione({
    paziente_id: pazQ,
    questionario_id: qId,
    data: '2026-09-01',
    note: 'prima stesura',
    risposte: rispondi([1, 2])
  })
  const leggi = (): { fascia: string | null; note: string | null; data: string } =>
    getDb().prepare('SELECT fascia, note, data FROM paziente_questionari WHERE id = ?')
      .get(compId) as { fascia: string | null; note: string | null; data: string }
  const punteggiDi = (): { nome: string; valore: number }[] =>
    getDb()
      .prepare(
        'SELECT nome, valore FROM compilazione_punteggi WHERE compilazione_id = ? ORDER BY ordine'
      )
      .all(compId) as { nome: string; valore: number }[]
  assert.equal(leggi().fascia, 'Basso')
  assert.deepEqual(punteggiDi(), [
    { nome: 'Totale', valore: 2 },
    { nome: 'Sub', valore: 0 }
  ])

  aggiornaCompilazione(compId, {
    paziente_id: pazQ,
    questionario_id: qId,
    data: '2026-09-02',
    note: 'corretta',
    risposte: rispondi([5, 6, 7, 8, 9])
  })
  assert.equal(leggi().fascia, 'Alto')
  assert.equal(leggi().note, 'corretta')
  assert.equal(leggi().data, '2026-09-02')
  assert.deepEqual(punteggiDi(), [
    { nome: 'Totale', valore: 5 },
    { nome: 'Sub', valore: 5 }
  ])
  // le risposte vecchie non devono restare accanto a quelle nuove
  const nRisposte = (
    getDb()
      .prepare('SELECT COUNT(*) AS n FROM questionario_risposte WHERE compilazione_id = ?')
      .get(compId) as { n: number }
  ).n
  assert.equal(nRisposte, 9)
  assert.throws(() => aggiornaCompilazione(999999, {
    paziente_id: pazQ,
    questionario_id: qId,
    data: '2026-09-02',
    note: null,
    risposte: []
  }), /non trovata/)

  // Una fascia definita DOPO deve valere anche per le compilazioni gia' fatte:
  // l'esito si ricalcola quando si legge, altrimenti lo stesso questionario
  // mostrerebbe il profilo di rischio in certe date e in altre no.
  const qTardi = Number(
    getDb()
      .prepare('INSERT INTO questionari (categoria_id, nome, ordine) VALUES (?, ?, 1)')
      .run(catId, 'Scala definita a meta').lastInsertRowid
  )
  const senzaFasce = {
    questionario: {
      id: qTardi,
      categoria_id: catId,
      nome: 'Scala definita a meta',
      istruzioni: null,
      ordine: 1,
      archiviato: 0 as const
    },
    domande: [
      {
        id: -1,
        testo: 'Unica domanda',
        tipo: 'si_no' as const,
        scala_min: null,
        scala_max: null,
        opzioni: []
      }
    ],
    punteggi: [{ id: -101, nome: 'Totale', domanda_ids: [-1] }],
    fasce: []
  }
  salvaQuestionario(senzaFasce)
  const domandaTardi = (
    getDb()
      .prepare('SELECT id FROM questionario_domande WHERE questionario_id = ?')
      .get(qTardi) as { id: number }
  ).id
  const compSenza = salvaCompilazione({
    paziente_id: pazQ,
    questionario_id: qTardi,
    data: '2026-09-03',
    note: null,
    risposte: [{ domanda_id: domandaTardi, valore: 1 }]
  })
  const fasciaSalvata = (): string | null =>
    (
      getDb().prepare('SELECT fascia FROM paziente_questionari WHERE id = ?').get(compSenza) as {
        fascia: string | null
      }
    ).fascia
  assert.equal(fasciaSalvata(), null)

  // ora si definisce la fascia, come fa chi sistema il questionario dopo averlo
  // gia' somministrato
  const letto = leggiQuestionario(qTardi)
  salvaQuestionario({
    ...letto,
    fasce: [
      {
        id: null,
        etichetta: 'Presente',
        punteggio_id: letto.punteggi[0].id,
        minimo: 1,
        massimo: null,
        punteggio2_id: null,
        minimo2: null,
        massimo2: null
      }
    ]
  })
  const elenco = elencoCompilazioni(pazQ) as { id: number; fascia: string | null }[]
  assert.equal(elenco.find((x) => x.id === compSenza)?.fascia, 'Presente')
  // il valore ricalcolato resta scritto: anche la cartella stampata lo legge da li'
  assert.equal(fasciaSalvata(), 'Presente')
}

// --- Duplicare una valutazione: i rilievi si copiano, i racconti no ---
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pzV = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Val', 'Duplica')")
  const dist = ins("INSERT INTO distretti (nome) VALUES ('Spalla')")
  const movi = ins(
    "INSERT INTO distretto_movimenti (distretto_id, nome, gradi, ordine) VALUES (?, 'Abduzione', 1, 0)",
    dist
  )
  const testId = ins(
    "INSERT INTO distretto_test (distretto_id, nome, gruppo, risposta, ordine) VALUES (?, 'Jobe', 'ortopedici', 'posneg', 0)",
    dist
  )
  const primaId = ins(
    "INSERT INTO valutazioni (paziente_id, data, ispezione, note) VALUES (?, '2026-09-01', 'spalla in antepulsione', 'da rivedere')",
    pzV
  )
  ins(
    `INSERT INTO valutazione_distretti (valutazione_id, distretto_id, nota_attivo, nota_passivo)
     VALUES (?, ?, 'dolore a fine corsa', null)`,
    primaId,
    dist
  )
  ins(
    `INSERT INTO valutazione_movimenti (valutazione_id, movimento_id, attivo_restrizione,
       attivo_dolore, attivo_gradi) VALUES (?, ?, 2, 1, 120)`,
    primaId,
    movi
  )
  ins(
    "INSERT INTO valutazione_test (valutazione_id, test_id, valore) VALUES (?, ?, 'positivo')",
    primaId,
    testId
  )

  const copiaId = duplicaValutazione(primaId, '2026-10-01')
  const copia = leggiValutazione(copiaId)
  assert.equal(copia.valutazione.data, '2026-10-01')
  assert.deepEqual(copia.distretto_ids, [dist])
  assert.equal(copia.movimenti[0].attivo_gradi, 120)
  assert.equal(copia.movimenti[0].attivo_restrizione, 2)
  assert.equal(copia.test[0].valore, 'positivo')
  assert.equal(copia.note_movimenti[0].attivo, 'dolore a fine corsa')
  // i testi discorsivi raccontano quel giorno la': non si ricopiano
  assert.equal(copia.valutazione.ispezione, null)
  assert.equal(copia.valutazione.note, null)
  // e l'originale resta com'era
  assert.equal(leggiValutazione(primaId).valutazione.ispezione, 'spalla in antepulsione')
}

// --- Bozza della seduta: una per paziente, e si sostituisce ---
{
  const c = getDb()
  const pzB = Number(
    c.prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Boz', 'Za')").run().lastInsertRowid
  )
  const salva = (contenuto: string): void => {
    c.prepare(
      `INSERT INTO bozze_seduta (paziente_id, aggiornata_il, contenuto) VALUES (?, ?, ?)
       ON CONFLICT(paziente_id) DO UPDATE SET aggiornata_il = excluded.aggiornata_il,
         contenuto = excluded.contenuto`
    ).run(pzB, new Date().toISOString(), contenuto)
  }
  salva('{"note":"prima"}')
  salva('{"note":"seconda"}')
  const righe = c.prepare('SELECT contenuto FROM bozze_seduta WHERE paziente_id = ?').all(pzB) as {
    contenuto: string
  }[]
  assert.equal(righe.length, 1)
  assert.equal(righe[0].contenuto, '{"note":"seconda"}')
  // cancellando il paziente se ne va anche la bozza
  c.prepare('DELETE FROM pazienti WHERE id = ?').run(pzB)
  assert.equal(
    (c.prepare('SELECT COUNT(*) AS n FROM bozze_seduta').get() as { n: number }).n,
    0
  )
}

// --- Programmare la settimana: la stessa seduta su piu' giorni ---
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pzP = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Pro', 'Gramma')")
  const catP = ins("INSERT INTO categorie (nome) VALUES ('Cat programma')")
  const esP = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Squat', catP)
  const sedP = ins("INSERT INTO sedute (paziente_id, data, note) VALUES (?, '2026-09-07', 'lunedì')", pzP)
  const sezP = ins("INSERT INTO seduta_sezioni (seduta_id, nome, ordine) VALUES (?, 'Rinforzo', 0)", sedP)
  ins(
    `INSERT INTO seduta_esercizi (seduta_id, seduta_sezione_id, esercizio_id, serie, ripetizioni, ordine)
     VALUES (?, ?, ?, '3', '12', 0)`,
    sedP,
    sezP,
    esP
  )

  // il canale IPC non si puo' chiamare da qui: si ripete quello che fa, cioe'
  // copiare la seduta su due date nuove
  const copiaSu = (data: string): number => {
    const nuovo = ins(
      'INSERT INTO sedute (paziente_id, data, fase_id, note) SELECT paziente_id, ?, fase_id, note FROM sedute WHERE id = ?',
      data,
      sedP
    )
    const sez = ins(
      'INSERT INTO seduta_sezioni (seduta_id, sezione_id, nome, ordine) SELECT ?, sezione_id, nome, ordine FROM seduta_sezioni WHERE id = ?',
      nuovo,
      sezP
    )
    ins(
      `INSERT INTO seduta_esercizi (seduta_id, seduta_sezione_id, esercizio_id, serie, ripetizioni, carico, recupero, nota, ordine)
       SELECT ?, ?, esercizio_id, serie, ripetizioni, carico, recupero, nota, ordine
       FROM seduta_esercizi WHERE seduta_id = ?`,
      nuovo,
      sez,
      sedP
    )
    return nuovo
  }
  const mer = copiaSu('2026-09-09')
  const ven = copiaSu('2026-09-11')

  const esercizi = (id: number): number =>
    (
      c.prepare('SELECT COUNT(*) AS n FROM seduta_esercizi WHERE seduta_id = ?').get(id) as {
        n: number
      }
    ).n
  assert.equal(esercizi(mer), 1)
  assert.equal(esercizi(ven), 1)
  // ogni copia ha la sua sezione, non quella dell'originale
  const sezioniDi = (id: number): number =>
    (
      c.prepare('SELECT COUNT(*) AS n FROM seduta_sezioni WHERE seduta_id = ?').get(id) as {
        n: number
      }
    ).n
  assert.equal(sezioniDi(mer), 1)
  assert.equal(
    (
      c.prepare('SELECT COUNT(*) AS n FROM sedute WHERE paziente_id = ?').get(pzP) as { n: number }
    ).n,
    3
  )
}

// --- Cestino: eliminare un paziente si puo' disfare ---
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pzC = ins("INSERT INTO pazienti (nome, cognome, telefono) VALUES ('Ces', 'Tino', '333')")
  const patC = ins("INSERT INTO patologie (nome) VALUES ('Prova cestino')")
  c.prepare('UPDATE pazienti SET patologia_id = ? WHERE id = ?').run(patC, pzC)
  const sedC = ins("INSERT INTO sedute (paziente_id, data, note) VALUES (?, '2026-09-01', 'nota')", pzC)
  const catC = ins("INSERT INTO categorie (nome) VALUES ('Cat cestino')")
  const esC = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Es cestino', catC)
  ins(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ordine) VALUES (?, ?, '3', 0)",
    sedC,
    esC
  )
  ins("INSERT INTO obiettivi_terapeutici (paziente_id, testo, termine, ordine) VALUES (?, 'Obiettivo', 'breve', 0)", pzC)

  eliminaConCestino('pazienti', pzC, 'Paziente', 'Tino Ces')
  const contati = (sql: string, ...a: unknown[]): number =>
    (c.prepare(sql).get(...a) as { n: number }).n
  assert.equal(contati('SELECT COUNT(*) AS n FROM pazienti WHERE id = ?', pzC), 0)
  assert.equal(contati('SELECT COUNT(*) AS n FROM sedute WHERE id = ?', sedC), 0)

  const voci = elencoCestino()
  assert.equal(voci.length, 1)
  assert.equal(voci[0].etichetta, 'Tino Ces')
  // paziente + seduta + esercizio della seduta + obiettivo
  assert.ok(voci[0].righe >= 4, `righe raccolte: ${voci[0].righe}`)

  ripristina(voci[0].id)
  assert.equal(contati('SELECT COUNT(*) AS n FROM pazienti WHERE id = ?', pzC), 1)
  assert.equal(contati('SELECT COUNT(*) AS n FROM sedute WHERE id = ?', sedC), 1)
  assert.equal(
    contati('SELECT COUNT(*) AS n FROM seduta_esercizi WHERE seduta_id = ?', sedC),
    1
  )
  assert.equal(
    contati('SELECT COUNT(*) AS n FROM obiettivi_terapeutici WHERE paziente_id = ?', pzC),
    1
  )
  // il telefono torna com'era: si rimette la riga, non una copia vuota
  assert.equal(
    (c.prepare('SELECT telefono FROM pazienti WHERE id = ?').get(pzC) as { telefono: string })
      .telefono,
    '333'
  )
  assert.equal(elencoCestino().length, 0)

  // svuotare butta via davvero
  eliminaConCestino('sedute', sedC, 'Seduta', 'Seduta di prova')
  svuotaCestino()
  assert.equal(elencoCestino().length, 0)
  assert.equal(contati('SELECT COUNT(*) AS n FROM sedute WHERE id = ?', sedC), 0)
}

// --- Cestino: anche la libreria si recupera ---
// Una sezione e' citata dalle sedute gia' fatte con un legame ON DELETE SET
// NULL: quelle righe non vengono cancellate, quindi non devono nemmeno finire
// nella fotografia, altrimenti il ripristino proverebbe a reinserirle.
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const contati = (sql: string, ...a: unknown[]): number =>
    (c.prepare(sql).get(...a) as { n: number }).n

  const patL = ins("INSERT INTO patologie (nome) VALUES ('Patologia libreria')")
  const faseL = ins('INSERT INTO fasi (patologia_id, nome) VALUES (?, ?)', patL, 'Fase libreria')
  const sezL = ins('INSERT INTO sezioni (fase_id, nome) VALUES (?, ?)', faseL, 'Riscaldamento')
  const catL = ins("INSERT INTO categorie (nome) VALUES ('Cat libreria')")
  ins('INSERT INTO sezione_categorie (sezione_id, categoria_id) VALUES (?, ?)', sezL, catL)
  const pzL = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Lib', 'Reria')")
  const sedL = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-09-02')", pzL)
  const ssL = ins(
    'INSERT INTO seduta_sezioni (seduta_id, sezione_id, nome) VALUES (?, ?, ?)',
    sedL,
    sezL,
    'Riscaldamento'
  )

  eliminaConCestino('sezioni', sezL, 'Sezione', 'Riscaldamento')
  assert.equal(contati('SELECT COUNT(*) AS n FROM sezioni WHERE id = ?', sezL), 0)
  // la seduta gia' fatta resta leggibile: perde solo il rimando alla sezione
  assert.equal(contati('SELECT COUNT(*) AS n FROM seduta_sezioni WHERE id = ?', ssL), 1)

  const vociL = elencoCestino()
  assert.equal(vociL.length, 1)
  assert.equal(vociL[0].tipo, 'Sezione')
  ripristina(vociL[0].id)
  assert.equal(contati('SELECT COUNT(*) AS n FROM sezioni WHERE id = ?', sezL), 1)
  // torna anche quello che le stava appeso davvero
  assert.equal(contati('SELECT COUNT(*) AS n FROM sezione_categorie WHERE sezione_id = ?', sezL), 1)
  assert.equal(elencoCestino().length, 0)

  // e un esercizio della libreria si recupera con tutto il suo contenuto
  const esL = ins(
    "INSERT INTO esercizi (nome, categoria_id, nota_tecnica) VALUES (?, ?, 'Ginocchio in linea')",
    'Affondo',
    catL
  )
  eliminaConCestino('esercizi', esL, 'Esercizio', 'Affondo')
  assert.equal(contati('SELECT COUNT(*) AS n FROM esercizi WHERE id = ?', esL), 0)
  ripristina(elencoCestino()[0].id)
  assert.equal(
    (c.prepare('SELECT nota_tecnica FROM esercizi WHERE id = ?').get(esL) as {
      nota_tecnica: string
    }).nota_tecnica,
    'Ginocchio in linea'
  )
  svuotaCestino()
}

// --- Tema: i documenti stampati devono seguire il colore scelto ---
{
  // Il tema di partenza e' il verde; scegliendo il blu cambiano le intestazioni
  // dei documenti, non solo l'interfaccia.
  assert.equal(coloriTema().accento, '#55806a')
  impostaTemaCorrente('blu')
  assert.equal(coloriTema().accento, '#2563eb')
  assert.equal(temaValido('inventato'), 'verde')
  impostaTemaCorrente('verde')
}

// --- Screening: un protocollo pesca dalla libreria, non duplica i test ---
{
  const catTest = Number(
    getDb().prepare("INSERT INTO test_categorie (nome, ordine) VALUES ('Salti', 0)").run()
      .lastInsertRowid
  )
  const tSalto = Number(
    getDb().prepare("INSERT INTO test_valutazione (nome, categoria_id) VALUES ('CMJ', ?)")
      .run(catTest).lastInsertRowid
  )
  const tHop = Number(
    getDb().prepare(
      "INSERT INTO test_valutazione (nome, categoria_id, per_lato) VALUES ('Single Hop', ?, 1)"
    ).run(catTest).lastInsertRowid
  )
  const catQ = Number(
    getDb().prepare("INSERT INTO questionario_categorie (nome, ordine) VALUES ('Ginocchio', 0)").run()
      .lastInsertRowid
  )
  const qAcl = Number(
    getDb().prepare("INSERT INTO questionari (nome, categoria_id) VALUES ('ACL-RSI', ?)").run(catQ)
      .lastInsertRowid
  )

  const protId = Number(
    getDb().prepare("INSERT INTO screening_protocolli (nome, sport) VALUES ('Off season', 'Calcio')")
      .run().lastInsertRowid
  )
  // Sezioni e voci arrivano con id negativi, come dall'interfaccia.
  salvaProtocollo({
    protocollo: {
      id: protId,
      nome: 'Off season',
      sport: 'Calcio',
      note: null,
      ordine: 0,
      archiviato: 0
    },
    sezioni: [
      {
        id: -1,
        nome: 'In ambulatorio',
        voci: [
          { id: -10, test_id: tSalto, questionario_id: null },
          { id: -11, test_id: null, questionario_id: qAcl }
        ]
      },
      { id: -2, nome: 'In campo', voci: [{ id: -12, test_id: tHop, questionario_id: null }] }
    ]
  })

  const letto = leggiProtocollo(protId)
  assert.equal(letto.sezioni.length, 2)
  // il nome della voce viene dalla libreria, non e' una copia
  assert.deepEqual(
    letto.sezioni[0].voci.map((v: { nome?: string }) => v.nome),
    ['CMJ', 'ACL-RSI']
  )
  assert.equal(letto.sezioni[1].voci[0].nome, 'Single Hop')

  // rinominando il test nella libreria, il protocollo mostra il nome nuovo
  getDb().prepare("UPDATE test_valutazione SET nome = 'CMJ bilaterale' WHERE id = ?").run(tSalto)
  assert.equal(leggiProtocollo(protId).sezioni[0].voci[0].nome, 'CMJ bilaterale')

  // togliendo una sezione, le sue voci se ne vanno con lei
  const restano = leggiProtocollo(protId)
  salvaProtocollo({ ...restano, sezioni: [restano.sezioni[0]] })
  assert.equal(leggiProtocollo(protId).sezioni.length, 1)
  assert.equal(
    (getDb().prepare('SELECT COUNT(*) AS n FROM screening_voci').get() as { n: number })
      .n,
    2
  )

  // la copia e' indipendente: le sue voci hanno id propri
  const copia = duplicaProtocollo(protId, 'Off season 2027')
  assert.notEqual(copia, protId)
  const dupl = leggiProtocollo(copia)
  assert.equal(dupl.protocollo.sport, 'Calcio')
  assert.deepEqual(
    dupl.sezioni[0].voci.map((v: { nome?: string }) => v.nome),
    ['CMJ bilaterale', 'ACL-RSI']
  )
  assert.ok(
    dupl.sezioni[0].voci.every(
      (v: { id: number | null }) => v.id !== letto.sezioni[0].voci[0].id
    )
  )

  // una voce non puo' essere insieme test e questionario, ne' nessuno dei due
  assert.throws(() =>
    getDb().prepare(
      'INSERT INTO screening_voci (sezione_id, test_id, questionario_id) VALUES (?, ?, ?)'
    ).run(dupl.sezioni[0].id, tSalto, qAcl)
  )
  assert.throws(() =>
    getDb().prepare(
      'INSERT INTO screening_voci (sezione_id, test_id, questionario_id) VALUES (?, NULL, NULL)'
    ).run(dupl.sezioni[0].id)
  )
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

// --- Controllo di una copia: si apre davvero, in disparte ---
// E' il cuore del pulsante "Controlla" delle copie di sicurezza: una copia si
// apre in sola lettura con le chiavi di adesso, senza toccare l'archivio in uso.
const copiaPath = join(dirAuth, 'copia.db')
copyFileSync(dbPath, copiaPath)
{
  const copia = apriAltroDb(copiaPath)
  assert.equal(copia.pragma('integrity_check', { simple: true }), 'ok')
  assert.ok(
    (copia.prepare('SELECT COUNT(*) AS n FROM pazienti').get() as { n: number }).n > 0
  )
  copia.close()
}
// un file che non e' un database (o e' rovinato) non passa il controllo
const rottaPath = join(dirAuth, 'rotta.db')
writeFileSync(rottaPath, 'questo non e un database')
assert.throws(() => apriAltroDb(rottaPath))

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

// --- Cartella completa del paziente ---
// Le query della cartella toccano quasi tutte le tabelle: qui si semina un
// paziente con qualcosa in ognuna e si controlla che il documento le riporti.
// Serve a beccare i nomi di colonna sbagliati, che il typecheck non vede.
const dirCartella = mkdtempSync(join(tmpdir(), 'riab-cartella-'))
initDb(join(dirCartella, 'cartella.db'), dekHex)
{
  const c = getDb()
  const ins = (sql: string, ...args: unknown[]): number | bigint =>
    c.prepare(sql).run(...args).lastInsertRowid

  const patC = ins("INSERT INTO patologie (nome) VALUES ('Lombalgia')")
  const faseC = ins('INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, ?, 0)', patC, 'Acuta')
  const catC = ins("INSERT INTO categorie (nome) VALUES ('Core')")
  const esC = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Plank', catC)
  const pz = ins(
    `INSERT INTO pazienti (nome, cognome, data_nascita, telefono, email, lavoro, inviato_da,
       diagnosi, tipo_intervento, data_intervento, patologia_id, fase_corrente_id)
     VALUES ('Giulia', 'Verdi', '1990-04-12', '333', 'g@v.it', 'Impiegata', 'Dott. Neri',
       'Lombalgia aspecifica', 'Nessuno', '2026-01-05', ?, ?)`,
    patC,
    faseC
  )

  ins(
    `INSERT INTO anamnesi_prossima (paziente_id, motivo_consulto, dolore_notturno, disturbi_sonno,
       tosse_starnuto, sintomi_neurologici, relazione_sintomi, note, note_giorno, note_esordio)
     VALUES (?, 'Dolore lombare', 'no', 'no', 'no', 'no', 'unico sintomo', 'nessuna', 'peggio la sera', 'in calo')`,
    pz
  )
  const sint = ins(
    `INSERT INTO anamnesi_sintomi (paziente_id, descrizione, andamento, da_quanto, episodio,
       esordio, traumatico, comportamento, aggrava, allevia, ordine)
     VALUES (?, 'Lombare destro', 'intermittente', '3 settimane', 'primo', 'graduale', 0,
       'riposo', 'stare seduta', 'camminare', 0)`,
    pz
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, dolore) VALUES (?, 'giorno', 480, 6)",
    sint
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2026-08-01', 7)",
    sint
  )
  // Un secondo sintomo: nella cartella i due finiscono nello stesso grafico,
  // distinti per colore, ed e' quello che la legenda deve dichiarare.
  const sint2 = ins(
    `INSERT INTO anamnesi_sintomi (paziente_id, descrizione, andamento, ordine)
     VALUES (?, 'Rigidità mattutina', 'costante', 1)`,
    pz
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, dolore) VALUES (?, 'giorno', 1200, 4)",
    sint2
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2026-08-20', 3)",
    sint2
  )
  ins(
    "INSERT INTO anamnesi_attivita (paziente_id, attivita, partecipazione, fattori_interni) VALUES (?, 'guida', 'palestra', 'timore')",
    pz
  )
  ins(
    `INSERT INTO anamnesi_remota (paziente_id, traumi, interventi, riabilitazioni, bioimmagini_note,
       peso, febbre, sudorazione, nausea, fumo, neoplasie, gravidanza, pacemaker, schegge)
     VALUES (?, 'nessuno', 'nessuno', 'nessuna', 'RX negativa', 0, 0, 0, 0, 1, 0, 0, 0, 0)`,
    pz
  )
  ins(
    "INSERT INTO bioimmagini (paziente_id, nome, tipo, contenuto, data) VALUES (?, 'RX bacino', 'image/png', 'x', '2026-07-01')",
    pz
  )

  const chart = ins("INSERT INTO body_chart (paziente_id, data, note) VALUES (?, '2026-08-20', 'prima visita')", pz)
  for (const [vista, tipo] of [
    ['fronte', 'dolore'],
    ['retro', 'rigidita'],
    ['destra', 'scossa'],
    ['sinistra', 'parestesie']
  ]) {
    ins(
      'INSERT INTO body_chart_segni (chart_id, vista, tipo, x, y, dimensione, intensita) VALUES (?, ?, ?, 0.5, 0.4, 1, 6)',
      chart,
      vista,
      tipo
    )
  }

  // Una body chart del piede: stessi segni, viste diverse. Nella cartella deve
  // uscire con le sue figure, non con quelle del corpo intero.
  const chartPiede = ins(
    "INSERT INTO body_chart (paziente_id, data, tipo, note) VALUES (?, '2026-08-22', 'piede', 'caviglia destra')",
    pz
  )
  for (const vista of ['dorso', 'pianta', 'esterno', 'interno']) {
    ins(
      "INSERT INTO body_chart_segni (chart_id, vista, tipo, x, y, dimensione, intensita) VALUES (?, ?, 'dolore', 0.3, 0.5, 1, 4)",
      chartPiede,
      vista
    )
  }

  const distr = ins("INSERT INTO distretti (nome) VALUES ('Rachide lombare')")
  const mov = ins(
    "INSERT INTO distretto_movimenti (distretto_id, nome, gradi) VALUES (?, 'Flessione', 1)",
    distr
  )
  const tst = ins(
    "INSERT INTO distretto_test (distretto_id, nome, gruppo, risposta) VALUES (?, 'SLR', 'Neurodinamici', 'pos-neg')",
    distr
  )
  const val = ins(
    `INSERT INTO valutazioni (paziente_id, data, ispezione, note, carico_locale, carico_generale,
       capacita_locale, capacita_generale)
     VALUES (?, '2026-08-25', 'atteggiamento antalgico', 'ok', 'ridotto', 'buono', 'media', 'buona')`,
    pz
  )
  ins(
    `INSERT INTO valutazione_distretti (valutazione_id, distretto_id, nota_attivo, nota_passivo)
     VALUES (?, ?, 'tira dal lato opposto', 'fine corsa elastico')`,
    val,
    distr
  )
  ins(
    `INSERT INTO valutazione_movimenti (valutazione_id, movimento_id, attivo_restrizione,
       attivo_dolore, passivo_restrizione, passivo_dolore, attivo_gradi, passivo_gradi)
     VALUES (?, ?, 2, 1, 1, 1, 40, 55)`,
    val,
    mov
  )
  ins(
    "INSERT INTO valutazione_test (valutazione_id, test_id, valore, nota) VALUES (?, ?, 'negativo', 'nessuna irradiazione')",
    val,
    tst
  )

  const qst = ins("INSERT INTO questionari (nome, ordine) VALUES ('Prova PROM', 0)")
  const comp = ins(
    "INSERT INTO paziente_questionari (paziente_id, questionario_id, data, fascia, note) VALUES (?, ?, '2026-08-26', 'rischio medio', '')",
    pz,
    qst
  )
  ins(
    "INSERT INTO compilazione_punteggi (compilazione_id, nome, valore, ordine) VALUES (?, 'Totale', 5, 0)",
    comp
  )

  const sed = ins("INSERT INTO sedute (paziente_id, data, fase_id, note) VALUES (?, '2026-08-27', ?, 'ben tollerata')", pz, faseC)
  ins(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ripetizioni, carico, recupero, nota, ordine) VALUES (?, ?, '3', '30\"', '-', '1 min', 'ok', 0)",
    sed,
    esC
  )

  ins(
    "INSERT INTO obiettivi_terapeutici (paziente_id, testo, termine, ordine) VALUES (?, 'Camminare 30 minuti', 'medio', 0)",
    pz
  )

  const tutte = SEZIONI.map((x) => x.chiave)
  const doc = generaCartella(Number(pz), tutte)
  for (const atteso of [
    'Verdi',
    'Dolore lombare',      // anamnesi prossima
    'RX negativa',         // anamnesi remota
    'Rachide lombare',     // valutazione obiettiva
    'tira dal lato opposto', // note del movimento attivo nella valutazione
    'fine corsa elastico',   // e del passivo
    'Prova PROM',          // questionari
    'Camminare 30 minuti', // obiettivi terapeutici
    'Lato sinistro',       // body chart, tutte e quattro le viste
    'Dorso',               // body chart del piede
    'Lato interno',
    'piede e caviglia'
  ]) {
    assert.ok(doc.includes(atteso), `la cartella non riporta "${atteso}"`)
  }

  // L'andamento del dolore si legge in due grafici affiancati — le 24 ore e
  // dall'esordio — con dentro tutti i sintomi, e sotto la legenda dei colori.
  // Prima ogni sintomo aveva i suoi due disegni e non erano confrontabili.
  assert.ok(doc.includes('Nelle 24 ore') && doc.includes('Dall’esordio'))
  assert.equal(doc.split('<figure>').length - 1, 2)
  assert.ok(doc.includes('class="legenda"'))
  for (const c of ['#2563eb', '#d64545']) {
    assert.ok(doc.includes(c), 'la legenda non distingue i due sintomi')
  }
  // i valori stanno nel disegno: elencarli di nuovo a parole era una ripetizione
  assert.ok(!doc.includes('08:00 →'))
  assert.ok(doc.includes('Rigidità mattutina'))
  // le sezioni escluse non devono comparire
  const soloDati = generaCartella(Number(pz), ['anagrafica'])
  assert.ok(soloDati.includes('Dott. Neri'))
  assert.ok(!soloDati.includes('27/08/2026'))
  // delle sedute nella cartella restano le date, non gli esercizi
  assert.ok(doc.includes('27/08/2026'))
  assert.ok(!doc.includes('Plank'))
  // una sezione senza contenuto non stampa un titolo vuoto
  const pzVuoto = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Vuoto', 'Test')")
  const nulla = generaCartella(Number(pzVuoto), tutte)
  assert.ok(!nulla.includes('Diario delle sedute'))
  assert.throws(() => generaCartella(999999, tutte), /non trovato/)

  // L'archivio si esporta anche in tabelle leggibili senza l'app: le query
  // toccano quasi tutte le tabelle, quindi qui si controlla che girino e che il
  // paziente seminato compaia.
  const dirCsv = mkdtempSync(join(tmpdir(), 'riab-csv-'))
  const cartellaCsv = esportaArchivio(dirCsv)
  for (const nome of [
    'pazienti.csv',
    'anamnesi.csv',
    'sintomi.csv',
    'obiettivi.csv',
    'sedute.csv',
    'valutazioni.csv',
    'questionari.csv',
    'screening.csv',
    'leggimi.txt'
  ]) {
    assert.ok(existsSync(join(cartellaCsv, nome)), `manca ${nome}`)
  }
  const csvPazienti = readFileSync(join(cartellaCsv, 'pazienti.csv'), 'utf-8')
  assert.ok(csvPazienti.startsWith('﻿'), 'senza BOM Excel sbaglia le accentate')
  assert.ok(csvPazienti.includes('Verdi;Giulia'))
  assert.ok(csvPazienti.includes('Lombalgia'))
  // il punto e virgola dentro a un testo non deve spezzare la colonna
  assert.ok(readFileSync(join(cartellaCsv, 'sedute.csv'), 'utf-8').includes('Plank'))
  rmSync(dirCsv, { recursive: true, force: true })

  // --- Dosaggio a cluster: dalla categoria fino alla scheda ---
  // La serie si spezza in blocchi con una pausa breve dentro. La categoria dice
  // solo se i campi si vedono; quello che si stampa dipende dai numeri salvati.
  {
    const catCl = ins(
      "INSERT INTO categorie (nome, dosaggio_cluster) VALUES ('Pliometria estensiva', 1)"
    )
    assert.equal(
      (
        c.prepare('SELECT dosaggio_cluster AS d FROM categorie WHERE id = ?').get(catCl) as {
          d: number
        }
      ).d,
      1
    )
    const esCl = ins(
      `INSERT INTO esercizi (nome, categoria_id, serie_default, cluster_default,
                             ripetizioni_default, recupero_cluster_default, recupero_default)
       VALUES ('Balzi a piedi pari', ?, '4', '3', '2', '15"', '2''')`,
      catCl
    )
    const sedCl = ins(
      "INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-08-28')",
      pz
    )
    ins(
      `INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, cluster, ripetizioni,
                                    recupero_cluster, recupero, ordine)
       SELECT ?, id, serie_default, cluster_default, ripetizioni_default,
              recupero_cluster_default, recupero_default, 0
       FROM esercizi WHERE id = ?`,
      sedCl,
      esCl
    )

    const schedaCl = datiScheda(Number(sedCl))
    const rigaCl = schedaCl.sezioni[0].esercizi[0]
    assert.equal(rigaCl.cluster, '3')
    assert.equal(rigaCl.recupero_cluster, '15"')
    assert.equal(volumeTesto(rigaCl), '4 × (3 × 2)')
    assert.equal(recuperoEsteso(rigaCl), `rec. 15" tra i cluster, 2' tra le serie`)
    assert.equal(ripetizioniTesto(rigaCl), '3 × 2')
    assert.equal(recuperoTesto(rigaCl), `15" / 2'`)
    // senza cluster il dosaggio resta quello di sempre
    assert.equal(volumeTesto({ serie: '3', cluster: null, ripetizioni: '10' }), '3 × 10')
    assert.equal(recuperoEsteso({ recupero_cluster: null, recupero: '1 min' }), 'rec. 1 min')

    // e finisce anche nelle tabelle che si aprono senza l'app
    const dirCl = mkdtempSync(join(tmpdir(), 'riab-csv-cl-'))
    const csvCl = readFileSync(join(esportaArchivio(dirCl), 'sedute.csv'), 'utf-8')
    assert.ok(csvCl.includes('cluster_per_serie'), 'colonna dei cluster')
    assert.ok(csvCl.includes('Balzi a piedi pari'))
    rmSync(dirCl, { recursive: true, force: true })
  }

  // La scheda mostrata al paziente legge le stesse sedute con query proprie.
  const scheda = datiScheda(Number(sed))
  assert.equal(scheda.paziente, 'Giulia Verdi')
  assert.equal(scheda.data, '2026-08-27')
  assert.equal(scheda.fase_nome, 'Acuta')
  assert.equal(scheda.sezioni.length, 1)
  assert.equal(scheda.sezioni[0].esercizi[0].nome, 'Plank')
  assert.equal(scheda.sezioni[0].esercizi[0].ripetizioni, '30"')
  assert.throws(() => datiScheda(999999), /non trovata/)
}
closeDb()
rmSync(dirCartella, { recursive: true, force: true })

void (async () => {
  const docxBuf = await generaDocx(pazExport, seduteExport)
  assert.ok(docxBuf.length > 1000 && docxBuf[0] === 0x50 && docxBuf[1] === 0x4b) // magic 'PK' (zip)
  console.log('Smoke test OK: migrazioni, vincoli, export e cifratura funzionano.')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
