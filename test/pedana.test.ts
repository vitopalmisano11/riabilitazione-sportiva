// I test con la pedana di forza: lettura del file dell'app della pedana,
// abbinamento del paziente, importazione, archivio e riepilogo (pedana.ts nel
// main e in shared). Il file di esempio e' quello vero dell'app della pedana
// (docs/esempio.pedana.json).
import { readFileSync } from 'node:fs'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { archivioDiProva } from './archivio-di-prova'
import { getDb } from '../src/main/db'
import {
  anteprimaPedana,
  archivioPedana,
  eliminaTestPedana,
  giaImportatePedana,
  importaPedana,
  impostaLatoInteressato
} from '../src/main/pedana'
import { creaPaziente, eliminaPaziente } from '../src/main/pazienti'
import { componiCartella, componiRelazioneValutazione, generaCartella } from '../src/main/export-cartella'
import { generaReportScreening } from '../src/main/report-screening'
import { generaReportPedana } from '../src/main/report-pedana'
import { elencoCestino, ripristina } from '../src/main/cestino'
import {
  condizioniLeggibili,
  fraseForzaLati,
  leggiFilePedana,
  nomeTestPulito,
  riepilogoPedana,
  somiglianzaNomi
} from '../src/shared/pedana'
import { curvaSvg, curvePedana, raggioTracciato, tracciatoSvg } from '../src/shared/pedana-curve'
import type { PazienteCreateInput } from '../src/shared/types'

archivioDiProva()

const ESEMPIO = readFileSync(new URL('../docs/esempio.pedana.json', import.meta.url), 'utf-8')

function paziente(nome = 'Mario', cognome = 'Rossi'): number {
  return creaPaziente({
    nome,
    cognome,
    data_nascita: null,
    codice_fiscale: null,
    telefono: null,
    email: null,
    lavoro: null,
    inviato_da: null,
    sport: null,
    diagnosi: null,
    tipo_intervento: null,
    data_intervento: null,
    precauzioni: null,
    arto_operato: null,
    patologia_id: null,
    fase_corrente_id: null,
    gruppo_id: null
  } as PazienteCreateInput)
}

// Importa tutto quello che c'e' in un file nel paziente dato.
function importaTutto(p: number, contenuto: string): { importate: number; saltate: number } {
  const a = anteprimaPedana(contenuto, 'prova.pedana.json', p)
  return importaPedana(
    p,
    a.token,
    a.registrazioni.map((r) => r.id)
  )
}

// Una registrazione di forza su un lato: picco_migliore_kg, e le prove.
function forza(
  id: string,
  data: string,
  lato: 'dx' | 'sx',
  picchi: number[],
  codice = 'forza.shoulder.y',
  nome = 'Forza isometrica — Spalla Y'
) {
  return {
    id,
    data,
    ora: '10:30',
    test: { codice, nome, categoria: 'Pedana di forza' },
    condizioni: { sorgente: 'total', ripetizioni_non_valide: 0 },
    peso_corporeo_kg: 78,
    avvertenze: [] as string[],
    misure: [
      {
        codice: 'picco_kg',
        nome: 'Picco di forza',
        unita: 'kg',
        per_prova: true,
        meglio: 'alto',
        valori: picchi.map((valore, i) => ({ lato, prova: i + 1, valore }))
      },
      {
        codice: 'picco_migliore_kg',
        nome: 'Picco della ripetizione migliore',
        unita: 'kg',
        per_prova: false,
        meglio: 'alto',
        valori: [{ lato, prova: null, valore: Math.max(...picchi) }]
      }
    ]
  }
}

const file = (registrazioni: unknown[], extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    formato: 'pedana-report',
    versione: 1,
    app: { nome: 'Balance Squat App', versione: '1.0' },
    dispositivo: { tipo: 'wii-balance-board', modello: null, frequenza_hz: 100 },
    paziente: { nome_completo: 'Mario Rossi', peso_corporeo_kg: 80 },
    registrazioni,
    ...extra
  })

const gruppoDi = (p: number, codice: string) =>
  riepilogoPedana(archivioPedana(p)).find((g) => g.codice === codice)!

// ---- il file --------------------------------------------------------------

test('Il file si riconosce solo se è un pedana-report di versione 1, e si controlla', () => {
  assert.throws(() => leggiFilePedana('non e json'), /non è leggibile/)
  assert.throws(() => leggiFilePedana('{"formato":"altro"}'), /non è un file esportato/)
  assert.throws(() => leggiFilePedana(file([], { versione: 2 })), /Versione del file non supportata/)
  assert.throws(
    () => leggiFilePedana(file([], { versione: undefined })),
    /Versione del file non supportata/
  )
  assert.throws(() => leggiFilePedana(file([], { paziente: undefined })), /mancano i dati del paziente/)
  assert.throws(() => leggiFilePedana(file([], { registrazioni: undefined })), /non ci sono registrazioni/)
  assert.throws(
    () => leggiFilePedana(file([{ ...forza('a', '12/10/2026', 'dx', [30]) }])),
    /data non è valida/
  )
  assert.throws(
    () =>
      leggiFilePedana(
        file([forza('uguale', '2026-10-12', 'dx', [30]), forza('uguale', '2026-10-13', 'sx', [30])])
      ),
    /due volte/
  )
  assert.throws(
    () => leggiFilePedana(file([{ ...forza('a', '2026-10-12', 'dx', [30]), test: { codice: '', nome: 'x' } }])),
    /manca il test/
  )
})

