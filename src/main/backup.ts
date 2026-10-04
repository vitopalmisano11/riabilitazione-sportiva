// Copie di sicurezza dell'archivio.
//
// Una copia utile deve contenere DUE file: il database cifrato e auth.json con
// le chiavi. Senza auth.json il database non si riapre, quindi copiarne uno solo
// non serve a niente.
//
// Prima di copiare si forza un checkpoint del giornale WAL: senza, il file .db
// potrebbe non contenere le ultime scritture e la copia risulterebbe incompleta.
//
// Perche' non l'API di backup di SQLite (db.backup()): con un archivio cifrato
// la libreria la rifiuta ("incompatible source and target databases"), e le
// alternative che ricifrano pagina per pagina (VACUUM INTO) costano decine di
// volte di piu' della copia del file. Le copie fatte mentre si lavora (quella
// dell'accesso, "Fai una copia", la chiavetta) copiano invece il file senza
// bloccare il programma, tenendolo fermo finche' non hanno finito: vedi
// copiaInSenzaBloccare.
import { app } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync
} from 'fs'
import { copyFile, open } from 'fs/promises'
import { join, sep } from 'path'
import { apriAltroDb, closeDb, dbAperto, getDb, riapriDb } from './db'
import { VERSIONE_SCHEMA } from './migrations'
import {
  cartellaBackup,
  backupAttivo,
  backupDaTenere,
  cartellaDati,
  impostaCartellaBackup,
  impostaCopiaFallita
} from './impostazioni'
import { registraErrore } from './registro'

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
const NOME_BACKUP = /^(?:[a-z0-9-]+_)?\d{4}-\d{2}-\d{2}_\d{4}$/

// Le copie fatte prima di aggiornare l'archivio: si tengono le ultime poche, a
// parte, senza toglier posto alle copie di tutti i giorni.
const PREFISSO_MIGRAZIONE = 'prima-della-migrazione-'
const MIGRAZIONI_DA_TENERE = 3

// La copia fatta prima di un ripristino e' l'unico modo di tornare indietro se si
// ripristina la copia sbagliata: se ne tengono di piu', ma non per sempre, perche'
// ognuna e' un archivio intero.
const PREFISSO_RIPRISTINO = 'prima-del-ripristino_'
const RIPRISTINI_DA_TENERE = 5

export function elencoBackup(dir = cartellaBackup()): VoceBackup[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((v) => v.isDirectory() && NOME_BACKUP.test(v.name))
    .map((v) => {
      const percorso = join(dir, v.name, DB)
      const dimensione = existsSync(percorso) ? statSync(percorso).size : 0
      return { nome: v.name, quando: statSync(join(dir, v.name)).mtime.toISOString(), dimensione }
    })
    // Dalla piu' recente. Il nome finisce sempre con la data e l'ora: e' quella a
    // decidere, non il prefisso ("prima-della-migrazione-v9" verrebbe dopo "v10").
    .sort((a, b) => b.nome.slice(-15).localeCompare(a.nome.slice(-15)) || b.nome.localeCompare(a.nome))
}

// Toglie le copie piu' vecchie oltre il numero da tenere. Le copie di tutti i
// giorni si contano da sole: quelle "prima di..." hanno un nome che le mette in
// testa all'elenco e, contate insieme, toglierebbero posto a quelle vere.
// Quelle prima di un ripristino e quelle prima di una migrazione si tengono
// nelle ultime poche, ognuna per conto suo.
function ruota(dir = cartellaBackup()): void {
  // Resti di una copia interrotta a meta' (vedi copiaIn): sono nostri, perche'
  // il nome senza il suffisso e' quello di una copia.
  for (const nome of readdirSync(dir)) {
    const m = nome.match(SUFFISSO_PROVVISORIO)
    if (m && NOME_BACKUP.test(nome.slice(0, m.index))) {
      rmSync(join(dir, nome), { recursive: true, force: true })
    }
  }
  const tutte = elencoBackup(dir)
  const normali = tutte.filter((v) => !v.nome.startsWith('prima-'))
  for (const v of normali.slice(backupDaTenere())) {
    rmSync(join(dir, v.nome), { recursive: true, force: true })
  }
  const migrazioni = tutte.filter((v) => v.nome.startsWith(PREFISSO_MIGRAZIONE))
  for (const v of migrazioni.slice(MIGRAZIONI_DA_TENERE)) {
    rmSync(join(dir, v.nome), { recursive: true, force: true })
  }
  const ripristini = tutte.filter((v) => v.nome.startsWith(PREFISSO_RIPRISTINO))
  for (const v of ripristini.slice(RIPRISTINI_DA_TENERE)) {
    rmSync(join(dir, v.nome), { recursive: true, force: true })
  }
}

