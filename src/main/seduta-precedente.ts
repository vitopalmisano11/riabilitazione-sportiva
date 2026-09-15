// L'ultima volta, per chi apre una seduta nuova.
//
// Il paziente torna e la prima cosa che si fa e' ripensare a com'era andata la
// volta prima: cosa riferiva, cosa gli si e' fatto, quanto aveva male, i
// numeri dei segni che si ricontrollano. Qui si prende la seduta piu' recente
// prima del giorno di quella che si sta scrivendo — non quelle programmate
// dopo, e non quella stessa se la si sta modificando.
import { getDb } from './db'
import type { SedutaPrecedente } from '../shared/types'

export function sedutaPrecedente(
  pazienteId: number,
  escludi: number | null,
  finoAl: string
): SedutaPrecedente | null {
  const db = getDb()
  const s = db
    .prepare(
      `SELECT id, data, riferito_andamento, riferito, trattamento, dolore, sforzo, note
       FROM sedute
       WHERE paziente_id = ? AND data <= ? AND id <> COALESCE(?, -1)
       ORDER BY data DESC, id DESC LIMIT 1`
    )
    .get(pazienteId, finoAl, escludi) as
    | (Omit<SedutaPrecedente, 'tecniche' | 'segni'> & { id: number })
    | undefined
  if (!s) return null

  const tecniche = (
    db
      .prepare(
        `SELECT t.nome FROM seduta_tecniche st JOIN tecniche t ON t.id = st.tecnica_id
         WHERE st.seduta_id = ? ORDER BY t.ordine, t.nome`
      )
      .all(s.id) as { nome: string }[]
  ).map((t) => t.nome)

  const segni = db
    .prepare(
      `SELECT g.nome, g.unita, v.valore FROM segno_valori v JOIN segni g ON g.id = v.segno_id
       WHERE v.seduta_id = ? ORDER BY g.ordine, g.id`
    )
    .all(s.id) as SedutaPrecedente['segni']

  const { id: _id, ...resto } = s
  return { ...resto, tecniche, segni }
}
