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

const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1 }
const SCRYPT_MAXMEM = 128 * 1024 * 1024

interface Wrapped {
  salt: string
  iv: string
  tag: string
  data: string
}

interface AuthFile {
  version: 1
  kdf: { algo: 'scrypt'; N: number; r: number; p: number }
  pw: Wrapped
  rk: Wrapped
  dq?: { domanda: string; chiave: Wrapped }
}

function derive(secret: string, salt: Buffer, kdf: AuthFile['kdf']): Buffer {
  return scryptSync(secret, salt, 32, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    maxmem: SCRYPT_MAXMEM
  })
}

function wrap(dek: Buffer, secret: string, kdf: AuthFile['kdf']): Wrapped {
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
function unwrap(w: Wrapped, secret: string, kdf: AuthFile['kdf']): Buffer {
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
  const kdf: AuthFile['kdf'] = { algo: 'scrypt', ...SCRYPT_PARAMS }
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
  try {
    return unwrap(file.pw, password, file.kdf).toString('hex')
  } catch {
    throw new Error('Password errata.')
  }
}

// Sblocca con la recovery key e imposta una nuova password.
export function recoverAuth(
  authPath: string,
  recoveryKey: string,
  nuovaPassword: string
): string {
  const file = leggi(authPath)
  let dek: Buffer
  try {
    dek = unwrap(file.rk, normalizeRecovery(recoveryKey), file.kdf)
  } catch {
    throw new Error('Chiave di recupero non valida.')
  }
  file.pw = wrap(dek, nuovaPassword, file.kdf)
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
    dek = unwrap(file.pw, vecchiaPassword, file.kdf)
  } catch {
    throw new Error('Password attuale errata.')
  }
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
    dek = unwrap(file.pw, password, file.kdf)
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
  file.dq = { domanda: d, chiave: wrap(dek, r, file.kdf) }
  scriviAtomico(authPath, JSON.stringify(file, null, 2))
}

export function togliDomandaAuth(authPath: string, password: string): void {
  const file = leggi(authPath)
  try {
    unwrap(file.pw, password, file.kdf)
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
  let dek: Buffer
  try {
    dek = unwrap(file.dq.chiave, normalizzaRisposta(risposta), file.kdf)
  } catch {
    throw new Error('Risposta sbagliata.')
  }
  file.pw = wrap(dek, nuovaPassword, file.kdf)
  scriviAtomico(authPath, JSON.stringify(file, null, 2))
  return dek.toString('hex')
}