const SUFFISSO_PROVVISORIO = /\.(in-corso|da-togliere)$/

// ---- Una copia alla volta ----
// Le copie che non bloccano il programma stanno in fila: due copie insieme si
// pesterebbero i piedi (una fa il checkpoint mentre l'altra legge il file). Chi
// deve chiudere o sostituire l'archivio (ripristino, spostamento della
// cartella, chiusura del programma) aspetta prima che la fila sia vuota.
let ultimaInFila: Promise<unknown> | null = null

export function copiaInCorso(): boolean {
  return ultimaInFila != null
}

export function attendiCopie(): Promise<void> {
  return (ultimaInFila ?? Promise.resolve()).then(
    () => undefined,
    () => undefined
  )
}

function inFila<T>(lavoro: () => Promise<T>): Promise<T> {
  // Con la fila vuota si parte subito, non al giro dopo: il checkpoint, cioe'
  // il momento che la copia fotografa, avviene adesso, prima di qualunque
  // scrittura che venga dopo (all'accesso, la pulizia del cestino).
  const questo = ultimaInFila ? attendiCopie().then(lavoro) : lavoro()
  ultimaInFila = questo
  questo
    .finally(() => {
      if (ultimaInFila === questo) ultimaInFila = null
    })
    .catch(() => undefined)
  return questo
}

// Le ultime scritture devono essere nel file, non nel giornale. Se il
// checkpoint non riesce ad andare fino in fondo, il file non ha ancora tutto:
// una copia fatta adesso sembrerebbe buona e non lo sarebbe.
function checkpoint(): void {
  if (!dbAperto()) return
  const [esito] = getDb().pragma('wal_checkpoint(TRUNCATE)') as { busy: number }[]
  if (esito && esito.busy) {
    throw new Error('L’archivio è occupato e la copia non sarebbe completa. Riprova tra poco.')
  }
}

function fileDaCopiare(): { db: string; auth: string | null } {
  const origine = cartellaDati()
  const db = join(origine, DB)
  if (!existsSync(db)) throw new Error('Non c’è ancora un archivio da copiare.')
  const auth = join(origine, AUTH)
  return { db, auth: existsSync(auth) ? auth : null }
}

// L'ultimo passo, uguale per tutte le copie: la cartella provvisoria completa
// prende il nome vero. Se `dest` c'e' gia' (due copie nello stesso minuto) la
// vecchia si mette da parte e si toglie solo dopo che la nuova ha preso il suo
// posto.
function daiIlNome(provvisoria: string, dest: string): void {
  const daTogliere = `${dest}.da-togliere`
  rmSync(daTogliere, { recursive: true, force: true })
  const cera = existsSync(dest)
  if (cera) renameSync(dest, daTogliere)
  try {
    renameSync(provvisoria, dest)
  } catch (e) {
    if (cera) renameSync(daTogliere, dest)
    throw e
  }
  if (cera) rmSync(daTogliere, { recursive: true, force: true })
}

// Apre la copia appena fatta e controlla cosa contiene. Aprirla lascia accanto
// i file di servizio di SQLite: nella copia non servono.
function controllaCopia(provvisoria: string, completo: boolean): void {
  const esito = ispeziona(join(provvisoria, DB), completo)
  for (const extra of [`${DB}-wal`, `${DB}-shm`]) {
    rmSync(join(provvisoria, extra), { force: true })
  }
  if (!esito.ok) throw new Error(esito.messaggio)
}

