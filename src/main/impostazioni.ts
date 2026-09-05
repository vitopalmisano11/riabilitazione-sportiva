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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spostaFileDati } from './file-dati'

interface Impostazioni {
  cartellaDati?: string
  cartellaExport?: string
  cartellaBackup?: string
  tema?: string
  scuro?: boolean
  finestra?: PosizioneFinestra
  bloccoAttivo?: boolean
  bloccoMinuti?: number
  backupAttivo?: boolean
  backupDaTenere?: number
  barraScura?: boolean
  ingrandimento?: number
  cartellaCopia?: string
  cartellaTabelle?: string
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
  writeFileSync(percorsoFile(), JSON.stringify({ ...leggi(), ...patch }, null, 2))
}

// In sviluppo il default è una cartella a parte, per non lavorare sui dati veri.
const nomeCartellaDati = (): string =>
  app.isPackaged ? 'Riabilitazione' : 'Riabilitazione (dev)'

// All'avvio il tema salvato diventa quello corrente: da qui lo leggono i
// generatori dei documenti, che non possono aprire questo file da soli.
impostaTemaCorrente(temaValido(leggi().tema))

export function cartellaDati(): string {
  const dir = leggi().cartellaDati || join(app.getPath('documents'), nomeCartellaDati())
  mkdirSync(dir, { recursive: true })
  return dir
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
  salva({ scuro: valore })
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
  const dest = cartellaDati()
  if (existsSync(legacy) && !existsSync(join(dest, 'riabilitazione.db'))) {
    spostaFileDati(app.getPath('userData'), dest)
  }
}
