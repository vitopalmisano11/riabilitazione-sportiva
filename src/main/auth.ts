// Gestione autenticazione e chiavi di cifratura.
// Modello: una DEK casuale (32 byte) cifra il database via SQLCipher; la DEK è
// salvata in auth.json "avvolta" (AES-256-GCM) due volte: con una chiave
// derivata dalla password (scrypt) e con una derivata dalla recovery key.
// Cambiare password = ri-avvolgere la DEK, senza ricifrare il database.
// Facoltativa, una terza chiave: la risposta a una domanda scelta da chi usa
// l'app. E' piu' comoda della chiave di recupero ma piu' debole (una risposta si
// indovina piu' facilmente di 32 caratteri a caso), percio' si aggiunge alla
// chiave, non la sostituisce.
// Nessuna dipendenza da Electron: testabile con Node (vedi test/auth.test.ts).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { scriviAtomico } from './scrittura'

// Quanto costa a chi prova password su una copia rubata: ogni tentativo vuole
// 64 MB di memoria e quasi un secondo. E' una delle combinazioni raccomandate
// (OWASP: N=2^16, r=8, p=2 vale quanto N=2^17, r=8, p=1) e resta dentro ai
// 128 MB che le versioni fino alla 0.5.5 concedono a scrypt: con N=2^17 quelle
// non riaprirebbero piu' il file delle chiavi, e tornare indietro di una
// versione, o aprire una copia nuova con un programma vecchio, direbbe
// "password errata".
//
// Fino alla 0.5.5 era N=2^15, p=1: un quarto del costo. Le chiavi fatte allora
// si portano ai parametri nuovi appena si conosce il segreto che le apre (la
// password all'accesso, la chiave o la risposta quando si usano).
const SCRYPT_PARAMS = { N: 65536, r: 8, p: 2 }
const SCRYPT_MAXMEM = 128 * 1024 * 1024

type Kdf = { algo: 'scrypt'; N: number; r: number; p: number }

interface Wrapped {
  salt: string
  iv: string
  tag: string
  data: string
  // I parametri con cui e' stata avvolta, se diversi da quelli del file: le
  // chiavi che non si possono riavvolgere subito (quella di recupero, la
  // risposta alla domanda) tengono i loro finche' non si usano.
  kdf?: Kdf
}

interface AuthFile {
  version: 1
  // I parametri della password, e di ogni chiave che non ne ha di suoi. Le
  // versioni fino alla 0.5.5 leggono solo questi: per loro la password si apre.
  kdf: Kdf
  pw: Wrapped
  rk: Wrapped
  dq?: { domanda: string; chiave: Wrapped }
}

const kdfDi = (w: Wrapped, file: AuthFile): Kdf => w.kdf ?? file.kdf
const costo = (k: Kdf): number => k.N * k.r * k.p
const KDF_NUOVO: Kdf = { algo: 'scrypt', ...SCRYPT_PARAMS }

// Il file passa ai parametri nuovi: le chiavi che non si riavvolgono adesso si
// tengono i loro, scritti accanto. Chi chiama poi riavvolge quelle di cui
// conosce il segreto, con i parametri del file.
function portaAiParametriNuovi(file: AuthFile): void {
  if (costo(file.kdf) >= costo(KDF_NUOVO)) return
  for (const w of [file.pw, file.rk, file.dq?.chiave]) {
    if (w && !w.kdf) w.kdf = file.kdf
  }
  file.kdf = KDF_NUOVO
}

function derive(secret: string, salt: Buffer, kdf: Kdf): Buffer {
  return scryptSync(secret, salt, 32, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    maxmem: SCRYPT_MAXMEM
  })
}

function wrap(dek: Buffer, secret: string, kdf: Kdf): Wrapped {
  const salt = randomBytes(16)
  const kek = derive(secret, salt, kdf)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', kek, iv)
  const data = Buffer.concat([cipher.update(dek), cipher.final()])
  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: data.toString('hex')
  }
}

// Lancia se il segreto è sbagliato (verifica del tag GCM).
function unwrap(w: Wrapped, secret: string, kdf: Kdf): Buffer {
  const kek = derive(secret, Buffer.from(w.salt, 'hex'), kdf)
  const decipher = createDecipheriv('aes-256-gcm', kek, Buffer.from(w.iv, 'hex'))
  decipher.setAuthTag(Buffer.from(w.tag, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(w.data, 'hex')), decipher.final()])
}

function leggi(authPath: string): AuthFile {
  try {
    return JSON.parse(readFileSync(authPath, 'utf-8')) as AuthFile
  } catch {
    throw new Error('File di autenticazione mancante o danneggiato.')
  }
}

function formatRecovery(hex: string): string {
  return hex.toUpperCase().match(/.{4}/g)!.join('-')
}

function normalizeRecovery(s: string): string {
  const pulita = s.replace(/[^0-9a-fA-F]/g, '').toLowerCase()
  if (pulita.length !== 32) throw new Error('Chiave di recupero non valida.')
  return pulita
}

