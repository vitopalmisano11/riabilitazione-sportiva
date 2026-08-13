import { dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { closeDb, getDb, initDb, riapriDb } from './db'
import {
  cartellaDati,
  cartellaExport,
  impostaCartellaDati,
  impostaCartellaExport
} from './impostazioni'
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
  // ---- Sistema ----
  handle('apriLink', (url: string) => {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Link non valido: deve iniziare con http:// o https://')
    }
    void shell.openExternal(url)
  })

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
  handle('impostazioni:info', () => ({ cartella: cartellaDati(), cartellaExport: cartellaExport() }))
  handle('impostazioni:cambiaCartellaExport', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Scegli la cartella di destinazione per l'export",
      defaultPath: cartellaExport(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    impostaCartellaExport(filePaths[0])
    return filePaths[0]
  })
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

  // ---- Sezioni (struttura della seduta per fase) ----
  handle('sezioni:list', (faseId: number) => {
    const db = getDb()
    const sezioni = db
      .prepare('SELECT * FROM sezioni WHERE fase_id = ? ORDER BY ordine, id')
      .all(faseId) as { id: number }[]
    const catStmt = db.prepare(
      'SELECT categoria_id FROM sezione_categorie WHERE sezione_id = ? ORDER BY ordine, categoria_id'
    )
    return sezioni.map((s) => ({
      ...s,
      categoria_ids: (catStmt.all(s.id) as { categoria_id: number }[]).map((r) => r.categoria_id)
    }))
  })
  handle('sezioni:create', (faseId: number, nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM sezioni WHERE fase_id = ?')
      .get(faseId) as { next: number }
    return Number(
      db.prepare('INSERT INTO sezioni (fase_id, nome, ordine) VALUES (?, ?, ?)')
        .run(faseId, nome.trim(), next).lastInsertRowid
    )
  })
  handle('sezioni:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE sezioni SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('sezioni:delete', (id: number) => {
    getDb().prepare('DELETE FROM sezioni WHERE id = ?').run(id)
  })
  handle('sezioni:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE sezioni SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })
  handle('sezioni:setCategorie', (sezioneId: number, categoriaIds: number[]) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM sezione_categorie WHERE sezione_id = ?').run(sezioneId)
      const ins = db.prepare(
        'INSERT INTO sezione_categorie (sezione_id, categoria_id, ordine) VALUES (?, ?, ?)'
      )
      categoriaIds.forEach((cid, i) => ins.run(sezioneId, cid, i))
    })()
  })

  // ---- Test di avanzamento (per fase) ----
  handle('testAvanzamento:list', (faseId: number) =>
    getDb()
      .prepare('SELECT * FROM test_avanzamento WHERE fase_id = ? ORDER BY ordine, id')
      .all(faseId)
  )
  handle('testAvanzamento:create', (faseId: number, nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare(
        'SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM test_avanzamento WHERE fase_id = ?'
      )
      .get(faseId) as { next: number }
    return Number(
      db.prepare('INSERT INTO test_avanzamento (fase_id, nome, ordine) VALUES (?, ?, ?)')
        .run(faseId, nome.trim(), next).lastInsertRowid
    )
  })
  handle('testAvanzamento:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE test_avanzamento SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('testAvanzamento:delete', (id: number) => {
    getDb().prepare('DELETE FROM test_avanzamento WHERE id = ?').run(id)
  })
  handle('testAvanzamento:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE test_avanzamento SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Categorie ----
  handle('categorie:list', () =>
    getDb().prepare('SELECT * FROM categorie ORDER BY ordine, nome').all()
  )
  handle('categorie:create', (nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM categorie')
      .get() as { next: number }
    return Number(
      db.prepare('INSERT INTO categorie (nome, ordine) VALUES (?, ?)').run(nome.trim(), next)
        .lastInsertRowid
    )
  })
  handle('categorie:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE categorie SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })
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
          `INSERT INTO esercizi (nome, categoria_id, serie_default, ripetizioni_default, carico_default, recupero_default, nota_tecnica, link)
           VALUES (@nome, @categoria_id, @serie_default, @ripetizioni_default, @carico_default, @recupero_default, @nota_tecnica, @link)`
        )
        .run({ ...data, nome: data.nome.trim() }).lastInsertRowid
    )
  )
  handle('esercizi:update', (id: number, data: EsercizioInput) => {
    getDb()
      .prepare(
        `UPDATE esercizi SET nome = @nome, categoria_id = @categoria_id,
         serie_default = @serie_default, ripetizioni_default = @ripetizioni_default,
         carico_default = @carico_default, recupero_default = @recupero_default,
         nota_tecnica = @nota_tecnica, link = @link
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
  handle('pazienti:obiettiviRaggiunti', (pazienteId: number) =>
    (
      getDb()
        .prepare('SELECT obiettivo_id FROM paziente_obiettivi WHERE paziente_id = ?')
        .all(pazienteId) as { obiettivo_id: number }[]
    ).map((r) => r.obiettivo_id)
  )
  handle('pazienti:setObiettivoRaggiunto', (pazienteId: number, obiettivoId: number, raggiunto: boolean) => {
    if (raggiunto) {
      getDb()
        .prepare(
          `INSERT OR IGNORE INTO paziente_obiettivi (paziente_id, obiettivo_id, raggiunto_il)
           VALUES (?, ?, date('now'))`
        )
        .run(pazienteId, obiettivoId)
    } else {
      getDb()
        .prepare('DELETE FROM paziente_obiettivi WHERE paziente_id = ? AND obiettivo_id = ?')
        .run(pazienteId, obiettivoId)
    }
  })
  handle('pazienti:testValori', (pazienteId: number, faseId: number) =>
    getDb()
      .prepare(
        `SELECT t.id AS test_id, t.nome,
                COALESCE(pt.eseguito, 0) AS eseguito,
                pt.valore
         FROM test_avanzamento t
         LEFT JOIN paziente_test pt ON pt.test_id = t.id AND pt.paziente_id = ?
         WHERE t.fase_id = ?
         ORDER BY t.ordine, t.id`
      )
      .all(pazienteId, faseId)
  )
  handle('pazienti:setTestValore', (pazienteId: number, testId: number, eseguito: boolean, valore: string | null) => {
    getDb()
      .prepare(
        `INSERT INTO paziente_test (paziente_id, test_id, eseguito, valore)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(paziente_id, test_id) DO UPDATE SET eseguito = excluded.eseguito, valore = excluded.valore`
      )
      .run(pazienteId, testId, eseguito ? 1 : 0, valore)
  })

  // ---- Sedute ----
  function insertFigliSeduta(sedutaId: number | bigint, input: SedutaInput): void {
    const db = getDb()
    const insSez = db.prepare(
      'INSERT INTO seduta_sezioni (seduta_id, sezione_id, nome, ordine) VALUES (?, ?, ?, ?)'
    )
    const sezioneIds = input.sezioni.map(
      (s, i) => Number(insSez.run(sedutaId, s.sezione_id, s.nome.trim(), i).lastInsertRowid)
    )
    const insEs = db.prepare(
      `INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ripetizioni, carico, recupero, nota, ordine, seduta_sezione_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    input.esercizi.forEach((e, i) =>
      insEs.run(
        sedutaId,
        e.esercizio_id,
        e.serie,
        e.ripetizioni,
        e.carico,
        e.recupero,
        e.nota,
        i,
        e.sezioneIndex != null ? (sezioneIds[e.sezioneIndex] ?? null) : null
      )
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
    const sezioniRows = db
      .prepare('SELECT id, sezione_id, nome FROM seduta_sezioni WHERE seduta_id = ? ORDER BY ordine, id')
      .all(id) as { id: number; sezione_id: number | null; nome: string }[]
    const esercizi = db
      .prepare(
        `SELECT se.esercizio_id, e.nome, c.nome AS categoria_nome, e.link,
                se.serie, se.ripetizioni, se.carico, se.recupero, se.nota, se.seduta_sezione_id
         FROM seduta_esercizi se
         JOIN esercizi e ON e.id = se.esercizio_id
         JOIN categorie c ON c.id = e.categoria_id
         WHERE se.seduta_id = ?
         ORDER BY se.ordine, se.id`
      )
      .all(id) as ({ seduta_sezione_id: number | null } & Record<string, unknown>)[]

    const sezioni = sezioniRows.map((s) => ({
      sezione_id: s.sezione_id,
      nome: s.nome,
      esercizi: esercizi
        .filter((e) => e.seduta_sezione_id === s.id)
        .map(({ seduta_sezione_id: _ignora, ...resto }) => resto)
    }))
    // esercizi senza sezione (sedute della v1): raggruppati in una sezione unica
    const orfani = esercizi
      .filter((e) => e.seduta_sezione_id == null)
      .map(({ seduta_sezione_id: _ignora, ...resto }) => resto)
    if (orfani.length > 0) {
      sezioni.push({ sezione_id: null, nome: 'Esercizi', esercizi: orfani })
    }
    return { ...seduta, sezioni }
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
      db.prepare('DELETE FROM seduta_sezioni WHERE seduta_id = ?').run(id)
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
