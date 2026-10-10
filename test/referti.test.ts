// I referti come byte (migrazione 56, referti.ts) e il loro giro nel cestino.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3-multiple-ciphers'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import { MIGRATIONS, runMigrations } from '../src/main/migrations'
import {
  aggiungiReferto,
  byteDelReferto,
  elencoReferti,
  eliminaReferto,
  leggiReferto,
  PESO_MASSIMO_REFERTO
} from '../src/main/referti'
import { elencoCestino, eliminaConCestino, ripristina, svuotaCestino } from '../src/main/cestino'

const prova = archivioDiProva()

const paziente = (cognome: string): number =>
  Number(getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Re', ?)").run(cognome).lastInsertRowid)

test('Referti: si salvano come byte e si rileggono identici, in ordine', () => {
  const pz = paziente('Ferti')
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), randomBytes(5000)])
  const foto = randomBytes(3000)
  const a = aggiungiReferto(pz, 'RM ginocchio.pdf', 'application/pdf', pdf)
  const b = aggiungiReferto(pz, 'RX.jpg', 'image/jpeg', foto)
  assert.deepEqual(
    elencoReferti(pz).map((r) => [r.id, r.nome]),
    [
      [a, 'RM ginocchio.pdf'],
      [b, 'RX.jpg']
    ]
  )
  const letto = leggiReferto(a)
  assert.equal(letto.tipo, 'application/pdf')
  assert.ok(letto.dati.equals(pdf))
  assert.ok(leggiReferto(b).dati.equals(foto))
  // nell'archivio e' un valore binario, non testo
  const tipo = getDb().prepare('SELECT typeof(contenuto) AS t FROM bioimmagini WHERE id = ?').get(a) as { t: string }
  assert.equal(tipo.t, 'blob')

  assert.throws(() => aggiungiReferto(pz, 'vuoto.pdf', 'application/pdf', Buffer.alloc(0)), /vuoto/)
  assert.throws(
    () => aggiungiReferto(pz, 'enorme.pdf', 'application/pdf', Buffer.alloc(PESO_MASSIMO_REFERTO + 1)),
    /troppo pesante/
  )
  assert.throws(() => leggiReferto(999999), /non trovato/)
})

test('Referti: anche quelli scritti come data URL (prima della 56) si leggono', () => {
  const byte = randomBytes(100)
  assert.ok(byteDelReferto(`data:image/jpeg;base64,${byte.toString('base64')}`).equals(byte))
  assert.ok(byteDelReferto(byte).equals(byte))
  assert.ok(byteDelReferto(new Uint8Array(byte)).equals(byte))
  assert.throws(() => byteDelReferto(null), /non è leggibile/)
})

test('Migrazione 56: i data URL diventano byte, il resto non si tocca, e l\'archivio si compatta', () => {
  const file = join(prova.cartella(), 'v55.db')
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  for (let i = 0; i < 55; i++) {
    db.exec(MIGRATIONS[i])
    db.pragma(`user_version = ${i + 1}`)
  }
  const pz = Number(db.prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Vec', 'Chio')").run().lastInsertRowid)
  const ins = db.prepare(
    "INSERT INTO bioimmagini (paziente_id, nome, tipo, contenuto, data) VALUES (?, ?, ?, ?, '2026-01-01')"
  )
  const pesanti: Buffer[] = []
  for (let i = 0; i < 20; i++) {
    const b = randomBytes(40_000)
    pesanti.push(b)
    ins.run(pz, `foto${i}.jpg`, 'image/jpeg', `data:image/jpeg;base64,${b.toString('base64')}`)
  }
  const pdf = randomBytes(1000)
  const idPdf = Number(ins.run(pz, 'esame.pdf', 'application/pdf', `data:application/pdf;base64,${pdf.toString('base64')}`).lastInsertRowid)
  const idStrano = Number(ins.run(pz, 'strano', 'image/png', 'non e un data url').lastInsertRowid)
  db.close()
  const prima = statSync(file).size

  const dopo = new Database(file)
  dopo.pragma('foreign_keys = ON')
  runMigrations(dopo)
  assert.equal(dopo.pragma('user_version', { simple: true }), MIGRATIONS.length)
  const righe = dopo.prepare('SELECT id, contenuto FROM bioimmagini ORDER BY id').all() as { id: number; contenuto: unknown }[]
  for (let i = 0; i < 20; i++) assert.ok(Buffer.isBuffer(righe[i].contenuto) && (righe[i].contenuto as Buffer).equals(pesanti[i]))
  assert.ok((righe.find((r) => r.id === idPdf)!.contenuto as Buffer).equals(pdf))
  assert.equal(righe.find((r) => r.id === idStrano)!.contenuto, 'non e un data url', 'quello che non e\' un data URL resta')
  assert.equal(dopo.pragma('integrity_check', { simple: true }), 'ok')
  dopo.close()
  // un quarto in meno di spazio per i referti (venti foto da 40 kB: circa 200 kB
  // risparmiati): il file e' davvero piu' piccolo. Si misura lo spazio guadagnato
  // e non una percentuale, perche' ogni migrazione nuova aggiunge le sue tabelle
  // e un po' di pagine al file di arrivo (colonne e indici compresi): la soglia
  // sta bassa apposta, a un quarto di quanto si risparmia, cosi' non va ritoccata
  // a ogni migrazione.
  const ora = statSync(file).size
  assert.ok(prima - ora > 50_000, `il file doveva rimpicciolire: ${prima} -> ${ora}`)
}, 120_000)

test('Cestino: un referto torna con i suoi byte, da solo o con il paziente', () => {
  svuotaCestino()
  const pz = paziente('Cestinato')
  const byte = randomBytes(20_000)
  const id = aggiungiReferto(pz, 'TAC.pdf', 'application/pdf', byte)

  eliminaReferto(id)
  assert.equal(elencoReferti(pz).length, 0)
  const voce = getDb().prepare('SELECT contenuto FROM cestino').get() as { contenuto: string }
  assert.ok(!voce.contenuto.includes('"type":"Buffer"'), 'i byte non diventano un elenco di numeri')
  assert.ok(voce.contenuto.length < byte.length * 1.5, 'nel cestino pesa quanto il base64, non di piu\'')
  ripristina(elencoCestino()[0].id)
  assert.ok(leggiReferto(id).dati.equals(byte))

  // con tutto il paziente
  eliminaConCestino('pazienti', pz, 'Paziente', 'Cestinato Re')
  assert.throws(() => leggiReferto(id), /non trovato/)
  ripristina(elencoCestino()[0].id)
  const tornato = leggiReferto(id)
  assert.ok(tornato.dati.equals(byte))
  const tipo = getDb().prepare('SELECT typeof(contenuto) AS t FROM bioimmagini WHERE id = ?').get(id) as { t: string }
  assert.equal(tipo.t, 'blob', 'torna binario, non testo')
})
