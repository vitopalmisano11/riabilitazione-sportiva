// Questionari (PROM): lettura, salvataggio e calcolo di punteggi e fasce.
// Il calcolo sta qui, nel processo principale, e non nell'interfaccia: cosi' il
// risultato memorizzato e' sempre quello prodotto dalle regole configurate.
import { getDb } from './db'
import { estremiDomanda, tipoPunteggioValido, valorePunteggio } from '../shared/punteggi-questionario'
import { eliminaMancanti } from './figli'
import { validaData } from './validazione'
import type {
  CompilazioneInput,
  CompilazioneRiepilogo,
  DomandaQuestionario,
  FasciaQuestionario,
  OpzioneDomanda,
  PunteggioQuestionario,
  Questionario,
  QuestionarioCompleto,
  VariazioneCompilazione
} from '../shared/types'

export function leggiQuestionario(id: number): QuestionarioCompleto {
  const db = getDb()
  const questionario = db.prepare('SELECT * FROM questionari WHERE id = ?').get(id) as
    | Questionario
    | undefined
  if (!questionario) throw new Error('Questionario non trovato.')

  const domande = db
    .prepare('SELECT * FROM questionario_domande WHERE questionario_id = ? ORDER BY ordine, id')
    .all(id) as DomandaQuestionario[]
  const opzStmt = db.prepare(
    'SELECT id, etichetta, punteggio FROM questionario_opzioni WHERE domanda_id = ? ORDER BY ordine, id'
  )
  for (const d of domande) d.opzioni = opzStmt.all(d.id) as OpzioneDomanda[]

  const punteggi = db
    .prepare('SELECT * FROM questionario_punteggi WHERE questionario_id = ? ORDER BY ordine, id')
    .all(id) as PunteggioQuestionario[]
  const domStmt = db.prepare('SELECT domanda_id FROM punteggio_domande WHERE punteggio_id = ?')
  for (const p of punteggi) {
    p.domanda_ids = (domStmt.all(p.id) as { domanda_id: number }[]).map((r) => r.domanda_id)
  }

  const fasce = db
    .prepare('SELECT * FROM questionario_fasce WHERE questionario_id = ? ORDER BY ordine, id')
    .all(id) as FasciaQuestionario[]

  return { questionario, domande, punteggi, fasce }
}