test('Quello che non si conosce si ignora, e quello che non è un numero non diventa zero', () => {
  const r = forza('x', '2026-10-12', 'dx', [30, 31])
  ;(r.misure[0].valori as unknown[]).push({ lato: 'dx', prova: 3, valore: 'tanto' })
  const strana = {
    ...r,
    campo_nuovo: { a: 1 },
    misure: [
      ...r.misure,
      {
        codice: 'misura_nuova',
        nome: 'Una nuova',
        unita: 'x',
        per_prova: false,
        meglio: null,
        valori: [{ lato: null, prova: null, valore: 5 }]
      }
    ],
    serie: [
      // lunghezze diverse: la serie si scarta
      { codice: 'forza_tempo', nome: 'Forza', x: [1, 2, 3], y: [1, 2] },
      { codice: 'forza_tempo', nome: 'Forza', x: [1, 2], y: [1, 2], lato: 'dx', prova: 1 },
      // senza liste: non e' una serie
      { codice: 'vuota', nome: 'Vuota' }
    ]
  }
  const letto = leggiFilePedana('﻿' + file([strana]))
  const reg = letto.registrazioni[0]
  assert.equal(reg.misure[0].valori.length, 2, 'il valore non numerico non entra')
  assert.equal(reg.misure.length, 3, 'una misura sconosciuta si tiene')
  assert.equal(reg.serie.length, 1)
  assert.equal(letto.app, 'Balance Squat App 1.0')
  assert.equal(letto.peso_kg, 80)
})

test('Il file di esempio vero si legge: registrazioni, misure, lati, serie, ovale, riassunto', () => {
  const f = leggiFilePedana(ESEMPIO)
  assert.equal(f.registrazioni.length, 8)
  assert.equal(f.paziente_nome, 'Mario Rossi')
  assert.equal(f.dispositivo.tipo, 'wii-balance-board')

  const sx = f.registrazioni[0]
  assert.equal(sx.test.codice, 'forza.shoulder.y')
  assert.deepEqual(
    sx.misure.find((m) => m.codice === 'picco_kg')!.valori.map((v) => [v.lato, v.prova, v.valore]),
    [
      ['sx', 1, 17.61],
      ['sx', 2, 18.47],
      ['sx', 3, 18.13]
    ]
  )
  assert.equal(sx.misure.find((m) => m.codice === 'picco_migliore_kg')!.valori[0].valore, 18.47)
  assert.equal(sx.serie.length, 3)
  assert.equal(sx.serie[0].lato, 'sx')
  assert.equal(f.registrazioni[1].serie.length, 2)

  const salto = f.registrazioni[2]
  assert.equal(salto.test.codice, 'salto.cmj')
  assert.ok(salto.misure.every((m) => m.valori.every((v) => v.lato === null)))
  assert.equal(salto.misure.find((m) => m.codice === 'carico_sx_statica_pct')!.meglio, null)
  assert.equal(salto.serie.find((s) => s.codice === 'carico_lati_tempo')!.canali.y_sx.length, 382)

  const stab = f.registrazioni.filter((r) => r.test.codice.startsWith('stabilometria'))
  assert.equal(stab.length, 5)
  for (const r of stab) {
    assert.equal(r.riassunto.length, 3)
    const tracciato = r.serie.find((s) => s.codice === 'stabilogramma')!
    assert.ok(tracciato.ellisse, 'ovale al 95%')
    assert.equal(tracciato.ellisse!.x.length, tracciato.ellisse!.y.length)
    assert.ok(tracciato.ellisse!.x.length > 3)
    assert.ok(r.serie.some((s) => s.codice === 'stabilogramma_tempo'))
  }
  assert.equal(stab[2].condizioni.confronto_sx_dx !== undefined, true)
})

test("L'ovale puo' mancare (file vecchi) o essere sbagliato: niente errore, niente ovale", () => {
  const f = JSON.parse(ESEMPIO)
  const reg = f.registrazioni.find((r: { test: { codice: string } }) =>
    r.test.codice.startsWith('stabilometria')
  )
  const trac = reg.serie.find((s: { codice: string }) => s.codice === 'stabilogramma')
  delete trac.ellisse
  const senza = leggiFilePedana(JSON.stringify(f))
  assert.equal(
    senza.registrazioni.find((r) => r.id === reg.id)!.serie.find((s) => s.codice === 'stabilogramma')!.ellisse,
    null
  )
  trac.ellisse = { x: [1, 2], y: [1] }
  const rotta = leggiFilePedana(JSON.stringify(f))
  assert.equal(
    rotta.registrazioni.find((r) => r.id === reg.id)!.serie.find((s) => s.codice === 'stabilogramma')!.ellisse,
    null
  )
  const svg = tracciatoSvg(
    senza.registrazioni.find((r) => r.id === reg.id)!.serie.find((s) => s.codice === 'stabilogramma')!
  )
  assert.ok(svg.includes('<polyline') && !svg.includes('<polygon'))
})

// ---- il paziente -------------------------------------------------------------

test('Il nome nel file somiglia a un paziente: ordine libero, accenti e maiuscole no, una lettera sì', () => {
  assert.equal(somiglianzaNomi('Mario Rossi', 'Rossi', 'Mario'), 1)
  assert.equal(somiglianzaNomi('Rossi Mario', 'Rossi', 'Mario'), 1)
  assert.equal(somiglianzaNomi('MARIO rossì', 'Rossi', 'Mario'), 1)
  assert.equal(somiglianzaNomi('Mario', 'Rossi', 'Mario'), 0.5, 'una parola su due')
  assert.equal(somiglianzaNomi('Paolo Verdi', 'Rossi', 'Mario'), 0)
  assert.equal(somiglianzaNomi('Marco Verdi', 'Rossi', 'Mario'), 0.5, 'Marco e Mario: una lettera, ma il cognome no')
  assert.equal(somiglianzaNomi('Giovani Bianchi', 'Bianchi', 'Giovanni'), 1, 'una lettera di meno')
  assert.equal(somiglianzaNomi('Mario Rosi', 'Rossi', 'Mario'), 0.5, 'le parole corte non si tollerano')
  assert.equal(somiglianzaNomi('', 'Rossi', 'Mario'), 0)
})

