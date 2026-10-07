// Promemoria per un paziente: "fargli rifare il KOOS fra sei settimane",
// "ripetere lo screening a fine fase".
//
// Riguardano un questionario o un protocollo di screening (i test di
// valutazione si fanno dentro uno screening). Compaiono nella pagina Follow-up
// e nel numerino del menu quando la data e' arrivata. Si chiudono da soli
// quando si salva una compilazione di quel questionario o si apre uno screening
// di quel protocollo per lo stesso paziente, oppure a mano.
import { getDb } from './db'
import { validaData } from './validazione'
import type { Promemoria, PromemoriaInput } from '../shared/types'

type Db = ReturnType<typeof getDb>

const SELEZIONE = `
  SELECT m.id, m.paziente_id, p.nome AS paziente_nome, p.cognome AS paziente_cognome,
         m.tipo, m.questionario_id, m.protocollo_id,
         COALESCE(q.nome, sp.nome, 'elemento eliminato') AS riferimento_nome,
         m.scadenza, m.nota, m.fatto_il
  FROM promemoria m
  JOIN pazienti p ON p.id = m.paziente_id
  LEFT JOIN questionari q ON q.id = m.questionario_id
  LEFT JOIN screening_protocolli sp ON sp.id = m.protocollo_id`

// Con un paziente: tutti i suoi, quelli aperti prima. Senza: gli aperti di
// tutti, per la pagina Follow-up, dal piu' vicino.
export function elencoPromemoria(pazienteId: number | null): Promemoria[] {
  const db = getDb()
  if (pazienteId == null) {
    return db
      .prepare(`${SELEZIONE} WHERE m.fatto_il IS NULL ORDER BY m.scadenza, m.id`)
      .all() as Promemoria[]
  }
  return db
    .prepare(
      `${SELEZIONE} WHERE m.paziente_id = ?
       ORDER BY (m.fatto_il IS NOT NULL), COALESCE(m.fatto_il, m.scadenza) DESC, m.id DESC`
    )
    .all(pazienteId) as Promemoria[]
}

export function creaPromemoria(dati: PromemoriaInput): number {
  validaData(dati.scadenza, 'La data del promemoria', { obbligatoria: true })
  if (dati.tipo !== 'questionario' && dati.tipo !== 'screening') {
    throw new Error('Il promemoria deve riguardare un questionario o uno screening.')
  }
  const db = getDb()
  const tabella = dati.tipo === 'questionario' ? 'questionari' : 'screening_protocolli'
  if (!db.prepare(`SELECT 1 FROM ${tabella} WHERE id = ?`).get(dati.riferimento_id)) {
    throw new Error(dati.tipo === 'questionario' ? 'Questionario non trovato.' : 'Protocollo non trovato.')
  }
  return Number(
    db
      .prepare(
        `INSERT INTO promemoria (paziente_id, tipo, questionario_id, protocollo_id, scadenza, nota)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        dati.paziente_id,
        dati.tipo,
        dati.tipo === 'questionario' ? dati.riferimento_id : null,
        dati.tipo === 'screening' ? dati.riferimento_id : null,
        dati.scadenza,
        dati.nota?.trim() || null
      ).lastInsertRowid
  )
}

export function segnaFatto(id: number, fatto: boolean): void {
  getDb()
    .prepare(
      fatto
        ? "UPDATE promemoria SET fatto_il = date('now', 'localtime') WHERE id = ?"
        : 'UPDATE promemoria SET fatto_il = NULL WHERE id = ?'
    )
    .run(id)
}

export function eliminaPromemoria(id: number): void {
  getDb().prepare('DELETE FROM promemoria WHERE id = ?').run(id)
}

// Quanti sono da fare: la data e' oggi o gia' passata.
export function contaInScadenza(): number {
  return (
    getDb()
      .prepare(
        "SELECT COUNT(*) AS n FROM promemoria WHERE fatto_il IS NULL AND scadenza <= date('now', 'localtime')"
      )
      .get() as { n: number }
  ).n
}

// Chiamata quando si fa quello che il promemoria chiedeva: chiude i suoi
// promemoria ancora aperti per quel paziente. Con `db` perche' si usa dentro la
// transazione di chi salva.
export function chiudiFatti(
  db: Db,
  pazienteId: number,
  cosa: { questionarioId: number } | { protocolloId: number }
): void {
  if ('questionarioId' in cosa) {
    db.prepare(
      `UPDATE promemoria SET fatto_il = date('now', 'localtime')
       WHERE paziente_id = ? AND questionario_id = ? AND fatto_il IS NULL`
    ).run(pazienteId, cosa.questionarioId)
  } else {
    db.prepare(
      `UPDATE promemoria SET fatto_il = date('now', 'localtime')
       WHERE paziente_id = ? AND protocollo_id = ? AND fatto_il IS NULL`
    ).run(pazienteId, cosa.protocolloId)
  }
}
