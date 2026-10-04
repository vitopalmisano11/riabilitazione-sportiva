// Questionari: punteggi, fasce, cambiamento che conta, ricalcolo.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import assert from 'node:assert/strict'
import { getDb } from '../src/main/db'
import { esito } from '../src/shared/misure'
import {
  aggiornaCompilazione,
  contaDaRicalcolare,
  elencoCompilazioni,
  leggiQuestionario,
  calcola,
  ricalcolaCompilazione,
  ricalcolaQuestionario,
  salvaCompilazione,
  salvaQuestionario
} from '../src/main/questionari'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

// Nove domande si/no (la nona vale 1 sopra una certa risposta), un punteggio
// Totale su tutte e un Sub sulle ultime cinque, tre fasce lette in ordine.
test('Questionari: punteggi e fasce sul caso a due punteggi', () => {
  const catId = Number(
    getDb()
      .prepare("INSERT INTO questionario_categorie (nome, ordine) VALUES ('Rachide', 0)")
      .run().lastInsertRowid
  )
  const qId = Number(
    getDb()
      .prepare("INSERT INTO questionari (nome, categoria_id, ordine) VALUES ('Prova', ?, 0)")
      .run(catId).lastInsertRowid
  )
  // Le domande non ancora salvate hanno un id negativo, assegnato
  // dall'interfaccia. Qui si passano in ordine sparso apposta: i riferimenti
  // devono seguire l'id, non la posizione nell'elenco (era il difetto per cui
  // un punteggio poteva risultare vuoto dopo un riordino).
  const domande = Array.from({ length: 9 }, (_, i) => ({
    id: -(i + 1),
    testo: `Domanda ${i + 1}`,
    tipo: 'si_no' as const,
    scala_min: null,
    scala_max: null,
    etichetta_min: null,
    etichetta_max: null,
    opzioni: []
  }))
  const mescolate = [...domande.slice(4), ...domande.slice(0, 4)]
  salvaQuestionario({
    questionario: {
      id: qId,
      categoria_id: catId,
      nome: 'Prova',
      istruzioni: null,
      ordine: 0,
      archiviato: 0,
      // Il cambiamento che conta: cinque punti in meno sul totale.
      mcid_punteggio_id: -101,
      mcid_punti: 5,
      mcid_percentuale: null,
      mcid_migliora_calando: 1,
      mcid_nota: null
    },
    domande: mescolate,
    // I punteggi arrivano con id negativi, come quelli appena creati
    // nell'interfaccia: le fasce li citano cosi', e il salvataggio deve
    // tradurli nei veri id. Se non lo facesse, la fascia resterebbe agganciata
    // a un punteggio inesistente e l'esito sarebbe sempre vuoto.
    punteggi: [
      { id: -101, nome: 'Totale', domanda_ids: domande.map((d) => d.id) },
      { id: -102, nome: 'Sub', domanda_ids: [-5, -6, -7, -8, -9] }
    ],
    fasce: [
      { id: null, etichetta: 'Basso', punteggio_id: -101, minimo: null, massimo: 3,
        punteggio2_id: null, minimo2: null, massimo2: null },
      { id: null, etichetta: 'Alto', punteggio_id: -101, minimo: 4, massimo: null,
        punteggio2_id: -102, minimo2: 4, massimo2: null },
      { id: null, etichetta: 'Medio', punteggio_id: -101, minimo: 4, massimo: null,
        punteggio2_id: null, minimo2: null, massimo2: null }
    ]
  })

  // Il "Totale" deve contenere tutte e nove le domande, non un sottoinsieme:
  // e' esattamente cio' che si rompeva prima, in silenzio.
  const perNome = (nome: string): number =>
    (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM punteggio_domande pd
           JOIN questionario_punteggi p ON p.id = pd.punteggio_id
           WHERE p.questionario_id = ? AND p.nome = ?`
        )
        .get(qId, nome) as { n: number }
    ).n
  assert.equal(perNome('Totale'), 9)
  assert.equal(perNome('Sub'), 5)

  const salvato = getDb()
    .prepare('SELECT id, testo FROM questionario_domande WHERE questionario_id = ?')
    .all(qId) as { id: number; testo: string }[]
  assert.equal(salvato.length, 9)
  // si risponde "si" alle domande indicate per numero, qualunque sia il loro ordine
  const rispondi = (uni: number[]): { domanda_id: number; valore: number }[] =>
    salvato.map((d) => ({
      domanda_id: d.id,
      valore: uni.includes(Number(d.testo.replace('Domanda ', ''))) ? 1 : 0
    }))

  // due sole risposte affermative -> totale 2 -> fascia bassa
  const nomiValori = (p: { nome: string; valore: number }[]): { nome: string; valore: number }[] =>
    p.map(({ nome, valore }) => ({ nome, valore }))
  let esito = calcola(qId, rispondi([1, 2]))
  assert.deepEqual(nomiValori(esito.punteggi), [
    { nome: 'Totale', valore: 2 },
    { nome: 'Sub', valore: 0 }
  ])
  // ogni punteggio sa da quale punteggio del questionario viene
  assert.ok(esito.punteggi.every((p) => typeof p.punteggio_id === 'number'))
  assert.equal(esito.fascia, 'Basso')

  // totale 5 ma sub 1: la regola "Alto" non si avvera, vince "Medio"
  esito = calcola(qId, rispondi([1, 2, 3, 4, 5]))
  assert.equal(esito.fascia, 'Medio')

  // totale 5 e sub 5: vince "Alto", che viene prima di "Medio"
  esito = calcola(qId, rispondi([5, 6, 7, 8, 9]))
  assert.deepEqual(nomiValori(esito.punteggi), [
    { nome: 'Totale', valore: 5 },
    { nome: 'Sub', valore: 5 }
  ])
  assert.equal(esito.fascia, 'Alto')

  // Le fasce salvate devono puntare a punteggi che esistono davvero: un
  // riferimento rimasto negativo o a zero non si avvererebbe mai.
  const riferimenti = getDb()
    .prepare(
      `SELECT f.punteggio_id AS p1, f.punteggio2_id AS p2 FROM questionario_fasce f
       WHERE f.questionario_id = ?`
    )
    .all(qId) as { p1: number | null; p2: number | null }[]
  assert.equal(riferimenti.length, 3)
  const idPunteggi = new Set(
    (
      getDb()
        .prepare('SELECT id FROM questionario_punteggi WHERE questionario_id = ?')
        .all(qId) as { id: number }[]
    ).map((r) => r.id)
  )
  for (const r of riferimenti) {
    if (r.p1 != null) assert.ok(idPunteggi.has(r.p1), 'fascia agganciata a un punteggio inesistente')
    if (r.p2 != null) assert.ok(idPunteggi.has(r.p2), 'fascia agganciata a un punteggio inesistente')
  }

  // Correzione di una compilazione gia' salvata: punteggi e fascia devono
  // essere ricalcolati sulle risposte nuove, non restare quelli di prima.
  const pazQ = Number(
    getDb().prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Test', 'Questionario')")
      .run().lastInsertRowid
  )
  const compId = salvaCompilazione({
    paziente_id: pazQ,
    questionario_id: qId,
    data: '2026-09-01',
    note: 'prima stesura',
    risposte: rispondi([1, 2])
  })
  assert.throws(
    () => salvaCompilazione({ paziente_id: pazQ, questionario_id: qId, data: '', note: null, risposte: rispondi([1, 2]) }),
    /Manca la data|non è una data valida/
  )
  const leggi = (): { fascia: string | null; note: string | null; data: string } =>
    getDb().prepare('SELECT fascia, note, data FROM paziente_questionari WHERE id = ?')
      .get(compId) as { fascia: string | null; note: string | null; data: string }
  const punteggiDi = (): { nome: string; valore: number }[] =>
    getDb()
      .prepare(
        'SELECT nome, valore FROM compilazione_punteggi WHERE compilazione_id = ? ORDER BY ordine'
      )
      .all(compId) as { nome: string; valore: number }[]
  assert.equal(leggi().fascia, 'Basso')
  assert.deepEqual(punteggiDi(), [
    { nome: 'Totale', valore: 2 },
    { nome: 'Sub', valore: 0 }
  ])

  aggiornaCompilazione(compId, {
    paziente_id: pazQ,
    questionario_id: qId,
    data: '2026-09-02',
    note: 'corretta',
    risposte: rispondi([5, 6, 7, 8, 9])
  })
  assert.equal(leggi().fascia, 'Alto')
  assert.equal(leggi().note, 'corretta')
  assert.equal(leggi().data, '2026-09-02')
  assert.deepEqual(punteggiDi(), [
    { nome: 'Totale', valore: 5 },
    { nome: 'Sub', valore: 5 }
  ])
  // le risposte vecchie non devono restare accanto a quelle nuove
  const nRisposte = (
    getDb()
      .prepare('SELECT COUNT(*) AS n FROM questionario_risposte WHERE compilazione_id = ?')
      .get(compId) as { n: number }
  ).n
  assert.equal(nRisposte, 9)
  assert.throws(() => aggiornaCompilazione(999999, {
    paziente_id: pazQ,
    questionario_id: qId,
    data: '2026-09-02',
    note: null,
    risposte: []
  }), /non trovata/)

  // Una fascia definita DOPO: le compilazioni gia' fatte restano com'erano
  // (punteggi e fascia sono una fotografia del giorno), ma si riconoscono come
  // "da ricalcolare" e si ricalcolano quando lo si chiede. Leggere l'elenco non
  // cambia niente nel database.
  const qTardi = Number(
    getDb()
      .prepare('INSERT INTO questionari (categoria_id, nome, ordine) VALUES (?, ?, 1)')
      .run(catId, 'Scala definita a meta').lastInsertRowid
  )
  const senzaFasce = {
    questionario: {
      id: qTardi,
      categoria_id: catId,
      nome: 'Scala definita a meta',
      istruzioni: null,
      ordine: 1,
      archiviato: 0 as const,
      // Questo questionario il cambiamento che conta non ce l'ha: e' il caso
      // normale, e non deve comparire nessun confronto.
      mcid_punteggio_id: null,
      mcid_punti: null,
      mcid_percentuale: null,
      mcid_migliora_calando: 1 as const,
      mcid_nota: null
    },
    domande: [
      {
        id: -1,
        testo: 'Unica domanda',
        tipo: 'si_no' as const,
        scala_min: null,
        scala_max: null,
        etichetta_min: null,
        etichetta_max: null,
        opzioni: []
      }
    ],
    punteggi: [{ id: -101, nome: 'Totale', domanda_ids: [-1] }],
    fasce: []
  }
  salvaQuestionario(senzaFasce)
  const domandaTardi = (
    getDb()
      .prepare('SELECT id FROM questionario_domande WHERE questionario_id = ?')
      .get(qTardi) as { id: number }
  ).id
  const compSenza = salvaCompilazione({
    paziente_id: pazQ,
    questionario_id: qTardi,
    data: '2026-09-03',
    note: null,
    risposte: [{ domanda_id: domandaTardi, valore: 1 }]
  })
  const fasciaSalvata = (): string | null =>
    (
      getDb().prepare('SELECT fascia FROM paziente_questionari WHERE id = ?').get(compSenza) as {
        fascia: string | null
      }
    ).fascia
  assert.equal(fasciaSalvata(), null)

  // ora si definisce la fascia, come fa chi sistema il questionario dopo averlo
  // gia' somministrato
  const letto = leggiQuestionario(qTardi)
  salvaQuestionario({
    ...letto,
    fasce: [
      {
        id: null,
        etichetta: 'Presente',
        punteggio_id: letto.punteggi[0].id,
        minimo: 1,
        massimo: null,
        punteggio2_id: null,
        minimo2: null,
        massimo2: null
      }
    ]
  })
  const primaDelRicalcolo = elencoCompilazioni(pazQ).find((x) => x.id === compSenza)!
  assert.equal(primaDelRicalcolo.fascia, null, 'la fascia di quel giorno non c’era')
  assert.equal(primaDelRicalcolo.daRicalcolare, true)
  assert.equal(fasciaSalvata(), null, 'leggere l’elenco non scrive niente')
  assert.equal(contaDaRicalcolare(qTardi), 1)
  assert.equal(ricalcolaQuestionario(qTardi), 1)
  assert.equal(contaDaRicalcolare(qTardi), 0)
  const elenco = elencoCompilazioni(pazQ)
  assert.equal(elenco.find((x) => x.id === compSenza)?.fascia, 'Presente')
  assert.equal(elenco.find((x) => x.id === compSenza)?.daRicalcolare, false)
  // Il questionario senza soglia non dice niente sul cambiamento.
  assert.equal(elenco.find((x) => x.id === compSenza)?.variazione, null)

  // --- Il cambiamento che conta ---
  // "Prova" ha la soglia a 5 punti in meno sul Totale. La prima compilazione
  // (2026-09-01, poi corretta al 02 con Totale 5) fa da riferimento: non ha un
  // confronto, le altre si misurano su di lei.
  {
    const prima = elencoCompilazioni(pazQ).find((x) => (x as { id: number }).id === compId) as {
      variazione: unknown
    }
    assert.equal(prima.variazione, null, 'la prima compilazione non si confronta con se stessa')

    // Sei risposte in meno: Totale da 5 a 0, cinque punti guadagnati, e siccome
    // qui si migliora calando il numero e' positivo.
    const dopo = salvaCompilazione({
      paziente_id: pazQ,
      questionario_id: qId,
      data: '2026-09-20',
      note: null,
      risposte: rispondi([])
    })
    const conVar = elencoCompilazioni(pazQ).find(
      (x) => (x as { id: number }).id === dopo
    ) as {
      variazione: { punti: number; percentuale: number; significativa: boolean; dal: string }
    }
    assert.equal(conVar.variazione.punti, 5)
    assert.equal(conVar.variazione.percentuale, 100)
    assert.equal(conVar.variazione.dal, '2026-09-02')
    assert.ok(conVar.variazione.significativa, 'cinque punti raggiungono la soglia')

    // Un peggioramento: il punteggio sale, il cambiamento e' negativo e non
    // conta come miglioramento.
    const peggio = salvaCompilazione({
      paziente_id: pazQ,
      questionario_id: qId,
      data: '2026-09-25',
      note: null,
      risposte: rispondi([1, 2, 3, 4, 5, 6, 7])
    })
    const conPeggio = elencoCompilazioni(pazQ).find(
      (x) => (x as { id: number }).id === peggio
    ) as { variazione: { punti: number; significativa: boolean } }
    assert.ok(conPeggio.variazione.punti < 0, 'peggiorando il numero e negativo')
    assert.equal(conPeggio.variazione.significativa, false)
  }
  // il valore ricalcolato resta scritto: anche la cartella stampata lo legge da li'
  assert.equal(fasciaSalvata(), 'Presente')

  // --- Rinominare un punteggio non perde il confronto con la prima volta ---
  {
    const conVariazione = (): number =>
      elencoCompilazioni(pazQ).filter((x) => x.questionario_id === qId && x.variazione != null).length
    const prima = conVariazione()
    assert.ok(prima > 0)
    const def = leggiQuestionario(qId)
    salvaQuestionario({
      ...def,
      punteggi: def.punteggi.map((p) => (p.nome === 'Totale' ? { ...p, nome: 'Totale ODI' } : p))
    })
    assert.equal(conVariazione(), prima, 'il confronto si aggancia all’id, non al nome')
    // il nome e' cambiato, i numeri no: niente da ricalcolare
    assert.equal(contaDaRicalcolare(qId), 0)
    // il punteggio salvato si chiama ancora come quel giorno
    const salvati = elencoCompilazioni(pazQ).find((x) => x.id === compId)!.punteggi
    assert.ok(salvati.some((p) => p.nome === 'Totale'))

    // Cambia la formula: "Sub" perde una domanda. Le compilazioni con una
    // risposta su quella domanda diventano "da ricalcolare", e restano con i
    // numeri di allora finche' non lo si chiede.
    const def2 = leggiQuestionario(qId)
    const sub = def2.punteggi.find((p) => p.nome === 'Sub')!
    salvaQuestionario({
      ...def2,
      punteggi: def2.punteggi.map((p) =>
        p.id === sub.id ? { ...p, domanda_ids: p.domanda_ids.slice(1) } : p
      )
    })
    const daFare = contaDaRicalcolare(qId)
    assert.ok(daFare > 0, 'una formula cambiata si vede')
    const vecchio = elencoCompilazioni(pazQ).find((x) => x.id === compId)!
    assert.equal(vecchio.daRicalcolare, true)
    const subPrima = vecchio.punteggi.find((p) => p.nome === 'Sub')!.valore
    ricalcolaCompilazione(compId)
    const nuovo = elencoCompilazioni(pazQ).find((x) => x.id === compId)!
    assert.equal(nuovo.daRicalcolare, false)
    assert.equal(nuovo.punteggi.find((p) => p.nome === 'Sub')!.valore, subPrima - 1)
    assert.equal(contaDaRicalcolare(qId), daFare - 1)
    assert.equal(ricalcolaQuestionario(qId), daFare - 1)
    assert.equal(contaDaRicalcolare(qId), 0)
    assert.throws(() => ricalcolaCompilazione(999999), /non trovata/)
  }
})