test('Il paziente non si abbina da solo: si propone il più somigliante e si sceglie', () => {
  const rossi = paziente('Mario', 'Rossi')
  const luca = paziente('Luca', 'Rossi')
  const verdi = paziente('Anna', 'Verdi')

  const a = anteprimaPedana(ESEMPIO, 'Mario-Rossi.pedana.json', null)
  assert.equal(a.paziente_nome_file, 'Mario Rossi')
  assert.equal(a.candidati[0].id, rossi, 'prima chi ha lo stesso nome')
  assert.equal(a.candidati[0].somiglianza, 1)
  assert.ok(a.candidati.some((c) => c.id === luca), 'anche chi ha solo il cognome')
  assert.ok(!a.candidati.some((c) => c.id === verdi))
  assert.equal(a.proposto, rossi)
  assert.equal(archivioPedana(rossi).test.length, 0, 'finché non si conferma non si scrive niente')

  // partendo dalla scheda di un altro paziente, e' lui il suggerimento
  const b = anteprimaPedana(ESEMPIO, 'x.json', verdi)
  assert.equal(b.proposto, verdi)
  assert.equal(b.candidati[0].id, rossi)
  assert.throws(() => anteprimaPedana(ESEMPIO, 'x.json', 99999), /Paziente non trovato/)

  // si puo' importare in un paziente diverso da quello proposto
  assert.deepEqual(
    importaPedana(
      luca,
      b.token,
      b.registrazioni.map((r) => r.id)
    ),
    { importate: 8, saltate: 0 }
  )
  assert.equal(archivioPedana(luca).test.length, 8)
  assert.equal(archivioPedana(verdi).test.length, 0)
  assert.throws(() => importaPedana(rossi, b.token, ['x']), /non è più in attesa/, 'il gettone si usa una volta')

  // un file senza nome non propone nessuno
  const senzaNome = anteprimaPedana(
    file([forza('s1', '2026-10-01', 'dx', [30])], { paziente: { nome_completo: null } }),
    'x.json',
    null
  )
  assert.deepEqual(senzaNome.candidati, [])
  assert.equal(senzaNome.proposto, null)
})

// ---- l'importazione ----------------------------------------------------------

test('Si importa una volta sola: rimportare salta, e un file più recente aggiunge solo le nuove', () => {
  const p = paziente('Carla', 'Neri')

  const a1 = anteprimaPedana(ESEMPIO, 'a.json', p)
  assert.ok(a1.registrazioni.every((r) => !r.gia_importata))
  assert.equal(a1.registrazioni.find((r) => r.test_codice === 'forza.shoulder.y')!.lato, 'sx')
  assert.equal(a1.registrazioni.find((r) => r.test_codice === 'salto.cmj')!.lato, null)
  assert.ok(a1.registrazioni.find((r) => r.test_codice === 'salto.cmj')!.ha_serie)
  assert.deepEqual(
    importaPedana(
      p,
      a1.token,
      a1.registrazioni.map((r) => r.id)
    ),
    { importate: 8, saltate: 0 }
  )

  // lo stesso file
  const a2 = anteprimaPedana(ESEMPIO, 'a.json', p)
  assert.ok(a2.registrazioni.every((r) => r.gia_importata))
  assert.deepEqual(
    importaPedana(
      p,
      a2.token,
      a2.registrazioni.map((r) => r.id)
    ),
    { importate: 0, saltate: 8 }
  )
  assert.equal(archivioPedana(p).test.length, 8, 'nessun doppione')

  // un file piu' recente: gli stessi risultati e uno nuovo
  const piuRecente = JSON.parse(ESEMPIO)
  piuRecente.registrazioni.push(forza('nuova-1', '2026-10-20', 'dx', [35]))
  const a3 = anteprimaPedana(JSON.stringify(piuRecente), 'b.json', p)
  assert.deepEqual(
    a3.registrazioni.filter((r) => !r.gia_importata).map((r) => r.id),
    ['nuova-1']
  )
  assert.deepEqual(
    importaPedana(
      p,
      a3.token,
      a3.registrazioni.map((r) => r.id)
    ),
    { importate: 1, saltate: 8 }
  )
  assert.equal(archivioPedana(p).test.length, 9)

  // solo quelle scelte
  const q = paziente('Dario', 'Gialli')
  const a4 = anteprimaPedana(ESEMPIO, 'c.json', q)
  const salto = a4.registrazioni.find((r) => r.test_codice === 'salto.cmj')!
  assert.deepEqual(importaPedana(q, a4.token, [salto.id]), { importate: 1, saltate: 0 })
  assert.deepEqual(
    archivioPedana(q).test.map((t) => t.test_codice),
    ['salto.cmj']
  )

  // cambiando paziente nella finestra si ricalcola quali ci sono gia'
  const a5 = anteprimaPedana(ESEMPIO, 'd.json', null)
  assert.deepEqual(giaImportatePedana(a5.token, q), [salto.id])
  assert.equal(giaImportatePedana(a5.token, p).length, 8)
  assert.throws(() => giaImportatePedana('gettone-sbagliato', p), /non è più in attesa/)
})

