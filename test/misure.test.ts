// Misure e soglie: verso della misura, LSI, soglie e fasce, misure calcolate.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import { etaInAnni } from '../src/shared/eta'
import assert from 'node:assert/strict'
import { getDb } from '../src/main/db'
import { leggiTest, salvaTest } from '../src/main/test-valutazione'
import { esito, lsi, riassumi, superaSoglia, valoreDi } from '../src/shared/misure'
import { controllaIntervalli, frasiControllo, unitaDiTempo } from '../src/shared/soglie'
import { generaReportScreening } from '../src/main/report-screening'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

test('Soglie e fasce: i buchi, le soglie che non si avverano, quelle al contrario', () => {
  // 0-89 e 90-100: l'89,5 non cade da nessuna parte (percentuali, un decimale)
  assert.deepEqual(
    controllaIntervalli([{ minimo: null, massimo: 89 }, { minimo: 90, massimo: 100 }], 1).buchi,
    ['i valori da 89,1 a 89,9', 'i valori sopra 100']
  )
  // 9,99 e 10 si toccano: con due decimali non c'e' un valore in mezzo
  assert.deepEqual(
    controllaIntervalli(
      [{ minimo: null, massimo: 9.99 }, { minimo: 10, massimo: 13 }, { minimo: 13.01, massimo: null }],
      2
    ).buchi,
    []
  )
  // un'estremita' lasciata aperta e' un buco: sotto 90 non si avvera niente
  assert.deepEqual(
    controllaIntervalli([{ minimo: 95.01, massimo: null }, { minimo: 90, massimo: 95 }], 2).buchi,
    ['i valori sotto 90']
  )
  // un buco di un valore solo
  assert.deepEqual(
    controllaIntervalli([{ minimo: null, massimo: 5 }, { minimo: 7, massimo: null }], 0).buchi,
    ['il valore 6']
  )
  // una soglia gia' coperta da quelle sopra non si avvera mai
  const coperta = controllaIntervalli([{ minimo: null, massimo: null }, { minimo: 0, massimo: 10 }], 2)
  assert.deepEqual(coperta.maiAvverate, [1])
  assert.deepEqual(coperta.buchi, [])
  assert.deepEqual(controllaIntervalli([{ minimo: 0, massimo: 10 }, { minimo: 5, massimo: 20 }], 2).maiAvverate, [])
  // scritta al contrario
  const alContrario = controllaIntervalli([{ minimo: 10, massimo: 5 }], 2)
  assert.deepEqual(alContrario.invertite, [0])
  assert.deepEqual(alContrario.buchi, ['tutti i valori'])
  // nessuna soglia: tutto fuori
  assert.deepEqual(controllaIntervalli([], 2).buchi, ['tutti i valori'])
  // le fasce di un totale: non scende sotto 0 ne' supera il massimo
  const fasce = [{ minimo: 7, massimo: null }, { minimo: 0, massimo: 6 }]
  assert.deepEqual(controllaIntervalli(fasce, 0, { da: 0 }).buchi, [])
  assert.deepEqual(controllaIntervalli(fasce, 0).buchi, ['i valori sotto 0'])
  assert.deepEqual(
    controllaIntervalli([{ minimo: 0, massimo: 6 }, { minimo: 7, massimo: 10 }], 0, { da: 0, a: 10 }).buchi,
    []
  )
  assert.deepEqual(
    controllaIntervalli([{ minimo: 0, massimo: 6 }, { minimo: 8, massimo: 10 }], 0, { da: 0, a: 10 }).buchi,
    ['il valore 7']
  )
  // le frasi
  assert.deepEqual(frasiControllo(controllaIntervalli([{ minimo: 0, massimo: 10 }], 0, { da: 0, a: 10 }), 'x'), [])
  assert.match(
    frasiControllo(controllaIntervalli([{ minimo: null, massimo: 89 }, { minimo: 90, massimo: null }], 1), 'resta fuori')[0],
    /Nessuna riga comprende i valori da 89,1 a 89,9: resta fuori\./
  )
  assert.match(
    frasiControllo(controllaIntervalli([{ minimo: null, massimo: null }, { minimo: 0, massimo: 1 }], 1), 'x')[0],
    /La riga 2 non si avvera mai/
  )
  // le unita' di tempo
  for (const u of ['s', 'sec', 'Secondi', ' ms ', 'min']) assert.equal(unitaDiTempo(u), true, u)
  for (const u of ['cm', 'kg', '%', 'N', null, '']) assert.equal(unitaDiTempo(u as string | null), false, String(u))
})

