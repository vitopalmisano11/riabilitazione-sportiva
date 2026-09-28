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
import { MIGRATIONS, runMigrations, VERSIONE_SCHEMA } from '../src/main/migrations'
import { generaDocx, generaHtml } from '../src/main/export-doc'
import {
  cambiaPasswordAuth,
  domandaAuth,
  impostaDomandaAuth,
  loginAuth,
  recoverAuth,
  recoverDomandaAuth,
  setupAuth,
  togliDomandaAuth
} from '../src/main/auth'
import {
  apriAltroDb,
  closeDb,
  controllaArchivio,
  getDb,
  initDb,
  isPlaintextDb
} from '../src/main/db'
import { seduteDellaSettimana } from '../src/main/settimana'
import { ultimaVoltaPerPaziente } from '../src/main/ultima-volta'
import { andamentoDolorePerPaziente } from '../src/main/andamento-dolore'
import { leggiProfilo, righeProfilo, salvaProfilo } from '../src/main/profilo'
import { generaCartella, generaRelazione, SEZIONI } from '../src/main/export-cartella'
import { esportaArchivio } from '../src/main/esporta-archivio'
import {
  elencoCestino,
  eliminaConCestino,
  ripristina,
  ripuliscilCestino,
  svuotaCestino
} from '../src/main/cestino'
import { duplicaValutazione, leggiValutazione, salvaValutazione } from '../src/main/valutazione'
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
import { leggiJsonPerScrivere, scriviAtomico } from '../src/main/scrittura'
import {
  eliminaTemporaneo,
  ripulisciTemporanei,
  scriviTemporaneo,
  usaCartellaTemporanei
} from '../src/main/temporanei'
import {
  erroreSenzaDatiNelRegistro,
  LINK_WEB,
  testoErrorePerRegistro,
  validaImmagine,
  validaLink
} from '../src/main/validazione'
import { generaReportScreening } from '../src/main/report-screening'
import { coloriBarra, conBarra } from '../src/main/finestre'
import { relazioneAnamnesi } from '../src/main/relazione-anamnesi'
import { relazioneValutazione } from '../src/main/relazione-valutazione'
import { calcolaPunteggio } from '../src/main/screening-punteggio'
import { sedutaPrecedente } from '../src/main/seduta-precedente'
import { nellaFascia } from '../src/shared/orari'
import { copyFileSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { daQuando } from '../src/renderer/src/lib'
import {
  caricoTesto,
  intensitaTesto,
  rirTesto,
  recuperoEsteso,
  recuperoTesto,
  ripetizioniTesto,
  volumeTesto
} from '../src/shared/dosaggio'

const dir = mkdtempSync(join(tmpdir(), 'riab-smoke-'))
const db = new Database(join(dir, 'test.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

runMigrations(db)
runMigrations(db) // idempotente
assert.equal(db.pragma('user_version', { simple: true }), 50)

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

// --- Campo sport (v48): si scrive e si rilegge, e resta vuoto se non c'e' ---
{
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
            unita_carico: 'kg',
            serie: '3',
            cluster: null,
            ripetizioni: '10',
            rir: null,
            carico: null,
            recupero_cluster: null,
            recupero: '1 min',
            nota: 'lento'
          },
          {
            // Con le ripetizioni di riserva: il carico e il RIR si leggono
            // nella stessa colonna, che e' la stessa domanda.
            nome: 'Squat',
            categoria_nome: 'Forza',
            unita_carico: 'kg',
            serie: '4',
            cluster: null,
            ripetizioni: '8',
            rir: '2',
            carico: '60',
            recupero_cluster: null,
            recupero: "2'",
            nota: null
          },
          {
            // Dosaggio a cluster: la serie si spezza in blocchi con una pausa
            // breve dentro, e sulla carta si deve leggere per esteso.
            nome: 'Balzi a piedi pari',
            categoria_nome: 'Pliometria estensiva',
            unita_carico: null,
            serie: '4',
            cluster: '3',
            ripetizioni: '2',
            rir: null,
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
// La seduta si stampa con la stessa tabella della finestra che si mostra al
// paziente: fascetta della sezione, e quattro colonne incolonnate.
assert.ok(html.includes('Riscaldamento'))
assert.ok(html.includes('class="fascetta"'), 'fascetta della sezione')
assert.ok(html.includes('tabella-scheda'), 'tabella come quella a schermo')
assert.ok(html.includes('<th>Recupero</th>'), 'intestazioni delle colonne')
// nella sua colonna il recupero si scrive corto: "rec." lo dice gia'
// l'intestazione
assert.ok(html.includes('1 min'))
assert.ok(!html.includes('rec. 1 min'), 'nella tabella il recupero non ripete rec.')
assert.ok(html.includes('3 × 10'))
// il RIR sta nella colonna del carico, accanto ai chili
assert.ok(html.includes('60 kg · RIR 2'), 'carico e RIR nella stessa colonna')
// il cluster: 4 x (3 x 2), e i due recuperi separati dalla barra
assert.ok(html.includes('4 × (3 × 2)'), 'volume a cluster')
// (le virgolette nel testo si scrivono &quot;: sullo schermo e' lo stesso segno)
assert.ok(html.includes(`15&quot; / 2'`), 'recuperi a cluster nella colonna')
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
// anche nella scheda illustrata i numeri si leggono come le colonne della
// tabella: etichetta sopra, valore sotto
assert.ok(illustrata.includes('class="numeri"'), 'numeri incolonnati')
assert.ok(illustrata.includes('Serie × rip.'), 'etichette dei numeri')
assert.ok(illustrata.includes('1 min'), 'il valore del recupero')
// gli esercizi sono numerati, come in un programma da portare a casa
assert.ok(illustrata.includes('<span class="num">1</span>'))
assert.ok(illustrata.includes('<span class="num">2</span>'))
assert.ok(illustrata.includes('href="https://www.youtube.com/watch?v=abc"'))
// un link che non e' web (javascript:, file:) non diventa cliccabile, e le
// virgolette dentro un attributo non lo chiudono prima del tempo
{
  const es0 = conFoto[0].sezioni[0].esercizi[0]
  const cattivi = generaHtml(
    pazExport,
    [
      {
        ...conFoto[0],
        sezioni: [
          {
            nome: 'A casa',
            esercizi: [
              { ...es0, link: 'javascript:alert(1)' },
              { ...es0, nome: 'Squat', link: 'https://a.it/x"onmouseover="alert(1)' },
              { ...es0, nome: 'Foto', immagine: 'x" onerror="alert(1)' }
            ]
          }
        ]
      }
    ],
    true
  )
  assert.ok(!cattivi.includes('href="javascript'), 'un link javascript non e\' cliccabile')
  assert.ok(!cattivi.includes('"onmouseover="'), 'le virgolette non chiudono l\'attributo')
  assert.ok(!cattivi.includes('" onerror="'), 'nemmeno nell\'immagine')
  assert.ok(cattivi.includes('x&quot;onmouseover=&quot;'), 'le virgolette del link diventano testo')
  assert.ok(cattivi.includes('x&quot; onerror=&quot;'), 'e quelle dell\'immagine')
}
// il riquadro della foto resta anche dove la foto manca: i cartelli della
// stessa riga devono restare allineati
assert.equal(illustrata.split('<div class="foto">').length - 1, 2)
// ma se nella sezione non c'e' nessuna foto, i riquadri vuoti spariscono
const senzaFoto = generaHtml(pazExport, [seduteExport[0]], true)
assert.ok(
  senzaFoto.includes('<div class="scheda-es">') && !senzaFoto.includes('<div class="foto">')
)

// --- Migrazioni: archivio piu' nuovo del programma, e copia prima di aggiornare ---
{
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
}

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

// File temporanei con dati dei pazienti: cartella loro, nome casuale, si tolgono.
const provaTemporanei = (async (): Promise<void> => {
  // cartella sua: la prova finisce quando lo script e' gia' arrivato in fondo
  const dirT = mkdtempSync(join(tmpdir(), 'riab-temporanei-'))
  usaCartellaTemporanei(dirT)
  const a = await scriviTemporaneo('.pdf', Buffer.from('%PDF-referto-di-Mario-Rossi'))
  const b = await scriviTemporaneo('.html', '<p>anteprima</p>')
  assert.ok(a.startsWith(dirT) && b.startsWith(dirT), 'stanno nella cartella dei temporanei')
  assert.ok(a.endsWith('.pdf') && b.endsWith('.html'))
  assert.ok(!/Mario|Rossi|referto/i.test(a), 'il nome non deve raccontare di chi e\'')
  assert.notEqual(a, await scriviTemporaneo('.pdf', Buffer.from('x')), 'i nomi sono diversi ogni volta')
  assert.equal(readFileSync(a, 'utf-8'), '%PDF-referto-di-Mario-Rossi')
  assert.equal(eliminaTemporaneo(a), true)
  assert.ok(!existsSync(a))
  assert.equal(eliminaTemporaneo(a), true, 'togliere un file che non c\'e\' piu\' non e\' un errore')
  ripulisciTemporanei()
  assert.deepEqual(readdirSync(dirT), [], 'la pulizia toglie tutto')
  ripulisciTemporanei() // e non da' errore se e' gia' vuota
  rmSync(dirT, { recursive: true, force: true })
})()

// Link e immagini: solo web (http/https) e immagini vere, sia in ingresso sia nei fogli stampati.
{
  validaLink(null, 'Il link')
  validaLink('', 'Il link')
  validaLink('   ', 'Il link')
  validaLink('https://www.youtube.com/watch?v=abc', 'Il link')
  validaLink(' HTTP://esempio.it/x ', 'Il link')
  for (const cattivo of ['javascript:alert(1)', 'file:///C:/Windows/win.ini', 'www.esempio.it', 'https://a b']) {
    assert.throws(() => validaLink(cattivo, 'Il link'), /http:\/\/ o https:\/\//, cattivo)
  }
  assert.ok(LINK_WEB.test('https://esempio.it') && !LINK_WEB.test('javascript:alert(1)'))

  validaImmagine(null)
  validaImmagine('data:image/png;base64,iVBORw0KGgo=')
  validaImmagine('data:image/jpeg;base64,/9j/4AAQSkZJRg==')
  for (const cattiva of ['data:text/html;base64,PHNjcmlwdD4=', 'https://esempio.it/a.png', 'x" onerror="alert(1)', '']) {
    assert.throws(() => validaImmagine(cattiva), /formato valido/, cattiva)
  }
}

// Registro degli errori: chi usa il programma legge il nome del file, il registro no
// (il nome di un referto dice di chi e').
{
  const e = erroreSenzaDatiNelRegistro('"Rossi_Mario_RM.pdf" e\' troppo pesante.', 'Referto troppo pesante.')
  assert.ok(e.message.includes('Rossi_Mario'), 'l\'utente deve poter leggere il nome')
  assert.equal(testoErrorePerRegistro(e), 'Referto troppo pesante.')

  // gli errori del sistema citano il percorso intero
  const sistema = new Error("ENOENT: no such file or directory, open 'C:\\Docs\\Rossi_Mario_ginocchio.pdf'")
  const testo = testoErrorePerRegistro(sistema)
  assert.ok(!testo.includes('Rossi') && !testo.includes('ginocchio'), testo)
  assert.ok(testo.includes("open '…'") && testo.includes('ENOENT'))
  assert.ok(/\n\s+at /.test(testo), 'la traccia del programma resta')
  assert.equal(testoErrorePerRegistro('fallito "D:/Pazienti/Verdi.docx"'), 'fallito "…"')
  assert.equal(testoErrorePerRegistro(new Error('UNIQUE constraint failed: patologie.nome')).startsWith('Error: UNIQUE constraint failed: patologie.nome'), true)
}

// Scrittura atomica: il file c'e' intero, si sostituisce, e non resta niente accanto.
{
  const f = join(dirAuth, 'prova-atomica.json')
  scriviAtomico(f, '{"a":1}')
  assert.equal(readFileSync(f, 'utf-8'), '{"a":1}')
  scriviAtomico(f, '{"a":2,"lungo":"' + 'x'.repeat(50000) + '"}')
  assert.equal((JSON.parse(readFileSync(f, 'utf-8')) as { a: number }).a, 2)
  assert.ok(!existsSync(`${f}.tmp`), 'il file provvisorio non deve restare')
  // un resto di una scrittura interrotta non disturba la successiva
  writeFileSync(`${f}.tmp`, '{"tagliato":')
  scriviAtomico(f, '{"a":3}')
  assert.equal(readFileSync(f, 'utf-8'), '{"a":3}')
  assert.ok(!readdirSync(dirAuth).some((n) => n.endsWith('.tmp')))

  // Riscrivere partendo da un file: assente = vuoto, illeggibile = errore (mai "vuoto").
  assert.deepEqual(leggiJsonPerScrivere(f), { a: 3 })
  rmSync(f)
  assert.deepEqual(leggiJsonPerScrivere(f), {})
  writeFileSync(f, '{"cartellaDati":"D:\\Pazienti","tema')
  assert.throws(() => leggiJsonPerScrivere(f), /non lo modifico/)
  assert.equal(readFileSync(f, 'utf-8').includes('Pazienti'), true, 'il file rovinato non si tocca')
  rmSync(f)
}

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
    etichetta_min: null,
    etichetta_max: null,
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
      archiviato: 0,
      // Il cambiamento che conta: cinque punti in meno sul totale.
      mcid_punteggio_id: -101,
      mcid_punti: 5,
      mcid_percentuale: null,
      mcid_migliora_calando: 1,
      mcid_nota: null
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
      archiviato: 0 as const,
      // Questo questionario il cambiamento che conta non ce l'ha: e' il caso
      // normale, e non deve comparire nessun confronto.
      mcid_punteggio_id: null,
      mcid_punti: null,
      mcid_percentuale: null,
      mcid_migliora_calando: 1 as const,
      mcid_nota: null
    },
    domande: [
      {
        id: -1,
        testo: 'Unica domanda',
        tipo: 'si_no' as const,
        scala_min: null,
        scala_max: null,
        etichetta_min: null,
        etichetta_max: null,
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
  const elenco = elencoCompilazioni(pazQ) as {
    id: number
    fascia: string | null
    variazione: { punti: number; percentuale: number; significativa: boolean; dal: string } | null
  }[]
  assert.equal(elenco.find((x) => x.id === compSenza)?.fascia, 'Presente')
  // Il questionario senza soglia non dice niente sul cambiamento.
  assert.equal(elenco.find((x) => x.id === compSenza)?.variazione, null)

  // --- Il cambiamento che conta ---
  // "Prova" ha la soglia a 5 punti in meno sul Totale. La prima compilazione
  // (2026-09-01, poi corretta al 02 con Totale 5) fa da riferimento: non ha un
  // confronto, le altre si misurano su di lei.
  {
    const prima = elencoCompilazioni(pazQ).find((x) => (x as { id: number }).id === compId) as {
      variazione: unknown
    }
    assert.equal(prima.variazione, null, 'la prima compilazione non si confronta con se stessa')

    // Sei risposte in meno: Totale da 5 a 0, cinque punti guadagnati, e siccome
    // qui si migliora calando il numero e' positivo.
    const dopo = salvaCompilazione({
      paziente_id: pazQ,
      questionario_id: qId,
      data: '2026-09-20',
      note: null,
      risposte: rispondi([])
    })
    const conVar = elencoCompilazioni(pazQ).find(
      (x) => (x as { id: number }).id === dopo
    ) as {
      variazione: { punti: number; percentuale: number; significativa: boolean; dal: string }
    }
    assert.equal(conVar.variazione.punti, 5)
    assert.equal(conVar.variazione.percentuale, 100)
    assert.equal(conVar.variazione.dal, '2026-09-02')
    assert.ok(conVar.variazione.significativa, 'cinque punti raggiungono la soglia')

    // Un peggioramento: il punteggio sale, il cambiamento e' negativo e non
    // conta come miglioramento.
    const peggio = salvaCompilazione({
      paziente_id: pazQ,
      questionario_id: qId,
      data: '2026-09-25',
      note: null,
      risposte: rispondi([1, 2, 3, 4, 5, 6, 7])
    })
    const conPeggio = elencoCompilazioni(pazQ).find(
      (x) => (x as { id: number }).id === peggio
    ) as { variazione: { punti: number; significativa: boolean } }
    assert.ok(conPeggio.variazione.punti < 0, 'peggiorando il numero e negativo')
    assert.equal(conPeggio.variazione.significativa, false)
  }
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

  // Un distretto con il lato: destra e sinistra si salvano separati, il sano
  // puo' essere "nella norma", e la cartella mette a confronto i gradi.
  const pzL = ins("INSERT INTO pazienti (nome, cognome, arto_operato) VALUES ('Lati', 'Due', 'dx')")
  const ginocchio = ins("INSERT INTO distretti (nome, bilaterale) VALUES ('Ginocchio', 1)")
  const flessione = ins(
    "INSERT INTO distretto_movimenti (distretto_id, nome, gradi, ordine) VALUES (?, 'Flessione', 1, 0)",
    ginocchio
  )
  const lachman = ins(
    "INSERT INTO distretto_test (distretto_id, nome, gruppo, risposta, ordine) VALUES (?, 'Lachman', 'ortopedici', 'posneg', 0)",
    ginocchio
  )
  const valL = ins("INSERT INTO valutazioni (paziente_id, data) VALUES (?, '2026-09-10')", pzL)
  const vuotoRilievo = {
    attivo_restrizione: null,
    attivo_dolore: null,
    attivo_gradi: null,
    passivo_restrizione: null,
    passivo_dolore: null,
    passivo_gradi: null,
    nota: null,
    norma: null,
    passivo_norma: null
  }
  salvaValutazione({
    ...leggiValutazione(valL),
    distretto_ids: [ginocchio],
    movimenti: [
      { ...vuotoRilievo, movimento_id: flessione, lato: 'dx', attivo_restrizione: 2, attivo_dolore: 1, attivo_gradi: 110 },
      { ...vuotoRilievo, movimento_id: flessione, lato: 'sx', attivo_gradi: 140, norma: 1, passivo_norma: 1 }
    ],
    test: [
      // con i due lati la nota e' una sola, del test: sta nella riga di destra
      { test_id: lachman, lato: 'dx', valore: 'positivo', nota: 'fine corsa morbido' },
      { test_id: lachman, lato: 'sx', valore: 'negativo', nota: null }
    ]
  })
  const lettaL = leggiValutazione(valL)
  assert.equal(lettaL.movimenti.length, 2)
  assert.equal(lettaL.movimenti.find((m) => m.lato === 'sx')?.norma, 1)
  assert.equal(lettaL.movimenti.find((m) => m.lato === 'sx')?.passivo_norma, 1)
  assert.equal(lettaL.test.length, 2)
  const cartellaL = generaCartella(pzL, ['valutazioni'])
  assert.ok(cartellaL.includes('Flessione attivo: destra 110° (interessato), sinistra 140° — lato interessato −21%'))
  assert.ok(cartellaL.includes('Flessione (nella norma)'))
  assert.ok(cartellaL.includes('Lachman: destra positivo, sinistra negativo (fine corsa morbido)'))

  // La relazione scritta della valutazione: le stesse cose in frasi.
  c.prepare("UPDATE valutazioni SET ispezione = 'tumefazione al ginocchio', carico_locale = 'diminuito', capacita_generale = 'aumentato' WHERE id = ?").run(valL)
  const relV = relazioneValutazione(pzL)
  assert.equal(relV[0].titolo, 'Valutazione del 10/09/2026')
  const testoV = relV[0].paragrafi.join(' ')
  assert.ok(testoV.includes("All'ispezione, osservazione e palpazione: tumefazione al ginocchio."))
  assert.ok(testoV.includes('Movimenti attivi a destra (lato interessato): flessione moderatamente limitata e dolorosa (110°).'))
  assert.ok(testoV.includes('Movimenti attivi a sinistra: flessione nella norma (140°).'))
  assert.ok(testoV.includes('Confronto fra i lati: flessione attiva 110° a destra e 140° a sinistra, −21% sul lato interessato.'))
  assert.ok(testoV.includes('Movimenti passivi a sinistra: flessione nella norma.'))
  assert.ok(
    testoV.includes('Lachman positivo a destra (lato interessato) e negativo a sinistra (fine corsa morbido)')
  )
  assert.ok(testoV.includes('Carico locale diminuito, capacità di carico generale aumentata.'))
  const documentoV = generaRelazione(pzL, 'valutazione')
  assert.ok(documentoV.includes('Relazione della valutazione obiettiva · stampata il'))
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

// --- La settimana: le sedute di tutti fra due date ---
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pz1 = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Anna', 'Bianchi')")
  const pz2 = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Marco', 'Rossi')")
  ins(
    "INSERT INTO sedute (paziente_id, data, focus) VALUES (?, '2026-10-05', 'preparazione corsa')",
    pz1
  )
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-10-07')", pz2)
  // fuori dalla settimana chiesta: non deve comparire
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-10-13')", pz1)

  // Una seduta costruita su una fase del campo si riconosce.
  const patC = ins("INSERT INTO patologie (nome, ha_campo) VALUES ('LCA', 1)")
  const faseCampo = ins(
    "INSERT INTO fasi (patologia_id, nome, campo) VALUES (?, 'Campo 4 mesi', 1)",
    patC
  )
  const fasePal = ins("INSERT INTO fasi (patologia_id, nome) VALUES (?, 'Intermedia')", patC)
  ins("INSERT INTO sedute (paziente_id, data, fase_id) VALUES (?, '2026-10-09', ?)", pz2, faseCampo)
  ins("INSERT INTO sedute (paziente_id, data, fase_id) VALUES (?, '2026-10-06', ?)", pz2, fasePal)

  const sett = seduteDellaSettimana('2026-10-05', '2026-10-11')
  assert.equal(sett.length, 4)
  assert.equal(sett.filter((x) => x.fase_campo === 1).length, 1)
  assert.equal(sett.find((x) => x.fase_campo === 1)?.fase_nome, 'Campo 4 mesi')
  // le sedute di palestra non si segnano come campo
  assert.equal(sett.filter((x) => x.fase_campo !== 1).length, 3)
  // in ordine di data, e con il nome gia' pronto da mostrare
  assert.equal(sett[0].data, '2026-10-05')
  assert.equal(sett[0].paziente, 'Bianchi Anna')
  assert.equal(sett[1].paziente, 'Rossi Marco')
  assert.equal(typeof sett[0].num_esercizi, 'number')
  // il focus della giornata arriva fino alla riga della settimana
  assert.equal(sett[0].focus, 'preparazione corsa')
  assert.equal(sett[1].focus, null)

  // Lo stesso giorno, piu' pazienti: l'ordine segue l'orario dell'appuntamento,
  // chi non ce l'ha segnato resta in fondo alla giornata.
  const pz3 = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Luca', 'Verdi')")
  ins("INSERT INTO sedute (paziente_id, data, ora) VALUES (?, '2026-10-08', '15:30')", pz1)
  ins("INSERT INTO sedute (paziente_id, data, ora) VALUES (?, '2026-10-08', '09:00')", pz2)
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-10-08')", pz3)
  const giorno = seduteDellaSettimana('2026-10-08', '2026-10-08')
  assert.equal(giorno.length, 3)
  assert.equal(giorno[0].ora, '09:00')
  assert.equal(giorno[0].paziente, 'Rossi Marco')
  assert.equal(giorno[1].ora, '15:30')
  assert.equal(giorno[1].paziente, 'Bianchi Anna')
  assert.equal(giorno[2].ora, null)
  assert.equal(giorno[2].paziente, 'Verdi Luca')
}

// --- Le indicazioni per casa in fondo al foglio ---
{
  // Senza indicazioni il foglio finisce con il programma, come prima.
  assert.ok(!generaHtml(pazExport, seduteExport).includes('class="per-casa"'))
  const conCasa = generaHtml(
    {
      ...pazExport,
      frequenza_casa: '3 volte a settimana',
      indicazioni: ['Fermati alla comparsa del dolore.']
    },
    seduteExport
  )
  assert.ok(conCasa.includes('>Indicazioni<'), 'blocco delle indicazioni')
  assert.ok(conCasa.includes('3 volte a settimana'))
  assert.ok(conCasa.includes('Fermati alla comparsa del dolore.'))
}

// --- Chi firma i fogli: l'intestazione dei documenti ---
{
  // Senza profilo il foglio esce come prima, senza intestazione.
  assert.ok(!generaHtml(pazExport, seduteExport).includes('carta-intestata'))
  salvaProfilo({
    nome: 'Dott. Mario Rossi',
    qualifica: 'Fisioterapista',
    studio: null,
    indirizzo: 'via Roma 3, Bari',
    codice_fiscale: null,
    partita_iva: '01234567890',
    telefono: '333 1234567',
    email: null
  })
  const p = leggiProfilo()
  assert.equal(p.nome, 'Dott. Mario Rossi')
  // le caselle lasciate vuote non diventano righe vuote
  assert.equal(p.studio, null)
  const { chi, dove } = righeProfilo()
  assert.equal(chi, 'Dott. Mario Rossi · Fisioterapista')
  assert.equal(dove, 'via Roma 3, Bari · P. IVA 01234567890 · 333 1234567')
  const conProfilo = generaHtml(pazExport, seduteExport)
  assert.ok(conProfilo.includes('carta-intestata'), 'intestazione nel foglio')
  assert.ok(conProfilo.includes('Dott. Mario Rossi · Fisioterapista'))
  assert.ok(conProfilo.includes('via Roma 3, Bari · P. IVA 01234567890 · 333 1234567'))
  // e poi si toglie, cosi' le prove che vengono dopo trovano i fogli com'erano
  salvaProfilo({
    nome: null,
    qualifica: null,
    studio: null,
    indirizzo: null,
    codice_fiscale: null,
    partita_iva: null,
    telefono: null,
    email: null
  })
  assert.equal(righeProfilo().chi, '')
}

// --- L'ultima volta che il paziente ha fatto un esercizio ---
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Ugo', 'Verdi')")
  const cat = ins("INSERT INTO categorie (nome) VALUES ('Forza')")
  const es1 = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Squat', cat)
  const es2 = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Ponte', cat)
  const vecchia = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-01-10')", pz)
  const recente = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-02-20')", pz)
  // una seduta programmata per il futuro: non l'ha ancora fatta
  const futura = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2099-01-01')", pz)
  const insEs = (sid: number, eid: number, serie: string, carico: string): void => {
    c.prepare(
      'INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, carico, ordine) VALUES (?, ?, ?, ?, 0)'
    ).run(sid, eid, serie, carico)
  }
  insEs(vecchia, es1, '3', '40')
  insEs(recente, es1, '4', '50')
  insEs(vecchia, es2, '2', '')
  insEs(futura, es1, '5', '999')

  const u = ultimaVoltaPerPaziente(pz, null)
  assert.equal(u.length, 2)
  const squat = u.find((x) => x.esercizio_id === es1)
  // vince la piu' recente fra quelle gia' fatte, non la programmata
  assert.equal(squat?.data, '2026-02-20')
  assert.equal(squat?.serie, '4')
  assert.equal(squat?.carico, '50')
  // escludendo la seduta che si sta modificando si torna a quella prima
  const senza = ultimaVoltaPerPaziente(pz, recente)
  assert.equal(senza.find((x) => x.esercizio_id === es1)?.carico, '40')
  // un paziente che non ha mai fatto niente non ha nessun precedente
  const altro = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Ida', 'Neri')")
  assert.equal(ultimaVoltaPerPaziente(altro, null).length, 0)
}

// --- Andamento del dolore (linguetta "Quadro"): sedute e anamnesi unite ---
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pzD = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Dolo', 'Re')")
  // il primo sintomo registrato e' quello del motivo della visita: i suoi
  // punti "dall'esordio" precedono le sedute, che devono ancora iniziare
  const sint1 = ins(
    "INSERT INTO anamnesi_sintomi (paziente_id, descrizione, ordine) VALUES (?, 'Ginocchio', 0)",
    pzD
  )
  // un secondo sintomo: i suoi punti non contano, si guarda solo il primo
  const sint2 = ins(
    "INSERT INTO anamnesi_sintomi (paziente_id, descrizione, ordine) VALUES (?, 'Caviglia', 1)",
    pzD
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2026-01-15', 6)",
    sint1
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2026-01-01', 8)",
    sint1
  )
  // un punto del grafico "giorno" non c'entra con l'andamento nel tempo
  ins("INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, dolore) VALUES (?, 'giorno', 480, 7)", sint1)
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2025-01-01', 9)",
    sint2
  )
  ins("INSERT INTO sedute (paziente_id, data, dolore) VALUES (?, '2026-02-10', 3)", pzD)
  ins("INSERT INTO sedute (paziente_id, data, dolore) VALUES (?, '2026-02-01', 5)", pzD)
  // una seduta senza dolore segnato non entra nella serie
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-02-05')", pzD)
  // una seduta programmata nel futuro non e' ancora "andamento"
  ins("INSERT INTO sedute (paziente_id, data, dolore) VALUES (?, '2099-01-01', 1)", pzD)

  const serie = andamentoDolorePerPaziente(pzD)
  assert.deepEqual(serie, [
    { data: '2026-01-01', dolore: 8, origine: 'anamnesi' },
    { data: '2026-01-15', dolore: 6, origine: 'anamnesi' },
    { data: '2026-02-01', dolore: 5, origine: 'seduta' },
    { data: '2026-02-10', dolore: 3, origine: 'seduta' }
  ])

  // un paziente senza numeri sul dolore non ha nessun punto
  const pzSenza = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Senza', 'Numeri')")
  assert.equal(andamentoDolorePerPaziente(pzSenza).length, 0)
}

// --- Controllo dell'archivio: un database sano lo dice ---
{
  const esito = controllaArchivio()
  assert.ok(esito.ok, esito.messaggio)
  assert.ok(esito.pazienti > 0)
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

// --- Esercizio "al volo": un nome scritto solo per questa seduta, senza
//     passare dalla libreria ---
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)

  const pzV = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Vito', 'Alvolo')")
  const catV = ins("INSERT INTO categorie (nome) VALUES ('Cat al volo')")
  const esV = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Affondo laterale', catV)
  const sedV = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-09-15')", pzV)

  // il vincolo CHECK impone esattamente uno tra esercizio_id e nome_libero:
  // ne' tutti e due ne' nessuno dei due
  assert.throws(
    () =>
      c
        .prepare(
          'INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, ordine) VALUES (?, NULL, NULL, 0)'
        )
        .run(sedV),
    /CHECK constraint/
  )
  assert.throws(
    () =>
      c
        .prepare(
          "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, ordine) VALUES (?, ?, 'Doppio', 0)"
        )
        .run(sedV, esV),
    /CHECK constraint/
  )

  // una riga di libreria normale...
  ins(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ripetizioni, ordine) VALUES (?, ?, '3', '10', 0)",
    sedV,
    esV
  )
  // ...e una "al volo": niente esercizio_id, solo il nome scritto li' per li'
  ins(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, serie, ripetizioni, ordine) VALUES (?, NULL, ?, '4', '12', 1)",
    sedV,
    'Slancio con elastico rosso'
  )

  type RigaLetta = {
    esercizio_id: number | null
    nome_libero: string | null
    nome: string
    categoria_nome: string | null
  }
  // il canale IPC non si puo' chiamare da qui: si ripete la lettura che fa
  // sedute:get, con lo stesso LEFT JOIN (non piu' un JOIN rigido) e la stessa
  // COALESCE del nome fra libreria e nome_libero
  const leggi = (sedutaId: number): RigaLetta[] =>
    c
      .prepare(
        `SELECT se.esercizio_id, se.nome_libero, COALESCE(e.nome, se.nome_libero) AS nome,
                c2.nome AS categoria_nome
         FROM seduta_esercizi se
         LEFT JOIN esercizi e ON e.id = se.esercizio_id
         LEFT JOIN categorie c2 ON c2.id = e.categoria_id
         WHERE se.seduta_id = ? ORDER BY se.ordine, se.id`
      )
      .all(sedutaId) as RigaLetta[]

  const righe = leggi(sedV)
  assert.equal(righe.length, 2)
  assert.equal(righe[0].nome, 'Affondo laterale')
  assert.equal(righe[0].categoria_nome, 'Cat al volo')
  assert.equal(righe[1].esercizio_id, null)
  assert.equal(righe[1].nome_libero, 'Slancio con elastico rosso')
  assert.equal(righe[1].nome, 'Slancio con elastico rosso')
  // un esercizio al volo non ha categoria: sparisce, non rompe la lettura
  assert.equal(righe[1].categoria_nome, null)

  // programmando la seduta su un'altra data (come fa sedute:programma), la
  // riga al volo deve seguirla col suo nome
  const nuova = ins(
    'INSERT INTO sedute (paziente_id, data, fase_id, note) SELECT paziente_id, ?, fase_id, note FROM sedute WHERE id = ?',
    '2026-09-22',
    sedV
  )
  ins(
    `INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, serie, ripetizioni, carico, recupero, nota, ordine)
     SELECT ?, esercizio_id, nome_libero, serie, ripetizioni, carico, recupero, nota, ordine
     FROM seduta_esercizi WHERE seduta_id = ?`,
    nuova,
    sedV
  )
  const copia = leggi(nuova)
  assert.equal(copia.length, 2)
  assert.equal(copia[0].nome, 'Affondo laterale')
  assert.equal(copia[1].esercizio_id, null)
  assert.equal(copia[1].nome, 'Slancio con elastico rosso')
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