// Copia l'archivio nella cartella `dest` senza lasciare mai una copia a meta'.
//
// I file arrivano prima in una cartella provvisoria accanto, e prendono il nome
// vero solo quando sono completi: un disco che si riempie, una chiavetta
// staccata o il computer che si spegne lasciano al massimo un provvisorio da
// buttare, mai una copia che sembra buona e non lo e'. Con `verifica` la copia
// si apre anche davvero (chiavi, integrita' delle pagine) prima di prendere il
// nome: serve quando la copia nuova ne sostituisce una buona.
//
// Questa blocca il programma finche' non ha finito: serve dove non si puo'
// aspettare (prima di aggiornare l'archivio, alla chiusura, prima di un
// ripristino). Copiare il file e' veloce; e' il controllo completo a pesare.
function copiaIn(dest: string, verifica: boolean): void {
  if (copiaInCorso()) {
    throw new Error('C’è già una copia in corso: aspetta che finisca e riprova.')
  }
  const { db, auth } = fileDaCopiare()
  checkpoint()
  const provvisoria = `${dest}.in-corso`
  rmSync(provvisoria, { recursive: true, force: true })
  try {
    mkdirSync(provvisoria, { recursive: true })
    copyFileSync(db, join(provvisoria, DB))
    if (auth) copyFileSync(auth, join(provvisoria, AUTH))
    if (verifica) controllaCopia(provvisoria, true)
    daiIlNome(provvisoria, dest)
  } catch (e) {
    rmSync(provvisoria, { recursive: true, force: true })
    throw e
  }
}

// La stessa copia, ma il programma intanto resta usabile: i file si copiano
// "in sottofondo", e il controllo confronta la copia con l'archivio byte per
// byte (anche questo in sottofondo) invece di ricontrollarne tutte le pagine.
//
// Per tutto il tempo il file dell'archivio deve restare fermo: dopo il
// checkpoint, le scritture di chi continua a lavorare restano nel giornale
// (WAL), e il checkpoint automatico che le riporterebbe nel file aspetta la
// fine della copia. La copia e' quindi l'archivio com'era quando e' partita.
async function copiaInSenzaBloccare(dest: string, verifica: boolean): Promise<void> {
  const { db, auth } = fileDaCopiare()
  checkpoint()
  const conn = dbAperto() ? getDb() : null
  const automatico = conn ? (conn.pragma('wal_autocheckpoint', { simple: true }) as number) : 0
  conn?.pragma('wal_autocheckpoint = 0')
  const provvisoria = `${dest}.in-corso`
  try {
    rmSync(provvisoria, { recursive: true, force: true })
    mkdirSync(provvisoria, { recursive: true })
    await copyFile(db, join(provvisoria, DB))
    if (auth) await copyFile(auth, join(provvisoria, AUTH))
    if (verifica && !(await stessiByte(db, join(provvisoria, DB)))) {
      throw new Error('La copia non è uguale all’archivio: il supporto potrebbe essere pieno o difettoso.')
    }
  } catch (e) {
    rmSync(provvisoria, { recursive: true, force: true })
    throw e
  } finally {
    // la connessione potrebbe essere cambiata nel frattempo (non dovrebbe: chi
    // la chiude aspetta la fila), e quella nuova ha gia' il suo valore
    if (conn && dbAperto() && getDb() === conn) conn.pragma(`wal_autocheckpoint = ${automatico}`)
  }
  try {
    // si apre davvero, con le chiavi di adesso; le pagine sono quelle
    // dell'archivio, appena confrontate
    if (verifica) controllaCopia(provvisoria, false)
    daiIlNome(provvisoria, dest)
  } catch (e) {
    rmSync(provvisoria, { recursive: true, force: true })
    throw e
  }
}

// Due file uguali, letti a pezzi senza fermare il programma.
async function stessiByte(a: string, b: string): Promise<boolean> {
  const [fa, fb] = await Promise.all([open(a, 'r'), open(b, 'r')])
  try {
    const [sa, sb] = await Promise.all([fa.stat(), fb.stat()])
    if (sa.size !== sb.size) return false
    const pezzo = 1 << 20
    const ba = Buffer.alloc(pezzo)
    const bb = Buffer.alloc(pezzo)
    for (let pos = 0; pos < sa.size; ) {
      const [ra, rb] = await Promise.all([fa.read(ba, 0, pezzo, pos), fb.read(bb, 0, pezzo, pos)])
      if (ra.bytesRead === 0 || ra.bytesRead !== rb.bytesRead) return false
      if (!ba.subarray(0, ra.bytesRead).equals(bb.subarray(0, rb.bytesRead))) return false
      pos += ra.bytesRead
    }
    return true
  } finally {
    await Promise.all([fa.close(), fb.close()])
  }
}