// Prima "migliore" era sempre il valore piu' alto e l'LSI sempre operato ÷
// sano: in un test a tempo si prendeva il tempo piu' lento, e un lato operato
// piu' lento dava un LSI sopra il 100%, cioe' "superato".
test('Misure dove meno e\' meglio (i tempi): prova migliore e LSI nel verso giusto', () => {
  assert.equal(riassumi([2.4, 2.2], 'migliore', 'max'), 2.2)
  assert.equal(riassumi([2.4, 2.2], 'peggiore', 'max'), 2.4)
  assert.equal(riassumi([30, 34], 'migliore', 'min'), 34)
  assert.equal(riassumi([30, 34], 'migliore', null), 34)
  // operato (dx) piu' lento del sano: deficit, sotto il 100%
  assert.equal(Math.round(lsi(2.2, 2.0, 'dx', 'max')! * 10) / 10, 90.9)
  assert.equal(Math.round(lsi(30, 40, 'dx', 'min')! * 10) / 10, 75)
  // senza lato operato: il rapporto minore ÷ maggiore, in tutte e due le direzioni
  assert.equal(lsi(2.0, 2.5, null, 'max'), 80)
  assert.equal(lsi(2.0, 2.5, null, 'min'), 80)
  // la soglia si giudica sul numero come si vede (LSI con un decimale)
  assert.equal(esito(89.96, 90), true) // si legge 90,0%
  assert.equal(esito(89.94, 90), false) // si legge 89,9%
  assert.equal(esito(null, 90), null)
  assert.equal(esito(85, null), null)
  // una misura con la soglia: al massimo 2,15 s, con due decimali
  assert.equal(superaSoglia(2.154, 2.15, 'max', 2), true)
  assert.equal(superaSoglia(2.156, 2.15, 'max', 2), false)
  assert.equal(superaSoglia(29.996, 30, 'min', 2), true)

  // Nel report: hop a tempo con il lato operato piu' lento
  const db = getDb()
  const paz = Number(
    db.prepare("INSERT INTO pazienti (nome, cognome, arto_operato) VALUES ('Tempo', 'Prova', 'dx')")
      .run().lastInsertRowid
  )
  const tHop = Number(
    db.prepare(
      "INSERT INTO test_valutazione (nome, prove, per_lato, lsi_cutoff, qualita) VALUES ('Hop a tempo', 2, 1, 90, 'Velocità')"
    ).run().lastInsertRowid
  )
  // nessuna soglia sulla misura: il verso c'e' lo stesso
  const mTempo = Number(
    db.prepare(
      "INSERT INTO test_misure (test_id, nome, unita, riassunto, cutoff_direzione) VALUES (?, 'Tempo', 's', 'migliore', 'max')"
    ).run(tHop).lastInsertRowid
  )
  const prot = Number(
    db.prepare("INSERT INTO screening_protocolli (nome, sport) VALUES ('RTP tempi', 'Calcio')").run()
      .lastInsertRowid
  )
  const sez = Number(
    db.prepare("INSERT INTO screening_sezioni (protocollo_id, nome) VALUES (?, 'Campo')")
      .run(prot).lastInsertRowid
  )
  db.prepare('INSERT INTO screening_voci (sezione_id, test_id, ordine) VALUES (?, ?, 0)').run(sez, tHop)
  const ses = Number(
    db.prepare(
      "INSERT INTO screening_sessioni (paziente_id, protocollo_id, protocollo_nome, sport, data) VALUES (?, ?, 'RTP tempi', 'Calcio', '2026-08-01')"
    ).run(paz, prot).lastInsertRowid
  )
  const v = db.prepare(
    'INSERT INTO screening_valori (sessione_id, misura_id, lato, prova, valore) VALUES (?, ?, ?, ?, ?)'
  )
  v.run(ses, mTempo, 'dx', 1, 2.5)
  v.run(ses, mTempo, 'dx', 2, 2.4) // migliore a destra: 2,4 (non 2,5)
  v.run(ses, mTempo, 'sx', 1, 2.0) // migliore a sinistra: 2,0
  v.run(ses, mTempo, 'sx', 2, 2.1)
  const { html } = generaReportScreening([ses])
  const riassunto = html.slice(html.indexOf('class="riassunto"'), html.indexOf('</ul></div>'))
  // LSI = sano ÷ operato = 2,0 ÷ 2,4 = 83,3%: sotto la soglia, deficit sul lato operato
  assert.ok(
    riassunto.includes('sul lato operato in Hop a tempo – Tempo (LSI 83.3%, soglia 90%)'),
    riassunto
  )
  assert.ok(!html.includes('<span class="ok">superato</span>'), 'un lato operato piu’ lento non supera')
})