test("I valori, le serie, il riassunto e le condizioni dell'esempio arrivano come sono", () => {
  const p = paziente('Elena', 'Blu')
  importaTutto(p, ESEMPIO)
  const arch = archivioPedana(p)

  const spalle = arch.test.filter((t) => t.test_codice === 'forza.shoulder.y')
  const sx = spalle.find((t) => t.lato === 'sx')!
  assert.equal(sx.peso_kg, 64)
  assert.deepEqual(
    sx.misure.find((m) => m.codice === 'picco_kg')!.valori.map((v) => v.valore),
    [17.61, 18.47, 18.13]
  )
  assert.equal(sx.serie.length, 3)
  assert.equal(sx.condizioni.riposo_kg, 0.42)

  const salto = arch.test.find((t) => t.test_codice === 'salto.cmj')!
  assert.equal(salto.lato, null)
  assert.deepEqual(salto.condizioni.eventi_serie_ms, {
    inizio_movimento: 1010,
    velocita_zero: 1510,
    stacco: 1790,
    atterraggio: 2300
  })
  assert.equal(salto.serie.find((s) => s.codice === 'carico_lati_tempo')!.canali.y_dx.length, 382)

  const mono = arch.test.find((t) => t.test_codice === 'stabilometria.monopodalico.occhi_chiusi')!
  assert.equal(mono.lato, 'dx', "il piede d'appoggio")
  assert.equal(mono.riassunto.length, 3)
  const tracciato = mono.serie.find((s) => s.codice === 'stabilogramma')!
  assert.ok(tracciato.ellisse && tracciato.ellisse.x.length > 3, "l'ovale si salva e si rilegge")
  assert.equal(mono.serie.find((s) => s.codice === 'stabilogramma_tempo')!.canali.y_ap.length, 251)
  assert.equal(mono.misure.find((m) => m.codice === 'durata_s')!.meglio, null)
})

test('Una registrazione senza misure si importa lo stesso, con il suo avviso', () => {
  const p = paziente('Fabio', 'Verde')
  const vuota = {
    id: 'vuota-1',
    data: '2026-10-05',
    ora: '09:00',
    test: { codice: 'forza.hamstring', nome: 'Forza isometrica — Hamstring', categoria: 'Pedana di forza' },
    condizioni: { ripetizioni_non_valide: 3 },
    avvertenze: ['nessuna ripetizione valida'],
    misure: []
  }
  assert.deepEqual(importaTutto(p, file([vuota])), { importate: 1, saltate: 0 })
  const g = gruppoDi(p, 'forza.hamstring')
  assert.equal(g.giorni.length, 1, "non sparisce dall'elenco")
  assert.deepEqual(g.giorni[0].avvertenze, ['nessuna ripetizione valida'])
  assert.equal(g.giorni[0].dx, null)
  assert.equal(g.giorni[0].lsi, null)
  assert.equal(g.misura.codice, '')
})

// ---- il riepilogo: lati, LSI, frase ---------------------------------------------

test('I due lati si abbinano: stesso test, giorni vicini; con un lato solo niente LSI', () => {
  const p = paziente('Giada', 'Rosa')
  importaTutto(
    p,
    file([
      // un test fatto in due giorni vicini: una sola riga con i due lati
      forza('d1', '2026-10-01', 'dx', [30, 33]),
      forza('s1', '2026-10-02', 'sx', [40, 36]),
      // lontani piu' di una settimana: due righe, nessun LSI
      forza('d2', '2026-10-20', 'dx', [34]),
      forza('s2', '2026-11-10', 'sx', [38]),
      // un test personalizzato non si mescola con un altro dallo stesso codice
      forza('c1', '2026-10-01', 'dx', [10], 'forza.custom', 'Intrarotatori'),
      forza('c2', '2026-10-01', 'sx', [20], 'forza.custom', 'Extrarotatori'),
      // un lato solo
      forza('h1', '2026-10-01', 'dx', [50], 'forza.hamstring', 'Hamstring')
    ])
  )

  const y = gruppoDi(p, 'forza.shoulder.y')
  assert.equal(y.giorni.length, 3)
  const coppia = y.giorni.find((g) => g.dataFine !== null)!
  assert.equal(coppia.data, '2026-10-01')
  assert.equal(coppia.dataFine, '2026-10-02')
  assert.equal(coppia.dx, 33, 'il picco migliore, non la media')
  assert.equal(coppia.sx, 40)
  assert.equal(coppia.lsi, (33 / 40) * 100, 'senza lato interessato: il meno forte sul più forte')
  assert.ok(y.giorni.filter((g) => g.dataFine === null).every((g) => g.lsi === null))
  assert.equal(y.frase, 'Arto sinistro più forte di 21% rispetto al destro.')

  // il test personalizzato si distingue dal nome
  const custom = riepilogoPedana(archivioPedana(p)).filter((g) => g.codice === 'forza.custom')
  assert.deepEqual(custom.map((g) => g.nome).sort(), ['Extrarotatori', 'Intrarotatori'])
  assert.ok(custom.every((g) => g.giorni.length === 1 && g.giorni[0].lsi === null))

  const h = gruppoDi(p, 'forza.hamstring')
  assert.equal(h.giorni[0].lsi, null)
  assert.equal(h.frase, null)

  // il picco medio vale se manca il migliore
  const solo = paziente('Ivo', 'Grigi')
  const r = forza('m1', '2026-10-01', 'dx', [30, 34])
  r.misure = [
    r.misure[0],
    {
      codice: 'picco_medio_kg',
      nome: 'Medio',
      unita: 'kg',
      per_prova: false,
      meglio: 'alto',
      valori: [{ lato: 'dx', prova: null, valore: 32 }]
    }
  ]
  importaTutto(solo, file([r]))
  assert.equal(gruppoDi(solo, 'forza.shoulder.y').misura.codice, 'picco_medio_kg')
  assert.equal(gruppoDi(solo, 'forza.shoulder.y').giorni[0].dx, 32)
})