export function eseguiBackup(prefisso = '', cartellaDestinazione = cartellaBackup()): string {
  const dest = join(cartellaDestinazione, nomeCartella(prefisso))
  copiaIn(dest, false)
  ruota(cartellaDestinazione)
  return dest
}

// "Fai una copia": il programma resta usabile mentre la copia si fa.
export function eseguiBackupSenzaBloccare(): Promise<string> {
  return inFila(async () => {
    const dir = cartellaBackup()
    const dest = join(dir, nomeCartella())
    await copiaInSenzaBloccare(dest, false)
    ruota(dir)
    return dest
  })
}

// Una copia automatica non riuscita: nel registro, e da dire al prossimo
// accesso. Non deve mai diventare essa stessa un errore.
function segnaCopiaFallita(momento: string, errore: unknown): void {
  registraErrore(`backup (${momento})`, errore)
  try {
    impostaCopiaFallita({
      quando: new Date().toISOString(),
      messaggio: `${momento}: ${errore instanceof Error ? errore.message : String(errore)}`
    })
  } catch {
    // il file delle impostazioni non si scrive: resta la riga nel registro
  }
}

// La copia da fare prima di applicare le migrazioni di un aggiornamento.
//
// Le migrazioni cambiano lo schema dell'archivio e non si annullano. La copia
// del giorno si fa dopo l'accesso, cioe' dopo la migrazione, e quella di chiusura
// sostituisce la copia di oggi: senza questa, l'unica copia con l'archivio
// com'era prima potrebbe essere di giorni fa. Va fatta anche con le copie
// automatiche spente: non e' una copia di routine, e' la rete di sicurezza
// dell'aggiornamento.
//
// Se la cartella scelta per le copie non si raggiunge (una chiavetta staccata,
// OneDrive non ancora pronto) si ripiega su quella di default dentro all'archivio,
// perche' non si puo' cambiare cartella prima di essere entrati. Se non riesce
// nemmeno quella, l'aggiornamento non parte: l'archivio resta com'era.
export function copiaPrimaDellaMigrazione(versione: number): void {
  const prefisso = `${PREFISSO_MIGRAZIONE}v${versione}_`
  try {
    eseguiBackup(prefisso)
  } catch {
    try {
      eseguiBackup(prefisso, join(cartellaDati(), 'Backup'))
    } catch (e) {
      throw new Error(
        `Il programma deve aggiornare l'archivio e prima ne fa una copia di sicurezza, ma non ci riesce: ${
          e instanceof Error ? e.message : String(e)
        }. L'archivio non è stato toccato.`
      )
    }
  }
}

// Copia dell'archivio in una cartella scelta dall'utente: una chiavetta, un
// disco esterno, una cartella sincronizzata.
//
// Le copie automatiche stanno sullo stesso disco dell'archivio: se il disco si
// rompe o il computer sparisce, se ne vanno insieme all'originale. Questa e'
// l'unica copia che puo' trovarsi altrove. Non entra nella rotazione e non
// cancella niente: quello che c'e' nella cartella scelta resta dov'e'.
//
// Su una chiavetta lenta la copia puo' durare parecchio: si fa senza bloccare
// il programma.
export function copiaFuori(destinazione: string): Promise<string> {
  return inFila(async () => {
    // Su una chiavetta che si stacca a meta' e' il caso piu' probabile di copia
    // interrotta: si controlla che sia uguale all'archivio e che si apra prima
    // di darle il nome.
    const dest = join(destinazione, `riabilitazione_${nomeCartella()}`)
    await copiaInSenzaBloccare(dest, true)
    return dest
  })
}

// Backup automatico: uno al giorno basta, il resto sarebbero copie identiche.
// Parte all'accesso e non lo fa aspettare: la copia e' l'archivio com'era
// quando e' partita, anche se intanto si comincia a lavorare.
export function backupSeServe(): Promise<void> {
  if (!backupAttivo()) return Promise.resolve()
  return inFila(async () => {
    const dir = cartellaBackup()
    const oggi = nomeCartella().slice(0, 10)
    if (elencoBackup(dir).some((v) => v.nome.startsWith(oggi))) return
    await copiaInSenzaBloccare(join(dir, nomeCartella()), false)
    ruota(dir)
  }).catch((e) => {
    // una copia non riuscita non deve impedire di usare l'app, ma va detta
    segnaCopiaFallita("all'accesso", e)
  })
}

