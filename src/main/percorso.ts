// Il percorso di riabilitazione: patologie, le loro fasi (palestra e campo) e,
// dentro a ogni fase, obiettivi, sezioni della seduta e test di avanzamento.
// Senza niente di Electron (modello: sedute.ts); il riordino e il posto in fondo
// vengono da elenchi.ts.
import { getDb } from './db'
import { eliminaConCestino, nomeDi } from './cestino'
import { prossimoOrdine } from './elenchi'

const nuovoNome = (nome: string): string => nome.trim()
const dentroFase = (faseId: number): { colonna: string; id: number } => ({ colonna: 'fase_id', id: faseId })

// ---- Patologie ----
export const elencoPatologie = (): unknown[] =>
  getDb().prepare('SELECT * FROM patologie ORDER BY ordine, nome').all()

export function creaPatologia(nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO patologie (nome, ordine) VALUES (?, ?)')
      .run(nuovoNome(nome), prossimoOrdine('patologie')).lastInsertRowid
  )
}

// Poche patologie hanno un percorso al campo: l'interruttore sta qui, cosi'
// tutte le altre non vedono mai la parola "campo".
export function impostaCampo(id: number, attivo: boolean): void {
  getDb().prepare('UPDATE patologie SET ha_campo = ? WHERE id = ?').run(attivo ? 1 : 0, id)
}

export function rinominaPatologia(id: number, nome: string): void {
  getDb().prepare('UPDATE patologie SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaPatologia(id: number): void {
  eliminaConCestino('patologie', id, 'Patologia', nomeDi('patologie', id))
}

// ---- Fasi ----
// Tutte le fasi della patologia, palestra e campo insieme: chi le usa
// filtra secondo il posto in cui deve mostrarle.
export const elencoFasi = (patologiaId: number): unknown[] =>
  getDb().prepare('SELECT * FROM fasi WHERE patologia_id = ? ORDER BY campo, ordine, id').all(patologiaId)

export function creaFase(patologiaId: number, nome: string, campo = false): number {
  const db = getDb()
  // L'ordine si conta dentro all'elenco di appartenenza: palestra e campo
  // sono due elenchi, ognuno con la sua numerazione.
  const { next } = db
    .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM fasi WHERE patologia_id = ? AND campo = ?')
    .get(patologiaId, campo ? 1 : 0) as { next: number }
  return Number(
    db
      .prepare('INSERT INTO fasi (patologia_id, nome, ordine, campo) VALUES (?, ?, ?, ?)')
      .run(patologiaId, nuovoNome(nome), next, campo ? 1 : 0).lastInsertRowid
  )
}

export function rinominaFase(id: number, nome: string): void {
  getDb().prepare('UPDATE fasi SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaFase(id: number): void {
  eliminaConCestino('fasi', id, 'Fase', nomeDi('fasi', id))
}

// ---- Obiettivi ----
export const elencoObiettivi = (faseId: number): unknown[] =>
  getDb().prepare('SELECT * FROM obiettivi WHERE fase_id = ? ORDER BY ordine, id').all(faseId)

export function creaObiettivo(faseId: number, nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO obiettivi (fase_id, nome, ordine) VALUES (?, ?, ?)')
      .run(faseId, nuovoNome(nome), prossimoOrdine('obiettivi', dentroFase(faseId))).lastInsertRowid
  )
}

export function rinominaObiettivo(id: number, nome: string): void {
  getDb().prepare('UPDATE obiettivi SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaObiettivo(id: number): void {
  eliminaConCestino('obiettivi', id, 'Obiettivo', nomeDi('obiettivi', id))
}

// ---- Sezioni (struttura della seduta per fase) ----
export function elencoSezioni(faseId: number): unknown[] {
  const db = getDb()
  const sezioni = db.prepare('SELECT * FROM sezioni WHERE fase_id = ? ORDER BY ordine, id').all(faseId) as {
    id: number
  }[]
  const catStmt = db.prepare(
    'SELECT categoria_id FROM sezione_categorie WHERE sezione_id = ? ORDER BY ordine, categoria_id'
  )
  return sezioni.map((s) => ({
    ...s,
    categoria_ids: (catStmt.all(s.id) as { categoria_id: number }[]).map((r) => r.categoria_id)
  }))
}

export function creaSezione(faseId: number, nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO sezioni (fase_id, nome, ordine) VALUES (?, ?, ?)')
      .run(faseId, nuovoNome(nome), prossimoOrdine('sezioni', dentroFase(faseId))).lastInsertRowid
  )
}

export function rinominaSezione(id: number, nome: string): void {
  getDb().prepare('UPDATE sezioni SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaSezione(id: number): void {
  eliminaConCestino('sezioni', id, 'Sezione', nomeDi('sezioni', id))
}

// Le categorie di esercizi che una sezione propone, nell'ordine scelto.
export function impostaCategorieSezione(sezioneId: number, categoriaIds: number[]): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM sezione_categorie WHERE sezione_id = ?').run(sezioneId)
    const ins = db.prepare('INSERT INTO sezione_categorie (sezione_id, categoria_id, ordine) VALUES (?, ?, ?)')
    categoriaIds.forEach((cid, i) => ins.run(sezioneId, cid, i))
  })()
}

// ---- Test di avanzamento (per fase) ----
export const elencoTestAvanzamento = (faseId: number): unknown[] =>
  getDb().prepare('SELECT * FROM test_avanzamento WHERE fase_id = ? ORDER BY ordine, id').all(faseId)

export function creaTestAvanzamento(faseId: number, nome: string): number {
  return Number(
    getDb()
      .prepare('INSERT INTO test_avanzamento (fase_id, nome, ordine) VALUES (?, ?, ?)')
      .run(faseId, nuovoNome(nome), prossimoOrdine('test_avanzamento', dentroFase(faseId))).lastInsertRowid
  )
}

export function rinominaTestAvanzamento(id: number, nome: string): void {
  getDb().prepare('UPDATE test_avanzamento SET nome = ? WHERE id = ?').run(nuovoNome(nome), id)
}

export function eliminaTestAvanzamento(id: number): void {
  eliminaConCestino('test_avanzamento', id, 'Test di avanzamento', nomeDi('test_avanzamento', id))
}
