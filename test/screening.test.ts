// Screening: protocolli, report, punteggio del cluster, tempo dall'intervento.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import assert from 'node:assert/strict'
import { getDb } from '../src/main/db'
import { avvisoPunteggio } from '../src/shared/punteggio'
import { duplicaProtocollo, leggiProtocollo, salvaProtocollo } from '../src/main/screening'
import { generaReportScreening } from '../src/main/report-screening'
import { coloriBarra, conBarra } from '../src/main/finestre'
import { calcolaPunteggio } from '../src/main/screening-punteggio'
import { writeFileSync } from 'node:fs'
import { daQuando } from '../src/renderer/src/lib'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

// Si conta in mesi e settimane, buttando via i giorni che avanzano: e' il modo
// in cui si ragiona in riabilitazione.
test('Quanto tempo e\' passato dall\'intervento', () => {
  const giorniFa = (n: number): string => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    const p = (x: number): string => String(x).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  assert.equal(daQuando(null), null)
  assert.equal(daQuando(giorniFa(3)), 'meno di una settimana')
  assert.equal(daQuando(giorniFa(7)), '1 settimana')
  // Date fisse, che non dipendono da che giorno e' oggi. Il caso che si e'
  // rotto davvero: dal 31 agosto al 7 settembre e' una settimana, ma sommando
  // i mesi a mano il 31 agosto scivolava al 1 settembre e ne mancava uno.
  assert.equal(daQuando('2026-08-31', new Date(2026, 8, 7)), '1 settimana')
  assert.equal(daQuando('2026-01-31', new Date(2026, 1, 28)), '4 settimane')
  assert.equal(daQuando('2026-03-15', new Date(2026, 8, 7)), '5 mesi e 3 settimane')
  assert.equal(daQuando('2026-09-07', new Date(2026, 8, 7)), 'meno di una settimana')
  // una data nel futuro non si conta
  assert.equal(daQuando('2026-09-08', new Date(2026, 8, 7)), null)
  // Il caso che si e' rotto davvero: appena passata la mezzanotte, con le date
  // lette come ore di Greenwich mancava sempre un giorno all'appello.
  assert.equal(daQuando(giorniFa(14)), '2 settimane')
  assert.equal(daQuando(giorniFa(20)), '2 settimane')
  // un mese e qualcosa: il mese e' quello vero del calendario, non 30 giorni.
  // Con date fisse: sottrarre "un mese" e poi "21 giorni" a oggi non da' sempre
  // tre settimane esatte, perche' i mesi hanno lunghezze diverse.
  assert.equal(daQuando('2026-07-17', new Date(2026, 8, 7)), '1 mese e 3 settimane')
  const p2 = (x: number): string => String(x).padStart(2, '0')
  // una data nel futuro non dice niente
  const domani = new Date()
  domani.setDate(domani.getDate() + 1)
  assert.equal(
    daQuando(`${domani.getFullYear()}-${p2(domani.getMonth() + 1)}-${p2(domani.getDate())}`),
    null
  )
})