// --- Cestino: il paziente e la sua patologia sono stati eliminati tutti e due ---
// Rimettere a posto il paziente per primo non puo' riuscire: la sua patologia
// non c'e'. Deve dire cosa fare (non "impossibile eliminare"), lasciare tutto
// com'era, e funzionare una volta rimessa a posto la patologia.
{
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const contati = (sql: string, ...a: unknown[]): number =>
    (c.prepare(sql).get(...a) as { n: number }).n
  const patM = ins("INSERT INTO patologie (nome) VALUES ('Patologia sparita')")
  const pzM = ins("INSERT INTO pazienti (nome, cognome, patologia_id) VALUES ('Mia', 'Rossi', ?)", patM)
  eliminaConCestino('pazienti', pzM, 'Paziente', 'Rossi Mia')
  eliminaConCestino('patologie', patM, 'Patologia', 'Patologia sparita')

  const vocePz = elencoCestino().find((v) => v.etichetta === 'Rossi Mia')!
  const vocePat = elencoCestino().find((v) => v.etichetta === 'Patologia sparita')!
  assert.throws(
    () => ripristina(vocePz.id),
    (e: unknown) =>
      e instanceof Error &&
      e.message.includes('Patologia sparita') &&
      !e.message.includes('FOREIGN KEY') &&
      !e.message.includes('eliminare')
  )
  // niente a meta': il paziente non e' tornato e la voce e' ancora li'
  assert.equal(contati('SELECT COUNT(*) AS n FROM pazienti WHERE id = ?', pzM), 0)
  assert.equal(elencoCestino().length, 2)

  ripristina(vocePat.id)
  ripristina(vocePz.id)
  assert.equal(contati('SELECT COUNT(*) AS n FROM pazienti WHERE id = ? AND patologia_id = ?', pzM, patM), 1)
  assert.equal(elencoCestino().length, 0)

  // se la patologia e' sparita anche dal cestino, lo si dice senza girarci intorno
  eliminaConCestino('pazienti', pzM, 'Paziente', 'Rossi Mia')
  eliminaConCestino('patologie', patM, 'Patologia', 'Patologia sparita')
  svuotaCestino(elencoCestino().find((v) => v.etichetta === 'Patologia sparita')!.id)
  assert.throws(
    () => ripristina(elencoCestino()[0].id),
    (e: unknown) =>
      e instanceof Error && e.message.includes('una patologia') && !e.message.includes('FOREIGN KEY')
  )
  svuotaCestino()
}