test('Il verso della misura si salva anche senza soglia', () => {
  const db = getDb()
  const t = Number(
    db.prepare("INSERT INTO test_valutazione (nome, prove) VALUES ('Verso prova', 1)").run().lastInsertRowid
  )
  const base = leggiTest(t)
  salvaTest({
    ...base,
    misure: [
      {
        id: null, nome: 'Tempo', unita: 's', per_prova: 1, riassunto: 'migliore', calcolo: null,
        calcolo_a: null, calcolo_b: null, riferimento: null, cutoff: null, cutoff_direzione: 'max'
      } as never
    ]
  })
  assert.equal(leggiTest(t).misure[0].cutoff_direzione, 'max')
  assert.equal(leggiTest(t).misure[0].cutoff, null)
})

test('Misure calcolate: niente giri chiusi', () => {
  const db = getDb()
  const t = Number(
    db.prepare("INSERT INTO test_valutazione (nome, prove) VALUES ('Salto prova', 1)").run().lastInsertRowid
  )
  const m = (id: number | null, nome: string, extra: object = {}): never =>
    ({
      id, nome, unita: null, per_prova: 1, riassunto: 'migliore', calcolo: null, calcolo_a: null,
      calcolo_b: null, riferimento: null, cutoff: null, cutoff_direzione: null, ...extra
    }) as never
  const leggi = (): ReturnType<typeof leggiTest> => leggiTest(t)
  salvaTest({ ...leggi(), misure: [m(null, 'CMJ'), m(null, 'SJ')] })
  const [cmj, sj] = leggi().misure
  // un rapporto fra due misure registrate si salva e si legge
  salvaTest({
    ...leggi(),
    misure: [cmj, sj, m(null, 'EUR', { calcolo: 'rapporto', calcolo_a: cmj.id, calcolo_b: sj.id })]
  })
  const eur = leggi().misure.find((x) => x.nome === 'EUR')
  assert.equal(eur?.calcolo_a, cmj.id)
  const valori = [
    { misura_id: cmj.id as number, lato: null, prova: 1, valore: 30 },
    { misura_id: sj.id as number, lato: null, prova: 1, valore: 20 }
  ]
  assert.equal(valoreDi(valori, eur!, leggi().misure, null), 1.5)
  // una calcolata come fonte di un'altra: errore chiaro, niente e' cambiato
  assert.throws(
    () =>
      salvaTest({
        ...leggi(),
        misure: [
          cmj,
          sj,
          eur!,
          m(null, 'Doppia', { calcolo: 'differenza', calcolo_a: eur!.id, calcolo_b: sj.id })
        ]
      }),
    /a sua volta è calcolata/
  )
  assert.equal(leggi().misure.length, 3)
  // due misure che si citano a vicenda (scritte prima di questo controllo):
  // la lettura si ferma invece di girare senza fine
  const a = { ...cmj, calcolo: 'rapporto' as const, calcolo_a: sj.id, calcolo_b: sj.id }
  const b = { ...sj, calcolo: 'rapporto' as const, calcolo_a: cmj.id, calcolo_b: cmj.id }
  assert.equal(valoreDi(valori, a, [a, b], null), null)
})

// Si calcola sul giorno di calendario, uguale ovunque.
test("Eta': il giorno del compleanno", () => {
  assert.equal(etaInAnni('1990-05-10', new Date(2026, 4, 9)), 35) // il giorno prima del compleanno
  assert.equal(etaInAnni('1990-05-10', new Date(2026, 4, 10)), 36) // il giorno stesso
  assert.equal(etaInAnni('1990-05-10T00:00:00', new Date(2026, 4, 10)), 36)
  assert.equal(etaInAnni(null), null)
  assert.equal(etaInAnni('non una data'), null)
  assert.equal(etaInAnni('2999-01-01'), null) // nato nel futuro: nessuna eta'
})
