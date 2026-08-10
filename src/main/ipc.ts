import { dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { closeDb, getDb, initDb, riapriDb } from './db'
import { cartellaDati, impostaCartellaDati } from './impostazioni'
import { spostaFileDati } from './file-dati'
import {
  authExists,
  cambiaPasswordAuth,
  loginAuth,
  recoverAuth,
  setupAuth
} from './auth'
import { esportaSeduta, esportaStorico, type FormatoExport } from './export'
import type {
  EsercizioInput,
  PazienteCreateInput,
  PazienteInput,
  SedutaInput
} from '../shared/types'

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
  if (msg.includes('file is not a database')) {
    return new Error('Impossibile aprire il database: chiave non valida o file danneggiato.')
  }
  return err instanceof Error ? err : new Error(msg)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handle(channel: string, fn: (...args: any[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      throw friendly(err)
    }
  })
}

export function registerIpc(): void {
  // ---- Autenticazione ----
  const authPath = (): string => join(cartellaDati(), 'auth.json')
  const dbPath = (): string => join(cartellaDati(), 'riabilitazione.db')

  handle('auth:status', () => (authExists(authPath()) ? 'login' : 'setup'))
  handle('auth:setup', (password: string) => {
    if (password.length < 8) throw new Error('La password deve avere almeno 8 caratteri.')
    const { dekHex, recoveryKey } = setupAuth(authPath(), password)
    initDb(dbPath(), dekHex)
    return recoveryKey
  })
  handle('auth:login', (password: string) => {
    const dekHex = loginAuth(authPath(), password)
    initDb(dbPath(), dekHex)
  })
  handle('auth:recover', (recoveryKey: string, nuovaPassword: string) => {
    if (nuovaPassword.length < 8) throw new Error('La password deve avere almeno 8 caratteri.')
    const dekHex = recoverAuth(authPath(), recoveryKey, nuovaPassword)
    initDb(dbPath(), dekHex)
  })
  handle('auth:cambiaPassword', (vecchia: string, nuova: string) => {
    if (nuova.length < 8) throw new Error('La nuova password deve avere almeno 8 caratteri.')
    cambiaPasswordAuth(authPath(), vecchia, nuova)
  })

  // ---- Impostazioni / cartella dati ----
  handle('impostazioni:info', () => ({ cartella: cartellaDati() }))
  handle('impostazioni:apriCartella', () => {
    void shell.openPath(cartellaDati())
  })
  handle('impostazioni:cambiaCartella', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Scegli la nuova cartella dei dati',
      defaultPath: cartellaDati(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    const nuova = filePaths[0]
    const vecchia = cartellaDati()
    if (nuova === vecchia) return nuova
    closeDb()
    try {
      spostaFileDati(vecchia, nuova)
    } catch (err) {
      riapriDb(join(vecchia, 'riabilitazione.db'))
      throw err
    }
    impostaCartellaDati(nuova)
    riapriDb(join(nuova, 'riabilitazione.db'))
    return nuova
  })

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

  // ---- Sedute ----
  function insertFigliSeduta(sedutaId: number | bigint, input: SedutaInput): void {
    const db = getDb()
    const insOb = db.prepare('INSERT INTO seduta_obiettivi (seduta_id, obiettivo_id) VALUES (?, ?)')
    for (const obId of input.obiettivi) insOb.run(sedutaId, obId)
    const insEs = db.prepare(
      `INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ripetizioni, carico, nota, ordine)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    input.esercizi.forEach((e, i) =>
      insEs.run(sedutaId, e.esercizio_id, e.serie, e.ripetizioni, e.carico, e.nota, i)
    )
  }

  handle('sedute:list', (pazienteId: number) =>
    getDb()
      .prepare(
        `SELECT s.id, s.paziente_id, s.data, f.nome AS fase_nome, s.note,
           (SELECT COUNT(*) FROM seduta_esercizi se WHERE se.seduta_id = s.id) AS num_esercizi,
           (SELECT GROUP_CONCAT(o.nome, ' · ')
              FROM seduta_obiettivi so JOIN obiettivi o ON o.id = so.obiettivo_id
              WHERE so.seduta_id = s.id) AS obiettivi_nomi
         FROM sedute s
         LEFT JOIN fasi f ON f.id = s.fase_id
         WHERE s.paziente_id = ?
         ORDER BY s.data DESC, s.id DESC`
      )
      .all(pazienteId)
  )
  handle('sedute:get', (id: number) => {
    const db = getDb()
    const seduta = db
      .prepare(
        'SELECT s.*, f.nome AS fase_nome FROM sedute s LEFT JOIN fasi f ON f.id = s.fase_id WHERE s.id = ?'
      )
      .get(id)
    if (!seduta) throw new Error('Seduta non trovata.')
    const obiettivi = (
      db.prepare('SELECT obiettivo_id FROM seduta_obiettivi WHERE seduta_id = ?').all(id) as {
        obiettivo_id: number
      }[]
    ).map((r) => r.obiettivo_id)
    const esercizi = db
      .prepare(
        `SELECT se.esercizio_id, e.nome, c.nome AS categoria_nome,
                se.serie, se.ripetizioni, se.carico, se.nota
         FROM seduta_esercizi se
         JOIN esercizi e ON e.id = se.esercizio_id
         JOIN categorie c ON c.id = e.categoria_id
         WHERE se.seduta_id = ?
         ORDER BY se.ordine, se.id`
      )
      .all(id)
    return { ...seduta, obiettivi, esercizi }
  })
  handle('sedute:create', (input: SedutaInput) => {
    const db = getDb()
    return db.transaction(() => {
      const sid = db
        .prepare('INSERT INTO sedute (paziente_id, data, fase_id, note) VALUES (?, ?, ?, ?)')
        .run(input.paziente_id, input.data, input.fase_id, input.note).lastInsertRowid
      insertFigliSeduta(sid, input)
      return Number(sid)
    })()
  })
  handle('sedute:update', (id: number, input: SedutaInput) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('UPDATE sedute SET data = ?, fase_id = ?, note = ? WHERE id = ?').run(
        input.data,
        input.fase_id,
        input.note,
        id
      )
      db.prepare('DELETE FROM seduta_obiettivi WHERE seduta_id = ?').run(id)
      db.prepare('DELETE FROM seduta_esercizi WHERE seduta_id = ?').run(id)
      insertFigliSeduta(id, input)
    })()
  })
  handle('sedute:delete', (id: number) => {
    getDb().prepare('DELETE FROM sedute WHERE id = ?').run(id)
  })

  // ---- Export ----
  handle('esporta:seduta', (sedutaId: number, formato: FormatoExport) =>
    esportaSeduta(sedutaId, formato)
  )
  handle('esporta:storico', (pazienteId: number, dal: string, al: string, formato: FormatoExport) =>
    esportaStorico(pazienteId, dal, al, formato)
  )
}