test("Il lato interessato si sceglie per test: l'arto operato vale solo dove non è scelto", () => {
  const p = paziente('Sara', 'Gialli')
  getDb().prepare("UPDATE pazienti SET arto_operato = 'dx' WHERE id = ?").run(p)
  importaTutto(
    p,
    file([
      forza('d1', '2026-10-01', 'dx', [30]),
      forza('s1', '2026-10-01', 'sx', [40]),
      // un altro test, un'altra storia: la spalla I
      forza('d2', '2026-10-01', 'dx', [20], 'forza.shoulder.i'),
      forza('s2', '2026-10-01', 'sx', [25], 'forza.shoulder.i')
    ])
  )

  // arto operato destro: LSI = destro 30 / sinistro 40 = 75%
  assert.equal(gruppoDi(p, 'forza.shoulder.y').giorni[0].lsi, 75)
  assert.equal(gruppoDi(p, 'forza.shoulder.i').giorni[0].lsi, 80)
  assert.equal(gruppoDi(p, 'forza.shoulder.y').latoInteressato, 'dx')

  // per la spalla Y l'interessato e' il sinistro: 40 / 30; l'altro test non cambia
  impostaLatoInteressato(p, 'forza.shoulder.y', 'sx')
  // l'LSI resta intero com'e': lo si arrotonda solo quando lo si mostra
  assert.equal(Math.round(gruppoDi(p, 'forza.shoulder.y').giorni[0].lsi! * 10) / 10, 133.3)
  assert.equal(gruppoDi(p, 'forza.shoulder.i').giorni[0].lsi, 80)

  // tolto, si torna all'arto operato della scheda
  impostaLatoInteressato(p, 'forza.shoulder.y', null)
  assert.equal(gruppoDi(p, 'forza.shoulder.y').giorni[0].lsi, 75)
  assert.throws(() => impostaLatoInteressato(p, 'forza.shoulder.y', 'sopra' as 'dx'), /destro o sinistro/)

  // senza arto operato ne' scelta: il rapporto fra il minore e il maggiore
  getDb().prepare('UPDATE pazienti SET arto_operato = NULL WHERE id = ?').run(p)
  assert.equal(gruppoDi(p, 'forza.shoulder.y').latoInteressato, null)
  assert.equal(gruppoDi(p, 'forza.shoulder.y').giorni[0].lsi, 75)
})

test("La frase dice di quanto un arto supera l'altro, e quando sono uguali", () => {
  assert.equal(fraseForzaLati(33, 30), 'Arto destro più forte di 10% rispetto al sinistro.')
  assert.equal(fraseForzaLati(30, 36), 'Arto sinistro più forte di 20% rispetto al destro.')
  assert.equal(fraseForzaLati(30, 30.1), 'Forza simmetrica fra i due arti.')
  assert.equal(fraseForzaLati(30, null), null)
  assert.equal(fraseForzaLati(0, 30), null)
})

test('Variazioni nel tempo e test bilaterali; senza un verso non si giudica', () => {
  const p = paziente('Elisa', 'Celeste')
  const stab = (id: string, data: string, v: number) => ({
    id,
    data,
    test: { codice: 'stabilometria.bipodalico.occhi_aperti', nome: 'Stabilometria', categoria: null },
    misure: [
      {
        codice: 'velocita_media_mm_s',
        nome: 'Velocità media',
        unita: 'mm/s',
        per_prova: false,
        meglio: 'basso',
        valori: [{ lato: null, prova: null, valore: v }]
      },
      {
        codice: 'durata_s',
        nome: 'Durata',
        unita: 's',
        per_prova: false,
        meglio: null,
        valori: [{ lato: null, prova: null, valore: 30 }]
      }
    ]
  })
  importaTutto(
    p,
    file([
      forza('a1', '2026-09-01', 'dx', [20, 25]),
      forza('a2', '2026-10-01', 'dx', [30, 28]),
      stab('b1', '2026-09-01', 12.5),
      stab('b2', '2026-10-01', 10)
    ])
  )
  const f = gruppoDi(p, 'forza.shoulder.y')
  assert.deepEqual(
    f.giorni.map((g) => [g.data, g.dx]),
    [
      ['2026-10-01', 30],
      ['2026-09-01', 25]
    ],
    'vale la ripetizione migliore'
  )
  assert.equal(f.variazione?.dx, 20, '25 → 30: +20%')
  assert.equal(f.variazione?.sx, null)

  const s = gruppoDi(p, 'stabilometria.bipodalico.occhi_aperti')
  assert.equal(s.perLato, false)
  assert.equal(s.giorni[0].unico, 10)
  assert.equal(s.variazione?.unico, -20)
  assert.equal(s.misura.meglio, 'basso')
  assert.ok(s.giorni.every((g) => g.lsi === null))

  // la stabilometria monopodalica del file di esempio: lato del piede, ma niente LSI
  const q = paziente('Teo', 'Marrone')
  importaTutto(q, ESEMPIO)
  const mono = gruppoDi(q, 'stabilometria.monopodalico.occhi_chiusi')
  assert.equal(mono.perLato, true)
  assert.equal(mono.giorni[0].dx, 49.22)
  assert.equal(mono.giorni[0].sx, null)
  assert.equal(mono.giorni[0].lsi, null, "l'LSI è solo per la forza")

  // destro e sinistro dello stesso test (confronto_sx_dx): una riga sola, due lati
  const aperti = gruppoDi(q, 'stabilometria.monopodalico.occhi_aperti')
  assert.equal(aperti.giorni.length, 1)
  assert.equal(aperti.giorni[0].sx, 36.59)
  assert.equal(aperti.giorni[0].dx, 36.72)
  assert.equal(aperti.giorni[0].test.length, 2)
  assert.equal(aperti.nome, 'Stabilometria — Monopodalico, occhi aperti', 'il lato non sta nel nome')
})

test('Le condizioni si leggono in parole, e quelle sconosciute si saltano', () => {
  const righe = condizioniLeggibili({
    sorgente: 'bottomLeft',
    durata_s: 5,
    ripetizioni_non_valide: 1,
    eventi_serie_ms: { inizio_movimento: 100, stacco: 450 },
    x_positivo: 'destra',
    qualcosa_di_nuovo: 7
  })
  assert.deepEqual(righe, [
    'Forza letta da: cella in basso a sinistra',
    'Durata: 5 s',
    '1 ripetizione non valida',
    "Eventi nel salto (ms dall'inizio): inizio movimento 100, stacco 450"
  ])
})

