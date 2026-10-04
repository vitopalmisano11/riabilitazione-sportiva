// Impostazioni dell'app. Il file impostazioni.json resta sempre in userData
// (posizione fissa); indica dove si trova la cartella dati (db + auth),
// di default Documenti/Riabilitazione per rendere banale il backup manuale.
import { app } from 'electron'
import {
  COLORI_DOCUMENTO,
  type ColoriDocumento,
  impostaTemaCorrente,
  temaValido,
  type Tema
} from '../shared/temi'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { spostaFileDati } from './file-dati'
import { leggiJsonPerScrivere, scriviAtomico } from './scrittura'
import { registraErrore } from './registro'
import { nellaFascia } from '../shared/orari'

interface Impostazioni {
  cartellaDati?: string
  cartellaExport?: string
  cartellaBackup?: string
  tema?: string
  scuro?: boolean
  // modalita' scura a orari fissi: se vero, "scuro" non conta
  scuroAutomatico?: boolean
  scuroDalle?: string
  scuroAlle?: string
  finestra?: PosizioneFinestra
  bloccoAttivo?: boolean
  bloccoMinuti?: number
  backupAttivo?: boolean
  backupDaTenere?: number
  barraScura?: boolean
  ingrandimento?: number
  cartellaCopia?: string
  cartellaTabelle?: string
  copiaFallita?: CopiaFallita | null
  // Quando e' stata fatta l'ultima copia fuori dal computer (chiavetta, disco
  // esterno): le copie automatiche stanno sullo stesso disco dell'archivio.
  ultimaCopiaFuori?: string
}

// Una copia automatica non riuscita. Quella di chiusura fallisce quando non c'e'
// piu' nessuno davanti allo schermo: si scrive qui e si dice al prossimo accesso.
export interface CopiaFallita {
  quando: string
  messaggio: string
}

const percorsoFile = (): string => join(app.getPath('userData'), 'impostazioni.json')

function leggi(): Impostazioni {
  try {
    return JSON.parse(readFileSync(percorsoFile(), 'utf-8')) as Impostazioni
  } catch {
    return {}
  }
}

function salva(patch: Impostazioni): void {
  // Per riscrivere si legge il file com'e' davvero: se non si legge, ci si
  // ferma con un errore invece di scriverlo con dentro solo questa modifica.
  const attuali = leggiJsonPerScrivere<Impostazioni>(percorsoFile())
  scriviAtomico(percorsoFile(), JSON.stringify({ ...attuali, ...patch }, null, 2))
}

// In sviluppo il default è una cartella a parte, per non lavorare sui dati veri.
const nomeCartellaDati = (): string =>
  app.isPackaged ? 'Riabilitazione' : 'Riabilitazione (dev)'

// All'avvio il tema salvato diventa quello corrente: da qui lo leggono i
// generatori dei documenti, che non possono aprire questo file da soli.
impostaTemaCorrente(temaValido(leggi().tema))

// Dove dovrebbero stare i dati, senza creare niente: serve prima
// dell'accesso, per capire se l'archivio c'e'.
export interface DoveDati {
  percorso: string
  // scelta da chi usa il programma (non quella di partenza in Documenti)
  personalizzata: boolean
}

export function doveDati(): DoveDati {
  const scelta = leggi().cartellaDati
  return scelta
    ? { percorso: scelta, personalizzata: true }
    : { percorso: join(app.getPath('documents'), nomeCartellaDati()), personalizzata: false }
}

// La cartella dei dati. Quella di partenza si crea se non c'e'; una scelta da
// chi usa il programma no: se manca (il disco esterno staccato, OneDrive non
// ancora sincronizzato su un computer nuovo) crearla vuota faceva sembrare
// sparito l'archivio, e il programma proponeva di farne uno nuovo.
export function cartellaDati(): string {
  const { percorso, personalizzata } = doveDati()
  if (personalizzata) {
    if (!existsSync(percorso)) {
      throw new Error(
        `Non trovo la cartella dei dati (${percorso}). Se è su un disco esterno o una chiavetta, collegala; se è in OneDrive, aspetta che finisca di sincronizzarsi.`
      )
    }
    return percorso
  }
  mkdirSync(percorso, { recursive: true })
  return percorso
}