test('Screening: un protocollo pesca dalla libreria, non duplica i test', () => {
  const catTest = Number(
    getDb().prepare("INSERT INTO test_categorie (nome, ordine) VALUES ('Salti', 0)").run()
      .lastInsertRowid
  )
  const tSalto = Number(
    getDb().prepare("INSERT INTO test_valutazione (nome, categoria_id) VALUES ('CMJ', ?)")
      .run(catTest).lastInsertRowid
  )
  const tHop = Number(
    getDb().prepare(
      "INSERT INTO test_valutazione (nome, categoria_id, per_lato) VALUES ('Single Hop', ?, 1)"
    ).run(catTest).lastInsertRowid
  )
  const catQ = Number(
    getDb().prepare("INSERT INTO questionario_categorie (nome, ordine) VALUES ('Ginocchio', 0)").run()
      .lastInsertRowid
  )
  const qAcl = Number(
    getDb().prepare("INSERT INTO questionari (nome, categoria_id) VALUES ('ACL-RSI', ?)").run(catQ)
      .lastInsertRowid
  )

  const protId = Number(
    getDb().prepare("INSERT INTO screening_protocolli (nome, sport) VALUES ('Off season', 'Calcio')")
      .run().lastInsertRowid
  )
  // Sezioni e voci arrivano con id negativi, come dall'interfaccia.
  salvaProtocollo({
    protocollo: {
      id: protId,
      nome: 'Off season',
      sport: 'Calcio',
      note: null,
      ordine: 0,
      archiviato: 0
    },
    sezioni: [
      {
        id: -1,
        nome: 'In ambulatorio',
        voci: [
          { id: -10, test_id: tSalto, questionario_id: null },
          { id: -11, test_id: null, questionario_id: qAcl }
        ]
      },
      { id: -2, nome: 'In campo', voci: [{ id: -12, test_id: tHop, questionario_id: null }] }
    ]
  })

  const letto = leggiProtocollo(protId)
  assert.equal(letto.sezioni.length, 2)
  // il nome della voce viene dalla libreria, non e' una copia
  assert.deepEqual(
    letto.sezioni[0].voci.map((v: { nome?: string }) => v.nome),
    ['CMJ', 'ACL-RSI']
  )
  assert.equal(letto.sezioni[1].voci[0].nome, 'Single Hop')

  // rinominando il test nella libreria, il protocollo mostra il nome nuovo
  getDb().prepare("UPDATE test_valutazione SET nome = 'CMJ bilaterale' WHERE id = ?").run(tSalto)
  assert.equal(leggiProtocollo(protId).sezioni[0].voci[0].nome, 'CMJ bilaterale')

  // togliendo una sezione, le sue voci se ne vanno con lei
  const restano = leggiProtocollo(protId)
  salvaProtocollo({ ...restano, sezioni: [restano.sezioni[0]] })
  assert.equal(leggiProtocollo(protId).sezioni.length, 1)
  assert.equal(
    (getDb().prepare('SELECT COUNT(*) AS n FROM screening_voci').get() as { n: number })
      .n,
    2
  )

  // la copia e' indipendente: le sue voci hanno id propri
  const copia = duplicaProtocollo(protId, 'Off season 2027')
  assert.notEqual(copia, protId)
  const dupl = leggiProtocollo(copia)
  assert.equal(dupl.protocollo.sport, 'Calcio')
  assert.deepEqual(
    dupl.sezioni[0].voci.map((v: { nome?: string }) => v.nome),
    ['CMJ bilaterale', 'ACL-RSI']
  )
  assert.ok(
    dupl.sezioni[0].voci.every(
      (v: { id: number | null }) => v.id !== letto.sezioni[0].voci[0].id
    )
  )

  // una voce non puo' essere insieme test e questionario, ne' nessuno dei due
  assert.throws(() =>
    getDb().prepare(
      'INSERT INTO screening_voci (sezione_id, test_id, questionario_id) VALUES (?, ?, ?)'
    ).run(dupl.sezioni[0].id, tSalto, qAcl)
  )
  assert.throws(() =>
    getDb().prepare(
      'INSERT INTO screening_voci (sezione_id, test_id, questionario_id) VALUES (?, NULL, NULL)'
    ).run(dupl.sezioni[0].id)
  )
})

