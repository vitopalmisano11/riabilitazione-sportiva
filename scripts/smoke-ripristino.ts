// Prova del ripristino di una copia di sicurezza.
//
// E' la cosa piu' delicata che il programma faccia con i dati: prende
// l'archivio in uso e lo sostituisce. Se va storto, si perde tutto. Qui si
// mettono alla prova i casi brutti — la copia rotta, la copia a meta', il
// ripristino interrotto — e si controlla che l'archivio di partenza resti
// sempre intatto quando qualcosa non torna.
//
// Si prova anche il caso di una copia fatta con una versione vecchia del
// programma: riaprendola, l'archivio deve aggiornarsi da solo senza perdere
// niente.
//
// Uso: npm run smoke:ripristino (si avvia da scripts/smoke-ripristino.js, che
// esegue questo file dentro a Electron: servono le vere cartelle dell'app).
// Nessun dato vero viene toccato: si lavora solo in cartelle temporanee.
import assert from 'node:assert/strict'
import { app } from 'electron'
import Database from 'better-sqlite3-multiple-ciphers'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { MIGRATIONS } from '../src/main/migrations'
import { setupAuth } from '../src/main/auth'
import { closeDb, getDb, initDb } from '../src/main/db'
import { impostaCartellaBackup, impostaCartellaDati } from '../src/main/impostazioni'
import {
  controllaBackup,
  elencoBackup,
  eseguiBackup,
  eseguiRipristino
} from '../src/main/backup'

const DB = 'riabilitazione.db'
const AUTH = 'auth.json'

// La cartella temporanea la prepara il lanciatore, prima ancora di caricare i
// moduli dell'app: da qui in poi non si esce mai da li'.
const base = process.env['RIAB_PROVA_DIR']
if (!base) throw new Error('Manca la cartella di prova: avviare con npm run smoke:ripristino.')

const dati = join(base, 'dati')
const copie = join(base, 'copie')
mkdirSync(dati, { recursive: true })
mkdirSync(copie, { recursive: true })
impostaCartellaDati(dati)
impostaCartellaBackup(copie)
assert.equal(join(dati, DB).startsWith(base), true, 'la prova deve restare nella cartella temporanea')

const dbApp = join(dati, DB)
const authApp = join(dati, AUTH)

// --- piccolo banco di prova ---
let fatti = 0
function controllo(titolo: string, corpo: () => void): void {
  corpo()
  fatti++
  console.log(`  ok  ${titolo}`)
}

const pazienti = (): string[] =>
  (getDb().prepare('SELECT cognome FROM pazienti ORDER BY cognome').all() as { cognome: string }[])
    .map((r) => r.cognome)

function aggiungiPaziente(cognome: string): void {
  getDb().prepare('INSERT INTO pazienti (nome, cognome) VALUES (?, ?)').run('Prova', cognome)
}

// Una copia con un nome deciso da noi: i nomi veri hanno il minuto come unita'
// minima, e due copie fatte nello stesso minuto si sovrascriverebbero.
function copiaChiamata(nome: string): string {
  const fatta = eseguiBackup()
  const dest = join(copie, nome)
  rmSync(dest, { recursive: true, force: true })
  renameSync(fatta, dest)
  return dest
}