// Il file delle impostazioni si legge? Uno che c'e' ma non si legge non e'
// "nessuna impostazione": dentro c'e' dove stanno i dati, e ripartire da
// Documenti vorrebbe dire non trovarli piu'.
export function impostazioniLeggibili(): boolean {
  try {
    leggiJsonPerScrivere(percorsoFile())
    return true
  } catch {
    return false
  }
}

export function percorsoImpostazioni(): string {
  return percorsoFile()
}

// Quando il file delle impostazioni non si legge piu', l'unico modo di andare
// avanti e' ricominciarlo: il vecchio resta accanto con un altro nome, il nuovo
// dice solo dove sono i dati. Colori e preferenze tornano quelli di partenza.
export function ricominciaImpostazioni(dir: string): void {
  const file = percorsoFile()
  if (existsSync(file)) copyFileSync(file, `${file}.illeggibile-${Date.now()}`)
  scriviAtomico(file, JSON.stringify({ cartellaDati: dir }, null, 2))
}

export function impostaCartellaDati(dir: string): void {
  salva({ cartellaDati: dir })
}

// Tema di colore scelto. Lo leggono l'app, per il foglio di stile, e i
// documenti stampati, che si costruiscono qui nel processo principale.
export function tema(): Tema {
  return temaValido(leggi().tema)
}

export function impostaTema(t: Tema): void {
  salva({ tema: temaValido(t) })
  impostaTemaCorrente(t)
}

// Dov'era la finestra l'ultima volta. Se la lasci su un secondo schermo o non
// massimizzata, la ritrovi com'era invece che al centro dello schermo primario.
export interface PosizioneFinestra {
  x?: number
  y?: number
  larghezza: number
  altezza: number
  massimizzata: boolean
}

export function posizioneFinestra(): PosizioneFinestra | null {
  return leggi().finestra ?? null
}

export function impostaPosizioneFinestra(p: PosizioneFinestra): void {
  salva({ finestra: p })
}

// Modalita' scura: si accende sopra alla tavolozza scelta e riguarda solo
// l'interfaccia. I documenti restano chiari, perche' si stampano su carta.
// La barra laterale puo' essere chiara o scura con qualunque colore. Chi non ha
// mai scelto si tiene com'era: il blu con la barra scura, gli altri chiara.
export function barraScura(): boolean {
  const i = leggi()
  return i.barraScura ?? temaValido(i.tema) === 'blu'
}

export function impostaBarraScura(valore: boolean): void {
  salva({ barraScura: valore })
}

// Quanto e' ingrandita la pagina: 1 e' la misura normale. Si tiene fra 0.8 e
// 1.6, cioe' fra "un po' piu' piccolo" e "il doppio abbondante": oltre, la
// finestra diventa inservibile.
export function ingrandimento(): number {
  const v = leggi().ingrandimento
  return typeof v === 'number' && v >= 0.8 && v <= 1.6 ? v : 1
}

export function impostaIngrandimento(valore: number): void {
  salva({ ingrandimento: Math.min(1.6, Math.max(0.8, Math.round(valore * 100) / 100)) })
}

// Dove sono finite l'ultima volta la copia completa e le tabelle leggibili.
// Chi le manda sempre nella stessa cartella (una cartella di OneDrive, per
// esempio) se la ritrova gia' aperta al giro dopo.
export function cartellaCopia(): string | undefined {
  return leggi().cartellaCopia
}

export function impostaCartellaCopia(dir: string): void {
  salva({ cartellaCopia: dir })
}

export function cartellaTabelle(): string | undefined {
  return leggi().cartellaTabelle
}

export function impostaCartellaTabelle(dir: string): void {
  salva({ cartellaTabelle: dir })
}

export function scuro(): boolean {
  return leggi().scuro === true
}

export function impostaScuro(valore: boolean): void {
  salva({ scuro: valore, scuroAutomatico: false })
}

