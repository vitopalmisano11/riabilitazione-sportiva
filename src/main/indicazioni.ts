// Le indicazioni per casa: un elenco di frasi in comune ("non fare gli esercizi
// il giorno della partita") e, per ogni paziente, quali valgono per lui e ogni
// quanto farli. Senza niente di Electron (modello: sedute.ts).
import { getDb } from './db'
import { prossimoOrdine } from './elenchi'

export const elencoIndicazioni = (): unknown[] =>
  getDb().prepare('SELECT * FROM indicazioni ORDER BY ordine, id').all()

export function creaIndicazione(testo: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO indicazioni (testo, ordine) VALUES (?, ?)')
      .run(testo.trim(), prossimoOrdine('indicazioni')).lastInsertRowid
  )
}

export function rinominaIndicazione(id: number, testo: string): void {
  getDb().prepare('UPDATE indicazioni SET testo = ? WHERE id = ?').run(testo.trim(), id)
}

// Si toglie dall'elenco comune: sparisce anche dai pazienti che ce l'avevano.
export function eliminaIndicazione(id: number): void {
  getDb().prepare('DELETE FROM indicazioni WHERE id = ?').run(id)
}

export function indicazioniDelPaziente(pazienteId: number): number[] {
  return (
    getDb()
      .prepare('SELECT indicazione_id FROM paziente_indicazioni WHERE paziente_id = ?')
      .all(pazienteId) as { indicazione_id: number }[]
  ).map((r) => r.indicazione_id)
}

// Quelle scelte per il paziente si riscrivono tutte insieme, con la frequenza.
export function impostaIndicazioniDelPaziente(pazienteId: number, ids: number[], frequenza: string | null): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM paziente_indicazioni WHERE paziente_id = ?').run(pazienteId)
    const ins = db.prepare('INSERT INTO paziente_indicazioni (paziente_id, indicazione_id) VALUES (?, ?)')
    for (const id of ids) ins.run(pazienteId, id)
    db.prepare('UPDATE pazienti SET frequenza_casa = ? WHERE id = ?').run(frequenza?.trim() || null, pazienteId)
  })()
}