// --- Cestino: tiene un mese, poi le voci se ne vanno ---
// La pulizia parte a ogni accesso: le voci piu' vecchie di 30 giorni si buttano,
// quelle piu' recenti restano e si possono ancora rimettere a posto.
{
  const c = getDb()
  const giorniFa = (n: number): string => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
  const metti = (etichetta: string, quando: string): void => {
    c.prepare('INSERT INTO cestino (tipo, etichetta, quando, contenuto) VALUES (?, ?, ?, ?)').run(
      'Prova',
      etichetta,
      quando,
      '[]'
    )
  }
  svuotaCestino()
  metti('di due mesi fa', giorniFa(60))
  metti('di 31 giorni fa', giorniFa(31))
  metti('di 29 giorni fa', giorniFa(29))
  metti('di ieri', giorniFa(1))
  ripuliscilCestino()
  assert.deepEqual(
    elencoCestino()
      .map((v) => v.etichetta)
      .sort(),
    ['di 29 giorni fa', 'di ieri']
  )
  svuotaCestino()
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

// --- Quanto tempo e' passato dall'intervento ---
// Si conta in mesi e settimane, buttando via i giorni che avanzano: e' il modo
// in cui si ragiona in riabilitazione.
{
  const giorniFa = (n: number): string => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    const p = (x: number): string => String(x).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  assert.equal(daQuando(null), null)
  assert.equal(daQuando(giorniFa(3)), 'meno di una settimana')
  assert.equal(daQuando(giorniFa(7)), '1 settimana')
  // Date fisse, che non dipendono da che giorno e' oggi. Il caso che si e'
  // rotto davvero: dal 31 agosto al 7 settembre e' una settimana, ma sommando
  // i mesi a mano il 31 agosto scivolava al 1 settembre e ne mancava uno.
  assert.equal(daQuando('2026-08-31', new Date(2026, 8, 7)), '1 settimana')
  assert.equal(daQuando('2026-01-31', new Date(2026, 1, 28)), '4 settimane')
  assert.equal(daQuando('2026-03-15', new Date(2026, 8, 7)), '5 mesi e 3 settimane')
  assert.equal(daQuando('2026-09-07', new Date(2026, 8, 7)), 'meno di una settimana')
  // una data nel futuro non si conta
  assert.equal(daQuando('2026-09-08', new Date(2026, 8, 7)), null)
  // Il caso che si e' rotto davvero: appena passata la mezzanotte, con le date
  // lette come ore di Greenwich mancava sempre un giorno all'appello.
  assert.equal(daQuando(giorniFa(14)), '2 settimane')
  assert.equal(daQuando(giorniFa(20)), '2 settimane')
  // un mese e qualcosa: il mese e' quello vero del calendario, non 30 giorni
  const unMeseE3Settimane = new Date()
  unMeseE3Settimane.setMonth(unMeseE3Settimane.getMonth() - 1)
  unMeseE3Settimane.setDate(unMeseE3Settimane.getDate() - 21)
  const p2 = (x: number): string => String(x).padStart(2, '0')
  assert.equal(
    daQuando(
      `${unMeseE3Settimane.getFullYear()}-${p2(unMeseE3Settimane.getMonth() + 1)}-${p2(
        unMeseE3Settimane.getDate()
      )}`
    ),
    '1 mese e 3 settimane'
  )
  // una data nel futuro non dice niente
  const domani = new Date()
  domani.setDate(domani.getDate() + 1)
  assert.equal(
    daQuando(`${domani.getFullYear()}-${p2(domani.getMonth() + 1)}-${p2(domani.getDate())}`),
    null
  )
}

// --- Tema: i documenti stampati devono seguire il colore scelto ---
{
  // Il tema di partenza e' il verde; scegliendo il blu cambiano le intestazioni
  // dei documenti, non solo l'interfaccia.
  assert.equal(coloriTema().accento, '#55806a')
  impostaTemaCorrente('blu')
  assert.equal(coloriTema().accento, '#2563eb')
  impostaTemaCorrente('prugna')
  assert.equal(coloriTema().accento, '#7a5299')
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

// --- Il riassunto scritto del report dello screening ---
// Due screening a confronto: la forza e' sotto la soglia di simmetria sul lato
// operato, la reattivita' supera la sua soglia ed e' migliorata.
{
  const db = getDb()
  const paz = Number(
    db.prepare("INSERT INTO pazienti (nome, cognome, arto_operato) VALUES ('Luca', 'Prova', 'dx')")
      .run().lastInsertRowid
  )
  const tForza = Number(
    db.prepare(
      "INSERT INTO test_valutazione (nome, prove, per_lato, lsi_cutoff, qualita) VALUES ('Dinamometro', 1, 1, 90, 'forza')"
    ).run().lastInsertRowid
  )
  const mForza = Number(
    db.prepare("INSERT INTO test_misure (test_id, nome, unita) VALUES (?, 'Picco', 'kg')")
      .run(tForza).lastInsertRowid
  )
  const tSalto = Number(
    db.prepare(
      "INSERT INTO test_valutazione (nome, prove, qualita) VALUES ('Drop jump prova', 1, 'Reattività')"
    ).run().lastInsertRowid
  )
  const mSalto = Number(
    db.prepare(
      "INSERT INTO test_misure (test_id, nome, unita, cutoff, cutoff_direzione) VALUES (?, 'Altezza', 'cm', 30, 'min')"
    ).run(tSalto).lastInsertRowid
  )
  const prot = Number(
    db.prepare("INSERT INTO screening_protocolli (nome, sport) VALUES ('RTP', 'Calcio')").run()
      .lastInsertRowid
  )
  const sez = Number(
    db.prepare("INSERT INTO screening_sezioni (protocollo_id, nome) VALUES (?, 'Ambulatorio')")
      .run(prot).lastInsertRowid
  )
  db.prepare('INSERT INTO screening_voci (sezione_id, test_id, ordine) VALUES (?, ?, 0)').run(sez, tForza)
  db.prepare('INSERT INTO screening_voci (sezione_id, test_id, ordine) VALUES (?, ?, 1)').run(sez, tSalto)
  const sessione = (data: string): number =>
    Number(
      db.prepare(
        "INSERT INTO screening_sessioni (paziente_id, protocollo_id, protocollo_nome, sport, data) VALUES (?, ?, 'RTP', 'Calcio', ?)"
      ).run(paz, prot, data).lastInsertRowid
    )
  const valore = db.prepare(
    'INSERT INTO screening_valori (sessione_id, misura_id, lato, prova, valore) VALUES (?, ?, ?, 1, ?)'
  )
  const t0 = sessione('2026-05-07')
  valore.run(t0, mForza, 'dx', 30)
  valore.run(t0, mForza, 'sx', 45)
  valore.run(t0, mSalto, null, 28)
  const t1 = sessione('2026-07-16')
  valore.run(t1, mForza, 'dx', 30)
  valore.run(t1, mForza, 'sx', 45)
  valore.run(t1, mSalto, null, 33)

  const { html } = generaReportScreening([t0, t1])
  if (process.env['RIASSUNTO_HTML']) writeFileSync(process.env['RIASSUNTO_HTML'], html)
  const riassunto = html.slice(html.indexOf('class="riassunto"'), html.indexOf('</ul></div>'))
  assert.ok(riassunto.length > 0, 'il riassunto manca')
  assert.ok(riassunto.includes('<b>Forza</b>'), 'raggruppato per qualità')
  assert.ok(riassunto.includes('sul lato operato in Dinamometro'), 'deficit sul lato operato')
  assert.ok(riassunto.includes('LSI 67%'))
  assert.ok(riassunto.includes('<b>Reattività</b>: <span class="ok">nella norma</span>'))
  assert.ok(riassunto.includes('In miglioramento</span>: Drop jump prova – Altezza +18%'), 'miglioramento dal primo screening')
  // la variazione nella tabella sta tra parentesi, accanto al numero
  assert.ok(html.includes('(+18%)'))

  // la barra in cima alla finestra entra subito dopo <body>, col titolo
  // protetto, e in stampa non c'e'
  const conTitolo = conBarra(html, 'Report — Prova <Luca>')
  assert.ok(/<body[^>]*><div class="barra-finestra"><span class="titolo-barra">Report — Prova &lt;Luca&gt;<\/span>/.test(conTitolo))
  assert.ok(conTitolo.includes("window.finestra.comando('chiudi')"))
  assert.ok(conBarra(html, 'x', coloriBarra('blu', true, false)).includes('background: #18202b'))
  assert.ok(conBarra(html, 'x', coloriBarra('verde', false, false)).includes('background: #e6dcc9'))
  assert.ok(conTitolo.includes('@media print { .barra-finestra, .spazio-barra { display: none; } }'))
}

// --- Il diario della seduta: cosa riferisce, trattamento, l'ultima volta ---
{
  const db = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(db.prepare(sql).run(...a).lastInsertRowid)
  // le tecniche di partenza ci sono gia'
  const tecniche = db.prepare('SELECT id, nome FROM tecniche ORDER BY ordine').all() as { id: number; nome: string }[]
  assert.ok(tecniche.some((t) => t.nome === 'Tecar'))
  const tecar = tecniche.find((t) => t.nome === 'Tecar')!.id
  const manuale = tecniche.find((t) => t.nome === 'Terapia manuale')!.id

  const paz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Diario', 'Prova')")
  const prima = ins(
    `INSERT INTO sedute (paziente_id, data, riferito_andamento, riferito, trattamento, dolore, note)
     VALUES (?, '2026-09-01', 'meglio', 'meno dolore la mattina', 'zona rotulea', 4, 'rivedere lo squat')`,
    paz
  )
  ins('INSERT INTO seduta_tecniche (seduta_id, tecnica_id) VALUES (?, ?)', prima, tecar)
  ins('INSERT INTO seduta_tecniche (seduta_id, tecnica_id) VALUES (?, ?)', prima, manuale)
  const segno = ins("INSERT INTO segni (paziente_id, nome, unita) VALUES (?, 'Dolore nello squat', '0-10')", paz)
  ins('INSERT INTO segno_valori (segno_id, seduta_id, valore) VALUES (?, ?, 5)', segno, prima)
  // una seduta programmata piu' avanti non conta come "l'ultima volta"
  ins("INSERT INTO sedute (paziente_id, data, riferito) VALUES (?, '2026-09-20', 'futura')", paz)

  const p = sedutaPrecedente(paz, null, '2026-09-05')
  assert.ok(p)
  assert.equal(p?.data, '2026-09-01')
  assert.equal(p?.riferito_andamento, 'meglio')
  assert.deepEqual(p?.tecniche, ['Terapia manuale', 'Tecar'])
  assert.deepEqual(p?.segni, [{ nome: 'Dolore nello squat', unita: '0-10', valore: 5 }])
  // modificando proprio quella seduta, la precedente non e' lei
  assert.equal(sedutaPrecedente(paz, prima, '2026-09-01'), null)

  // nel diario stampato: cosa riferisce, trattamento e dolore, non gli esercizi
  const cartellaDiario = generaCartella(paz, ['sedute'])
  assert.ok(
    cartellaDiario.includes(
      '01/09/2026 · riferisce: meglio, meno dolore la mattina · trattamento: Terapia manuale, Tecar; zona rotulea · dolore 4/10'
    )
  )

  // la modalita' scura a orari fissi, anche a cavallo della mezzanotte
  const alle = (h: number, m = 0): Date => new Date(2026, 8, 15, h, m)
  assert.equal(nellaFascia('20:00', '07:00', alle(21)), true)
  assert.equal(nellaFascia('20:00', '07:00', alle(6, 59)), true)
  assert.equal(nellaFascia('20:00', '07:00', alle(7)), false)
  assert.equal(nellaFascia('20:00', '07:00', alle(12)), false)
  assert.equal(nellaFascia('13:00', '15:00', alle(14)), true)
  assert.equal(nellaFascia('10:00', '10:00', alle(10)), false)
}

// --- Il punteggio del cluster ---
// Un piccolo Ankle-GO: una misura di un test a una gamba per volta, una di un
// test bilaterale e il punteggio di un questionario, con le soglie dei punti e
// le fasce del risultato. Un protocollo senza punteggio non ne mostra.
{
  const db = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(db.prepare(sql).run(...a).lastInsertRowid)
  const paz = ins("INSERT INTO pazienti (nome, cognome, arto_operato) VALUES ('Punti', 'Cluster', 'dx')")
  const tHop = ins("INSERT INTO test_valutazione (nome, prove, per_lato) VALUES ('Side hop prova', 1, 1)")
  const mHop = ins(
    "INSERT INTO test_misure (test_id, nome, unita, cutoff, cutoff_direzione) VALUES (?, 'Tempo', 's', 13, 'max')",
    tHop
  )
  const tOtto = ins("INSERT INTO test_valutazione (nome, prove) VALUES ('Figure of 8 prova', 2)")
  const mOtto = ins(
    "INSERT INTO test_misure (test_id, nome, unita, per_prova, riassunto) VALUES (?, 'Tempo', 's', 1, 'peggiore')",
    tOtto
  )
  const qFaam = ins("INSERT INTO questionari (nome) VALUES ('FAAM prova')")
  const pFaam = ins("INSERT INTO questionario_punteggi (questionario_id, nome) VALUES (?, 'Totale')", qFaam)

  const prot = ins("INSERT INTO screening_protocolli (nome, sport) VALUES ('Ankle-GO prova', 'Caviglia')")
  salvaProtocollo({
    protocollo: { id: prot, nome: 'Ankle-GO prova', sport: 'Caviglia', note: null, ordine: 0, archiviato: 0 },
    sezioni: [
      {
        id: -1,
        nome: 'Test',
        voci: [
          { id: -2, test_id: tHop, questionario_id: null },
          { id: -3, test_id: tOtto, questionario_id: null },
          { id: -4, test_id: null, questionario_id: qFaam }
        ]
      }
    ],
    punteggio: {
      regole: [
        {
          id: null, misura_id: mHop, punteggio_id: null, lato: 'interessato', nome: 'Side hop – Tempo',
          soglie: [
            { minimo: null, massimo: 9.99, punti: 4 },
            { minimo: 10, massimo: 13, punti: 2 },
            { minimo: null, massimo: null, punti: 0 }
          ]
        },
        {
          id: null, misura_id: mOtto, punteggio_id: null, lato: null, nome: 'Figure of 8 – Tempo',
          soglie: [
            { minimo: null, massimo: 12.99, punti: 2 },
            { minimo: 13, massimo: 18, punti: 1 }
          ]
        },
        {
          id: null, misura_id: null, punteggio_id: pFaam, lato: null, nome: 'FAAM ADL',
          soglie: [
            { minimo: 95.01, massimo: null, punti: 2 },
            { minimo: 90, massimo: 95, punti: 1 }
          ]
        }
      ],
      fasce: [
        { etichetta: 'Recupero probabile', minimo: 7, massimo: null },
        { etichetta: 'Ritorno improbabile', minimo: 0, massimo: 6 }
      ]
    }
  })
  assert.equal(leggiProtocollo(prot).punteggio?.regole.length, 3)
  // salvando senza il punteggio, quello che c'e' resta
  salvaProtocollo({ ...leggiProtocollo(prot), punteggio: undefined })
  assert.equal(leggiProtocollo(prot).punteggio?.fasce.length, 2)
  // la copia del protocollo si porta dietro anche il punteggio
  assert.equal(leggiProtocollo(duplicaProtocollo(prot, 'Ankle-GO copia')).punteggio?.regole.length, 3)

  const sessione = ins(
    "INSERT INTO screening_sessioni (paziente_id, protocollo_id, protocollo_nome, sport, data) VALUES (?, ?, 'Ankle-GO prova', 'Caviglia', '2026-09-01')",
    paz, prot
  )
  const valore = db.prepare(
    'INSERT INTO screening_valori (sessione_id, misura_id, lato, prova, valore) VALUES (?, ?, ?, ?, ?)'
  )
  valore.run(sessione, mHop, 'dx', 1, 9.5)
  valore.run(sessione, mHop, 'sx', 1, 8)
  valore.run(sessione, mOtto, null, 1, 14)
  valore.run(sessione, mOtto, null, 2, 12.5)

  // senza il questionario il punteggio e' parziale: niente fascia
  const parziale = calcolaPunteggio(sessione)
  assert.ok(parziale && !parziale.completo && parziale.fascia == null)
  assert.equal(parziale?.totale, 6)

  const comp = ins(
    "INSERT INTO paziente_questionari (paziente_id, questionario_id, data) VALUES (?, ?, '2026-09-01')",
    paz, qFaam
  )
  ins("INSERT INTO compilazione_punteggi (compilazione_id, nome, valore, ordine) VALUES (?, 'Totale', 96, 0)", comp)
  ins(
    'INSERT INTO screening_questionari (sessione_id, questionario_id, compilazione_id) VALUES (?, ?, ?)',
    sessione, qFaam, comp
  )

  const risultato = calcolaPunteggio(sessione)
  assert.ok(risultato)
  // lato interessato destro 9,5 s → 4; la prova migliore del Figure of 8 e'
  // la piu' bassa, 12,5 s → 2; FAAM 96 → 2
  assert.deepEqual(risultato?.voci.map((v) => v.punti), [4, 2, 2])
  assert.equal(risultato?.totale, 8)
  assert.equal(risultato?.massimo, 8)
  assert.equal(risultato?.fascia, 'Recupero probabile')
  const reportPunti = generaReportScreening([sessione]).html
  assert.ok(reportPunti.includes('Punteggio: 8 / 8') && reportPunti.includes('Recupero probabile'))

  // un protocollo senza punteggio non ne mostra
  const protSenza = ins("INSERT INTO screening_protocolli (nome, sport) VALUES ('Senza punti', 'Calcio')")
  const sessioneSenza = ins(
    "INSERT INTO screening_sessioni (paziente_id, protocollo_id, protocollo_nome, sport, data) VALUES (?, ?, 'Senza punti', 'Calcio', '2026-09-02')",
    paz, protSenza
  )
  assert.equal(calcolaPunteggio(sessioneSenza), null)
  assert.ok(!generaReportScreening([sessioneSenza]).html.includes('class="punteggio"'))
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

// Domanda di recupero: si imposta con la password, la risposta non bada a
// maiuscole e spazi, e la chiave di recupero resta valida
assert.equal(domandaAuth(authPath), null)
assert.throws(() => impostaDomandaAuth(authPath, 'sbagliata', 'Primo cane?', 'Fido'), /Password errata/)
// una risposta corta si indovina troppo in fretta: si rifiuta, e non cambia niente
assert.throws(
  () => impostaDomandaAuth(authPath, 'password-numero-tre', 'Nome del primo cane?', 'Fido'),
  /almeno 8 caratteri/
)
assert.throws(
  () => impostaDomandaAuth(authPath, 'password-numero-tre', 'Nome del primo cane?', '  Fido   '),
  /almeno 8 caratteri/
)
impostaDomandaAuth(authPath, 'password-numero-tre', 'Nome del primo cane?', 'Fido Bello')
assert.equal(domandaAuth(authPath), 'Nome del primo cane?')
assert.throws(() => recoverDomandaAuth(authPath, 'Rex', 'password-quattro'), /Risposta sbagliata/)
assert.equal(recoverDomandaAuth(authPath, '  fido   BELLO ', 'password-quattro'), dekHex)
assert.equal(loginAuth(authPath, 'password-quattro'), dekHex)
assert.equal(recoverAuth(authPath, recoveryKey, 'password-quattro'), dekHex)
togliDomandaAuth(authPath, 'password-quattro')
assert.equal(domandaAuth(authPath), null)
assert.throws(() => recoverDomandaAuth(authPath, 'fido bello', 'password-cinque'), /Non è stata impostata/)

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

// Una destinazione con dentro anche solo un pezzo di un altro archivio (le
// chiavi, o un giornale) non si accetta, e non si sposta niente: un database
// con le chiavi sbagliate non si aprirebbe piu'.
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

// Se un file non si sposta, quelli gia' spostati tornano al loro posto.
{
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
}

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
    `INSERT INTO anamnesi_remota (paziente_id, patologie, traumi, interventi, riabilitazioni,
       bioimmagini_note,
       peso, febbre, sudorazione, nausea, fumo, neoplasie, gravidanza, pacemaker, schegge)
     VALUES (?, 'Ipertensione', 'nessuno', 'nessuno', 'nessuna', 'RX negativa',
       0, 0, 0, 0, 1, 0, 0, 0, 0)`,
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
  c.prepare('UPDATE pazienti SET aspettative = ? WHERE id = ?').run(
    'Vorrei tornare in piscina prima dell estate',
    pz
  )

  // La relazione scritta: frasi fisse riempite con quello che c'e', i "no"
  // detti con "nega", niente di inventato.
  const rel = relazioneAnamnesi(Number(pz))
  assert.equal(rel.prossima[0].testo, 'Si rivolge per dolore lombare.')
  assert.ok(
    rel.prossima[1].testo.startsWith(
      'Riferisce lombare destro, intermittente, al primo episodio, presente da 3 settimane, a esordio non traumatico.'
    )
  )
  // cosa lo aggrava e cosa lo allevia: elenchi puntati sotto al sintomo
  assert.deepEqual(rel.prossima[1].elenchi, [
    { titolo: 'Cosa lo aggrava', voci: ['Stare seduta'] },
    { titolo: 'Cosa lo allevia', voci: ['Camminare'] }
  ])
  // l'andamento nelle 24 ore e dall'esordio: ognuno a capo
  assert.ok(rel.prossima.some((p) => p.testo === "Nell'arco delle 24 ore: peggio la sera."))
  assert.ok(rel.prossima.some((p) => p.testo === "Dall'esordio a oggi: in calo."))
  assert.ok(rel.prossima[2].testo.startsWith('Riferisce inoltre rigidità mattutina, costante.'))
  assert.ok(
    rel.prossima.some((p) =>
      p.testo.includes('Nega dolore o sintomi notturni, disturbi del sonno, sintomi neurologici e peggioramento con tosse o starnuto.')
    )
  )
  assert.ok(!rel.prossima.some((p) => p.testo.includes('Note: nessuna')))
  assert.ok(rel.remota[0].testo.startsWith('Altre patologie e farmaci: ipertensione.'))
  assert.ok(rel.remota[0].testo.includes('Nega traumi precedenti, interventi chirurgici e precedenti riabilitativi.'))
  assert.ok(rel.remota.some((p) => p.testo.startsWith('Riferisce fumo. Nega variazioni di peso')))
  // I campi a pulsanti: si'/no col dettaglio, durata con la fase, esordio in
  // una parola, intensita' del dolore.
  const pzNuovo = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Nuovi', 'Campi')")
  ins(
    `INSERT INTO anamnesi_prossima (paziente_id, notturno_sn, dolore_notturno, sonno_sn, neuro_sn,
       neuro_tipi, sintomi_neurologici)
     VALUES (?, 1, 'si sveglia verso le 4', 0, 1, 'formicolio,forza', 'gamba sinistra')`,
    pzNuovo
  )
  ins(
    `INSERT INTO anamnesi_sintomi (paziente_id, descrizione, durata_numero, durata_unita, da_quanto,
       esordio_modo, traumatico, nprs_attuale, nprs_peggiore, ordine)
     VALUES (?, 'dolore al ginocchio destro', 3, 'settimane', 'dopo la partita', 'improvviso', 1, 4, 7, 0)`,
    pzNuovo
  )
  const relNuova = relazioneAnamnesi(Number(pzNuovo))
  assert.equal(
    relNuova.prossima[0].testo,
    'Riferisce dolore al ginocchio destro, presente da 3 settimane (fase acuta), dopo la partita, a esordio improvviso e traumatico. Intensità del dolore (NPRS): attuale 4/10, peggiore 7/10.'
  )
  assert.equal(
    relNuova.prossima[1].testo,
    'Riferisce dolore o sintomi notturni (si sveglia verso le 4) e sintomi neurologici (formicolio o parestesie e perdita di forza, gamba sinistra). Nega disturbi del sonno.'
  )
  const cartellaNuova = generaCartella(Number(pzNuovo), ['anamnesi'])
  assert.ok(cartellaNuova.includes('3 settimane (fase acuta), dopo la partita'))
  assert.ok(cartellaNuova.includes('sì — si sveglia verso le 4'))
  assert.ok(cartellaNuova.includes('attuale 4/10 · peggiore 7/10'))
  assert.ok(cartellaNuova.includes('sì — formicolio o parestesie, perdita di forza — gamba sinistra'))

  // e' un documento a parte, non una sezione della cartella
  const documentoRelazione = generaRelazione(Number(pz))
  if (process.env['RELAZIONE_HTML']) writeFileSync(process.env['RELAZIONE_HTML'], documentoRelazione)
  assert.ok(documentoRelazione.includes('Relazione dell’anamnesi · stampata il'))
  assert.ok(documentoRelazione.includes('<p>Si rivolge per dolore lombare.</p>'))
  assert.ok(!generaCartella(Number(pz), SEZIONI.map((x) => x.chiave)).includes('Si rivolge per'))

  const tutte = SEZIONI.map((x) => x.chiave)
  const doc = generaCartella(Number(pz), tutte)
  for (const atteso of [
    'Verdi',
    'Dolore lombare',      // anamnesi prossima
    'Altre patologie',     // anamnesi remota: il campo nuovo
    'Ipertensione',
    'RX negativa',         // anamnesi remota
    'Rachide lombare',     // valutazione obiettiva
    'tira dal lato opposto', // note del movimento attivo nella valutazione
    'fine corsa elastico',   // e del passivo
    'Prova PROM',          // questionari
    'Aspettative del paziente', // quello che si aspetta, con parole sue
    'tornare in piscina',
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

  // Un testo che comincia con = + - @ Excel lo eseguirebbe come formula: un
  // apostrofo davanti lo lascia testo. I numeri e il resto non cambiano.
  {
    const c = getDb()
    c.prepare('INSERT INTO pazienti (nome, cognome, diagnosi, lavoro, sport) VALUES (?, ?, ?, ?, ?)').run(
      'Formula',
      'Prova',
      '=HYPERLINK("http://esempio.it","clicca")',
      '-dolore al mattino',
      'Nuoto'
    )
    const dirF = mkdtempSync(join(tmpdir(), 'riab-csv-formule-'))
    const csvF = readFileSync(join(esportaArchivio(dirF), 'pazienti.csv'), 'utf-8')
    assert.ok(csvF.includes(`"'=HYPERLINK(""http://esempio.it"",""clicca"")"`), 'la formula resta testo')
    assert.ok(csvF.includes("'-dolore al mattino"))
    assert.ok(csvF.includes('Prova;Formula;'), 'il testo normale non cambia')
    assert.ok(!/;=HYPERLINK/.test(csvF), 'nessuna cella comincia con =')
    // 'Verdi;Giulia' e la data non hanno subito niente
    assert.ok(csvF.includes('Verdi;Giulia'))
    c.prepare("DELETE FROM pazienti WHERE cognome = 'Prova' AND nome = 'Formula'").run()
    rmSync(dirF, { recursive: true, force: true })
  }

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
                             ripetizioni_default, unita_carico,
                             recupero_cluster_default, recupero_default)
       VALUES ('Balzi a piedi pari', ?, '4', '3', '2', 'sec', '15"', '2''')`,
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
    // Il carico: si scrive il numero e l'unita' la mette l'app; quello che
    // scrivi a parole resta com'e'.
    assert.equal(caricoTesto('10', null), '10')
    assert.equal(caricoTesto('10', 'kg'), '10 kg')
    assert.equal(caricoTesto('7,5', 'sec'), '7,5 sec')
    assert.equal(caricoTesto('elastico rosso', 'kg'), 'elastico rosso')
    assert.equal(caricoTesto('12 kg', 'kg'), '12 kg')
    assert.equal(caricoTesto('', 'kg'), null)
    assert.equal(caricoTesto('10', ''), '10')
    // e la scheda del paziente porta con se' l'unita' scelta
    assert.equal(rigaCl.unita_carico, 'sec')

    // senza cluster il dosaggio resta quello di sempre
    assert.equal(volumeTesto({ serie: '3', cluster: null, ripetizioni: '10' }), '3 × 10')
    assert.equal(recuperoEsteso({ recupero_cluster: null, recupero: '1 min' }), 'rec. 1 min')
  // le ripetizioni di riserva: il numero da solo non si capirebbe
  assert.equal(rirTesto({ rir: '2' }), 'RIR 2')
  assert.equal(rirTesto({ rir: null }), null)
  assert.equal(rirTesto({ rir: '  ' }), null)
  assert.equal(intensitaTesto({ carico: '60', unita_carico: 'kg', rir: '2' }), '60 kg · RIR 2')
  assert.equal(intensitaTesto({ carico: '60', unita_carico: 'kg', rir: null }), '60 kg')
  assert.equal(intensitaTesto({ carico: null, rir: '2' }), 'RIR 2')
  assert.equal(intensitaTesto({ carico: null, rir: null }), null)

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

// initDb davanti a un archivio piu' nuovo: errore chiaro, e il file non resta agganciato.
{
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
}

void (async () => {
  await provaTemporanei
  const docxBuf = await generaDocx(pazExport, seduteExport)
  assert.ok(docxBuf.length > 1000 && docxBuf[0] === 0x50 && docxBuf[1] === 0x4b) // magic 'PK' (zip)
  console.log('Smoke test OK: migrazioni, vincoli, export e cifratura funzionano.')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
