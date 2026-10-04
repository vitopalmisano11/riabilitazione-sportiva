// Protezioni trasversali: file temporanei, link e immagini, registro degli errori, scrittura atomica.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { leggiJsonPerScrivere, scriviAtomico } from '../src/main/scrittura'
import {
  eliminaTemporaneo,
  ripulisciTemporanei,
  scriviTemporaneo,
  usaCartellaTemporanei
} from '../src/main/temporanei'
import {
  controllaArgomenti,
  erroreSenzaDatiNelRegistro,
  LINK_WEB,
  testoErrorePerRegistro,
  validaImmagine,
  validaLink
} from '../src/main/validazione'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

test('File temporanei: cartella loro, nome casuale, si tolgono', async () => {
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
})

// Link e immagini: solo web (http/https) e immagini vere, sia in ingresso sia nei fogli stampati.
test('Link e immagini: solo web e immagini vere', () => {
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
})

// Registro degli errori: chi usa il programma legge il nome del file, il registro no
// (il nome di un referto dice di chi e').
test('Registro degli errori: niente nomi di file dei pazienti', () => {
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
})

test('Scrittura atomica: il file c\'e\' intero, si sostituisce, non resta niente accanto', () => {
  const dir = mkdtempSync(join(tmpdir(), 'riab-scrittura-'))
  const f = join(dir, 'prova-atomica.json')
  scriviAtomico(f, '{"a":1}')
  assert.equal(readFileSync(f, 'utf-8'), '{"a":1}')
  scriviAtomico(f, '{"a":2,"lungo":"' + 'x'.repeat(50000) + '"}')
  assert.equal((JSON.parse(readFileSync(f, 'utf-8')) as { a: number }).a, 2)
  assert.ok(!existsSync(`${f}.tmp`), 'il file provvisorio non deve restare')
  // un resto di una scrittura interrotta non disturba la successiva
  writeFileSync(`${f}.tmp`, '{"tagliato":')
  scriviAtomico(f, '{"a":3}')
  assert.equal(readFileSync(f, 'utf-8'), '{"a":3}')
  assert.ok(!readdirSync(dir).some((n) => n.endsWith('.tmp')))

  // Riscrivere partendo da un file: assente = vuoto, illeggibile = errore (mai "vuoto").
  assert.deepEqual(leggiJsonPerScrivere(f), { a: 3 })
  rmSync(f)
  assert.deepEqual(leggiJsonPerScrivere(f), {})
  writeFileSync(f, '{"cartellaDati":"D:\\Pazienti","tema')
  assert.throws(() => leggiJsonPerScrivere(f), /non lo modifico/)
  assert.equal(readFileSync(f, 'utf-8').includes('Pazienti'), true, 'il file rovinato non si tocca')
  rmSync(f)
  rmSync(dir, { recursive: true, force: true })
})

test('Argomenti dei canali: NaN e infinito non passano, nemmeno dentro a elenchi e oggetti', () => {
  // quello che e' normale passa
  controllaArgomenti([])
  controllaArgomenti([1, 'testo', null, undefined, true, 0, -5.5])
  controllaArgomenti([{ serie: [{ peso: 12.5, nota: null }], ids: [1, 2, 3] }])
  assert.throws(() => controllaArgomenti([Number.NaN]), /non è un numero valido/)
  assert.throws(() => controllaArgomenti([1, Number.POSITIVE_INFINITY]), /non è un numero valido/)
  assert.throws(() => controllaArgomenti([{ righe: [{ carico: Number.NaN }] }]), /non è un numero valido/)
  assert.throws(() => controllaArgomenti([[[Number.NEGATIVE_INFINITY]]]), /non è un numero valido/)
  // nel registro non c'e' il dato, solo la natura dell'errore
  try {
    controllaArgomenti([Number.NaN])
  } catch (e) {
    assert.match(testoErrorePerRegistro(e), /NaN o infinito/)
  }
  // un oggetto con un giro dentro non manda in loop: oltre la profondita' non si guarda
  const giro: Record<string, unknown> = {}
  giro.se = giro
  controllaArgomenti([giro])
})

