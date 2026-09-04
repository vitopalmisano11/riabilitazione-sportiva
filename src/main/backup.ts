// Copie di sicurezza dell'archivio.
//
// Una copia utile deve contenere DUE file: il database cifrato e auth.json con
// le chiavi. Senza auth.json il database non si riapre, quindi copiarne uno solo
// non serve a niente.
//
// Prima di copiare si forza un checkpoint del giornale WAL: senza, il file .db
// potrebbe non contenere le ultime scritture e la copia risulterebbe incompleta.
import { app } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync
} from 'fs'
import { join } from 'path'
import { apriAltroDb, getDb } from './db'
import { cartellaBackup, backupAttivo, backupDaTenere, cartellaDati } from './impostazioni'

const DB = 'riabilitazione.db'
const AUTH = 'auth.json'

export interface VoceBackup {
  nome: string
  quando: string
  dimensione: number
}

// Nome della cartella: ordinabile alfabeticamente e leggibile a occhio.
function nomeCartella(prefisso = ''): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${prefisso}${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
    d.getHours()
  )}${p(d.getMinutes())}`
}

// Solo le cartelle create da noi. Senza questo controllo, puntando le copie a
// una cartella che contiene gia' altra roba, la rotazione cancellerebbe i
// documenti dell'utente credendoli vecchi backup.
const NOME_BACKUP = /^(?:[a-z-]+_)?\d{4}-\d{2}-\d{2}_\d{4}$/

export function elencoBackup(): VoceBackup[] {
  const dir = cartellaBackup()
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((v) => v.isDirectory() && NOME_BACKUP.test(v.name))
    .map((v) => {
      const percorso = join(dir, v.name, DB)
      const dimensione = existsSync(percorso) ? statSync(percorso).size : 0
      return { nome: v.name, quando: statSync(join(dir, v.name)).mtime.toISOString(), dimensione }
    })
    .sort((a, b) => b.nome.localeCompare(a.nome))
}

// Toglie le copie piu' vecchie oltre il numero da tenere.
function ruota(): void {
  const tenere = backupDaTenere()
  const dir = cartellaBackup()
  for (const v of elencoBackup().slice(tenere)) {
    rmSync(join(dir, v.nome), { recursive: true, force: true })
  }
}

export function eseguiBackup(prefisso = ''): string {
  const origine = cartellaDati()
  const db = join(origine, DB)
  if (!existsSync(db)) throw new Error('Non c’è ancora un archivio da copiare.')

  // le ultime scritture devono essere nel file, non nel giornale
  try {
    getDb().pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    // database non aperto: il file e' comunque coerente
  }

  const dest = join(cartellaBackup(), nomeCartella(prefisso))
  mkdirSync(dest, { recursive: true })
  copyFileSync(db, join(dest, DB))
  const auth = join(origine, AUTH)
  if (existsSync(auth)) copyFileSync(auth, join(dest, AUTH))
  ruota()
  return dest
}

// Copia dell'archivio in una cartella scelta dall'utente: una chiavetta, un
// disco esterno, una cartella sincronizzata.
//
// Le copie automatiche stanno sullo stesso disco dell'archivio: se il disco si
// rompe o il computer sparisce, se ne vanno insieme all'originale. Questa e'
// l'unica copia che puo' trovarsi altrove. Non entra nella rotazione e non
// cancella niente: quello che c'e' nella cartella scelta resta dov'e'.
export function copiaFuori(destinazione: string): string {
  const origine = cartellaDati()
  const db = join(origine, DB)
  if (!existsSync(db)) throw new Error('Non c’è ancora un archivio da copiare.')

  try {
    getDb().pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    // database non aperto: il file e' comunque coerente
  }

  const dest = join(destinazione, `riabilitazione_${nomeCartella()}`)
  mkdirSync(dest, { recursive: true })
  copyFileSync(db, join(dest, DB))
  const auth = join(origine, AUTH)
  if (existsSync(auth)) copyFileSync(auth, join(dest, AUTH))
  return dest
}

// Backup automatico: uno al giorno basta, il resto sarebbero copie identiche.
export function backupSeServe(): void {
  if (!backupAttivo()) return
  try {
    const oggi = nomeCartella().slice(0, 10)
    if (elencoBackup().some((v) => v.nome.startsWith(oggi))) return
    eseguiBackup()
  } catch {
    // una copia non riuscita non deve impedire di usare l'app
  }
}

// Backup di chiusura: sostituisce quello del giorno, cosi' contiene anche il
// lavoro appena fatto.
export function backupDiChiusura(): void {
  if (!backupAttivo()) return
  try {
    const oggi = nomeCartella().slice(0, 10)
    const dir = cartellaBackup()
    for (const v of elencoBackup().filter((x) => x.nome.startsWith(oggi) && !x.nome.startsWith('prima'))) {
      rmSync(join(dir, v.nome), { recursive: true, force: true })
    }
    eseguiBackup()
  } catch {
    // in chiusura non ha senso disturbare con un errore
  }
}

// Controllo di una copia: si apre davvero, e si guarda cosa contiene.
//
// Avere delle copie non serve a niente se non si sa se si aprono. Qui la copia
// viene aperta in disparte, in sola lettura, con le chiavi di adesso: l'archivio
// in uso non viene toccato. Quello che torna e' quello che uno vorrebbe sapere
// prima di averne bisogno: si apre? quanti pazienti ci sono dentro? di quando e'
// l'ultima seduta?
export interface EsitoControllo {
  ok: boolean
  messaggio: string
  pazienti?: number
  sedute?: number
  ultimaSeduta?: string | null
}

export function controllaBackup(nome: string): EsitoControllo {
  if (!NOME_BACKUP.test(nome)) return { ok: false, messaggio: 'Copia di sicurezza non valida.' }
  const dir = join(cartellaBackup(), nome)
  if (!existsSync(join(dir, DB))) {
    return { ok: false, messaggio: 'In questa copia manca il database.' }
  }
  if (!existsSync(join(dir, AUTH))) {
    return {
      ok: false,
      messaggio: 'In questa copia manca auth.json: senza le chiavi il database non si apre.'
    }
  }
  let conn: ReturnType<typeof apriAltroDb> | null = null
  try {
    conn = apriAltroDb(join(dir, DB))
    const male = conn.pragma('integrity_check', { simple: true })
    if (male !== 'ok') {
      return { ok: false, messaggio: `Il database di questa copia è danneggiato (${male}).` }
    }
    const pazienti = (conn.prepare('SELECT COUNT(*) AS n FROM pazienti').get() as { n: number }).n
    const sedute = (conn.prepare('SELECT COUNT(*) AS n FROM sedute').get() as { n: number }).n
    const ultima = (
      conn.prepare('SELECT MAX(data) AS d FROM sedute').get() as { d: string | null }
    ).d
    return {
      ok: true,
      messaggio: 'La copia si apre e i dati ci sono.',
      pazienti,
      sedute,
      ultimaSeduta: ultima
    }
  } catch (e) {
    return {
      ok: false,
      messaggio:
        e instanceof Error && e.message.includes('not a database')
          ? 'Questa copia non si apre con le chiavi di adesso: il file è danneggiato o viene da un altro archivio.'
          : `Non si riesce ad aprire questa copia: ${e instanceof Error ? e.message : String(e)}`
    }
  } finally {
    conn?.close()
  }
}

// Ripristino: prima si mette al sicuro lo stato attuale, poi si riportano
// indietro i due file. L'app si riavvia perche' il database va riaperto da zero.
export function ripristinaBackup(nome: string): void {
  if (!NOME_BACKUP.test(nome)) throw new Error('Copia di sicurezza non valida.')
  const sorgente = join(cartellaBackup(), nome)
  const db = join(sorgente, DB)
  if (!existsSync(db)) throw new Error('Questa copia non contiene il database.')

  eseguiBackup('prima-del-ripristino_')

  const dest = cartellaDati()
  copyFileSync(db, join(dest, DB))
  const auth = join(sorgente, AUTH)
  if (existsSync(auth)) copyFileSync(auth, join(dest, AUTH))
  // il giornale della sessione precedente non vale piu' per il file ripristinato
  for (const extra of [`${DB}-wal`, `${DB}-shm`]) {
    const f = join(dest, extra)
    if (existsSync(f)) rmSync(f, { force: true })
  }

  app.relaunch()
  app.exit(0)
}