// ---- eliminare ----------------------------------------------------------------

test('Eliminare un test porta via valori e tracciati; eliminare il paziente, tutto, e il cestino lo rende', () => {
  const p = paziente('Marta', 'Porpora')
  importaTutto(p, ESEMPIO)
  impostaLatoInteressato(p, 'forza.shoulder.y', 'sx')
  const db = getDb()
  const conta = (tabella: string): number =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${tabella}`).get() as { n: number }).n

  const prima = { valori: conta('pedana_valori'), serie: conta('pedana_serie') }
  const stab = archivioPedana(p).test.find((t) => t.test_codice.startsWith('stabilometria'))!
  eliminaTestPedana(stab.id)
  assert.equal(conta('pedana_serie'), prima.serie - 2)
  assert.equal(conta('pedana_valori'), prima.valori - 10)
  assert.equal(archivioPedana(p).test.length, 7)

  // dopo l'eliminazione lo stesso file si può importare di nuovo (solo quel test)
  const diNuovo = anteprimaPedana(ESEMPIO, 'a.json', p)
  assert.deepEqual(
    diNuovo.registrazioni.filter((r) => !r.gia_importata).map((r) => r.test_codice),
    [stab.test_codice]
  )

  eliminaPaziente(p)
  const resto = (tabella: string): number =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${tabella} WHERE paziente_id = ?`).get(p) as { n: number }).n
  assert.equal(resto('pedana_test'), 0)
  assert.equal(resto('pedana_lato_interessato'), 0)

  // dal cestino il paziente torna con i suoi test della pedana, serie comprese
  const voce = elencoCestino().find((v) => v.etichetta.includes('Porpora'))!
  ripristina(voce.id)
  const tornato = archivioPedana(p)
  assert.equal(tornato.test.length, 7)
  assert.equal(tornato.lati_interessati['forza.shoulder.y'], 'sx')
  assert.equal(tornato.test.find((t) => t.test_codice === 'forza.shoulder.y' && t.lato === 'sx')!.serie.length, 3)
})

// ---- i report -------------------------------------------------------------------

// Un paziente con forza sui due lati in due momenti, e una stabilometria.
function pazienteConPedana(nome: string, cognome: string): number {
  const p = paziente(nome, cognome)
  getDb().prepare("UPDATE pazienti SET arto_operato = 'dx' WHERE id = ?").run(p)
  importaTutto(
    p,
    file([
      forza('d1', '2026-09-01', 'dx', [24, 26]),
      forza('s1', '2026-09-01', 'sx', [30, 29]),
      forza('d2', '2026-10-01', 'dx', [28, 30]),
      forza('s2', '2026-10-01', 'sx', [31, 32]),
      ...(JSON.parse(ESEMPIO).registrazioni as unknown[]).filter(
        (r) => (r as { test: { codice: string } }).test.codice.startsWith('stabilometria')
      )
    ])
  )
  return p
}

test('La cartella ha la sezione dei test con pedana: storico, ultimo test, grafici', () => {
  const p = pazienteConPedana('Nadia', 'Cartella')
  const c = componiCartella(p, ['pedana'])
  assert.equal(c.sezioni.length, 1)
  assert.equal(c.sezioni[0].titolo, 'Test con pedana')
  const blocchi = c.sezioni[0].blocchi

  const storico = blocchi.find(
    (b) => b.tipo === 'tabella' && b.intestazioni[0] === 'Data' && b.intestazioni.includes('LSI')
  )
  assert.ok(storico && storico.tipo === 'tabella')
  // dal piu' vecchio: 26 / 30 e poi 30 / 32, con l'LSI del lato operato (destro)
  assert.deepEqual(storico.righe[0].slice(0, 3), ['01/09/2026', '26 kg', '30 kg'])
  assert.deepEqual(storico.righe[1].slice(0, 3), ['01/10/2026', '30 kg', '32 kg'])
  assert.equal(storico.righe[1][3], '93,8 %', 'destro operato: 30 / 32')

  assert.ok(
    blocchi.some(
      (b) => b.tipo === 'paragrafi' && b.voci.some((v) => v.testo === 'Arto sinistro più forte di 7% rispetto al destro.')
    )
  )
  assert.ok(blocchi.some((b) => b.tipo === 'grafici'), 'andamento nel tempo')
  // la stabilometria: tracciato e frasi dell'app
  const stab = blocchi.find((b) => b.tipo === 'elenco' && b.voci[0].startsWith('Oscillazione marcata'))
  assert.ok(stab)
  const html = generaCartella(p, ['pedana'])
  assert.ok(html.includes('Test con pedana'))
  assert.ok(html.includes('Tracciato del centro di pressione'))

  // un paziente senza test della pedana: la sezione non c'e'
  const vuoto = paziente('Vera', 'Senzapedana')
  assert.equal(componiCartella(vuoto, ['pedana']).sezioni.length, 0)
})

test('La relazione della valutazione chiude con una sintesi dei test con pedana', () => {
  const p = pazienteConPedana('Rita', 'Relazione')
  const c = componiRelazioneValutazione(p)
  const sez = c.sezioni.find((s) => s.titolo === 'Test con pedana')!
  assert.ok(sez, 'la sezione è presente')
  const tabella = sez.blocchi[0]
  assert.ok(tabella.tipo === 'tabella')
  assert.deepEqual(tabella.intestazioni, ['Test', 'Data', 'Risultato', 'LSI', 'Dal primo test'])
  const spalla = tabella.righe.find((r) => r[0].includes('Spalla Y'))!
  assert.equal(spalla[2], 'Dx 30 kg · Sx 32 kg')
  assert.equal(spalla[4], 'destro +15% · sinistro +7%')
  assert.ok(
    sez.blocchi.some(
      (b) =>
        b.tipo === 'paragrafi' &&
        b.voci.some((v) => v.testo.startsWith('Forza isometrica — Spalla Y: arto sinistro più forte di 7%'))
    )
  )

  // senza test con pedana la relazione non cambia
  const senza = paziente('Gino', 'Senza')
  assert.ok(!componiRelazioneValutazione(senza).sezioni.some((s) => s.titolo === 'Test con pedana'))
})

