// Screening eseguiti su un paziente.
//
// Una sessione e' un protocollo somministrato in una data. I valori sono righe
// (misura, lato, prova, valore) e non colonne, perche' ogni test ha misure sue
// e un numero di prove suo: cosi' aggiungere un test alla libreria non cambia
// niente qui.
//
// Il nome del protocollo e lo sport si copiano dentro la sessione. Sembra una
// ripetizione, ma se il protocollo viene cambiato o cancellato uno screening
// gia' fatto deve restare leggibile per com'era il giorno in cui e' stato fatto.
import { getDb } from './db'
import type {
  MisuraTest,
  ScreeningCompleto,
  ScreeningRiepilogo,
  ValoreScreening,
  VoceEseguita
} from '../shared/types'

export function elencoScreening(pazienteId: number | null): ScreeningRiepilogo[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.paziente_id, s.data, s.protocollo_nome, s.sport, s.note,
              p.nome AS paziente_nome, p.cognome AS paziente_cognome,
              (SELECT COUNT(*) FROM screening_valori v WHERE v.sessione_id = s.id) AS num_valori
       FROM screening_sessioni s
       JOIN pazienti p ON p.id = s.paziente_id
       WHERE (? IS NULL OR s.paziente_id = ?)
       ORDER BY s.data DESC, s.id DESC`
    )
    .all(pazienteId, pazienteId) as ScreeningRiepilogo[]
}

export function creaScreening(
  pazienteId: number,
  protocolloId: number,
  data: string
): number {
  const db = getDb()
  const prot = db
    .prepare('SELECT nome, sport FROM screening_protocolli WHERE id = ?')
    .get(protocolloId) as { nome: string; sport: string } | undefined
  if (!prot) throw new Error('Protocollo non trovato.')

  return Number(
    db
      .prepare(
        `INSERT INTO screening_sessioni (paziente_id, protocollo_id, protocollo_nome, sport, data)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(pazienteId, protocolloId, prot.nome, prot.sport, data).lastInsertRowid
  )
}

// Tutto quello che serve a compilare uno screening: le sezioni del protocollo,
// i test con le loro misure, e i valori gia' inseriti.
export function leggiScreening(id: number): ScreeningCompleto {
  const db = getDb()
  const s = db
    .prepare(
      `SELECT s.*, p.nome AS paziente_nome, p.cognome AS paziente_cognome,
              p.arto_operato
       FROM screening_sessioni s JOIN pazienti p ON p.id = s.paziente_id
       WHERE s.id = ?`
    )
    .get(id) as ScreeningCompleto['sessione'] | undefined
  if (!s) throw new Error('Screening non trovato.')

  const sezioni = s.protocollo_id
    ? (db
        .prepare(
          'SELECT id, nome FROM screening_sezioni WHERE protocollo_id = ? ORDER BY ordine, id'
        )
        .all(s.protocollo_id) as { id: number; nome: string }[])
    : []

  const vociStmt = db.prepare(
    `SELECT v.test_id, v.questionario_id,
            COALESCE(t.nome, q.nome) AS nome,
            t.protocollo, t.prove, t.per_lato, t.lsi_cutoff
     FROM screening_voci v
     LEFT JOIN test_valutazione t ON t.id = v.test_id
     LEFT JOIN questionari q ON q.id = v.questionario_id
     WHERE v.sezione_id = ? ORDER BY v.ordine, v.id`
  )
  const misureStmt = db.prepare(
    `SELECT id, nome, unita, per_prova, riassunto, cutoff, cutoff_direzione,
            calcolo, calcolo_a, calcolo_b
     FROM test_misure WHERE test_id = ? ORDER BY ordine, id`
  )
  const compilazioneStmt = db.prepare(
    `SELECT sq.compilazione_id, pq.data, pq.fascia
     FROM screening_questionari sq
     LEFT JOIN paziente_questionari pq ON pq.id = sq.compilazione_id
     WHERE sq.sessione_id = ? AND sq.questionario_id = ?`
  )

  return {
    sessione: s,
    sezioni: sezioni.map((sez) => ({
      nome: sez.nome,
      voci: (vociStmt.all(sez.id) as Record<string, unknown>[]).map((v): VoceEseguita => {
        if (v.questionario_id != null) {
          const c = compilazioneStmt.get(id, v.questionario_id) as
            | { compilazione_id: number | null; data: string | null; fascia: string | null }
            | undefined
          return {
            tipo: 'questionario',
            questionario_id: Number(v.questionario_id),
            nome: String(v.nome),
            compilazione_id: c?.compilazione_id ?? null,
            compilazione_data: c?.data ?? null,
            fascia: c?.fascia ?? null
          }
        }
        return {
          tipo: 'test',
          test_id: Number(v.test_id),
          nome: String(v.nome),
          protocollo: (v.protocollo as string | null) ?? null,
          prove: Number(v.prove ?? 1),
          per_lato: Number(v.per_lato) === 1 ? 1 : 0,
          lsi_cutoff: (v.lsi_cutoff as number | null) ?? null,
          misure: misureStmt.all(v.test_id) as MisuraTest[]
        }
      })
    })),
    valori: db
      .prepare(
        'SELECT misura_id, lato, prova, valore FROM screening_valori WHERE sessione_id = ?'
      )
      .all(id) as ValoreScreening[]
  }
}

// I valori si riscrivono tutti insieme: sono pochi e nessuno li cita da fuori,
// quindi cancellare e reinserire e' piu' semplice e non lascia orfani.
export function salvaValori(
  sessioneId: number,
  data: string,
  note: string | null,
  valori: ValoreScreening[]
): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('UPDATE screening_sessioni SET data = ?, note = ? WHERE id = ?').run(
      data,
      note,
      sessioneId
    )
    db.prepare('DELETE FROM screening_valori WHERE sessione_id = ?').run(sessioneId)
    const ins = db.prepare(
      'INSERT INTO screening_valori (sessione_id, misura_id, lato, prova, valore) VALUES (?, ?, ?, ?, ?)'
    )
    for (const v of valori) {
      if (!Number.isFinite(v.valore)) continue
      ins.run(sessioneId, v.misura_id, v.lato, v.prova, v.valore)
    }
  })()
}

export function collegaCompilazione(
  sessioneId: number,
  questionarioId: number,
  compilazioneId: number
): void {
  getDb()
    .prepare(
      `INSERT INTO screening_questionari (sessione_id, questionario_id, compilazione_id)
       VALUES (?, ?, ?)
       ON CONFLICT(sessione_id, questionario_id) DO UPDATE SET compilazione_id = excluded.compilazione_id`
    )
    .run(sessioneId, questionarioId, compilazioneId)
}

export function eliminaScreening(id: number): void {
  getDb().prepare('DELETE FROM screening_sessioni WHERE id = ?').run(id)
}
