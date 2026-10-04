// Password nuove e file delle chiavi: le regole per sceglierne una che regga
// chi prova password su una copia rubata, e il passaggio delle chiavi fatte
// con i parametri di prima (fino alla 0.5.5) a quelli nuovi.
import { afterAll, beforeAll, test } from 'vitest'
import assert from 'node:assert/strict'
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { controllaPassword, LUNGHEZZA_MINIMA } from '../src/shared/password'
import {
  cambiaPasswordAuth,
  impostaDomandaAuth,
  loginAuth,
  recoverAuth,
  recoverDomandaAuth,
  setupAuth
} from '../src/main/auth'

let dir = ''
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'riab-password-'))
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

test('Una password nuova: lunga, non solo numeri, non in fila, non comune', () => {
  assert.match(controllaPassword('corta')!, new RegExp(`almeno ${LUNGHEZZA_MINIMA}`))
  assert.match(controllaPassword('123456789012')!, /soli numeri/)
  assert.match(controllaPassword('aaaaaaaaaaaa')!, /ripetuti o in fila/)
  assert.match(controllaPassword('abcdefghijkl')!, /ripetuti o in fila/)
  assert.match(controllaPassword('ababababab')!, /ripetuti o in fila/)
  assert.match(controllaPassword('Juventus2024!')!, /prime password/)
  assert.match(controllaPassword('password1234')!, /prime password/)
  assert.match(controllaPassword('Fisioterapia!!')!, /prime password/)
  // gli spazi in fondo non contano per la lunghezza
  assert.notEqual(controllaPassword('abc12xyz9 '), null)
  // vanno bene: una frase, o una parola lunga con dentro altro
  assert.equal(controllaPassword('il gatto dorme sul divano'), null)
  assert.equal(controllaPassword('Aroma di caffè 7'), null)
  assert.equal(controllaPassword('k8#Tq2vLm9'), null)
})

// Il file delle chiavi come lo scriveva la 0.5.5: N=2^15, p=1, un solo kdf per
// tutte le chiavi.
type Kdf = { algo: 'scrypt'; N: number; r: number; p: number }
const VECCHIO: Kdf = { algo: 'scrypt', N: 32768, r: 8, p: 1 }
function avvolgiVecchio(dek: Buffer, segreto: string): Record<string, string> {
  const salt = randomBytes(16)
  const kek = scryptSync(segreto, salt, 32, { N: VECCHIO.N, r: VECCHIO.r, p: VECCHIO.p, maxmem: 128 * 1024 * 1024 })
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', kek, iv)
  const data = Buffer.concat([c.update(dek), c.final()])
  return { salt: salt.toString('hex'), iv: iv.toString('hex'), tag: c.getAuthTag().toString('hex'), data: data.toString('hex') }
}

type FileChiavi = {
  kdf: Kdf
  pw: { kdf?: Kdf }
  rk: { kdf?: Kdf }
  dq?: { chiave: { kdf?: Kdf } }
}
const leggi = (p: string): FileChiavi => JSON.parse(readFileSync(p, 'utf-8')) as FileChiavi

test('Un archivio nuovo usa i parametri nuovi per tutte le chiavi', () => {
  const p = join(dir, 'nuovo.json')
  setupAuth(p, 'una frase lunga e mia')
  const f = leggi(p)
  assert.deepEqual(f.kdf, { algo: 'scrypt', N: 65536, r: 8, p: 2 })
  assert.equal(f.pw.kdf, undefined)
  assert.equal(f.rk.kdf, undefined)
})

test('Le chiavi della 0.5.5 passano ai parametri nuovi quando si usano, senza perdere niente', () => {
  const p = join(dir, 'vecchio.json')
  const dek = randomBytes(32)
  const rk = randomBytes(16).toString('hex')
  writeFileSync(
    p,
    JSON.stringify({
      version: 1,
      kdf: VECCHIO,
      pw: avvolgiVecchio(dek, 'vecchia password'),
      rk: avvolgiVecchio(dek, rk),
      dq: { domanda: 'Il primo cane?', chiave: avvolgiVecchio(dek, 'fido il bello') }
    })
  )

  // All'accesso la password si riavvolge; chiave e domanda tengono i loro parametri.
  assert.equal(loginAuth(p, 'vecchia password'), dek.toString('hex'))
  let f = leggi(p)
  assert.equal(f.kdf.N, 65536, 'i parametri del file sono quelli della password')
  assert.equal(f.pw.kdf, undefined)
  assert.deepEqual(f.rk.kdf, VECCHIO)
  assert.deepEqual(f.dq!.chiave.kdf, VECCHIO)
  // si rientra, con la password di sempre
  assert.equal(loginAuth(p, 'vecchia password'), dek.toString('hex'))
  assert.throws(() => loginAuth(p, 'sbagliata'), /Password errata/)

  // La risposta alla domanda apre ancora, e si porta ai parametri nuovi.
  assert.equal(recoverDomandaAuth(p, 'Fido il  Bello', 'seconda password lunga'), dek.toString('hex'))
  f = leggi(p)
  assert.equal(f.dq!.chiave.kdf, undefined)
  assert.deepEqual(f.rk.kdf, VECCHIO)

  // La chiave di recupero (scritta come la si legge sul foglio) apre ancora.
  const scritta = rk.toUpperCase().match(/.{4}/g)!.join('-')
  assert.equal(recoverAuth(p, scritta, 'terza password lunga'), dek.toString('hex'))
  f = leggi(p)
  assert.equal(f.rk.kdf, undefined, 'ora tutte le chiavi hanno i parametri nuovi')
  assert.equal(loginAuth(p, 'terza password lunga'), dek.toString('hex'))
  assert.equal(recoverAuth(p, rk, 'quarta password lunga'), dek.toString('hex'))
})

test('Cambiare password o domanda su un file della 0.5.5 lo porta ai parametri nuovi', () => {
  const p = join(dir, 'vecchio-2.json')
  const dek = randomBytes(32)
  const rk = randomBytes(16).toString('hex')
  writeFileSync(
    p,
    JSON.stringify({ version: 1, kdf: VECCHIO, pw: avvolgiVecchio(dek, 'vecchia password'), rk: avvolgiVecchio(dek, rk) })
  )
  cambiaPasswordAuth(p, 'vecchia password', 'nuova password lunga')
  let f = leggi(p)
  assert.equal(f.kdf.N, 65536)
  assert.deepEqual(f.rk.kdf, VECCHIO)
  impostaDomandaAuth(p, 'nuova password lunga', 'Dove sono nato?', 'in una casa gialla')
  f = leggi(p)
  assert.equal(f.dq!.chiave.kdf, undefined)
  assert.equal(recoverDomandaAuth(p, 'in una casa gialla', 'altra password lunga'), dek.toString('hex'))
  assert.equal(recoverAuth(p, rk, 'ultima password lunga'), dek.toString('hex'))
})
