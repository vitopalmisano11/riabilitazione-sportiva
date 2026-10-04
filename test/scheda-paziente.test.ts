// Indicazioni per casa, massimali, segni di riferimento e bozze (indicazioni.ts,
// atleta.ts, segni.ts, bozze.ts).
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  creaIndicazione,
  elencoIndicazioni,
  eliminaIndicazione,
  impostaIndicazioniDelPaziente,
  indicazioniDelPaziente,
  rinominaIndicazione
} from '../src/main/indicazioni'
import { creaMassimale, elencoMassimali, eliminaMassimale, impostaMisure } from '../src/main/atleta'
import { andamentoSegni, creaSegno, elencoSegni, eliminaSegno, rinominaSegno, segniDellaSeduta } from '../src/main/segni'
import { eliminaBozza, leggiBozza, salvaBozza } from '../src/main/bozze'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

const paziente = (cognome: string): number =>
  Number(getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Sc', ?)").run(cognome).lastInsertRowid)

test('Indicazioni per casa: un elenco in comune, e per ogni paziente quelle che valgono', () => {
  const a = creaIndicazione('  Non fare gli esercizi il giorno della partita ')
  const b = creaIndicazione('Ghiaccio dopo la seduta')
  const c = creaIndicazione('Camminare ogni giorno')
  const testi = (): string[] => (elencoIndicazioni() as { testo: string }[]).map((i) => i.testo)
  assert.deepEqual(testi().slice(-3), ['Non fare gli esercizi il giorno della partita', 'Ghiaccio dopo la seduta', 'Camminare ogni giorno'])
  rinominaIndicazione(b, 'Ghiaccio 10 minuti dopo la seduta')
  assert.ok(testi().includes('Ghiaccio 10 minuti dopo la seduta'))

  const x = paziente('Indicazioni X')
  const y = paziente('Indicazioni Y')
  impostaIndicazioniDelPaziente(x, [a, b], ' 3 volte a settimana ')
  impostaIndicazioniDelPaziente(y, [c], null)
  assert.deepEqual(indicazioniDelPaziente(x).sort(), [a, b].sort())
  assert.deepEqual(indicazioniDelPaziente(y), [c])
  const freq = (id: number): string | null =>
    (getDb().prepare('SELECT frequenza_casa FROM pazienti WHERE id = ?').get(id) as { frequenza_casa: string | null }).frequenza_casa
  assert.equal(freq(x), '3 volte a settimana')
  assert.equal(freq(y), null)

  // si riscrivono per intero, non si sommano
  impostaIndicazioniDelPaziente(x, [c], '')
  assert.deepEqual(indicazioniDelPaziente(x), [c])
  assert.equal(freq(x), null, 'una frequenza vuota diventa nessuna')

  // tolta dall'elenco comune, sparisce da chi ce l'aveva
  eliminaIndicazione(c)
  assert.deepEqual(indicazioniDelPaziente(x), [])
  assert.deepEqual(indicazioniDelPaziente(y), [])
})

test('Massimali: con i controlli, dal piu\' recente; peso e altezza', () => {
  const pz = paziente('Massimali')
  const m1 = creaMassimale(pz, '  Squat ', 100, ' kg ', '2026-01-10')
  creaMassimale(pz, 'Panca', 80, null, '2026-03-10')
  const elenco = elencoMassimali(pz) as { id: number; esercizio: string; valore: number; unita: string | null; data: string }[]
  assert.deepEqual(elenco.map((m) => m.esercizio), ['Panca', 'Squat'], 'dal piu\' recente')
  assert.deepEqual([elenco[1].unita, elenco[0].unita], ['kg', null])
  assert.throws(() => creaMassimale(pz, '   ', 100, null, '2026-01-10'), /esercizio/i)
  // un numero negativo o non valido no (lo zero lo ferma il modulo dell'interfaccia)
  assert.throws(() => creaMassimale(pz, 'Stacco', -5, null, '2026-01-10'), /valore/i)
  assert.throws(() => creaMassimale(pz, 'Stacco', Number.NaN, null, '2026-01-10'), /valore/i)
  assert.throws(() => creaMassimale(pz, 'Stacco', 100, null, '10/01/2026'), /data/i)
  eliminaMassimale(m1)
  assert.deepEqual((elencoMassimali(pz) as { esercizio: string }[]).map((m) => m.esercizio), ['Panca'])

  impostaMisure(pz, 72.5, 178)
  const dati = (): { peso: number | null; altezza: number | null } =>
    getDb().prepare('SELECT peso, altezza FROM pazienti WHERE id = ?').get(pz) as { peso: number | null; altezza: number | null }
  assert.deepEqual(dati(), { peso: 72.5, altezza: 178 })
  assert.throws(() => impostaMisure(pz, -1, 178), /peso/i)
  assert.throws(() => impostaMisure(pz, 72, Number.POSITIVE_INFINITY), /altezza/i)
  assert.deepEqual(dati(), { peso: 72.5, altezza: 178 }, 'un rifiuto non cambia niente')
  impostaMisure(pz, null, null)
  assert.deepEqual(dati(), { peso: null, altezza: null })
})

test('Segni di riferimento: prima misura e ultima, e se ne vanno con il segno', () => {
  const c = getDb()
  const pz = paziente('Segni')
  const altro = paziente('Segni altro')
  const dolore = creaSegno(pz, ' Dolore nello squat ', ' 0-10 ')
  const flex = creaSegno(pz, 'Flessione', '°')
  creaSegno(altro, 'Solo suo', null)
  assert.deepEqual((elencoSegni(pz) as { nome: string }[]).map((s) => s.nome), ['Dolore nello squat', 'Flessione'])
  assert.equal((elencoSegni(altro) as { ordine: number }[])[0].ordine, 0, 'la numerazione e\' per paziente')
  rinominaSegno(flex, 'Flessione ginocchio', null)
  assert.ok((elencoSegni(pz) as { nome: string }[]).some((s) => s.nome === 'Flessione ginocchio'))

  const seduta = (data: string): number => Number(c.prepare('INSERT INTO sedute (paziente_id, data) VALUES (?, ?)').run(pz, data).lastInsertRowid)
  const s1 = seduta('2026-02-01')
  const s2 = seduta('2026-02-08')
  const s3 = seduta('2026-02-15')
  const misura = c.prepare('INSERT INTO segno_valori (segno_id, seduta_id, valore) VALUES (?, ?, ?)')
  misura.run(dolore, s2, 5)
  misura.run(dolore, s1, 7) // inserita dopo ma e' la prima in data
  misura.run(dolore, s3, 3)
  type Riga = { id: number; prima_data: string; prima_valore: number; ultima_data: string; ultima_valore: number; misure: number }
  const riga = (andamentoSegni(pz) as Riga[]).find((s) => s.id === dolore)!
  assert.deepEqual([riga.prima_data, riga.prima_valore, riga.ultima_data, riga.ultima_valore, riga.misure], ['2026-02-01', 7, '2026-02-15', 3, 3])
  assert.equal((andamentoSegni(pz) as Riga[]).find((s) => s.id === flex)!.misure, 0)
  assert.deepEqual(segniDellaSeduta(s2), [{ segno_id: dolore, valore: 5 }])

  eliminaSegno(dolore)
  const rimaste = c.prepare('SELECT COUNT(*) AS n FROM segno_valori WHERE segno_id = ?').get(dolore) as { n: number }
  assert.equal(rimaste.n, 0, 'le misure se ne vanno col segno')
  assert.deepEqual(segniDellaSeduta(s2), [])
})

test('La bozza della seduta: una per paziente, si sostituisce, si toglie', () => {
  const a = paziente('Bozza A')
  const b = paziente('Bozza B')
  assert.equal(leggiBozza(a), null)
  salvaBozza(a, '{"note":"prima"}')
  salvaBozza(a, '{"note":"seconda"}')
  salvaBozza(b, '{"note":"di B"}')
  const letta = leggiBozza(a)!
  assert.equal(letta.contenuto, '{"note":"seconda"}')
  assert.ok(Math.abs(Date.now() - new Date(letta.aggiornata_il).getTime()) < 60_000)
  assert.equal(leggiBozza(b)!.contenuto, '{"note":"di B"}')
  eliminaBozza(a)
  assert.equal(leggiBozza(a), null)
  assert.ok(leggiBozza(b), 'quella di un altro paziente resta')
  eliminaBozza(a) // toglierla due volte non da' errore
})