test('Il report di screening richiama i test con pedana scelti, a confronto, e solo quelli', () => {
  const p = pazienteConPedana('Olga', 'Screening')
  const ses = Number(
    getDb()
      .prepare(
        "INSERT INTO screening_sessioni (paziente_id, protocollo_nome, sport, data) VALUES (?, 'Prova', 'Calcio', '2026-10-02')"
      )
      .run(p).lastInsertRowid
  )
  const arch = archivioPedana(p)
  const forzaIds = arch.test.filter((t) => t.test_codice === 'forza.shoulder.y').map((t) => t.id)
  assert.equal(forzaIds.length, 4)

  const senza = generaReportScreening([ses]).html
  assert.ok(!senza.includes('Test con pedana'))

  const con = generaReportScreening([ses], forzaIds).html
  assert.ok(con.includes('<h3>Test con pedana</h3>'))
  assert.ok(con.includes('Forza isometrica (Spalla Y)'))
  assert.ok(con.includes('<span class="data">01/09/2026</span>') && con.includes('<span class="data">01/10/2026</span>'), 'tutte e due le date a confronto')
  assert.ok(con.includes('ciambella'), 'la ciambella dei due lati')
  assert.ok(con.includes('Arto sinistro più forte'))
  assert.ok(con.includes('differenza fra gli arti ridotta dal 15% al 7% rispetto al primo test'), 'cambiamento fra T0 e T1')
  assert.ok(!con.includes('Statokinesigramma') && !con.includes('Oscillazione marcata'), 'la stabilometria non è stata scelta')

  // solo un giorno scelto: niente andamento
  const giorno = arch.test.filter((t) => t.data === '2026-10-01' && t.test_codice === 'forza.shoulder.y').map((t) => t.id)
  const uno = generaReportScreening([ses], giorno).html
  assert.ok(uno.includes('L’andamento compare dal secondo test.'))
  assert.ok(!uno.includes('01/09/2026</span>'))

  // la stabilometria porta il tracciato e le frasi
  const stab = arch.test.filter((t) => t.test_codice.startsWith('stabilometria')).map((t) => t.id)
  const conStab = generaReportScreening([ses], stab).html
  assert.ok(conStab.includes('Tracciato del centro di pressione'))
  assert.ok(conStab.includes('Oscillazione marcata'))
  // la stabilometria non ha la tabella con la data: una riga di valori
  assert.ok(conStab.includes('class="valori-riga"') && !conStab.includes('<th>13/10/2026</th>'))
  // le note dicono a quale piede si riferiscono
  assert.ok(conStab.includes('Piede destro') && conStab.includes('Piede sinistro'))
  // il riassunto in fondo ha una frase per ogni test scelto
  const riassuntoFinale = conStab.slice(conStab.indexOf('<div class="riassunto">'))
  assert.ok(riassuntoFinale.includes('<b>Stabilometria (Monopodalico'), 'una frase per la stabilometria')
  assert.ok(!generaReportScreening([ses], forzaIds).html.includes('<b>Stabilometria'))
  assert.ok(generaReportScreening([ses], forzaIds).html.includes('<b>Forza isometrica (Spalla Y)</b>'))

  // registrazioni di un altro paziente non entrano mai nel report
  const altro = pazienteConPedana('Ugo', 'Altro')
  const dellAltro = archivioPedana(altro).test.map((t) => t.id)
  assert.ok(!generaReportScreening([ses], dellAltro).html.includes('<h3>Test con pedana</h3>'))
})

test('i nomi dei test non hanno parentesi dentro le parentesi', () => {
  assert.equal(nomeTestPulito('Forza isometrica — Spalla (Y (135°))'), 'Forza isometrica — Spalla (Y 135°)')
  assert.equal(nomeTestPulito('Salto — CMJ'), 'Salto — CMJ')
  assert.equal(nomeTestPulito('Spalla (Y)'), 'Spalla (Y)')
  assert.equal(nomeTestPulito('A (B (C (D)))'), 'A (B C D)')
})