// Backup di chiusura: prende il posto di quello del giorno, cosi' contiene
// anche il lavoro appena fatto.
//
// Prima si cancellava la copia di oggi e poi si faceva la nuova: se la nuova
// non riusciva (disco pieno, cartella non raggiungibile) non restava nessuna
// copia del giorno, e nessuno lo sapeva. Adesso la nuova si fa per prima, si
// controlla che si apra, e solo allora le altre di oggi se ne vanno. Se
// l'archivio stesso e' rovinato la nuova non passa il controllo e resta la
// copia buona di stamattina.
//
// Senza accesso l'archivio non e' cambiato: la copia di stamattina va bene com'e'.
export function backupDiChiusura(): void {
  if (!backupAttivo() || !dbAperto()) return
  try {
    const dir = cartellaBackup()
    const nome = nomeCartella()
    const oggi = nome.slice(0, 10)
    copiaIn(join(dir, nome), true)
    for (const v of elencoBackup(dir).filter((x) => x.nome.startsWith(oggi) && x.nome !== nome)) {
      rmSync(join(dir, v.nome), { recursive: true, force: true })
    }
    ruota(dir)
    // una copia controllata e' riuscita: un avviso rimasto da prima non vale piu'
    try {
      impostaCopiaFallita(null)
    } catch {
      // resta l'avviso: meglio uno di troppo che nessuno
    }
  } catch (e) {
    segnaCopiaFallita('alla chiusura', e)
  }
}

// La cartella di OneDrive, se su questo computer c'e'. Windows la annuncia in
// una variabile d'ambiente: non si va a indovinare percorsi.
export function cartellaOneDrive(): string | null {
  const p = process.env['OneDrive'] || process.env['OneDriveConsumer'] || ''
  return p !== '' && existsSync(p) ? p : null
}

// Le copie stanno gia' andando online? Vero se la cartella delle copie e'
// dentro a quella di OneDrive.
export function copieInOneDrive(): boolean {
  const one = cartellaOneDrive()
  if (!one) return false
  const dentro = cartellaBackup().toLowerCase()
  return dentro === one.toLowerCase() || dentro.startsWith(one.toLowerCase() + sep)
}