// Due screening a confronto: la forza e' sotto la soglia di simmetria sul lato
// operato, la reattivita' supera la sua soglia ed e' migliorata.
test('Il riassunto scritto del report dello screening', () => {
  const db = getDb()
  const paz = Number(
    db.prepare("INSERT INTO pazienti (nome, cognome, arto_operato) VALUES ('Luca', 'Prova', 'dx')")
      .run().lastInsertRowid
  )
  const tForza = Number(
    db.prepare(
      "INSERT INTO test_valutazione (nome, prove, per_lato, lsi_cutoff, qualita) VALUES ('Dinamometro', 1, 1, 90, 'forza')"
    ).run().lastInsertRowid
  )
  const mForza = Number(
    db.prepare("INSERT INTO test_misure (test_id, nome, unita) VALUES (?, 'Picco', 'kg')")
      .run(tForza).lastInsertRowid
  )
  const tSalto = Number(
    db.prepare(
      "INSERT INTO test_valutazione (nome, prove, qualita) VALUES ('Drop jump prova', 1, 'Reattività')"
    ).run().lastInsertRowid
  )
  const mSalto = Number(
    db.prepare(
      "INSERT INTO test_misure (test_id, nome, unita, cutoff, cutoff_direzione) VALUES (?, 'Altezza', 'cm', 30, 'min')"
    ).run(tSalto).lastInsertRowid
  )
  const prot = Number(
    db.prepare("INSERT INTO screening_protocolli (nome, sport) VALUES ('RTP', 'Calcio')").run()
      .lastInsertRowid
  )
  const sez = Number(
    db.prepare("INSERT INTO screening_sezioni (protocollo_id, nome) VALUES (?, 'Ambulatorio')")
      .run(prot).lastInsertRowid
  )
  db.prepare('INSERT INTO screening_voci (sezione_id, test_id, ordine) VALUES (?, ?, 0)').run(sez, tForza)
  db.prepare('INSERT INTO screening_voci (sezione_id, test_id, ordine) VALUES (?, ?, 1)').run(sez, tSalto)
  const sessione = (data: string): number =>
    Number(
      db.prepare(
        "INSERT INTO screening_sessioni (paziente_id, protocollo_id, protocollo_nome, sport, data) VALUES (?, ?, 'RTP', 'Calcio', ?)"
      ).run(paz, prot, data).lastInsertRowid
    )
  const valore = db.prepare(
    'INSERT INTO screening_valori (sessione_id, misura_id, lato, prova, valore) VALUES (?, ?, ?, 1, ?)'
  )
  const t0 = sessione('2026-05-07')
  valore.run(t0, mForza, 'dx', 30)
  valore.run(t0, mForza, 'sx', 45)
  valore.run(t0, mSalto, null, 28)
  const t1 = sessione('2026-07-16')
  valore.run(t1, mForza, 'dx', 30)
  valore.run(t1, mForza, 'sx', 45)
  valore.run(t1, mSalto, null, 33)

  const { html } = generaReportScreening([t0, t1])
  if (process.env['RIASSUNTO_HTML']) writeFileSync(process.env['RIASSUNTO_HTML'], html)
  const riassunto = html.slice(html.indexOf('class="riassunto"'), html.indexOf('</ul></div>'))
  assert.ok(riassunto.length > 0, 'il riassunto manca')
  assert.ok(riassunto.includes('<b>Forza</b>'), 'raggruppato per qualità')
  assert.ok(riassunto.includes('sul lato operato in Dinamometro'), 'deficit sul lato operato')
  // lo stesso numero, con lo stesso decimale, della tabella del report
  assert.ok(riassunto.includes('LSI 66.7%'))
  assert.ok(riassunto.includes('<b>Reattività</b>: <span class="ok">nella norma</span>'))
  assert.ok(riassunto.includes('In miglioramento</span>: Drop jump prova – Altezza +18%'), 'miglioramento dal primo screening')
  // la variazione nella tabella sta tra parentesi, accanto al numero
  assert.ok(html.includes('(+18%)'))

  // la barra in cima alla finestra entra subito dopo <body>, col titolo
  // protetto, e in stampa non c'e'
  const conTitolo = conBarra(html, 'Report — Prova <Luca>')
  assert.ok(/<body[^>]*><div class="barra-finestra"><span class="titolo-barra">Report — Prova &lt;Luca&gt;<\/span>/.test(conTitolo))
  assert.ok(conTitolo.includes("window.finestra.comando('chiudi')"))
  assert.ok(conBarra(html, 'x', coloriBarra('blu', true, false)).includes('background: #18202b'))
  assert.ok(conBarra(html, 'x', coloriBarra('verde', false, false)).includes('background: #e6dcc9'))
  assert.ok(conTitolo.includes('@media print { .barra-finestra, .spazio-barra { display: none; } }'))
})

