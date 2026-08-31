import { app, dialog, ipcMain, nativeImage, shell } from 'electron'
import { basename, join } from 'path'
import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
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
import { anteprimaSeduta, esportaSeduta, esportaStorico, type FormatoExport } from './export'
import { leggiQuestionario, salvaCompilazione, salvaQuestionario } from './questionari'
import { leggiTest, salvaTest } from './test-valutazione'
import {
  leggiDistretto,
  leggiValutazione,
  salvaDistretto,
  salvaValutazione
} from './valutazione'
import type {
  AnamnesiProssima,
  AnamnesiRemota,
  AttivitaPartecipazione,
  BodyChartCompleta,
  CompilazioneInput,
  EsercizioInput,
  PazienteCreateInput,
  PazienteInput,
  DistrettoCompleto,
  QuestionarioCompleto,
  SedutaInput,
  TestValutazioneCompleto,
  ValutazioneCompleta
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
    getDb().prepare('SELECT * FROM patologie ORDER BY ordine, nome').all()
  )
  handle('patologie:create', (nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM patologie')
      .get() as { next: number }
    return Number(
      db.prepare('INSERT INTO patologie (nome, ordine) VALUES (?, ?)').run(nome.trim(), next)
        .lastInsertRowid
    )
  })
  handle('patologie:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE patologie SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })
  handle('patologie:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE patologie SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('patologie:delete', (id: number) => {
    getDb().prepare('DELETE FROM patologie WHERE id = ?').run(id)
  })

  // ---- Distretti (libreria della valutazione obiettiva) ----
  handle('distretti:list', () =>
    getDb().prepare('SELECT * FROM distretti ORDER BY ordine, nome').all()
  )
  handle('distretti:get', (id: number) => leggiDistretto(id))
  handle('distretti:create', (nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM distretti')
      .get() as { next: number }
    return Number(
      db.prepare('INSERT INTO distretti (nome, ordine) VALUES (?, ?)').run(nome.trim(), next)
        .lastInsertRowid
    )
  })
  handle('distretti:salva', (dati: DistrettoCompleto) => salvaDistretto(dati))
  handle('distretti:delete', (id: number) => {
    getDb().prepare('DELETE FROM distretti WHERE id = ?').run(id)
  })
  handle('distretti:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE distretti SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  handle('patologie:distretti', (patologiaId: number) =>
    (
      getDb()
        .prepare('SELECT distretto_id FROM patologia_distretti WHERE patologia_id = ?')
        .all(patologiaId) as { distretto_id: number }[]
    ).map((r) => r.distretto_id)
  )
  handle('patologie:setDistretti', (patologiaId: number, ids: number[]) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM patologia_distretti WHERE patologia_id = ?').run(patologiaId)
      const ins = db.prepare(
        'INSERT INTO patologia_distretti (patologia_id, distretto_id) VALUES (?, ?)'
      )
      for (const d of ids) ins.run(patologiaId, d)
    })()
  })

  // ---- Valutazioni obiettive ----
  handle('valutazioni:list', (pazienteId: number) =>
    getDb()
      .prepare(
        `SELECT v.id, v.data, v.note,
                (SELECT COUNT(*) FROM valutazione_distretti d WHERE d.valutazione_id = v.id)
                  AS num_distretti
         FROM valutazioni v WHERE v.paziente_id = ?
         ORDER BY v.data DESC, v.id DESC`
      )
      .all(pazienteId)
  )
  handle('valutazioni:get', (id: number) => leggiValutazione(id))
  handle('valutazioni:create', (pazienteId: number, data: string, distrettoIds: number[]) => {
    const db = getDb()
    return db.transaction(() => {
      const id = Number(
        db
          .prepare('INSERT INTO valutazioni (paziente_id, data) VALUES (?, ?)')
          .run(pazienteId, data).lastInsertRowid
      )
      const ins = db.prepare(
        'INSERT INTO valutazione_distretti (valutazione_id, distretto_id) VALUES (?, ?)'
      )
      for (const d of distrettoIds) ins.run(id, d)
      return id
    })()
  })
  handle('valutazioni:salva', (dati: ValutazioneCompleta) => salvaValutazione(dati))
  handle('valutazioni:delete', (id: number) => {
    getDb().prepare('DELETE FROM valutazioni WHERE id = ?').run(id)
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
  // Colonne esplicite: `e.*` trascinerebbe anche `immagine` in ogni elenco.
  handle('esercizi:list', (includiArchiviati: boolean) =>
    getDb()
      .prepare(
        `SELECT e.id, e.nome, e.categoria_id, e.serie_default, e.ripetizioni_default,
                e.carico_default, e.recupero_default, e.nota_tecnica, e.link, e.archiviato,
                c.nome AS categoria_nome,
                (e.immagine IS NOT NULL) AS ha_immagine
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

  // ---- Immagine dell'esercizio ----
  // Sta nel database (quindi cifrata e inclusa nel backup della cartella) come
  // data URL. Larghezza massima e peso massimo tengono il file sotto controllo.
  const IMG_LARGHEZZA_MAX = 1000
  const IMG_PESO_MAX = 3 * 1024 * 1024

  handle('esercizi:immagine', (id: number) => {
    const riga = getDb().prepare('SELECT immagine FROM esercizi WHERE id = ?').get(id) as
      | { immagine: string | null }
      | undefined
    if (!riga) throw new Error('Esercizio non trovato.')
    return riga.immagine
  })

  handle('esercizi:setImmagine', (id: number, dataUrl: string | null) => {
    if (dataUrl != null && dataUrl.length > IMG_PESO_MAX) {
      throw new Error('Immagine troppo pesante.')
    }
    getDb().prepare('UPDATE esercizi SET immagine = ? WHERE id = ?').run(dataUrl, id)
  })

  handle('scegliImmagine', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Scegli l'immagine dell'esercizio",
      properties: ['openFile'],
      filters: [{ name: 'Immagini', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }]
    })
    if (canceled || filePaths.length === 0) return null
    let img = nativeImage.createFromPath(filePaths[0])
    if (img.isEmpty()) throw new Error('Immagine non leggibile o in un formato non supportato.')
    if (img.getSize().width > IMG_LARGHEZZA_MAX) {
      img = img.resize({ width: IMG_LARGHEZZA_MAX, quality: 'good' })
    }
    // PNG se resta leggero (conserva la trasparenza), altrimenti JPEG.
    const png = img.toPNG()
    if (png.length <= 400 * 1024) return `data:image/png;base64,${png.toString('base64')}`
    return `data:image/jpeg;base64,${img.toJPEG(80).toString('base64')}`
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
        `SELECT p.*, pat.nome AS patologia_nome, f.nome AS fase_nome,
                (SELECT MAX(s.data) FROM sedute s WHERE s.paziente_id = p.id) AS ultima_seduta
         FROM pazienti p
         LEFT JOIN patologie pat ON pat.id = p.patologia_id
         LEFT JOIN fasi f ON f.id = p.fase_corrente_id
         -- in cima chi ha la seduta piu' recente; chi non ne ha ancora resta in
         -- fondo, in ordine alfabetico
         ORDER BY ultima_seduta IS NULL, ultima_seduta DESC, p.cognome, p.nome`
      )
      .all()
  )
  handle('pazienti:create', (data: PazienteCreateInput) => {
    checkFaseCoerente(data.patologia_id, data.fase_corrente_id)
    return Number(
      getDb()
        .prepare(
          `INSERT INTO pazienti
             (nome, cognome, data_nascita, telefono, email, lavoro, inviato_da, diagnosi,
              tipo_intervento, data_intervento, patologia_id, fase_corrente_id)
           VALUES
             (@nome, @cognome, @data_nascita, @telefono, @email, @lavoro, @inviato_da, @diagnosi,
              @tipo_intervento, @data_intervento, @patologia_id, @fase_corrente_id)`
        )
        .run({ ...data, nome: data.nome.trim(), cognome: data.cognome.trim() }).lastInsertRowid
    )
  })
  handle('pazienti:update', (id: number, data: PazienteInput) => {
    getDb()
      .prepare(
        `UPDATE pazienti SET nome = @nome, cognome = @cognome,
         data_nascita = @data_nascita, telefono = @telefono, email = @email,
         lavoro = @lavoro, inviato_da = @inviato_da, diagnosi = @diagnosi,
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
                (e.immagine IS NOT NULL) AS ha_immagine,
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

  // ---- Categorie dei questionari ----
  handle('questionariCategorie:list', () =>
    getDb().prepare('SELECT * FROM questionario_categorie ORDER BY ordine, nome').all()
  )
  handle('questionariCategorie:create', (nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM questionario_categorie')
      .get() as { next: number }
    return Number(
      db
        .prepare('INSERT INTO questionario_categorie (nome, ordine) VALUES (?, ?)')
        .run(nome.trim(), next).lastInsertRowid
    )
  })
  handle('questionariCategorie:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE questionario_categorie SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('questionariCategorie:delete', (id: number) => {
    getDb().prepare('DELETE FROM questionario_categorie WHERE id = ?').run(id)
  })
  handle('questionariCategorie:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE questionario_categorie SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Questionari (PROM) ----
  handle('questionari:list', (includiArchiviati: boolean) =>
    getDb()
      .prepare(
        `SELECT * FROM questionari
         ${includiArchiviati ? '' : 'WHERE archiviato = 0'}
         ORDER BY ordine, nome`
      )
      .all()
  )
  handle('questionari:get', (id: number) => leggiQuestionario(id))
  handle('questionari:create', (nome: string, categoriaId: number) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM questionari WHERE categoria_id = ?')
      .get(categoriaId) as { next: number }
    return Number(
      db
        .prepare('INSERT INTO questionari (nome, categoria_id, ordine) VALUES (?, ?, ?)')
        .run(nome.trim(), categoriaId, next).lastInsertRowid
    )
  })
  handle('questionari:salva', (dati: QuestionarioCompleto) => salvaQuestionario(dati))
  handle('questionari:setArchiviato', (id: number, archiviato: boolean) => {
    getDb().prepare('UPDATE questionari SET archiviato = ? WHERE id = ?').run(archiviato ? 1 : 0, id)
  })
  handle('questionari:delete', (id: number) => {
    getDb().prepare('DELETE FROM questionari WHERE id = ?').run(id)
  })
  handle('questionari:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE questionari SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Compilazioni di un paziente ----
  handle('compilazioni:list', (pazienteId: number) => {
    const db = getDb()
    const righe = db
      .prepare(
        `SELECT pq.id, pq.data, pq.questionario_id, pq.fascia, pq.note, q.nome AS questionario_nome
         FROM paziente_questionari pq JOIN questionari q ON q.id = pq.questionario_id
         WHERE pq.paziente_id = ?
         ORDER BY pq.data DESC, pq.id DESC`
      )
      .all(pazienteId) as { id: number }[]
    const pStmt = db.prepare(
      'SELECT nome, valore FROM compilazione_punteggi WHERE compilazione_id = ? ORDER BY ordine'
    )
    return righe.map((r) => ({ ...r, punteggi: pStmt.all(r.id) }))
  })
  handle('compilazioni:risposte', (compilazioneId: number) =>
    getDb()
      .prepare('SELECT domanda_id, valore FROM questionario_risposte WHERE compilazione_id = ?')
      .all(compilazioneId)
  )
  handle('compilazioni:create', (dati: CompilazioneInput) => salvaCompilazione(dati))
  handle('compilazioni:delete', (id: number) => {
    getDb().prepare('DELETE FROM paziente_questionari WHERE id = ?').run(id)
  })

  // ---- Categorie dei test ----
  handle('testCategorie:list', () =>
    getDb().prepare('SELECT * FROM test_categorie ORDER BY ordine, nome').all()
  )
  handle('testCategorie:create', (nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM test_categorie')
      .get() as { next: number }
    return Number(
      db.prepare('INSERT INTO test_categorie (nome, ordine) VALUES (?, ?)').run(nome.trim(), next)
        .lastInsertRowid
    )
  })
  handle('testCategorie:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE test_categorie SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('testCategorie:delete', (id: number) => {
    getDb().prepare('DELETE FROM test_categorie WHERE id = ?').run(id)
  })
  handle('testCategorie:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE test_categorie SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Test di valutazione ----
  handle('testValutazione:list', (includiArchiviati: boolean) =>
    getDb()
      .prepare(
        `SELECT id, categoria_id, nome, descrizione, protocollo, link, prove, ordine, archiviato
         FROM test_valutazione
         ${includiArchiviati ? '' : 'WHERE archiviato = 0'}
         ORDER BY ordine, nome`
      )
      .all()
  )
  handle('testValutazione:get', (id: number) => leggiTest(id))
  handle('testValutazione:create', (nome: string, categoriaId: number) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM test_valutazione WHERE categoria_id = ?')
      .get(categoriaId) as { next: number }
    return Number(
      db
        .prepare('INSERT INTO test_valutazione (nome, categoria_id, ordine) VALUES (?, ?, ?)')
        .run(nome.trim(), categoriaId, next).lastInsertRowid
    )
  })
  handle('testValutazione:salva', (dati: TestValutazioneCompleto) => salvaTest(dati))
  handle('testValutazione:delete', (id: number) => {
    getDb().prepare('DELETE FROM test_valutazione WHERE id = ?').run(id)
  })
  handle('testValutazione:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE test_valutazione SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Anamnesi prossima ----
  handle('anamnesi:get', (pazienteId: number) => {
    const db = getDb()
    const riga = db
      .prepare('SELECT * FROM anamnesi_prossima WHERE paziente_id = ?')
      .get(pazienteId) as Record<string, unknown> | undefined
    const sintomi = db
      .prepare(
        `SELECT id, descrizione, andamento, da_quanto, episodio, esordio, traumatico,
                comportamento, aggrava, allevia
         FROM anamnesi_sintomi WHERE paziente_id = ? ORDER BY ordine, id`
      )
      .all(pazienteId) as { id: number }[]
    const puntiStmt = db.prepare(
      `SELECT id, grafico, minuti, data, dolore FROM sintomo_punti
       WHERE sintomo_id = ? ORDER BY grafico, minuti, data, id`
    )
    const conPunti = sintomi.map((x) => ({ ...x, punti: puntiStmt.all(x.id) }))
    return {
      motivo_consulto: null,
      dolore_notturno: null,
      disturbi_sonno: null,
      tosse_starnuto: null,
      sintomi_neurologici: null,
      relazione_sintomi: null,
      note: null,
      note_giorno: null,
      note_esordio: null,
      ...(riga ?? {}),
      sintomi: conPunti
    }
  })

  handle('anamnesi:salva', (pazienteId: number, dati: AnamnesiProssima) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare(
        `INSERT INTO anamnesi_prossima
           (paziente_id, motivo_consulto, dolore_notturno, disturbi_sonno, tosse_starnuto,
            sintomi_neurologici, relazione_sintomi, note, note_giorno, note_esordio)
         VALUES (@paziente_id, @motivo_consulto, @dolore_notturno, @disturbi_sonno,
                 @tosse_starnuto, @sintomi_neurologici, @relazione_sintomi, @note,
                 @note_giorno, @note_esordio)
         ON CONFLICT(paziente_id) DO UPDATE SET
           motivo_consulto = excluded.motivo_consulto,
           dolore_notturno = excluded.dolore_notturno,
           disturbi_sonno = excluded.disturbi_sonno,
           tosse_starnuto = excluded.tosse_starnuto,
           sintomi_neurologici = excluded.sintomi_neurologici,
           relazione_sintomi = excluded.relazione_sintomi,
           note = excluded.note,
           note_giorno = excluded.note_giorno,
           note_esordio = excluded.note_esordio`
      ).run({
        paziente_id: pazienteId,
        motivo_consulto: dati.motivo_consulto,
        dolore_notturno: dati.dolore_notturno,
        disturbi_sonno: dati.disturbi_sonno,
        tosse_starnuto: dati.tosse_starnuto,
        sintomi_neurologici: dati.sintomi_neurologici,
        relazione_sintomi: dati.relazione_sintomi,
        note: dati.note,
        note_giorno: dati.note_giorno,
        note_esordio: dati.note_esordio
      })

      // I sintomi gia' salvati conservano il proprio id: i grafici futuri vi si
      // aggancieranno, e un riordino non deve spostarli su un altro sintomo.
      const daTenere = dati.sintomi
        .map((x) => x.id)
        .filter((x): x is number => x != null && x > 0)
      const segnaposto = daTenere.map(() => '?').join(', ')
      db.prepare(
        'DELETE FROM anamnesi_sintomi WHERE paziente_id = ?' +
          (daTenere.length > 0 ? ` AND id NOT IN (${segnaposto})` : '')
      ).run(pazienteId, ...daTenere)

      const ins = db.prepare(
        `INSERT INTO anamnesi_sintomi
           (paziente_id, descrizione, andamento, da_quanto, episodio, esordio, traumatico,
            comportamento, aggrava, allevia, ordine)
         VALUES (@paziente_id, @descrizione, @andamento, @da_quanto, @episodio, @esordio,
                 @traumatico, @comportamento, @aggrava, @allevia, @ordine)`
      )
      const upd = db.prepare(
        `UPDATE anamnesi_sintomi SET descrizione = @descrizione, andamento = @andamento,
           da_quanto = @da_quanto, episodio = @episodio, esordio = @esordio,
           traumatico = @traumatico, comportamento = @comportamento, aggrava = @aggrava,
           allevia = @allevia, ordine = @ordine
         WHERE id = @id`
      )
      const insPunto = db.prepare(
        `INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, data, dolore)
         VALUES (?, ?, ?, ?, ?)`
      )
      dati.sintomi.forEach((x, i) => {
        const { punti, ...resto } = x
        const campi = { ...resto, paziente_id: pazienteId, ordine: i }
        let sid: number
        if (x.id == null || x.id < 0) {
          sid = Number(ins.run({ ...campi, id: null }).lastInsertRowid)
        } else {
          upd.run(campi)
          sid = x.id
        }
        // I punti si riscrivono per intero: non sono citati da nessun'altra
        // tabella, e riscriverli e' piu' semplice che tenerne traccia uno a uno.
        db.prepare('DELETE FROM sintomo_punti WHERE sintomo_id = ?').run(sid)
        for (const pt of punti) {
          insPunto.run(sid, pt.grafico, pt.minuti, pt.data, pt.dolore)
        }
      })
    })()
  })

  // ---- Attivita' e partecipazione ----
  handle('anamnesi:attivita', (pazienteId: number) => {
    const riga = getDb()
      .prepare('SELECT attivita, partecipazione, fattori_interni FROM anamnesi_attivita WHERE paziente_id = ?')
      .get(pazienteId)
    return riga ?? { attivita: null, partecipazione: null, fattori_interni: null }
  })
  handle('anamnesi:salvaAttivita', (pazienteId: number, dati: AttivitaPartecipazione) => {
    getDb()
      .prepare(
        `INSERT INTO anamnesi_attivita (paziente_id, attivita, partecipazione, fattori_interni)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(paziente_id) DO UPDATE SET
           attivita = excluded.attivita,
           partecipazione = excluded.partecipazione,
           fattori_interni = excluded.fattori_interni`
      )
      .run(pazienteId, dati.attivita, dati.partecipazione, dati.fattori_interni)
  })

  // ---- Anamnesi remota ----
  const REMOTA_VUOTA: AnamnesiRemota = {
    traumi: null,
    interventi: null,
    riabilitazioni: null,
    bioimmagini_note: null,
    peso: null,
    febbre: null,
    sudorazione: null,
    nausea: null,
    fumo: null,
    neoplasie: null,
    gravidanza: null,
    pacemaker: null,
    schegge: null
  }

  handle('anamnesi:remota', (pazienteId: number) => {
    const riga = getDb()
      .prepare('SELECT * FROM anamnesi_remota WHERE paziente_id = ?')
      .get(pazienteId) as Record<string, unknown> | undefined
    return { ...REMOTA_VUOTA, ...(riga ?? {}) }
  })
  handle('anamnesi:salvaRemota', (pazienteId: number, dati: AnamnesiRemota) => {
    getDb()
      .prepare(
        `INSERT INTO anamnesi_remota
           (paziente_id, traumi, interventi, riabilitazioni, bioimmagini_note,
            peso, febbre, sudorazione, nausea, fumo, neoplasie, gravidanza, pacemaker, schegge)
         VALUES (@paziente_id, @traumi, @interventi, @riabilitazioni, @bioimmagini_note,
            @peso, @febbre, @sudorazione, @nausea, @fumo, @neoplasie, @gravidanza,
            @pacemaker, @schegge)
         ON CONFLICT(paziente_id) DO UPDATE SET
           traumi = excluded.traumi, interventi = excluded.interventi,
           riabilitazioni = excluded.riabilitazioni,
           bioimmagini_note = excluded.bioimmagini_note,
           peso = excluded.peso, febbre = excluded.febbre,
           sudorazione = excluded.sudorazione, nausea = excluded.nausea,
           fumo = excluded.fumo, neoplasie = excluded.neoplasie,
           gravidanza = excluded.gravidanza, pacemaker = excluded.pacemaker,
           schegge = excluded.schegge`
      )
      .run({ ...dati, paziente_id: pazienteId })
  })

  // ---- Bioimmagini ----
  const BIO_PESO_MAX = 12 * 1024 * 1024

  handle('bioimmagini:list', (pazienteId: number) =>
    getDb()
      .prepare(
        'SELECT id, nome, tipo, data FROM bioimmagini WHERE paziente_id = ? ORDER BY ordine, id'
      )
      .all(pazienteId)
  )

  handle('bioimmagini:aggiungi', async (pazienteId: number) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Scegli il referto (foto o PDF)',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Referti', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }]
    })
    if (canceled || filePaths.length === 0) return 0
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM bioimmagini WHERE paziente_id = ?')
      .get(pazienteId) as { next: number }
    const ins = db.prepare(
      `INSERT INTO bioimmagini (paziente_id, nome, tipo, contenuto, data, ordine)
       VALUES (?, ?, ?, ?, date('now'), ?)`
    )
    let aggiunti = 0
    for (const percorso of filePaths) {
      const nome = basename(percorso)
      const pdf = percorso.toLowerCase().endsWith('.pdf')
      let tipo: string
      let dataUrl: string
      if (pdf) {
        const buf = readFileSync(percorso)
        if (buf.length > BIO_PESO_MAX) {
          throw new Error(`"${nome}" e' troppo pesante (oltre 12 MB).`)
        }
        tipo = 'application/pdf'
        dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`
      } else {
        // le foto si rimpiccioliscono: un referto fotografato col telefono
        // arriva a diversi megabyte e farebbe crescere l'archivio senza motivo
        let img = nativeImage.createFromPath(percorso)
        if (img.isEmpty()) throw new Error(`"${nome}" non e' leggibile.`)
        if (img.getSize().width > 1600) img = img.resize({ width: 1600, quality: 'good' })
        tipo = 'image/jpeg'
        dataUrl = `data:image/jpeg;base64,${img.toJPEG(82).toString('base64')}`
      }
      ins.run(pazienteId, nome, tipo, dataUrl, next + aggiunti)
      aggiunti++
    }
    return aggiunti
  })

  handle('bioimmagini:apri', async (id: number) => {
    const riga = getDb()
      .prepare('SELECT nome, tipo, contenuto FROM bioimmagini WHERE id = ?')
      .get(id) as { nome: string; tipo: string; contenuto: string } | undefined
    if (!riga) throw new Error('Referto non trovato.')
    const base64 = riga.contenuto.slice(riga.contenuto.indexOf(',') + 1)
    const estensione = riga.tipo === 'application/pdf' ? '.pdf' : '.jpg'
    const tmp = join(app.getPath('temp'), `referto-${id}${estensione}`)
    await writeFile(tmp, Buffer.from(base64, 'base64'))
    void shell.openPath(tmp)
  })

  handle('bioimmagini:delete', (id: number) => {
    getDb().prepare('DELETE FROM bioimmagini WHERE id = ?').run(id)
  })

  // ---- Body chart ----
  handle('bodyChart:list', (pazienteId: number) =>
    getDb()
      .prepare(
        `SELECT b.id, b.data, b.note,
                (SELECT COUNT(*) FROM body_chart_segni s WHERE s.chart_id = b.id) AS num_segni
         FROM body_chart b
         WHERE b.paziente_id = ?
         ORDER BY b.data DESC, b.id DESC`
      )
      .all(pazienteId)
  )
  handle('bodyChart:get', (id: number) => {
    const db = getDb()
    const chart = db.prepare('SELECT * FROM body_chart WHERE id = ?').get(id)
    if (!chart) throw new Error('Body chart non trovata.')
    const segni = db
      .prepare(
        `SELECT id, vista, tipo, x, y, dimensione, intensita
         FROM body_chart_segni WHERE chart_id = ? ORDER BY ordine, id`
      )
      .all(id)
    return { chart, segni }
  })
  handle('bodyChart:create', (pazienteId: number, data: string) =>
    Number(
      getDb()
        .prepare('INSERT INTO body_chart (paziente_id, data) VALUES (?, ?)')
        .run(pazienteId, data).lastInsertRowid
    )
  )
  handle('bodyChart:salva', (dati: BodyChartCompleta) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('UPDATE body_chart SET data = ?, note = ? WHERE id = ?').run(
        dati.chart.data,
        dati.chart.note,
        dati.chart.id
      )
      db.prepare('DELETE FROM body_chart_segni WHERE chart_id = ?').run(dati.chart.id)
      const ins = db.prepare(
        `INSERT INTO body_chart_segni (chart_id, vista, tipo, x, y, dimensione, intensita, ordine)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      dati.segni.forEach((s, i) =>
        ins.run(dati.chart.id, s.vista, s.tipo, s.x, s.y, s.dimensione, s.intensita, i)
      )
    })()
  })
  handle('bodyChart:delete', (id: number) => {
    getDb().prepare('DELETE FROM body_chart WHERE id = ?').run(id)
  })

  // ---- Export ----
  handle('esporta:anteprima', (sedutaId: number) => anteprimaSeduta(sedutaId))
  handle('esporta:seduta', (sedutaId: number, formato: FormatoExport) =>
    esportaSeduta(sedutaId, formato)
  )
  handle('esporta:storico', (pazienteId: number, dal: string, al: string, formato: FormatoExport) =>
    esportaStorico(pazienteId, dal, al, formato)
  )
}
