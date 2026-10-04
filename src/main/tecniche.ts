// Le tecniche del trattamento (terapia manuale, tecar...): l'elenco e' del
// fisioterapista, e quelle che non usa piu' si archiviano invece di sparire,
// perche' le sedute gia' fatte le citano.
import { getDb } from './db'

export function elencoTecniche(includiArchiviate: boolean): unknown[] {
  return getDb()
    .prepare(
      `SELECT * FROM tecniche ${includiArchiviate ? '' : 'WHERE archiviata = 0'}
       ORDER BY ordine, nome`
    )
    .all()
}

export function creaTecnica(nome: string): number {
  const db = getDb()
  const pulito = nome.trim()
  if (!pulito) throw new Error('Scrivi il nome della tecnica.')
  // Se c'era gia' (magari archiviata) si rimette in elenco invece di duplicarla.
  const esiste = db.prepare('SELECT id FROM tecniche WHERE nome = ? COLLATE NOCASE').get(pulito) as
    | { id: number }
    | undefined
  if (esiste) {
    db.prepare('UPDATE tecniche SET archiviata = 0 WHERE id = ?').run(esiste.id)
    return esiste.id
  }
  return Number(
    db.prepare('INSERT INTO tecniche (nome, ordine) VALUES (?, ?)').run(pulito, prossimoOrdineTecniche()).lastInsertRowid
  )
}

// `tecniche` non e' fra gli elenchi ordinabili a mano (si riordinano da sole per
// nome): il posto in fondo si calcola qui.
function prossimoOrdineTecniche(): number {
  return (
    getDb().prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS prossimo FROM tecniche').get() as {
      prossimo: number
    }
  ).prossimo
}

export function archiviaTecnica(id: number, archiviata: boolean): void {
  getDb().prepare('UPDATE tecniche SET archiviata = ? WHERE id = ?').run(archiviata ? 1 : 0, id)
}
