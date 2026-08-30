// Questionari (PROM): lettura, salvataggio e calcolo di punteggi e fasce.
// Il calcolo sta qui, nel processo principale, e non nell'interfaccia: cosi' il
// risultato memorizzato e' sempre quello prodotto dalle regole configurate.
import { getDb } from './db'
import type {
  CompilazioneInput,
  DomandaQuestionario,
  FasciaQuestionario,
  OpzioneDomanda,
  PunteggioQuestionario,
  Questionario,
  QuestionarioCompleto
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
    db.prepare('UPDATE questionari SET nome = ?, istruzioni = ? WHERE id = ?').run(
      dati.questionario.nome.trim(),
      dati.questionario.istruzioni,
      qid
    )

    // --- domande ---
    const idsDomande = dati.domande.map((d) => d.id).filter((x): x is number => x != null && x > 0)
    eliminaMancanti(db, 'questionario_domande', 'questionario_id', qid, idsDomande)

    const insDom = db.prepare(
      `INSERT INTO questionario_domande (questionario_id, testo, tipo, scala_min, scala_max, ordine)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    const updDom = db.prepare(
      `UPDATE questionario_domande SET testo = ?, tipo = ?, scala_min = ?, scala_max = ?, ordine = ?
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
      if (d.id == null || d.id < 0) {
        const nuovo = Number(insDom.run(qid, d.testo.trim(), d.tipo, min, max, i).lastInsertRowid)
        if (d.id != null) idDomanda.set(d.id, nuovo)
        idDefinitivo[i] = nuovo
      } else {
        updDom.run(d.testo.trim(), d.tipo, min, max, i, d.id)
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
      'INSERT INTO questionario_punteggi (questionario_id, nome, ordine) VALUES (?, ?, ?)'
    )
    const updPun = db.prepare('UPDATE questionario_punteggi SET nome = ?, ordine = ? WHERE id = ?')
    const idPunteggio = new Map<number, number>()
    dati.punteggi.forEach((p, i) => {
      let pid: number
      if (p.id == null || p.id < 0) {
        pid = Number(insPun.run(qid, p.nome.trim(), i).lastInsertRowid)
        if (p.id != null) idPunteggio.set(p.id, pid)
      } else {
        updPun.run(p.nome.trim(), i, p.id)
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

    const risolviPunteggio = (rif: number | null): number | null =>
      rif == null ? null : rif >= 0 ? rif : (idPunteggio.get(rif) ?? null)

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

function eliminaMancanti(
  db: ReturnType<typeof getDb>,
  tabella: string,
  colonnaPadre: string,
  padreId: number,
  daTenere: number[]
): void {
  const segnaposto = daTenere.map(() => '?').join(', ')
  const dove = daTenere.length > 0 ? ` AND id NOT IN (${segnaposto})` : ''
  db.prepare(`DELETE FROM ${tabella} WHERE ${colonnaPadre} = ?${dove}`).run(padreId, ...daTenere)
}

// ---- Calcolo di punteggi e fascia ----

export function calcola(
  questionarioId: number,
  risposte: { domanda_id: number; valore: number }[]
): { punteggi: { nome: string; valore: number }[]; fascia: string | null } {
  const { punteggi, fasce } = leggiQuestionario(questionarioId)
  const perDomanda = new Map(risposte.map((r) => [r.domanda_id, r.valore]))

  const valori = new Map<number, number>()
  const risultato = punteggi.map((p) => {
    const valore = p.domanda_ids.reduce((somma, did) => somma + (perDomanda.get(did) ?? 0), 0)
    if (p.id != null) valori.set(p.id, valore)
    return { nome: p.nome, valore }
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

export function salvaCompilazione(dati: CompilazioneInput): number {
  const db = getDb()
  const { punteggi, fascia } = calcola(dati.questionario_id, dati.risposte)
  return db.transaction(() => {
    const id = Number(
      db
        .prepare(
          'INSERT INTO paziente_questionari (paziente_id, questionario_id, data, fascia, note) VALUES (?, ?, ?, ?, ?)'
        )
        .run(dati.paziente_id, dati.questionario_id, dati.data, fascia, dati.note).lastInsertRowid
    )
    const insR = db.prepare(
      'INSERT INTO questionario_risposte (compilazione_id, domanda_id, valore) VALUES (?, ?, ?)'
    )
    for (const r of dati.risposte) insR.run(id, r.domanda_id, r.valore)
    const insP = db.prepare(
      'INSERT INTO compilazione_punteggi (compilazione_id, nome, valore, ordine) VALUES (?, ?, ?, ?)'
    )
    punteggi.forEach((p, i) => insP.run(id, p.nome, p.valore, i))
    return id
  })()
}
