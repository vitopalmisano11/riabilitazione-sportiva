import type { getDb } from './db'

// Salvando una scheda "in blocco" (le voci con id restano, le nuove si
// inseriscono, quelle sparite si eliminano) si toglie prima quello che non c'e'
// piu': tutte le righe figlie del padre, tranne quelle da tenere.
export function eliminaMancanti(
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
