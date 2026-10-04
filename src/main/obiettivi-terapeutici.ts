// Gli obiettivi terapeutici del paziente (a breve, medio e lungo termine) e le
// sue aspettative. Senza niente di Electron (modello: sedute.ts).
import { getDb } from './db'
import { prossimoOrdine } from './elenchi'
import type { TermineObiettivo } from '../shared/types'

// Le aspettative stanno sul paziente ma si scrivono qui, dove si parla di
// obiettivi: leggerle e salvarle e' un giro a se', senza passare dalla
// finestra dell'anagrafica.
export function leggiAspettative(pazienteId: number): string | null {
  const r = getDb().prepare('SELECT aspettative FROM pazienti WHERE id = ?').get(pazienteId) as
    | { aspettative: string | null }
    | undefined
  return r?.aspettative ?? null
}

export function salvaAspettative(pazienteId: number, testo: string | null): void {
  getDb()
    .prepare('UPDATE pazienti SET aspettative = ? WHERE id = ?')
    .run(testo?.trim() || null, pazienteId)
}

export function elencoObiettiviTerapeutici(pazienteId: number): unknown[] {
  return getDb()
    .prepare('SELECT id, testo, termine FROM obiettivi_terapeutici WHERE paziente_id = ? ORDER BY ordine, id')
    .all(pazienteId)
}

export function creaObiettivoTerapeutico(pazienteId: number, testo: string, termine: TermineObiettivo): number {
  return Number(
    getDb()
      .prepare('INSERT INTO obiettivi_terapeutici (paziente_id, testo, termine, ordine) VALUES (?, ?, ?, ?)')
      .run(
        pazienteId,
        testo.trim(),
        termine,
        prossimoOrdine('obiettivi_terapeutici', { colonna: 'paziente_id', id: pazienteId })
      ).lastInsertRowid
  )
}

export function aggiornaObiettivoTerapeutico(id: number, testo: string, termine: TermineObiettivo): void {
  getDb()
    .prepare('UPDATE obiettivi_terapeutici SET testo = ?, termine = ? WHERE id = ?')
    .run(testo.trim(), termine, id)
}

export function togliObiettivoTerapeutico(id: number): void {
  getDb().prepare('DELETE FROM obiettivi_terapeutici WHERE id = ?').run(id)
}