// La risposta si confronta senza badare a maiuscole, spazi e accenti scritti
// in modo diverso: "Via Roma" e "via  roma " sono la stessa risposta.
function normalizzaRisposta(s: string): string {
  return s.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function authExists(authPath: string): boolean {
  return existsSync(authPath)
}

export function setupAuth(
  authPath: string,
  password: string
): { dekHex: string; recoveryKey: string } {
  const kdf = KDF_NUOVO
  const dek = randomBytes(32)
  const rkSegreto = randomBytes(16).toString('hex')
  const file: AuthFile = {
    version: 1,
    kdf,
    pw: wrap(dek, password, kdf),
    rk: wrap(dek, rkSegreto, kdf)
  }
  scriviAtomico(authPath, JSON.stringify(file, null, 2))
  return { dekHex: dek.toString('hex'), recoveryKey: formatRecovery(rkSegreto) }
}

export function loginAuth(authPath: string, password: string): string {
  const file = leggi(authPath)
  let dek: Buffer
  try {
    dek = unwrap(file.pw, password, kdfDi(file.pw, file))
  } catch {
    throw new Error('Password errata.')
  }
  // Una password avvolta con i parametri di prima: adesso che la si conosce,
  // si riavvolge con quelli nuovi. Se il file non si scrive (una chiavetta
  // protetta, per dire) si entra lo stesso: ci si riprova la volta dopo.
  if (costo(kdfDi(file.pw, file)) < costo(KDF_NUOVO)) {
    try {
      portaAiParametriNuovi(file)
      file.pw = wrap(dek, password, file.kdf)
      scriviAtomico(authPath, JSON.stringify(file, null, 2))
    } catch {
      // resta com'era
    }
  }
  return dek.toString('hex')
}

// Sblocca con la recovery key e imposta una nuova password.
export function recoverAuth(
  authPath: string,
  recoveryKey: string,
  nuovaPassword: string
): string {
  const file = leggi(authPath)
  const segreto = normalizeRecovery(recoveryKey)
  let dek: Buffer
  try {
    dek = unwrap(file.rk, segreto, kdfDi(file.rk, file))
  } catch {
    throw new Error('Chiave di recupero non valida.')
  }
  portaAiParametriNuovi(file)
  file.pw = wrap(dek, nuovaPassword, file.kdf)
  // la chiave e' quella di sempre: si riavvolge solo con i parametri nuovi
  if (file.rk.kdf) file.rk = wrap(dek, segreto, file.kdf)
  scriviAtomico(authPath, JSON.stringify(file, null, 2))
  return dek.toString('hex')
}

export function cambiaPasswordAuth(
  authPath: string,
  vecchiaPassword: string,
  nuovaPassword: string
): void {
  const file = leggi(authPath)
  let dek: Buffer
  try {
    dek = unwrap(file.pw, vecchiaPassword, kdfDi(file.pw, file))
  } catch {
    throw new Error('Password attuale errata.')
  }
  portaAiParametriNuovi(file)
  file.pw = wrap(dek, nuovaPassword, file.kdf)
  scriviAtomico(authPath, JSON.stringify(file, null, 2))
}

export function domandaAuth(authPath: string): string | null {
  if (!existsSync(authPath)) return null
  return leggi(authPath).dq?.domanda ?? null
}

export function impostaDomandaAuth(
  authPath: string,
  password: string,
  domanda: string,
  risposta: string
): void {
  const file = leggi(authPath)
  let dek: Buffer
  try {
    dek = unwrap(file.pw, password, kdfDi(file.pw, file))
  } catch {
    throw new Error('Password errata.')
  }
  const d = domanda.trim()
  const r = normalizzaRisposta(risposta)
  if (d === '') throw new Error('Scrivi la domanda.')
  // Chi ottiene il database e auth.json (per esempio da una copia in OneDrive)
  // puo' provare risposte all'infinito, senza che nessuno se ne accorga: una
  // parola sola si trova in poche ore, una frase che solo chi la scrive conosce no.
  if (r.length < 8) {
    throw new Error(
      'La risposta deve avere almeno 8 caratteri: una parola sola si indovina troppo in fretta. Meglio una frase che sai solo tu.'
    )
  }
  portaAiParametriNuovi(file)
  file.dq = { domanda: d, chiave: wrap(dek, r, file.kdf) }
  scriviAtomico(authPath, JSON.stringify(file, null, 2))
}

export function togliDomandaAuth(authPath: string, password: string): void {
  const file = leggi(authPath)
  try {
    unwrap(file.pw, password, kdfDi(file.pw, file))
  } catch {
    throw new Error('Password errata.')
  }
  delete file.dq
  scriviAtomico(authPath, JSON.stringify(file, null, 2))
}

// Sblocca con la risposta alla domanda e imposta una nuova password.
export function recoverDomandaAuth(
  authPath: string,
  risposta: string,
  nuovaPassword: string
): string {
  const file = leggi(authPath)
  if (!file.dq) throw new Error('Non è stata impostata nessuna domanda di recupero.')
  const r = normalizzaRisposta(risposta)
  let dek: Buffer
  try {
    dek = unwrap(file.dq.chiave, r, kdfDi(file.dq.chiave, file))
  } catch {
    throw new Error('Risposta sbagliata.')
  }
  portaAiParametriNuovi(file)
  file.pw = wrap(dek, nuovaPassword, file.kdf)
  if (file.dq.chiave.kdf) file.dq.chiave = wrap(dek, r, file.kdf)
  scriviAtomico(authPath, JSON.stringify(file, null, 2))
  return dek.toString('hex')
}