// Una cartella di copia costruita a mano, per i casi rotti.
function cartellaCopia(nome: string): string {
  const dir = join(copie, nome)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

// Un archivio come lo avrebbe lasciato una versione vecchia del programma:
// solo una parte delle migrazioni applicate.
function archivioVecchio(percorso: string, dek: string, fino: number): void {
  const conn = new Database(percorso)
  conn.pragma(`cipher='sqlcipher'`)
  conn.pragma(`key='${dek}'`)
  conn.pragma('foreign_keys = ON')
  for (let i = 0; i < fino; i++) {
    conn.exec(MIGRATIONS[i])
    conn.pragma(`user_version = ${i + 1}`)
  }
  conn.prepare('INSERT INTO pazienti (nome, cognome) VALUES (?, ?)').run('Prova', 'Anziani')
  conn.close()
}

const provvisori = [`${DB}.nuovo`, `${AUTH}.nuovo`, `${DB}.nuovo-wal`, `${DB}.nuovo-shm`]
const restiProvvisori = (): string[] =>
  readdirSync(dati).filter((f) => f.includes('.nuovo'))

function prove(): void {
  // --- preparazione: un archivio con dentro qualcosa ---
  const { dekHex } = setupAuth(authApp, 'prova-di-prova')
  initDb(dbApp, dekHex)
  aggiungiPaziente('Uno')
  aggiungiPaziente('Due')

  // 1 — una copia sana si riconosce come sana
  const sana = copiaChiamata('2020-01-01_0900')
  controllo('una copia sana si apre e racconta cosa contiene', () => {
    const esito = controllaBackup('2020-01-01_0900')
    assert.equal(esito.ok, true, esito.messaggio)
    assert.equal(esito.pazienti, 2)
    assert.equal(esito.sedute, 0)
  })

  // 2 — i nomi di cartella che non abbiamo scritto noi non sono copie
  controllo('un nome di cartella non nostro viene rifiutato', () => {
    for (const nome of ['Documenti', '2020-01-01', '../fuori', '2020-13-99_9999x']) {
      const esito = controllaBackup(nome)
      assert.equal(esito.ok, false)
      assert.match(esito.messaggio, /non valida/)
    }
  })

  // 3 — una copia senza il database
  controllo('una copia senza il database lo dice', () => {
    cartellaCopia('2020-01-02_0900')
    const esito = controllaBackup('2020-01-02_0900')
    assert.equal(esito.ok, false)
    assert.match(esito.messaggio, /manca il database/)
  })

  // 4 — una copia senza le chiavi: il database da solo non si riaprirebbe
  controllo('una copia senza auth.json lo dice', () => {
    const dir = cartellaCopia('2020-01-03_0900')
    copyFileSync(join(sana, DB), join(dir, DB))
    const esito = controllaBackup('2020-01-03_0900')
    assert.equal(esito.ok, false)
    assert.match(esito.messaggio, /auth\.json/)
  })

  // 5 — un file rovinato, e uno che viene da un altro archivio
  controllo('una copia rovinata o di un altro archivio non si apre', () => {
    const rotta = cartellaCopia('2020-01-04_0900')
    writeFileSync(join(rotta, DB), 'questo non e un database')
    copyFileSync(authApp, join(rotta, AUTH))
    assert.equal(controllaBackup('2020-01-04_0900').ok, false)

    const altra = cartellaCopia('2020-01-05_0900')
    const estranea = new Database(join(altra, DB))
    estranea.pragma(`cipher='sqlcipher'`)
    estranea.pragma(`key='00112233445566778899aabbccddeeff'`)
    estranea.exec('CREATE TABLE pazienti (id INTEGER PRIMARY KEY)')
    estranea.close()
    copyFileSync(authApp, join(altra, AUTH))
    assert.equal(controllaBackup('2020-01-05_0900').ok, false)
  })

  // 6 — l'elenco delle copie: solo le nostre, dalla piu' recente
  controllo('l’elenco mostra solo le copie nostre, dalla piu’ recente', () => {
    mkdirSync(join(copie, 'una cartella qualsiasi'), { recursive: true })
    const nomi = elencoBackup().map((v) => v.nome)
    assert.equal(nomi.includes('una cartella qualsiasi'), false)
    assert.deepEqual([...nomi].sort((a, b) => b.localeCompare(a)), nomi)
    assert.equal(nomi.includes('2020-01-01_0900'), true)
  })

  // 7 — se la copia e' cattiva il ripristino non parte nemmeno
  controllo('con una copia cattiva il ripristino non parte e l’archivio resta com’era', () => {
    const prima = pazienti()
    const copiePrima = elencoBackup().length
    assert.throws(() => eseguiRipristino('2020-01-04_0900'), /rimasto com'era/)
    assert.deepEqual(pazienti(), prima, 'i dati non devono essere cambiati')
    assert.deepEqual(restiProvvisori(), [], 'nessun file a meta’ sul disco')
    assert.equal(elencoBackup().length, copiePrima, 'niente da salvare: non si tocca niente')
  })

  // 8 — il ripristino riuscito: i dati tornano quelli della copia
  controllo('una copia sana si ripristina e i dati sono quelli della copia', () => {
    aggiungiPaziente('Tre') // dopo la copia: deve sparire con il ripristino
    assert.deepEqual(pazienti(), ['Due', 'Tre', 'Uno'])
    eseguiRipristino('2020-01-01_0900')
    initDb(dbApp, dekHex)
    assert.deepEqual(pazienti(), ['Due', 'Uno'])
  })

  // 9 — prima di sostituire, lo stato di adesso viene messo da parte
  controllo('prima di sostituire viene presa la copia "prima del ripristino"', () => {
    const rete = elencoBackup().filter((v) => v.nome.startsWith('prima-del-ripristino_'))
    assert.equal(rete.length >= 1, true, 'manca la rete di sicurezza')
    const esito = controllaBackup(rete[0].nome)
    assert.equal(esito.ok, true, esito.messaggio)
    // dentro c'e' lo stato di prima, con i tre pazienti
    assert.equal(esito.pazienti, 3)
  })

  // 10 — dopo il ripristino non restano i giornali dell'archivio di prima
  controllo('dopo il ripristino non restano giornali vecchi ne’ file provvisori', () => {
    closeDb()
    for (const f of provvisori) assert.equal(existsSync(join(dati, f)), false, f)
    // il db e' chiuso: i giornali di questa sessione non ci sono piu'
    assert.equal(existsSync(join(dati, `${DB}-wal`)), false)
    assert.equal(existsSync(join(dati, `${DB}-shm`)), false)
    initDb(dbApp, dekHex)
  })

  // 11 — un ripristino che si rompe a meta' lascia l'archivio di prima intatto
  controllo('un ripristino che si rompe a meta’ non tocca l’archivio', () => {
    aggiungiPaziente('Quattro')
    const prima = pazienti()
    // copia con il database buono ma le chiavi impossibili da copiare: e' il
    // caso del disco che si stacca a meta' strada
    const zoppa = cartellaCopia('2020-01-06_0900')
    copyFileSync(join(sana, DB), join(zoppa, DB))
    mkdirSync(join(zoppa, AUTH))
    assert.equal(controllaBackup('2020-01-06_0900').ok, true)

    assert.throws(() => eseguiRipristino('2020-01-06_0900'), /rimasto com'era/)
    // l'archivio si riapre da solo ed e' quello di prima
    assert.deepEqual(pazienti(), prima)
    assert.deepEqual(restiProvvisori(), [], 'nessun file a meta’ sul disco')
    assert.equal(existsSync(authApp), true)
  })

  // 12 — i resti di un ripristino interrotto non disturbano quello nuovo
  controllo('i resti di un ripristino interrotto vengono ripuliti', () => {
    for (const f of provvisori) writeFileSync(join(dati, f), 'spazzatura')
    assert.equal(restiProvvisori().length, provvisori.length)
    eseguiRipristino('2020-01-01_0900')
    assert.deepEqual(restiProvvisori(), [])
    initDb(dbApp, dekHex)
    assert.deepEqual(pazienti(), ['Due', 'Uno'])
  })

  // 13 — una copia fatta con una versione vecchia del programma
  const fino = Math.floor(MIGRATIONS.length / 2)
  controllo('una copia vecchia si riconosce e si apre', () => {
    const vecchia = cartellaCopia('2020-01-07_0900')
    archivioVecchio(join(vecchia, DB), dekHex, fino)
    copyFileSync(authApp, join(vecchia, AUTH))
    const esito = controllaBackup('2020-01-07_0900')
    assert.equal(esito.ok, true, esito.messaggio)
    assert.equal(esito.pazienti, 1)
  })

  controllo('ripristinando una copia vecchia l’archivio si aggiorna da solo', () => {
    eseguiRipristino('2020-01-07_0900')
    initDb(dbApp, dekHex)
    assert.equal(
      getDb().pragma('user_version', { simple: true }),
      MIGRATIONS.length,
      'l’archivio doveva arrivare alla versione di adesso'
    )
    // e il paziente scritto con lo schema vecchio e' ancora li'
    assert.deepEqual(pazienti(), ['Anziani'])
  })

  controllo('l’archivio aggiornato regge una riapertura senza cambiare piu’ niente', () => {
    closeDb()
    initDb(dbApp, dekHex)
    assert.equal(getDb().pragma('user_version', { simple: true }), MIGRATIONS.length)
    assert.deepEqual(pazienti(), ['Anziani'])
  })
}

let uscita = 0
try {
  console.log('Prova del ripristino delle copie di sicurezza')
  prove()
  console.log(`\n${fatti} controlli, tutti verdi.`)
} catch (e) {
  console.error('\nControllo fallito:')
  console.error(e)
  uscita = 1
} finally {
  try {
    closeDb()
  } catch {
    // gia' chiuso
  }
  rmSync(base, { recursive: true, force: true })
}
app.exit(uscita)