// Salvataggio in blocco: gli elementi con id restano quelli (le compilazioni
// gia' fatte continuano a puntarci), i nuovi si inseriscono, gli spariti si
// eliminano. Tutto dentro una transazione.
export function salvaQuestionario(dati: QuestionarioCompleto): void {
  const db = getDb()
  const qid = dati.questionario.id

  db.transaction(() => {
    // Il punteggio a cui si riferisce il MCID si scrive dopo, quando i
    // punteggi sono stati salvati: se e' stato appena creato, adesso avrebbe
    // ancora un id provvisorio.
    db.prepare(
      `UPDATE questionari SET nome = ?, istruzioni = ?, mcid_punti = ?,
         mcid_percentuale = ?, mcid_migliora_calando = ?, mcid_nota = ?
       WHERE id = ?`
    ).run(
      dati.questionario.nome.trim(),
      dati.questionario.istruzioni,
      dati.questionario.mcid_punti,
      dati.questionario.mcid_percentuale,
      dati.questionario.mcid_migliora_calando ? 1 : 0,
      dati.questionario.mcid_nota,
      qid
    )

    // --- domande ---
    const idsDomande = dati.domande.map((d) => d.id).filter((x): x is number => x != null && x > 0)
    eliminaMancanti(db, 'questionario_domande', 'questionario_id', qid, idsDomande)

    const insDom = db.prepare(
      `INSERT INTO questionario_domande (questionario_id, testo, tipo, scala_min, scala_max,
                                         etichetta_min, etichetta_max, ordine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const updDom = db.prepare(
      `UPDATE questionario_domande SET testo = ?, tipo = ?, scala_min = ?, scala_max = ?,
         etichetta_min = ?, etichetta_max = ?, ordine = ?
       WHERE id = ?`
    )
    // Una domanda non ancora salvata arriva con un id negativo, assegnato
    // dall'interfaccia e stabile per tutta la sessione: qui lo si traduce nel
    // vero id. Prima si usava la posizione nell'elenco, ma bastava riordinare o
    // inserire una domanda perche' i riferimenti puntassero a quella sbagliata.
    const idDomanda = new Map<number, number>()
    const idDefinitivo: number[] = []
    dati.domande.forEach((d, i) => {
      const min = d.tipo === 'scala' ? d.scala_min : null
      const max = d.tipo === 'scala' ? d.scala_max : null
      // I nomi degli estremi valgono solo per la scala: cambiando tipo di
      // domanda non restano appesi.
      const etMin = d.tipo === 'scala' ? d.etichetta_min?.trim() || null : null
      const etMax = d.tipo === 'scala' ? d.etichetta_max?.trim() || null : null
      if (d.id == null || d.id < 0) {
        const nuovo = Number(
          insDom.run(qid, d.testo.trim(), d.tipo, min, max, etMin, etMax, i).lastInsertRowid
        )
        if (d.id != null) idDomanda.set(d.id, nuovo)
        idDefinitivo[i] = nuovo
      } else {
        updDom.run(d.testo.trim(), d.tipo, min, max, etMin, etMax, i, d.id)
        idDefinitivo[i] = d.id
      }
      // Le opzioni si riscrivono sempre: non sono citate da nessun'altra tabella.
      db.prepare('DELETE FROM questionario_opzioni WHERE domanda_id = ?').run(idDefinitivo[i])
      if (d.tipo === 'scelta') {
        const insOpz = db.prepare(
          'INSERT INTO questionario_opzioni (domanda_id, etichetta, punteggio, ordine) VALUES (?, ?, ?, ?)'
        )
        d.opzioni.forEach((o, j) => insOpz.run(idDefinitivo[i], o.etichetta.trim(), o.punteggio, j))
      }
    })

    const risolvi = (rif: number): number | null =>
      rif >= 0 ? rif : (idDomanda.get(rif) ?? null)

    // --- punteggi ---
    const idsPunteggi = dati.punteggi.map((p) => p.id).filter((x): x is number => x != null && x > 0)
    eliminaMancanti(db, 'questionario_punteggi', 'questionario_id', qid, idsPunteggi)

    const insPun = db.prepare(
      'INSERT INTO questionario_punteggi (questionario_id, nome, tipo, ordine) VALUES (?, ?, ?, ?)'
    )
    const updPun = db.prepare('UPDATE questionario_punteggi SET nome = ?, tipo = ?, ordine = ? WHERE id = ?')
    const idPunteggio = new Map<number, number>()
    dati.punteggi.forEach((p, i) => {
      // un punteggio senza tipo (scritto da chi non lo conosce) e' una somma
      const tipo = p.tipo ?? 'somma'
      if (!tipoPunteggioValido(tipo)) throw new Error(`Il punteggio «${p.nome}» ha un modo di calcolo sconosciuto.`)
      let pid: number
      if (p.id == null || p.id < 0) {
        pid = Number(insPun.run(qid, p.nome.trim(), tipo, i).lastInsertRowid)
        if (p.id != null) idPunteggio.set(p.id, pid)
      } else {
        updPun.run(p.nome.trim(), tipo, i, p.id)
        pid = p.id
      }
      db.prepare('DELETE FROM punteggio_domande WHERE punteggio_id = ?').run(pid)
      // INSERT semplice, non "OR IGNORE": se un riferimento fosse sbagliato la
      // domanda sparirebbe dal punteggio senza che nessuno se ne accorga.
      const insLeg = db.prepare(
        'INSERT INTO punteggio_domande (punteggio_id, domanda_id) VALUES (?, ?)'
      )
      const gia = new Set<number>()
      for (const rif of p.domanda_ids) {
        const did = risolvi(rif)
        if (did == null) throw new Error('Riferimento a una domanda non valido.')
        if (gia.has(did)) continue
        gia.add(did)
        insLeg.run(pid, did)
      }
    })

    // Un riferimento che non si risolve non deve diventare "nessuna condizione":
    // la fascia si avvererebbe sempre, o mai, senza che nessuno se ne accorga.
    const risolviPunteggio = (rif: number | null): number | null => {
      if (rif == null) return null
      if (rif > 0) return rif
      const id = idPunteggio.get(rif)
      if (id == null) throw new Error('Riferimento a un punteggio non valido.')
      return id
    }

    // Adesso che i punteggi hanno il loro id vero si puo' scrivere a quale si
    // riferisce il cambiamento che conta.
    const rifMcid = dati.questionario.mcid_punteggio_id
    db.prepare('UPDATE questionari SET mcid_punteggio_id = ? WHERE id = ?').run(
      rifMcid == null ? null : rifMcid >= 0 ? rifMcid : (idPunteggio.get(rifMcid) ?? null),
      qid
    )

    // --- fasce ---
    const idsFasce = dati.fasce.map((f) => f.id).filter((x): x is number => x != null && x > 0)
    eliminaMancanti(db, 'questionario_fasce', 'questionario_id', qid, idsFasce)

    const insFas = db.prepare(
      `INSERT INTO questionario_fasce
        (questionario_id, etichetta, punteggio_id, minimo, massimo, punteggio2_id, minimo2, massimo2, ordine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const updFas = db.prepare(
      `UPDATE questionario_fasce SET etichetta = ?, punteggio_id = ?, minimo = ?, massimo = ?,
        punteggio2_id = ?, minimo2 = ?, massimo2 = ?, ordine = ? WHERE id = ?`
    )
    dati.fasce.forEach((f, i) => {
      const p1 = risolviPunteggio(f.punteggio_id)
      const p2 = risolviPunteggio(f.punteggio2_id)
      if (f.id == null) {
        insFas.run(qid, f.etichetta.trim(), p1, f.minimo, f.massimo, p2, f.minimo2, f.massimo2, i)
      } else {
        updFas.run(f.etichetta.trim(), p1, f.minimo, f.massimo, p2, f.minimo2, f.massimo2, i, f.id)
      }
    })
  })()
}

// ---- Calcolo di punteggi e fascia ----

// Un punteggio calcolato: il nome com'era quel giorno (resta leggibile anche se
// il punteggio viene rinominato o tolto) e il punteggio del questionario da cui
// viene, a cui si aggancia il confronto con la prima volta.
export interface PunteggioCalcolato {
  punteggio_id: number | null
  nome: string
  valore: number
}

export interface Risultato {
  punteggi: PunteggioCalcolato[]
  fascia: string | null
}

// `definizione` si passa quando si calcolano tante compilazioni dello stesso
// questionario: si legge una volta sola.
export function calcola(
  questionarioId: number,
  risposte: { domanda_id: number; valore: number }[],
  definizione: QuestionarioCompleto = leggiQuestionario(questionarioId)
): Risultato {
  const { punteggi, fasce, domande } = definizione
  const perDomanda = new Map(risposte.map((r) => [r.domanda_id, r.valore]))
  const estremi = new Map(domande.map((d) => [d.id, estremiDomanda(d)]))

  const valori = new Map<number, number>()
  const risultato = punteggi.map((p) => {
    // le risposte date alle domande del punteggio, con gli estremi della loro
    // domanda (per la percentuale)
    const date = p.domanda_ids.flatMap((did) => {
      const v = perDomanda.get(did)
      if (v == null) return []
      const e = estremi.get(did) ?? { min: 0, max: 0 }
      return [{ valore: v, min: e.min, max: e.max }]
    })
    const valore = valorePunteggio(p.tipo ?? 'somma', date)
    if (p.id != null) valori.set(p.id, valore)
    return { punteggio_id: p.id ?? null, nome: p.nome, valore }
  })

  // Le fasce si leggono in ordine: vince la prima regola che si avvera.
  const soddisfa = (id: number | null, min: number | null, max: number | null): boolean => {
    if (id == null) return true // condizione non impostata: non vincola
    const v = valori.get(id)
    if (v == null) return false
    if (min != null && v < min) return false
    if (max != null && v > max) return false
    return true
  }
  const fascia = fasce.find(
    (f) =>
      soddisfa(f.punteggio_id, f.minimo, f.massimo) &&
      soddisfa(f.punteggio2_id, f.minimo2, f.massimo2)
  )
  return { punteggi: risultato, fascia: fascia?.etichetta ?? null }
}

// Il risultato di una compilazione si fotografa quando la si salva, come le
// sedute: punteggi e fascia restano quelli di quel giorno, calcolati con le
// regole di quel giorno, e stanno sempre insieme.
//
// Prima la fascia si ricalcolava a ogni lettura con le regole di oggi, mentre i
// punteggi restavano quelli salvati: cambiando la formula di un punteggio, lo
// storico mostrava i numeri vecchi accanto a fasce calcolate coi numeri nuovi.
// E guardare l'elenco cambiava i dati. Adesso cambiare le regole non tocca
// niente da solo: le compilazioni fatte con regole diverse si riconoscono (vedi
// daRicalcolare) e si ricalcolano quando lo si chiede.
function scriviRisultato(compilazioneId: number, r: Risultato): void {
  const db = getDb()
  db.prepare('UPDATE paziente_questionari SET fascia = ? WHERE id = ?').run(r.fascia, compilazioneId)
  db.prepare('DELETE FROM compilazione_punteggi WHERE compilazione_id = ?').run(compilazioneId)
  const ins = db.prepare(
    `INSERT INTO compilazione_punteggi (compilazione_id, punteggio_id, nome, valore, ordine)
     VALUES (?, ?, ?, ?, ?)`
  )
  r.punteggi.forEach((p, i) => ins.run(compilazioneId, p.punteggio_id, p.nome, p.valore, i))
}

function scriviRisposte(compilazioneId: number, risposte: CompilazioneInput['risposte']): void {
  const db = getDb()
  db.prepare('DELETE FROM questionario_risposte WHERE compilazione_id = ?').run(compilazioneId)
  const ins = db.prepare(
    'INSERT INTO questionario_risposte (compilazione_id, domanda_id, valore) VALUES (?, ?, ?)'
  )
  for (const r of risposte) ins.run(compilazioneId, r.domanda_id, r.valore)
}

// Il risultato salvato e' ancora quello che darebbero le regole di oggi? Si
// confrontano i numeri e la fascia, non i nomi: rinominare un punteggio non
// rende una compilazione "da ricalcolare".
function stessoRisultato(salvato: Risultato, adesso: Risultato): boolean {
  if (salvato.fascia !== adesso.fascia) return false
  if (salvato.punteggi.length !== adesso.punteggi.length) return false
  return salvato.punteggi.every((p, i) => {
    const q = adesso.punteggi[i]
    const stesso = p.punteggio_id != null ? p.punteggio_id === q.punteggio_id : p.nome === q.nome
    return stesso && p.valore === q.valore
  })
}

// Le definizioni dei questionari, lette una volta per elenco invece che una
// volta per compilazione.
function definizioni(): (id: number) => QuestionarioCompleto {
  const lette = new Map<number, QuestionarioCompleto>()
  return (id) => {
    let q = lette.get(id)
    if (!q) {
      q = leggiQuestionario(id)
      lette.set(id, q)
    }
    return q
  }
}

function risposteDi(compilazioneId: number): { domanda_id: number; valore: number }[] {
  return getDb()
    .prepare('SELECT domanda_id, valore FROM questionario_risposte WHERE compilazione_id = ?')
    .all(compilazioneId) as { domanda_id: number; valore: number }[]
}

function punteggiSalvati(compilazioneId: number): PunteggioCalcolato[] {
  return getDb()
    .prepare(
      `SELECT punteggio_id, nome, valore FROM compilazione_punteggi
       WHERE compilazione_id = ? ORDER BY ordine`
    )
    .all(compilazioneId) as PunteggioCalcolato[]
}

// Quanto e' cambiato il punteggio rispetto alla prima volta, e se il
// cambiamento e' grande abbastanza da contare.
//
// Il confronto si fa con la prima compilazione di quel questionario perche' la
// domanda clinica e' "da quando l'ho preso in carico, sta meglio davvero?".
// "Meglio" non e' sempre "meno": in un questionario di dolore o disabilita' il
// punteggio scende, in uno di funzione sale, e il questionario dice da che
// parte sta.
function variazione(
  q: {
    mcid_punteggio_id: number | null
    mcid_punti: number | null
    mcid_percentuale: number | null
    mcid_migliora_calando: number
  },
  nomePunteggio: string,
  adesso: number,
  prima: number,
  dal: string
): VariazioneCompilazione | null {
  if (q.mcid_punti == null && q.mcid_percentuale == null) return null
  const grezza = adesso - prima
  const punti = q.mcid_migliora_calando ? -grezza : grezza
  // La percentuale si legge sul punto di partenza: dieci punti presi da 60
  // sono un conto, presi da 20 un altro.
  const percentuale = prima === 0 ? 0 : Math.round((punti / Math.abs(prima)) * 1000) / 10
  const perPunti = q.mcid_punti != null && punti >= q.mcid_punti
  const perCento = q.mcid_percentuale != null && percentuale >= q.mcid_percentuale
  return {
    punteggio_nome: nomePunteggio,
    punti: Math.round(punti * 10) / 10,
    percentuale,
    significativa: perPunti || perCento,
    dal
  }
}

// Il punteggio su cui si misura il cambiamento, fra quelli salvati di una
// compilazione: per id, cosi' rinominarlo non perde il confronto. Le
// compilazioni salvate prima che si scrivesse l'id si riconoscono dal nome.
function punteggioMcid(
  salvati: PunteggioCalcolato[],
  mcidId: number,
  mcidNome: string
): PunteggioCalcolato | undefined {
  return (
    salvati.find((p) => p.punteggio_id === mcidId) ??
    salvati.find((p) => p.punteggio_id == null && p.nome === mcidNome)
  )
}

// Le compilazioni di un paziente, con il risultato salvato. Solo lettura: non
// cambia niente nel database.
export function elencoCompilazioni(pazienteId: number): CompilazioneRiepilogo[] {
  const db = getDb()
  const righe = db
    .prepare(
      `SELECT pq.id, pq.data, pq.questionario_id, pq.fascia, pq.note, q.nome AS questionario_nome,
              q.mcid_punteggio_id, q.mcid_punti, q.mcid_percentuale, q.mcid_migliora_calando
       FROM paziente_questionari pq JOIN questionari q ON q.id = pq.questionario_id
       WHERE pq.paziente_id = ?
       ORDER BY pq.data DESC, pq.id DESC`
    )
    .all(pazienteId) as {
    id: number
    data: string
    questionario_id: number
    questionario_nome: string
    fascia: string | null
    note: string | null
    mcid_punteggio_id: number | null
    mcid_punti: number | null
    mcid_percentuale: number | null
    mcid_migliora_calando: number
  }[]

  const definizione = definizioni()
  const nomePunteggio = db.prepare('SELECT nome FROM questionario_punteggi WHERE id = ?')
  // la prima compilazione di ogni questionario: le righe arrivano dalla piu'
  // recente, quindi e' l'ultima che si incontra
  const prime = new Map<number, { id: number; data: string }>()
  for (const r of righe) prime.set(r.questionario_id, { id: r.id, data: r.data })

  return righe.map((r) => {
    const { mcid_punteggio_id, mcid_punti, mcid_percentuale, mcid_migliora_calando, ...base } = r
    const punteggi = punteggiSalvati(r.id)
    const adesso = calcola(r.questionario_id, risposteDi(r.id), definizione(r.questionario_id))

    let var_: VariazioneCompilazione | null = null
    const prima = prime.get(r.questionario_id)
    const rif =
      mcid_punteggio_id == null
        ? undefined
        : (nomePunteggio.get(mcid_punteggio_id) as { nome: string } | undefined)
    if (rif && prima && prima.id !== r.id) {
      const ora = punteggioMcid(punteggi, mcid_punteggio_id!, rif.nome)
      const allora = punteggioMcid(punteggiSalvati(prima.id), mcid_punteggio_id!, rif.nome)
      if (ora && allora) {
        var_ = variazione(
          { mcid_punteggio_id, mcid_punti, mcid_percentuale, mcid_migliora_calando },
          rif.nome,
          ora.valore,
          allora.valore,
          prima.data
        )
      }
    }
    return {
      ...base,
      punteggi: punteggi.map(({ nome, valore }) => ({ nome, valore })),
      variazione: var_,
      daRicalcolare: !stessoRisultato({ punteggi, fascia: r.fascia }, adesso)
    }
  })
}

// Ricalcola una compilazione con le regole di oggi del suo questionario. Le
// risposte non cambiano: cambiano punteggi e fascia.
export function ricalcolaCompilazione(id: number): void {
  const db = getDb()
  const riga = db
    .prepare('SELECT questionario_id FROM paziente_questionari WHERE id = ?')
    .get(id) as { questionario_id: number } | undefined
  if (!riga) throw new Error('Compilazione non trovata.')
  const risultato = calcola(riga.questionario_id, risposteDi(id))
  db.transaction(() => scriviRisultato(id, risultato))()
}

// Le compilazioni di un questionario fatte con regole diverse da quelle di oggi.
function compilazioniDaRicalcolare(questionarioId: number): { id: number; adesso: Risultato }[] {
  const db = getDb()
  const definizione = leggiQuestionario(questionarioId)
  const righe = db
    .prepare('SELECT id, fascia FROM paziente_questionari WHERE questionario_id = ?')
    .all(questionarioId) as { id: number; fascia: string | null }[]
  const fuori: { id: number; adesso: Risultato }[] = []
  for (const r of righe) {
    const adesso = calcola(questionarioId, risposteDi(r.id), definizione)
    if (!stessoRisultato({ punteggi: punteggiSalvati(r.id), fascia: r.fascia }, adesso)) {
      fuori.push({ id: r.id, adesso })
    }
  }
  return fuori
}

export function contaDaRicalcolare(questionarioId: number): number {
  return compilazioniDaRicalcolare(questionarioId).length
}

// Ricalcola tutte le compilazioni del questionario che ne hanno bisogno, in una
// volta sola. Torna quante ne ha cambiate.
export function ricalcolaQuestionario(questionarioId: number): number {
  const db = getDb()
  return db.transaction(() => {
    const fuori = compilazioniDaRicalcolare(questionarioId)
    for (const { id, adesso } of fuori) scriviRisultato(id, adesso)
    return fuori.length
  })()
}

// Correzione di una compilazione gia' salvata: risposte e punteggi si
// riscrivono da zero, perche' un punteggio calcolato su risposte vecchie non
// vale piu' niente. Il questionario di partenza non cambia: per usarne un
// altro se ne compila uno nuovo.
export function aggiornaCompilazione(id: number, dati: CompilazioneInput): void {
  validaData(dati.data, 'La data della compilazione', { obbligatoria: true })
  const db = getDb()
  const riga = db
    .prepare('SELECT questionario_id FROM paziente_questionari WHERE id = ?')
    .get(id) as { questionario_id: number } | undefined
  if (!riga) throw new Error('Compilazione non trovata.')

  const risultato = calcola(riga.questionario_id, dati.risposte)
  db.transaction(() => {
    db.prepare('UPDATE paziente_questionari SET data = ?, note = ? WHERE id = ?').run(
      dati.data,
      dati.note,
      id
    )
    scriviRisposte(id, dati.risposte)
    scriviRisultato(id, risultato)
  })()
}

export function salvaCompilazione(dati: CompilazioneInput): number {
  validaData(dati.data, 'La data della compilazione', { obbligatoria: true })
  const db = getDb()
  const risultato = calcola(dati.questionario_id, dati.risposte)
  return db.transaction(() => {
    const id = Number(
      db
        .prepare(
          'INSERT INTO paziente_questionari (paziente_id, questionario_id, data, note) VALUES (?, ?, ?, ?)'
        )
        .run(dati.paziente_id, dati.questionario_id, dati.data, dati.note).lastInsertRowid
    )
    scriviRisposte(id, dati.risposte)
    scriviRisultato(id, risultato)
    return id
  })()
}