test('le curve: forza, salto con i momenti, carico sui lati, oscillazione', () => {
  const p = paziente('Curva', 'Prova')
  importaTutto(p, ESEMPIO)
  const archivio = archivioPedana(p)
  const di = (prefisso: string) => archivio.test.filter((t) => t.test_codice.startsWith(prefisso))

  const forzaCurve = curvePedana(di('forza'))
  // un disegno per lato, con tutte le ripetizioni di quel lato
  const lati = new Set(forzaCurve.map((c) => c.chiave))
  assert.equal(lati.size, forzaCurve.length, 'un disegno per lato')
  assert.ok(forzaCurve.length >= 1 && forzaCurve.length <= 2)
  assert.equal(forzaCurve[0].unitaX, 's', 'i millisecondi diventano secondi')
  for (const c of forzaCurve) {
    assert.ok(c.linee.length >= 2)
    assert.ok(c.linee.some((l) => l.spessore > 2), 'la ripetizione migliore è in evidenza')
    assert.ok(c.linee.every((l) => l.colore === c.linee[0].colore), 'un solo colore per disegno')
  }
  if (forzaCurve.length === 2) {
    assert.deepEqual(forzaCurve[0].intervalloY, forzaCurve[1].intervalloY, 'stessa scala fra i due lati')
  }

  const salto = curvePedana(di('salto'))
  assert.deepEqual(
    salto.map((c) => c.titolo),
    ['Forza durante il salto', 'Carico sui due lati durante il salto']
  )
  assert.ok(salto[0].eventi.length > 0, 'i momenti del salto sono segnati')
  assert.ok(salto[1].linee.some((l) => l.etichetta === 'Destro') && salto[1].linee.some((l) => l.etichetta === 'Sinistro'))

  const stab = curvePedana(di('stabilometria'))
  assert.equal(stab.length, 5)
  assert.ok(stab.some((c) => c.titolo === 'Oscillazione nel tempo — piede sinistro'))
  assert.ok(stab.some((c) => c.titolo === 'Oscillazione nel tempo'), 'il bipodalico non ha lato')
  assert.ok(stab.every((c) => c.intervalloY), 'stessa scala fra le curve a confronto')
  for (const c of stab) {
    for (const l of c.linee) {
      const m = l.y.reduce((a, b) => a + b, 0) / l.y.length
      assert.ok(Math.abs(m) < 1e-6, 'ogni direzione e centrata sulla propria media')
    }
  }

  // il tracciato: ovale e croce sopra la traiettoria, stessa scala fra due lati
  const tracciati = di('stabilometria').flatMap((t) => t.serie.filter((s) => s.codice === 'stabilogramma'))
  assert.ok(tracciati.every((s) => s.ellisse))
  const svg = tracciatoSvg(tracciati[0])
  assert.ok(svg.includes('<polygon') && svg.includes('<polyline'))
  assert.ok(!svg.includes('NaN'))
  const comune = Math.max(...tracciati.map(raggioTracciato))
  assert.ok(tracciatoSvg(tracciati[0], { raggio: comune }).includes('griglia'))

  for (const c of [...forzaCurve, ...salto, ...stab]) {
    const svg = curvaSvg(c)
    assert.ok(svg.startsWith('<svg') && svg.includes('<path'), c.titolo)
    assert.ok(!svg.includes('NaN') && !svg.includes('Infinity'), `${c.titolo}: nessun numero rotto`)
  }
  // una curva con un solo punto non si disegna
  assert.equal(curvaSvg({ ...forzaCurve[0], linee: [{ ...forzaCurve[0].linee[0], x: [0], y: [1] }] }), '')

  // e arrivano nei documenti
  const cartella = componiCartella(p, ['pedana']).sezioni
  assert.ok(JSON.stringify(cartella).includes('Forza durante il salto'))
  const ses = Number(
    getDb()
      .prepare(
        "INSERT INTO screening_sessioni (paziente_id, protocollo_nome, sport, data) VALUES (?, 'Prova', 'Calcio', '2026-10-02')"
      )
      .run(p).lastInsertRowid
  )
  const tutte = archivio.test.map((t) => t.id)
  const report = generaReportScreening([ses], tutte).html
  assert.ok(report.includes('Forza durante il salto') && report.includes('Oscillazione nel tempo'))
})

test('un gruppo con destro e sinistro non porta il lato nel nome', () => {
  const p = paziente('Lato', 'Nome')
  const reg = (id: string, lato: 'dx' | 'sx', nome: string) => ({
    ...forza(id, '2026-10-01', lato, [20], 'stabilometria.monopodalico.occhi_chiusi', nome)
  })
  importaTutto(
    p,
    JSON.stringify({
      formato: 'pedana-report',
      versione: 1,
      creato_il: '2026-10-01T10:00:00Z',
      app: { nome: 'x', versione: '1' },
      dispositivo: { tipo: null, modello: null, frequenza_hz: null, portata_nominale_kg: null },
      paziente: { nome_completo: 'Lato Nome', peso_corporeo_kg: null },
      registrazioni: [
        reg('a', 'sx', 'Stabilometria — Monopodalico sinistro, occhi chiusi'),
        reg('b', 'dx', 'Stabilometria — Monopodalico destro, occhi chiusi')
      ]
    })
  )
  const gruppi = riepilogoPedana(archivioPedana(p))
  assert.equal(gruppi.length, 1)
  assert.equal(gruppi[0].nome, 'Stabilometria — Monopodalico, occhi chiusi')
})

test('Il report dei soli test con pedana: singolo o a confronto, e solo del suo paziente', () => {
  const p = pazienteConPedana('Rita', 'Soloreport')
  const arch = archivioPedana(p)
  const spalla = arch.test.filter((t) => t.test_codice === 'forza.shoulder.y')

  // a confronto: due date dello stesso test
  const confronto = generaReportPedana(
    p,
    spalla.map((t) => t.id)
  )
  assert.equal(confronto.cognome, 'Soloreport')
  assert.ok(confronto.html.includes('<h3>Test con pedana</h3>'))
  assert.ok(confronto.html.includes('dal 01/09/2026 al 01/10/2026'))
  assert.ok(confronto.html.includes('<span class="data">01/09/2026</span>') && confronto.html.includes('<span class="data">01/10/2026</span>'))
  assert.ok(!confronto.html.includes('Nessun valore registrato'), 'nessuna traccia di screening')
  assert.ok(confronto.html.includes('Scarica in PDF'))

  // singolo: una data sola
  const uno = generaReportPedana(
    p,
    spalla.filter((t) => t.data === '2026-10-01').map((t) => t.id)
  )
  assert.ok(uno.html.includes('Test con pedana del 01/10/2026'))

  // gli id di un altro paziente non entrano; senza niente di valido e' un errore
  const altro = pazienteConPedana('Ugo', 'Altro2')
  const deiAltri = archivioPedana(altro).test.map((t) => t.id)
  assert.throws(() => generaReportPedana(p, deiAltri), /Nessun test/)
  assert.throws(() => generaReportPedana(p, []), /Nessun test/)
})