// Un piccolo Ankle-GO: una misura di un test a una gamba per volta, una di un
// test bilaterale e il punteggio di un questionario, con le soglie dei punti e
// le fasce del risultato. Un protocollo senza punteggio non ne mostra.
test('Il punteggio del cluster', () => {
  const db = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(db.prepare(sql).run(...a).lastInsertRowid)
  const paz = ins("INSERT INTO pazienti (nome, cognome, arto_operato) VALUES ('Punti', 'Cluster', 'dx')")
  const tHop = ins("INSERT INTO test_valutazione (nome, prove, per_lato) VALUES ('Side hop prova', 1, 1)")
  const mHop = ins(
    "INSERT INTO test_misure (test_id, nome, unita, cutoff, cutoff_direzione) VALUES (?, 'Tempo', 's', 13, 'max')",
    tHop
  )
  const tOtto = ins("INSERT INTO test_valutazione (nome, prove) VALUES ('Figure of 8 prova', 2)")
  const mOtto = ins(
    "INSERT INTO test_misure (test_id, nome, unita, per_prova, riassunto) VALUES (?, 'Tempo', 's', 1, 'peggiore')",
    tOtto
  )
  const qFaam = ins("INSERT INTO questionari (nome) VALUES ('FAAM prova')")
  const pFaam = ins("INSERT INTO questionario_punteggi (questionario_id, nome) VALUES (?, 'Totale')", qFaam)

  const prot = ins("INSERT INTO screening_protocolli (nome, sport) VALUES ('Ankle-GO prova', 'Caviglia')")
  salvaProtocollo({
    protocollo: { id: prot, nome: 'Ankle-GO prova', sport: 'Caviglia', note: null, ordine: 0, archiviato: 0 },
    sezioni: [
      {
        id: -1,
        nome: 'Test',
        voci: [
          { id: -2, test_id: tHop, questionario_id: null },
          { id: -3, test_id: tOtto, questionario_id: null },
          { id: -4, test_id: null, questionario_id: qFaam }
        ]
      }
    ],
    punteggio: {
      regole: [
        {
          id: null, misura_id: mHop, punteggio_id: null, lato: 'interessato', nome: 'Side hop – Tempo',
          soglie: [
            { minimo: null, massimo: 9.99, punti: 4 },
            { minimo: 10, massimo: 13, punti: 2 },
            { minimo: null, massimo: null, punti: 0 }
          ]
        },
        {
          id: null, misura_id: mOtto, punteggio_id: null, lato: null, nome: 'Figure of 8 – Tempo',
          soglie: [
            { minimo: null, massimo: 12.99, punti: 2 },
            { minimo: 13, massimo: 18, punti: 1 }
          ]
        },
        {
          id: null, misura_id: null, punteggio_id: pFaam, lato: null, nome: 'FAAM ADL',
          soglie: [
            { minimo: 95.01, massimo: null, punti: 2 },
            { minimo: 90, massimo: 95, punti: 1 }
          ]
        }
      ],
      fasce: [
        { etichetta: 'Recupero probabile', minimo: 7, massimo: null },
        { etichetta: 'Ritorno improbabile', minimo: 0, massimo: 6 }
      ]
    }
  })
  assert.equal(leggiProtocollo(prot).punteggio?.regole.length, 3)
  // salvando senza il punteggio, quello che c'e' resta
  salvaProtocollo({ ...leggiProtocollo(prot), punteggio: undefined })
  assert.equal(leggiProtocollo(prot).punteggio?.fasce.length, 2)
  // la copia del protocollo si porta dietro anche il punteggio
  assert.equal(leggiProtocollo(duplicaProtocollo(prot, 'Ankle-GO copia')).punteggio?.regole.length, 3)

  const sessione = ins(
    "INSERT INTO screening_sessioni (paziente_id, protocollo_id, protocollo_nome, sport, data) VALUES (?, ?, 'Ankle-GO prova', 'Caviglia', '2026-09-01')",
    paz, prot
  )
  const valore = db.prepare(
    'INSERT INTO screening_valori (sessione_id, misura_id, lato, prova, valore) VALUES (?, ?, ?, ?, ?)'
  )
  valore.run(sessione, mHop, 'dx', 1, 9.5)
  valore.run(sessione, mHop, 'sx', 1, 8)
  valore.run(sessione, mOtto, null, 1, 14)
  valore.run(sessione, mOtto, null, 2, 12.5)

  // senza il questionario il punteggio e' parziale: niente fascia
  const parziale = calcolaPunteggio(sessione)
  assert.ok(parziale && !parziale.completo && parziale.fascia == null)
  assert.equal(parziale?.totale, 6)

  const comp = ins(
    "INSERT INTO paziente_questionari (paziente_id, questionario_id, data) VALUES (?, ?, '2026-09-01')",
    paz, qFaam
  )
  ins("INSERT INTO compilazione_punteggi (compilazione_id, nome, valore, ordine) VALUES (?, 'Totale', 96, 0)", comp)
  ins(
    'INSERT INTO screening_questionari (sessione_id, questionario_id, compilazione_id) VALUES (?, ?, ?)',
    sessione, qFaam, comp
  )

  const risultato = calcolaPunteggio(sessione)
  assert.ok(risultato)
  // lato interessato destro 9,5 s → 4; la prova migliore del Figure of 8 e'
  // la piu' bassa, 12,5 s → 2; FAAM 96 → 2
  assert.deepEqual(risultato?.voci.map((v) => v.punti), [4, 2, 2])
  assert.equal(risultato?.totale, 8)
  assert.equal(risultato?.massimo, 8)
  assert.equal(risultato?.fascia, 'Recupero probabile')
  const reportPunti = generaReportScreening([sessione]).html
  assert.ok(reportPunti.includes('Punteggio: 8 / 8') && reportPunti.includes('Recupero probabile'))
  assert.equal(avvisoPunteggio(risultato!), null)
  assert.ok(risultato!.voci.every((v) => !v.fuoriFascia))

  // Un valore che cade in un buco fra le soglie (FAAM: 90–95 e da 95,01) non
  // vale zero punti in silenzio: e' "fuori dalle soglie", il totale e'
  // parziale e la fascia non si da'.
  db.prepare('UPDATE compilazione_punteggi SET valore = 85 WHERE compilazione_id = ?').run(comp)
  const buco = calcolaPunteggio(sessione)!
  assert.deepEqual(buco.voci.map((v) => v.punti), [4, 2, null])
  assert.deepEqual(buco.voci.map((v) => v.fuoriFascia), [false, false, true])
  assert.equal(buco.completo, false)
  assert.equal(buco.fascia, null)
  assert.match(avvisoPunteggio(buco)!, /FAAM ADL non rientra in nessuna soglia/)
  const reportBuco = generaReportScreening([sessione]).html
  assert.ok(reportBuco.includes('fuori dalle soglie'))
  assert.ok(reportBuco.includes('non rientra in nessuna soglia'))
  // il valore si giudica arrotondato come si vede: 95,004 si legge 95 → 1 punto
  db.prepare('UPDATE compilazione_punteggi SET valore = 95.004 WHERE compilazione_id = ?').run(comp)
  const arrotondato = calcolaPunteggio(sessione)!
  assert.equal(arrotondato.voci[2].valore, 95)
  assert.equal(arrotondato.voci[2].punti, 1)
  db.prepare('UPDATE compilazione_punteggi SET valore = 96 WHERE compilazione_id = ?').run(comp)

  // il punteggio del questionario si ritrova per id: rinominarlo non lo perde
  db.prepare('UPDATE compilazione_punteggi SET punteggio_id = ? WHERE compilazione_id = ?').run(pFaam, comp)
  db.prepare("UPDATE questionario_punteggi SET nome = 'Totale ADL' WHERE id = ?").run(pFaam)
  assert.equal(calcolaPunteggio(sessione)!.voci[2].punti, 2)
  db.prepare("UPDATE questionario_punteggi SET nome = 'Totale' WHERE id = ?").run(pFaam)

  // un totale completo che non cade in nessuna fascia si dice
  assert.match(
    avvisoPunteggio({ ...risultato!, fascia: null, fasciaMancante: true })!,
    /non rientra in nessuna fascia/
  )

  // un protocollo senza punteggio non ne mostra
  const protSenza = ins("INSERT INTO screening_protocolli (nome, sport) VALUES ('Senza punti', 'Calcio')")
  const sessioneSenza = ins(
    "INSERT INTO screening_sessioni (paziente_id, protocollo_id, protocollo_nome, sport, data) VALUES (?, ?, 'Senza punti', 'Calcio', '2026-09-02')",
    paz, protSenza
  )
  assert.equal(calcolaPunteggio(sessioneSenza), null)
  assert.ok(!generaReportScreening([sessioneSenza]).html.includes('class="punteggio"'))
})