// Sposta le copie in una cartella di OneDrive, creandola se non c'e'.
export function usaOneDrive(): string {
  const one = cartellaOneDrive()
  if (!one) throw new Error('Su questo computer non risulta configurato OneDrive.')
  const dir = join(one, 'Riabilitazione - copie di sicurezza')
  mkdirSync(dir, { recursive: true })
  impostaCartellaBackup(dir)
  return dir
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

// Guarda dentro a un file di database, in disparte e in sola lettura, senza
// toccare l'archivio in uso. Serve due volte: per controllare una copia prima
// di averne bisogno, e per controllare il file appena copiato durante un
// ripristino, prima di lasciargli prendere il posto dell'archivio.
//
// Con `completo` a falso non si ricontrollano tutte le pagine: serve dopo una
// copia gia' confrontata byte per byte con l'archivio, dove resta da sapere
// solo che si apre con le chiavi di adesso.
function ispeziona(percorsoDb: string, completo = true): EsitoControllo {
  let conn: ReturnType<typeof apriAltroDb> | null = null
  try {
    conn = apriAltroDb(percorsoDb)
    // Una copia fatta da una versione piu' recente non si aprirebbe piu' dopo
    // il ripristino: meglio dirlo prima, quando l'archivio in uso e' ancora al
    // suo posto.
    const versione = conn.pragma('user_version', { simple: true }) as number
    if (versione > VERSIONE_SCHEMA) {
      return {
        ok: false,
        messaggio:
          'Questa copia è stata fatta da una versione più recente del programma: aggiorna il programma per poterla usare.'
      }
    }
    const male = completo ? conn.pragma('integrity_check', { simple: true }) : 'ok'
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
  return ispeziona(join(dir, DB))
}

// Ripristino: l'archivio in uso viene sostituito solo alla fine, quando i file
// nuovi sono gia' sul disco e si e' visto che si aprono.
//
// Il modo pericoloso sarebbe scrivere la copia direttamente sopra all'archivio,
// che e' quello che si faceva prima: se la copia si interrompe a meta' (il disco
// esterno che si stacca, lo spazio che finisce) l'archivio buono non c'e' piu' e
// quello nuovo non e' finito. Qui invece i due file arrivano prima accanto ai
// loro, con un nome provvisorio; solo dopo che si sono aperti davvero prendono
// il loro posto con una rinomina, che non copia niente e dura un istante.
//
// Database e chiavi devono restare una coppia: un database senza il suo
// auth.json non si riapre piu'. Per questo si pretendono tutti e due, e le due
// rinomine stanno una dietro l'altra, senza niente in mezzo.
//
// La sostituzione vera e propria sta qui, staccata dal riavvio: cosi' la si puo'
// mettere alla prova da sola (scripts/smoke-ripristino.ts), senza che la prova
// si chiuda il programma sotto i piedi.
export function eseguiRipristino(nome: string): void {
  // Si guarda dentro la copia prima di toccare qualunque cosa: se non si apre,
  // il ripristino non parte nemmeno.
  const esito = controllaBackup(nome)
  if (!esito.ok) {
    throw new Error(`${esito.messaggio} Il ripristino non è stato fatto: il tuo archivio è rimasto com'era.`)
  }

  const sorgente = join(cartellaBackup(), nome)
  // Rete di sicurezza: lo stato di adesso, prima di cambiarlo. Va fatto mentre
  // il database e' ancora aperto, perche' serve il checkpoint del giornale.
  eseguiBackup(PREFISSO_RIPRISTINO)

  const dest = cartellaDati()
  const dbNuovo = join(dest, `${DB}.nuovo`)
  const authNuovo = join(dest, `${AUTH}.nuovo`)
  // Controllare il file provvisorio vuol dire aprirlo, e aprirlo lascia accanto
  // i due file di servizio di SQLite. La rinomina non se li porta dietro, quindi
  // vanno tolti a mano: se restassero, il prossimo ripristino troverebbe il
  // giornale di quello di prima.
  const ripulisci = (): void => {
    for (const f of [dbNuovo, authNuovo, `${dbNuovo}-wal`, `${dbNuovo}-shm`]) {
      rmSync(f, { force: true })
    }
  }

  // Da qui l'archivio non e' piu' aperto: il file deve essere libero, altrimenti
  // su Windows non si puo' sostituire.
  closeDb()
  ripulisci() // resti di un ripristino interrotto male
  try {
    copyFileSync(join(sorgente, DB), dbNuovo)
    copyFileSync(join(sorgente, AUTH), authNuovo)
    // Non basta che la copia di partenza fosse buona: si controlla quella
    // appena arrivata, perche' e' lei che diventera' l'archivio.
    const arrivato = ispeziona(dbNuovo)
    if (!arrivato.ok) throw new Error(arrivato.messaggio)
  } catch (e) {
    // Niente e' stato sostituito: si buttano i file provvisori e si torna a
    // lavorare sull'archivio di prima, che non e' mai stato toccato.
    ripulisci()
    riapriDb(join(dest, DB))
    throw new Error(
      `${e instanceof Error ? e.message : String(e)} Il ripristino non è stato fatto: il tuo archivio è rimasto com'era.`
    )
  }

  // Il giornale della sessione di prima non vale piu' per il file nuovo.
  for (const extra of [`${DB}-wal`, `${DB}-shm`]) {
    rmSync(join(dest, extra), { force: true })
  }
  renameSync(dbNuovo, join(dest, DB))
  renameSync(authNuovo, join(dest, AUTH))
  ripulisci()
}

// Quello che succede all'utente: l'archivio viene sostituito e il programma si
// riapre da solo sui dati appena ripristinati.
export function ripristinaBackup(nome: string): void {
  eseguiRipristino(nome)
  // Il blocco di "una sola copia" va liberato prima: la copia che riparte non
  // deve trovare questa ancora segnata come aperta e richiudersi subito.
  app.releaseSingleInstanceLock()
  app.relaunch()
  app.exit(0)
}