export function orariScuro(): { automatico: boolean; dalle: string; alle: string } {
  const i = leggi()
  return {
    automatico: i.scuroAutomatico === true,
    dalle: i.scuroDalle ?? '20:00',
    alle: i.scuroAlle ?? '07:00'
  }
}

export function impostaScuroAutomatico(dalle: string, alle: string): void {
  salva({ scuroAutomatico: true, scuroDalle: dalle, scuroAlle: alle })
}

// Scura adesso? Con gli orari fissi dipende dall'ora, altrimenti dalla scelta.
export function scuroAdesso(adesso = new Date()): boolean {
  const o = orariScuro()
  return o.automatico ? nellaFascia(o.dalle, o.alle, adesso) : scuro()
}

// Blocco automatico: dopo un po' che non tocchi niente l'app torna alla
// schermata della password. Serve quando il computer resta acceso in ambulatorio
// e il paziente e' li' davanti.
export interface Blocco {
  attivo: boolean
  minuti: number
}

export function blocco(): Blocco {
  const i = leggi()
  const m = i.bloccoMinuti
  return {
    attivo: i.bloccoAttivo === true,
    minuti: typeof m === 'number' && m >= 1 ? Math.min(240, Math.round(m)) : 15
  }
}

export function impostaBlocco(b: Blocco): void {
  salva({
    bloccoAttivo: b.attivo === true,
    bloccoMinuti: Math.max(1, Math.min(240, Math.round(b.minuti)))
  })
}

export function coloriDocumento(): ColoriDocumento {
  return COLORI_DOCUMENTO[tema()]
}

export function cartellaExport(): string {
  return leggi().cartellaExport || app.getPath('documents')
}

export function impostaCartellaExport(dir: string): void {
  salva({ cartellaExport: dir })
}

// Dove sono le copie, senza crearla: per cercarci dentro prima dell'accesso.
export function cartellaBackupSenzaCreare(dati: string): string {
  return leggi().cartellaBackup || join(dati, 'Backup')
}

// Le copie di sicurezza: di default in una sottocartella dell'archivio, ma si
// puo' puntare altrove — dentro OneDrive, per esempio, e finiscono online da
// sole.
export function cartellaBackup(): string {
  const dir = leggi().cartellaBackup || join(cartellaDati(), 'Backup')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function impostaCartellaBackup(dir: string): void {
  salva({ cartellaBackup: dir })
}

export function backupAttivo(): boolean {
  return leggi().backupAttivo !== false
}

export function impostaBackupAttivo(attivo: boolean): void {
  salva({ backupAttivo: attivo })
}

export function ultimaCopiaFuori(): string | null {
  return leggi().ultimaCopiaFuori ?? null
}

export function impostaUltimaCopiaFuori(quando: string): void {
  salva({ ultimaCopiaFuori: quando })
}

export function copiaFallita(): CopiaFallita | null {
  return leggi().copiaFallita ?? null
}

export function impostaCopiaFallita(c: CopiaFallita | null): void {
  salva({ copiaFallita: c })
}

export function backupDaTenere(): number {
  const n = leggi().backupDaTenere
  return typeof n === 'number' && n > 0 ? n : 10
}

export function impostaBackupDaTenere(n: number): void {
  salva({ backupDaTenere: Math.max(1, Math.min(100, Math.round(n))) })
}

// Migrazione una tantum: le versioni precedenti salvavano db e auth in userData.
export function migraDaUserData(): void {
  const legacy = join(app.getPath('userData'), 'riabilitazione.db')
  if (!existsSync(legacy)) return
  try {
    // dentro al try: una cartella dei dati che non si trova non deve impedire
    // al programma di aprirsi (la schermata d'accesso spiega cosa fare)
    const dest = cartellaDati()
    if (existsSync(join(dest, 'riabilitazione.db'))) return
    spostaFileDati(app.getPath('userData'), dest)
  } catch (e) {
    // Succede all'avvio, prima di qualunque finestra: un errore qui non
    // dev'essere quello che impedisce al programma di aprirsi. Se la
    // destinazione non e' libera i vecchi file restano dove sono, intatti.
    registraErrore('migraDaUserData', e)
  }
}
