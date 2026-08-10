import { ipcMain } from 'electron'
import { getDb } from './db'
import type { EsercizioInput, PazienteCreateInput, PazienteInput } from '../shared/types'

// Traduce gli errori SQLite in messaggi comprensibili per l'utente.
function friendly(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('UNIQUE constraint failed')) {
    return new Error('Esiste già un elemento con questo nome.')
  }
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return new Error(
      'Impossibile eliminare: questo elemento è utilizzato altrove (es. da esercizi, pazienti o sedute).'
    )
  }
  return err instanceof Error ? err : new Error(msg)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handle(channel: string, fn: (...args: any[]) => unknown): void {
  ipcMain.handle(channel, (_event, ...args) => {
    try {
      return fn(...args)
    } catch (err) {
      throw friendly(err)
    }
  })
}

export function registerIpc(): void {
  // ---- Patologie ----
  handle('patologie:list', () =>
    getDb().prepare('SELECT * FROM patologie ORDER BY nome').all()
  )
  handle('patologie:create', (nome: string) =>
    Number(getDb().prepare('INSERT INTO patologie (nome) VALUES (?)').run(nome.trim()).lastInsertRowid)
  )
  handle('patologie:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE patologie SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('patologie:delete', (id: number) => {
    getDb().prepare('DELETE FROM patologie WHERE id = ?').run(id)
  })

  // ---- Fasi ----
  handle('fasi:list', (patologiaId: number) =>
    getDb().prepare('SELECT * FROM fasi WHERE patologia_id = ? ORDER BY ordine, id').all(patologiaId)
  )
  handle('fasi:create', (patologiaId: number, nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM fasi WHERE patologia_id = ?')
      .get(patologiaId) as { next: number }
    return Number(
      db.prepare('INSERT INTO fasi (patologia_id, nome, ordine) VALUES (?, ?, ?)')
        .run(patologiaId, nome.trim(), next).lastInsertRowid
    )
  })
  handle('fasi:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE fasi SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('fasi:delete', (id: number) => {
    getDb().prepare('DELETE FROM fasi WHERE id = ?').run(id)
  })
  handle('fasi:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE fasi SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Obiettivi ----
  handle('obiettivi:list', (faseId: number) =>
    getDb().prepare('SELECT * FROM obiettivi WHERE fase_id = ? ORDER BY ordine, id').all(faseId)
  )
  handle('obiettivi:create', (faseId: number, nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM obiettivi WHERE fase_id = ?')
      .get(faseId) as { next: number }
    return Number(
      db.prepare('INSERT INTO obiettivi (fase_id, nome, ordine) VALUES (?, ?, ?)')
        .run(faseId, nome.trim(), next).lastInsertRowid
    )
  })
  handle('obiettivi:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE obiettivi SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('obiettivi:delete', (id: number) => {
    getDb().prepare('DELETE FROM obiettivi WHERE id = ?').run(id)
  })
  handle('obiettivi:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE obiettivi SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })
  handle('obiettivi:categorie', (obiettivoId: number) =>
    (getDb()
      .prepare('SELECT categoria_id FROM obiettivo_categorie WHERE obiettivo_id = ?')
      .all(obiettivoId) as { categoria_id: number }[]).map((r) => r.categoria_id)
  )
  handle('obiettivi:setCategoria', (obiettivoId: number, categoriaId: number, attiva: boolean) => {
    if (attiva) {
      getDb()
        .prepare('INSERT OR IGNORE INTO obiettivo_categorie (obiettivo_id, categoria_id) VALUES (?, ?)')
        .run(obiettivoId, categoriaId)
    } else {
      getDb()
        .prepare('DELETE FROM obiettivo_categorie WHERE obiettivo_id = ? AND categoria_id = ?')
        .run(obiettivoId, categoriaId)
    }
  })

  // ---- Categorie ----
  handle('categorie:list', () =>
    getDb().prepare('SELECT * FROM categorie ORDER BY nome').all()
  )
  handle('categorie:create', (nome: string) =>
    Number(getDb().prepare('INSERT INTO categorie (nome) VALUES (?)').run(nome.trim()).lastInsertRowid)
  )
  handle('categorie:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE categorie SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('categorie:delete', (id: number) => {
    getDb().prepare('DELETE FROM categorie WHERE id = ?').run(id)
  })

  // ---- Esercizi ----
  handle('esercizi:list', (includiArchiviati: boolean) =>
    getDb()
      .prepare(
        `SELECT e.*, c.nome AS categoria_nome
         FROM esercizi e JOIN categorie c ON c.id = e.categoria_id
         ${includiArchiviati ? '' : 'WHERE e.archiviato = 0'}
         ORDER BY e.nome`
      )
      .all()
  )
  handle('esercizi:create', (data: EsercizioInput) =>
    Number(
      getDb()
        .prepare(
          `INSERT INTO esercizi (nome, categoria_id, serie_default, ripetizioni_default, carico_default, nota_tecnica)
           VALUES (@nome, @categoria_id, @serie_default, @ripetizioni_default, @carico_default, @nota_tecnica)`
        )
        .run({ ...data, nome: data.nome.trim() }).lastInsertRowid
    )
  )
  handle('esercizi:update', (id: number, data: EsercizioInput) => {
    getDb()
      .prepare(
        `UPDATE esercizi SET nome = @nome, categoria_id = @categoria_id,
         serie_default = @serie_default, ripetizioni_default = @ripetizioni_default,
         carico_default = @carico_default, nota_tecnica = @nota_tecnica
         WHERE id = @id`
      )
      .run({ ...data, nome: data.nome.trim(), id })
  })
  handle('esercizi:setArchiviato', (id: number, archiviato: boolean) => {
    getDb().prepare('UPDATE esercizi SET archiviato = ? WHERE id = ?').run(archiviato ? 1 : 0, id)
  })
  handle('esercizi:delete', (id: number) => {
    getDb().prepare('DELETE FROM esercizi WHERE id = ?').run(id)
  })

  // ---- Pazienti ----
  // La fase corrente deve appartenere alla patologia assegnata al paziente.
  function checkFaseCoerente(patologiaId: number | null, faseId: number | null): void {
    if (faseId == null) return
    if (patologiaId == null) throw new Error('Imposta prima la patologia del paziente.')
    const fase = getDb().prepare('SELECT patologia_id FROM fasi WHERE id = ?').get(faseId) as
      | { patologia_id: number }
      | undefined
    if (!fase || fase.patologia_id !== patologiaId) {
      throw new Error('La fase selezionata non appartiene alla patologia del paziente.')
    }
  }

  handle('pazienti:list', () =>
    getDb()
      .prepare(
        `SELECT p.*, pat.nome AS patologia_nome, f.nome AS fase_nome
         FROM pazienti p
         LEFT JOIN patologie pat ON pat.id = p.patologia_id
         LEFT JOIN fasi f ON f.id = p.fase_corrente_id
         ORDER BY p.cognome, p.nome`
      )
      .all()
  )
  handle('pazienti:create', (data: PazienteCreateInput) => {
    checkFaseCoerente(data.patologia_id, data.fase_corrente_id)
    return Number(
      getDb()
        .prepare(
          `INSERT INTO pazienti (nome, cognome, tipo_intervento, data_intervento, patologia_id, fase_corrente_id)
           VALUES (@nome, @cognome, @tipo_intervento, @data_intervento, @patologia_id, @fase_corrente_id)`
        )
        .run({ ...data, nome: data.nome.trim(), cognome: data.cognome.trim() }).lastInsertRowid
    )
  })
  handle('pazienti:update', (id: number, data: PazienteInput) => {
    getDb()
      .prepare(
        `UPDATE pazienti SET nome = @nome, cognome = @cognome,
         tipo_intervento = @tipo_intervento, data_intervento = @data_intervento
         WHERE id = @id`
      )
      .run({ ...data, nome: data.nome.trim(), cognome: data.cognome.trim(), id })
  })
  handle('pazienti:setPatologiaFase', (id: number, patologiaId: number | null, faseId: number | null) => {
    checkFaseCoerente(patologiaId, faseId)
    getDb()
      .prepare('UPDATE pazienti SET patologia_id = ?, fase_corrente_id = ? WHERE id = ?')
      .run(patologiaId, faseId, id)
  })
  handle('pazienti:delete', (id: number) => {
    getDb().prepare('DELETE FROM pazienti WHERE id = ?').run(id)
  })
}
