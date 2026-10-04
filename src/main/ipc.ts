import { BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { basename, join } from 'path'
import { copyFileSync, existsSync, readFileSync } from 'fs'
import { closeDb, controllaArchivio, dbAperto, getDb, initDb, riapriDb } from './db'
import { controllaSetup, FILE_CHIAVI, FILE_DB, statoAccesso } from './accesso'
import {
  cartellaBackup,
  cartellaDati,
  cartellaExport,
  backupAttivo,
  backupDaTenere,
  copiaFallita,
  impostaBackupAttivo,
  impostaBackupDaTenere,
  impostaCartellaBackup,
  impostaCartellaDati,
  impostaCartellaExport,
  blocco,
  impostaBlocco,
  barraScura,
  cartellaBackupSenzaCreare,
  cartellaCopia,
  doveDati,
  impostazioniLeggibili,
  ricominciaImpostazioni,
  cartellaTabelle,
  impostaBarraScura,
  impostaCartellaCopia,
  impostaCartellaTabelle,
  impostaIngrandimento,
  ingrandimento,
  impostaScuro,
  impostaScuroAutomatico,
  orariScuro,
  scuroAdesso,
  impostaTema,
  scuro,
  tema
} from './impostazioni'
import { spostaFileDati } from './file-dati'
import { eliminaTemporaneo, eliminaTemporaneoPresto, scriviTemporaneo } from './temporanei'
import { apriScheda } from './scheda'
import { datiScheda } from './scheda-dati'
import { esportaArchivio } from './esporta-archivio'
import { percorsoRegistro, registraErrore, ultimiErrori } from './registro'
import {
  elencoCestino,
  eliminaConCestino,
  ripristina,
  ripuliscilCestino,
  svuotaCestino
} from './cestino'
import {
  copiaFuori,
  elencoBackup,
  eseguiBackup,
  backupSeServe,
  cartellaOneDrive,
  controllaBackup,
  copieInOneDrive,
  usaOneDrive,
  ripristinaBackup
} from './backup'
import {
  authExists,
  cambiaPasswordAuth,
  domandaAuth,
  impostaDomandaAuth,
  loginAuth,
  recoverAuth,
  recoverDomandaAuth,
  setupAuth,
  togliDomandaAuth
} from './auth'
import {
  apriAnteprimaCartella,
  apriAnteprimaRelazione,
  apriAnteprimaReport,
  esportaReport,
  anteprimaSchedaIllustrata,
  esportaCartella,
  esportaRelazione,
  esportaCertificato,
  esportaSeduta,
  esportaStorico,
  type FormatoExport
} from './export'
import {
  aggiornaCompilazione,
  leggiQuestionario,
  salvaCompilazione,
  salvaQuestionario,
  elencoCompilazioni
} from './questionari'
import { duplicaProtocollo, leggiProtocollo, salvaProtocollo } from './screening'
import { calcolaPunteggio } from './screening-punteggio'
import {
  collegaCompilazione,
  creaScreening,
  elencoScreening,
  leggiScreening,
  salvaValori
} from './screening-sessioni'
import { leggiTest, salvaTest } from './test-valutazione'
import {
  duplicaValutazione,
  leggiDistretto,
  leggiValutazione,
  salvaDistretto,
  salvaValutazione
} from './valutazione'
import type { Tema } from '../shared/temi'
import { seduteDellaSettimana } from './settimana'
import { ultimaVoltaPerPaziente } from './ultima-volta'
import { andamentoDolorePerPaziente } from './andamento-dolore'
import { sedutaPrecedente } from './seduta-precedente'
import { leggiProfilo, salvaProfilo } from './profilo'
import {
  erroreSenzaDatiNelRegistro,
  richiedeTesto,
  validaData,
  validaImmagine,
  validaLink,
  validaNumeroPositivo,
  validaOra,
  validaScala010
} from './validazione'
import type {
  CertificatoInput,
  TipoChart,
  AnamnesiProssima,
  AnamnesiRemota,
  AttivitaPartecipazione,
  BodyChartCompleta,
  CompilazioneInput,
  EsercizioInput,
  PazienteCreateInput,
  PazienteDettaglio,
  PazienteInput,
  Profilo,
  DistrettoCompleto,
  QuestionarioCompleto,
  SedutaInput,
  ProtocolloScreeningCompleto,
  ValoreScreening,
  SezioneCartella,
  TipoRelazione,
  StatoPaziente,
  TermineObiettivo,
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

// Data leggibile per le etichette del cestino: nel database sta al contrario.
function dataIt(iso: string | undefined): string {
  if (!iso) return ''
  const [a, m, g] = iso.split('-')
  return g && m && a ? `${g}/${m}/${a}` : iso
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handle(channel: string, fn: (...args: any[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      // Nel registro finisce il nome dell'operazione e l'errore, mai quello che
      // e' stato scritto: serve a capire cosa si e' rotto, non a rileggere i
      // dati dei pazienti.
      registraErrore(channel, err)
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

  handle('auth:status', () => statoAccesso())
  handle('auth:setup', (password: string) => {
    if (password.length < 8) throw new Error('La password deve avere almeno 8 caratteri.')
    controllaSetup(cartellaDati())
    const { dekHex, recoveryKey } = setupAuth(authPath(), password)
    initDb(dbPath(), dekHex)
    // il cestino tiene un mese: le voci piu' vecchie se ne vanno all'accesso
    ripuliscilCestino()
    return recoveryKey
  })
  handle('auth:login', (password: string) => {
    const dekHex = loginAuth(authPath(), password)
    initDb(dbPath(), dekHex)
    // una copia al giorno, appena si entra: conserva com'era l'archivio prima
    // della sessione, anche se quella precedente e' finita male
    backupSeServe()
    // Il cestino tiene un mese, e la pulizia si fa a ogni accesso: prima era
    // solo alla creazione dell'archivio, quando il cestino e' vuoto, e le voci
    // (con dentro anche i referti dei pazienti eliminati) restavano per sempre.
    // Dopo la copia del giorno: quella conserva l'archivio com'era prima di
    // qualunque cambiamento della sessione.
    ripuliscilCestino()
  })
  handle('auth:recover', (recoveryKey: string, nuovaPassword: string) => {
    if (nuovaPassword.length < 8) throw new Error('La password deve avere almeno 8 caratteri.')
    const dekHex = recoverAuth(authPath(), recoveryKey, nuovaPassword)
    initDb(dbPath(), dekHex)
    ripuliscilCestino()
  })
  // Prima dell'accesso, quando l'archivio non si trova: si indica la cartella
  // che lo contiene. Da archivio aperto la cartella si sposta da Impostazioni,
  // che porta con se' i file.
  handle('auth:scegliCartellaDati', async () => {
    if (dbAperto()) throw new Error('L’archivio è già aperto: la cartella si cambia da Impostazioni.')
    const attuale = doveDati().percorso
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Scegli la cartella dove sono i dati (quella con riabilitazione.db)',
      defaultPath: existsSync(attuale) ? attuale : undefined,
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    const scelta = filePaths[0]
    if (!existsSync(join(scelta, FILE_DB))) {
      throw new Error(
        'In questa cartella non c’è l’archivio del programma (riabilitazione.db): scegli la cartella che lo contiene.'
      )
    }
    if (impostazioniLeggibili()) impostaCartellaDati(scelta)
    else ricominciaImpostazioni(scelta)
    return statoAccesso()
  })
  // Prima dell'accesso, quando accanto all'archivio manca auth.json: lo si
  // prende da una copia di sicurezza. La chiave che cifra l'archivio non cambia
  // mai (cambiare password la ri-avvolge soltanto), quindi le chiavi di
  // qualunque copia dello stesso archivio lo aprono, con la password che si
  // usava quando la copia e' stata fatta.
  handle('auth:prendiChiavi', async () => {
    if (dbAperto()) throw new Error('L’archivio è già aperto.')
    const dati = cartellaDati()
    if (existsSync(join(dati, FILE_CHIAVI))) return statoAccesso()
    const copie = cartellaBackupSenzaCreare(dati)
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Scegli una copia di sicurezza (la cartella che contiene auth.json)',
      defaultPath: existsSync(copie) ? copie : dati,
      properties: ['openDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    const sorgente = join(filePaths[0], FILE_CHIAVI)
    if (!existsSync(sorgente)) {
      throw new Error(
        'In questa cartella non c’è auth.json: scegli la cartella di una copia di sicurezza (per esempio dentro «Backup»).'
      )
    }
    copyFileSync(sorgente, join(dati, FILE_CHIAVI))
    return statoAccesso()
  })
  handle('auth:cambiaPassword', (vecchia: string, nuova: string) => {
    if (nuova.length < 8) throw new Error('La nuova password deve avere almeno 8 caratteri.')
    cambiaPasswordAuth(authPath(), vecchia, nuova)
  })
  handle('auth:domanda', () => domandaAuth(authPath()))
  handle('auth:impostaDomanda', (password: string, domanda: string, risposta: string) =>
    impostaDomandaAuth(authPath(), password, domanda, risposta)
  )
  handle('auth:togliDomanda', (password: string) => togliDomandaAuth(authPath(), password))
  handle('auth:recoverDomanda', (risposta: string, nuovaPassword: string) => {
    if (nuovaPassword.length < 8) throw new Error('La password deve avere almeno 8 caratteri.')
    const dekHex = recoverDomandaAuth(authPath(), risposta, nuovaPassword)
    initDb(dbPath(), dekHex)
    ripuliscilCestino()
  })

  // ---- Copie di sicurezza ----
  handle('backup:info', () => ({
    oneDrive: cartellaOneDrive() != null,
    inOneDrive: copieInOneDrive(),
    cartella: cartellaBackup(),
    attivo: backupAttivo(),
    daTenere: backupDaTenere(),
    copie: elencoBackup(),
    copiaFallita: backupAttivo() ? copiaFallita() : null
  }))
  handle('backup:cambiaCartella', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Scegli dove tenere le copie di sicurezza',
      defaultPath: cartellaBackup(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    impostaCartellaBackup(filePaths[0])
    return filePaths[0]
  })
  handle('backup:usaOneDrive', () => usaOneDrive())
  handle('backup:setAttivo', (attivo: boolean) => impostaBackupAttivo(attivo))
  handle('backup:setDaTenere', (n: number) => impostaBackupDaTenere(n))
  handle('backup:eseguiOra', () => eseguiBackup())
  handle('backup:apriCartella', () => {
    void shell.openPath(cartellaBackup())
  })
  handle('backup:controlla', (nome: string) => controllaBackup(nome))
  handle('backup:ripristina', (nome: string) => ripristinaBackup(nome))
  // Copia leggibile fuori dall'app: tabelle CSV, non un backup.
  handle('backup:esportaArchivio', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Dove salvare le tabelle leggibili',
      defaultPath: cartellaTabelle(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    impostaCartellaTabelle(filePaths[0])
    const dest = esportaArchivio(filePaths[0])
    shell.showItemInFolder(dest)
    return dest
  })
  handle('backup:copiaFuori', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Scegli dove mettere la copia (chiavetta, disco esterno, OneDrive…)',
      defaultPath: cartellaCopia(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    impostaCartellaCopia(filePaths[0])
    const dest = copiaFuori(filePaths[0])
    shell.showItemInFolder(dest)
    return dest
  })

  // ---- Impostazioni / cartella dati ----
  handle('impostazioni:info', () => ({
    cartella: cartellaDati(),
    cartellaExport: cartellaExport(),
    tema: tema(),
    scuro: scuro(),
    scuroAdesso: scuroAdesso(),
    orariScuro: orariScuro(),
    barraScura: barraScura(),
    ingrandimento: ingrandimento()
  }))
  // Non passa dal solito aiutante perche' serve sapere da quale finestra
  // arriva: e' quella che va ingrandita.
  ipcMain.handle('impostazioni:setIngrandimento', (evento, valore: number) => {
    impostaIngrandimento(valore)
    const finestra = BrowserWindow.fromWebContents(evento.sender)
    if (finestra && !finestra.isDestroyed()) {
      finestra.webContents.setZoomFactor(ingrandimento())
    }
  })
  handle('impostazioni:setBarraScura', (valore: boolean) => impostaBarraScura(valore))
  handle('impostazioni:setScuro', (valore: boolean) => impostaScuro(valore))
  handle('impostazioni:setScuroAutomatico', (dalle: string, alle: string) =>
    impostaScuroAutomatico(dalle, alle)
  )
  handle('impostazioni:setTema', (t: Tema) => impostaTema(t))
  // Il tema serve al preload prima ancora che la pagina si disegni, percio' e'
  // l'unica risposta immediata: chiesta dopo, si vedrebbe un lampo dei colori
  // di partenza a ogni avvio.
  ipcMain.on('impostazioni:temaSubito', (e) => {
    e.returnValue = { tema: tema(), scuro: scuroAdesso(), barraScura: barraScura() }
  })
  // Il controllo periodico degli orari (modalita' scura a orari fissi) non ha
  // fretta: risponde in modo asincrono e non ferma la pagina.
  ipcMain.handle('impostazioni:temaOra', () => ({ scuro: scuroAdesso() }))
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
  // Poche patologie hanno un percorso al campo: l'interruttore sta qui, cosi'
  // tutte le altre non vedono mai la parola "campo".
  handle('patologie:setCampo', (id: number, attivo: boolean) => {
    getDb().prepare('UPDATE patologie SET ha_campo = ? WHERE id = ?').run(attivo ? 1 : 0, id)
  })
  handle('patologie:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE patologie SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  // Nel cestino una voce si riconosce dal nome: "Squat monopodalico", non
  // "esercizio 42". Tutte le tabelle della libreria hanno la colonna nome.
  const nomeDi = (tabella: string, id: number): string =>
    (
      getDb().prepare(`SELECT nome FROM ${tabella} WHERE id = ?`).get(id) as
        | { nome: string }
        | undefined
    )?.nome ?? 'senza nome'

  handle('patologie:delete', (id: number) => {
    eliminaConCestino('patologie', id, 'Patologia', nomeDi('patologie', id))
  })

  // ---- Gruppi (dove segui il paziente: Centro, Studio, Domicilio...) ----
  handle('gruppi:list', () => getDb().prepare('SELECT * FROM gruppi ORDER BY ordine, nome').all())
  handle('gruppi:create', (nome: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM gruppi')
      .get() as { next: number }
    return Number(
      db.prepare('INSERT INTO gruppi (nome, ordine) VALUES (?, ?)').run(nome.trim(), next)
        .lastInsertRowid
    )
  })
  handle('gruppi:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE gruppi SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })
  handle('gruppi:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE gruppi SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('gruppi:delete', (id: number) => {
    eliminaConCestino('gruppi', id, 'Gruppo', nomeDi('gruppi', id))
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
    eliminaConCestino('distretti', id, 'Distretto', nomeDi('distretti', id))
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
    validaData(data, 'La data della valutazione', { obbligatoria: true })
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
  // ---- Indicazioni per casa ----
  handle('indicazioni:list', () =>
    getDb().prepare('SELECT * FROM indicazioni ORDER BY ordine, id').all()
  )
  handle('indicazioni:create', (testo: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM indicazioni')
      .get() as { next: number }
    return Number(
      db.prepare('INSERT INTO indicazioni (testo, ordine) VALUES (?, ?)').run(testo.trim(), next)
        .lastInsertRowid
    )
  })
  handle('indicazioni:rinomina', (id: number, testo: string) => {
    getDb().prepare('UPDATE indicazioni SET testo = ? WHERE id = ?').run(testo.trim(), id)
  })
  handle('indicazioni:delete', (id: number) => {
    getDb().prepare('DELETE FROM indicazioni WHERE id = ?').run(id)
  })
  handle('indicazioni:delPaziente', (pazienteId: number) =>
    (
      getDb()
        .prepare('SELECT indicazione_id FROM paziente_indicazioni WHERE paziente_id = ?')
        .all(pazienteId) as { indicazione_id: number }[]
    ).map((r) => r.indicazione_id)
  )
  handle(
    'indicazioni:setDelPaziente',
    (pazienteId: number, ids: number[], frequenza: string | null) => {
      const db = getDb()
      db.transaction(() => {
        db.prepare('DELETE FROM paziente_indicazioni WHERE paziente_id = ?').run(pazienteId)
        const ins = db.prepare(
          'INSERT INTO paziente_indicazioni (paziente_id, indicazione_id) VALUES (?, ?)'
        )
        for (const id of ids) ins.run(pazienteId, id)
        db.prepare('UPDATE pazienti SET frequenza_casa = ? WHERE id = ?').run(
          frequenza?.trim() || null,
          pazienteId
        )
      })()
    }
  )

  // ---- Massimali e misure dell'atleta ----
  handle('massimali:list', (pazienteId: number) =>
    getDb()
      .prepare('SELECT * FROM massimali WHERE paziente_id = ? ORDER BY data DESC, id DESC')
      .all(pazienteId)
  )
  handle(
    'massimali:create',
    (pazienteId: number, esercizio: string, valore: number, unita: string | null, data: string) => {
      richiedeTesto(esercizio, "Il nome dell'esercizio")
      validaNumeroPositivo(valore, 'Il valore')
      validaData(data, 'La data', { obbligatoria: true })
      return Number(
        getDb()
          .prepare(
            'INSERT INTO massimali (paziente_id, esercizio, valore, unita, data) VALUES (?, ?, ?, ?, ?)'
          )
          .run(pazienteId, esercizio.trim(), valore, unita?.trim() || null, data).lastInsertRowid
      )
    }
  )
  handle('massimali:delete', (id: number) => {
    getDb().prepare('DELETE FROM massimali WHERE id = ?').run(id)
  })
  handle('massimali:setMisure', (pazienteId: number, peso: number | null, altezza: number | null) => {
    if (peso != null) validaNumeroPositivo(peso, 'Il peso')
    if (altezza != null) validaNumeroPositivo(altezza, "L'altezza")
    getDb().prepare('UPDATE pazienti SET peso = ?, altezza = ? WHERE id = ?').run(peso, altezza, pazienteId)
  })

  // ---- Segni di riferimento: le due o tre cose che si ricontrollano ----
  handle('segni:list', (pazienteId: number) =>
    getDb()
      .prepare('SELECT * FROM segni WHERE paziente_id = ? ORDER BY ordine, id')
      .all(pazienteId)
  )
  // Prima misura e ultima, con le date: e' quello che si legge nella scheda
  // ("dolore nello squat: da 7 a 3"). Il resto delle misure non serve li'.
  handle('segni:andamento', (pazienteId: number) =>
    getDb()
      .prepare(
        `SELECT g.*,
           (SELECT s.data FROM segno_valori v JOIN sedute s ON s.id = v.seduta_id
             WHERE v.segno_id = g.id ORDER BY s.data, s.id LIMIT 1) AS prima_data,
           (SELECT v.valore FROM segno_valori v JOIN sedute s ON s.id = v.seduta_id
             WHERE v.segno_id = g.id ORDER BY s.data, s.id LIMIT 1) AS prima_valore,
           (SELECT s.data FROM segno_valori v JOIN sedute s ON s.id = v.seduta_id
             WHERE v.segno_id = g.id ORDER BY s.data DESC, s.id DESC LIMIT 1) AS ultima_data,
           (SELECT v.valore FROM segno_valori v JOIN sedute s ON s.id = v.seduta_id
             WHERE v.segno_id = g.id ORDER BY s.data DESC, s.id DESC LIMIT 1) AS ultima_valore,
           (SELECT COUNT(*) FROM segno_valori v WHERE v.segno_id = g.id) AS misure
         FROM segni g WHERE g.paziente_id = ? ORDER BY g.ordine, g.id`
      )
      .all(pazienteId)
  )
  handle('segni:create', (pazienteId: number, nome: string, unita: string | null) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM segni WHERE paziente_id = ?')
      .get(pazienteId) as { next: number }
    return Number(
      db
        .prepare('INSERT INTO segni (paziente_id, nome, unita, ordine) VALUES (?, ?, ?, ?)')
        .run(pazienteId, nome.trim(), unita?.trim() || null, next).lastInsertRowid
    )
  })
  handle('segni:rinomina', (id: number, nome: string, unita: string | null) => {
    getDb()
      .prepare('UPDATE segni SET nome = ?, unita = ? WHERE id = ?')
      .run(nome.trim(), unita?.trim() || null, id)
  })
  // Eliminando il segno se ne vanno anche le misure: senza il segno non
  // vogliono dire piu' niente.
  handle('segni:delete', (id: number) => {
    getDb().prepare('DELETE FROM segni WHERE id = ?').run(id)
  })
  handle('segni:dellaSeduta', (sedutaId: number) =>
    getDb()
      .prepare('SELECT segno_id, valore FROM segno_valori WHERE seduta_id = ?')
      .all(sedutaId)
  )

  // ---- Chi firma i fogli stampati ----
  handle('profilo:leggi', () => leggiProfilo())
  handle('profilo:salva', (p: Profilo) => salvaProfilo(p))

  // ---- Bozza della seduta in costruzione ----
  handle('bozze:leggi', (pazienteId: number) =>
    getDb()
      .prepare('SELECT aggiornata_il, contenuto FROM bozze_seduta WHERE paziente_id = ?')
      .get(pazienteId) ?? null
  )
  handle('bozze:salva', (pazienteId: number, contenuto: string) => {
    getDb()
      .prepare(
        `INSERT INTO bozze_seduta (paziente_id, aggiornata_il, contenuto) VALUES (?, ?, ?)
         ON CONFLICT(paziente_id) DO UPDATE SET aggiornata_il = excluded.aggiornata_il,
           contenuto = excluded.contenuto`
      )
      .run(pazienteId, new Date().toISOString(), contenuto)
  })
  handle('bozze:elimina', (pazienteId: number) => {
    getDb().prepare('DELETE FROM bozze_seduta WHERE paziente_id = ?').run(pazienteId)
  })

  handle('valutazioni:duplica', (id: number, data: string) => duplicaValutazione(id, data))
  handle('valutazioni:salva', (dati: ValutazioneCompleta) => salvaValutazione(dati))
  handle('valutazioni:delete', (id: number) => {
    const v = getDb().prepare('SELECT data FROM valutazioni WHERE id = ?').get(id) as
      | { data: string }
      | undefined
    eliminaConCestino('valutazioni', id, 'Valutazione', `Valutazione del ${dataIt(v?.data)}`)
  })

  // ---- Fasi ----
  // Tutte le fasi della patologia, palestra e campo insieme: chi le usa
  // filtra secondo il posto in cui deve mostrarle.
  handle('fasi:list', (patologiaId: number) =>
    getDb()
      .prepare('SELECT * FROM fasi WHERE patologia_id = ? ORDER BY campo, ordine, id')
      .all(patologiaId)
  )
  handle('fasi:create', (patologiaId: number, nome: string, campo = false) => {
    const db = getDb()
    // L'ordine si conta dentro all'elenco di appartenenza: palestra e campo
    // sono due elenchi, ognuno con la sua numerazione.
    const { next } = db
      .prepare(
        'SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM fasi WHERE patologia_id = ? AND campo = ?'
      )
      .get(patologiaId, campo ? 1 : 0) as { next: number }
    return Number(
      db.prepare('INSERT INTO fasi (patologia_id, nome, ordine, campo) VALUES (?, ?, ?, ?)')
        .run(patologiaId, nome.trim(), next, campo ? 1 : 0).lastInsertRowid
    )
  })
  handle('fasi:update', (id: number, nome: string) => {
    getDb().prepare('UPDATE fasi SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('fasi:delete', (id: number) => {
    eliminaConCestino('fasi', id, 'Fase', nomeDi('fasi', id))
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
    eliminaConCestino('obiettivi', id, 'Obiettivo', nomeDi('obiettivi', id))
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
    eliminaConCestino('sezioni', id, 'Sezione', nomeDi('sezioni', id))
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
    eliminaConCestino('test_avanzamento', id, 'Test di avanzamento', nomeDi('test_avanzamento', id))
  })
  handle('testAvanzamento:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE test_avanzamento SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Categorie ----
  // In ordine alfabetico: le categorie sono tante e si cercano per nome, e un
  // ordine deciso a mano andava tenuto aggiornato a ogni aggiunta. L'ordine lo
  // decide qui, non nella query: COLLATE NOCASE dell'SQL confonde le lettere
  // accentate (es. "Mobilità" finiva fuori posto), mentre localeCompare
  // conosce le regole dell'italiano.
  handle('categorie:list', () =>
    (getDb().prepare('SELECT * FROM categorie').all() as { nome: string }[]).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'it')
    )
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
  // Il dosaggio a cluster ha senso in poche categorie (la pliometria estensiva):
  // la spunta sta qui, cosi' le altre restano com'erano, senza campi in piu'.
  handle('categorie:setCluster', (id: number, attivo: boolean) => {
    getDb()
      .prepare('UPDATE categorie SET dosaggio_cluster = ? WHERE id = ?')
      .run(attivo ? 1 : 0, id)
  })
  // Stessa cosa per le ripetizioni di riserva: hanno senso nella forza, non
  // nella mobilita'.
  handle('categorie:setRir', (id: number, attivo: boolean) => {
    getDb().prepare('UPDATE categorie SET dosaggio_rir = ? WHERE id = ?').run(attivo ? 1 : 0, id)
  })
  // Un solo livello: una categoria che ha gia' dei distretti dentro non puo'
  // finire dentro a un'altra, e non ci si puo' mettere dentro a se stessa.
  handle('categorie:setPadre', (id: number, padreId: number | null) => {
    const db = getDb()
    if (padreId != null) {
      if (padreId === id) throw new Error('Una categoria non puo\' stare dentro a se stessa.')
      const figlie = db
        .prepare('SELECT COUNT(*) AS n FROM categorie WHERE padre_id = ?')
        .get(id) as { n: number }
      if (figlie.n > 0) {
        throw new Error(
          'Questa categoria ha gia\' dei distretti dentro: prima spostali, poi potrai metterla dentro a un\'altra.'
        )
      }
      const padre = db.prepare('SELECT padre_id FROM categorie WHERE id = ?').get(padreId) as
        | { padre_id: number | null }
        | undefined
      if (padre?.padre_id != null) {
        throw new Error('Si puo\' scendere di un livello solo: quella categoria e\' gia\' dentro a un\'altra.')
      }
    }
    db.prepare('UPDATE categorie SET padre_id = ? WHERE id = ?').run(padreId, id)
  })
  handle('categorie:delete', (id: number) => {
    eliminaConCestino('categorie', id, 'Categoria di esercizi', nomeDi('categorie', id))
  })

  // ---- Esercizi ----
  // Colonne esplicite: `e.*` trascinerebbe anche `immagine` in ogni elenco.
  handle('esercizi:list', (includiArchiviati: boolean) =>
    getDb()
      .prepare(
        `SELECT e.id, e.nome, e.categoria_id, e.serie_default, e.cluster_default,
                e.ripetizioni_default, e.rir_default, e.carico_default, e.unita_carico,
                e.recupero_cluster_default,
                e.recupero_default, e.nota_tecnica, e.link, e.archiviato,
                c.nome AS categoria_nome, c.dosaggio_cluster, c.dosaggio_rir,
                (SELECT COUNT(*) FROM seduta_esercizi se WHERE se.esercizio_id = e.id) AS usi,
                (e.immagine IS NOT NULL) AS ha_immagine
         FROM esercizi e JOIN categorie c ON c.id = e.categoria_id
         ${includiArchiviati ? '' : 'WHERE e.archiviato = 0'}
         ORDER BY e.nome`
      )
      .all()
  )
  handle('esercizi:create', (data: EsercizioInput) => {
    validaLink(data.link, 'Il link del video')
    return Number(
      getDb()
        .prepare(
          `INSERT INTO esercizi (nome, categoria_id, serie_default, cluster_default,
                                 ripetizioni_default, rir_default, carico_default, unita_carico,
                                 recupero_cluster_default,
                                 recupero_default, nota_tecnica, link)
           VALUES (@nome, @categoria_id, @serie_default, @cluster_default,
                   @ripetizioni_default, @rir_default, @carico_default, @unita_carico,
                   @recupero_cluster_default,
                   @recupero_default, @nota_tecnica, @link)`
        )
        .run({ ...data, nome: data.nome.trim(), link: data.link?.trim() || null }).lastInsertRowid
    )
  })
  handle('esercizi:update', (id: number, data: EsercizioInput) => {
    validaLink(data.link, 'Il link del video')
    getDb()
      .prepare(
        `UPDATE esercizi SET nome = @nome, categoria_id = @categoria_id,
         serie_default = @serie_default, cluster_default = @cluster_default,
         ripetizioni_default = @ripetizioni_default, rir_default = @rir_default,
         carico_default = @carico_default,
         unita_carico = @unita_carico,
         recupero_cluster_default = @recupero_cluster_default,
         recupero_default = @recupero_default,
         nota_tecnica = @nota_tecnica, link = @link
         WHERE id = @id`
      )
      .run({ ...data, nome: data.nome.trim(), link: data.link?.trim() || null, id })
  })
  handle('esercizi:setArchiviato', (id: number, archiviato: boolean) => {
    getDb().prepare('UPDATE esercizi SET archiviato = ? WHERE id = ?').run(archiviato ? 1 : 0, id)
  })
  handle('esercizi:delete', (id: number) => {
    // Un esercizio citato da una seduta non si cancella: le sedute passate
    // devono restare leggibili. Il vincolo del database lo impedisce comunque,
    // ma da solo direbbe "FOREIGN KEY constraint failed": qui si dice cosa fare.
    const usi = getDb()
      .prepare('SELECT COUNT(*) AS n FROM seduta_esercizi WHERE esercizio_id = ?')
      .get(id) as { n: number }
    if (usi.n > 0) {
      throw new Error(
        `Questo esercizio è usato in ${usi.n === 1 ? 'una seduta' : `${usi.n} sedute`} già registrate e non si può eliminare: usa "Archivia" per toglierlo dall'elenco senza perdere quelle sedute.`
      )
    }
    eliminaConCestino('esercizi', id, 'Esercizio', nomeDi('esercizi', id))
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
    validaImmagine(dataUrl)
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
    const fase = getDb()
      .prepare('SELECT patologia_id, campo FROM fasi WHERE id = ?')
      .get(faseId) as { patologia_id: number; campo: number } | undefined
    if (!fase || fase.patologia_id !== patologiaId) {
      throw new Error('La fase selezionata non appartiene alla patologia del paziente.')
    }
    // Il campo e' un percorso parallelo: la fase corrente e' sempre di palestra,
    // altrimenti "Avanza" non saprebbe da dove ripartire.
    if (fase.campo === 1) {
      throw new Error(
        'Una fase del campo non si imposta come fase corrente: il campo si sceglie sulla singola seduta.'
      )
    }
  }

  // L'ultima seduta e' l'ultima fatta, non l'ultima in calendario: una seduta
  // gia' fissata per la settimana prossima portava il paziente in cima
  // all'elenco prima ancora di vederlo.
  handle('pazienti:list', () =>
    getDb()
      .prepare(
        `SELECT p.*, pat.nome AS patologia_nome, f.nome AS fase_nome, g.nome AS gruppo_nome,
                (SELECT MAX(s.data) FROM sedute s
                 WHERE s.paziente_id = p.id AND s.data <= date('now', 'localtime')) AS ultima_seduta
         FROM pazienti p
         LEFT JOIN patologie pat ON pat.id = p.patologia_id
         LEFT JOIN fasi f ON f.id = p.fase_corrente_id
         LEFT JOIN gruppi g ON g.id = p.gruppo_id
         -- in cima chi ha la seduta piu' recente; chi non ne ha ancora resta in
         -- fondo, in ordine alfabetico
         ORDER BY ultima_seduta IS NULL, ultima_seduta DESC, p.cognome, p.nome`
      )
      .all()
  )
  handle('pazienti:create', (data: PazienteCreateInput) => {
    richiedeTesto(data.nome, 'Il nome')
    richiedeTesto(data.cognome, 'Il cognome')
    validaData(data.data_nascita, 'La data di nascita')
    validaData(data.data_intervento, "La data dell'intervento")
    checkFaseCoerente(data.patologia_id, data.fase_corrente_id)
    return Number(
      getDb()
        .prepare(
          `INSERT INTO pazienti
             (nome, cognome, data_nascita, codice_fiscale, telefono, email, lavoro, inviato_da, sport, diagnosi,
              tipo_intervento, data_intervento, precauzioni, patologia_id, fase_corrente_id, gruppo_id)
           VALUES
             (@nome, @cognome, @data_nascita, @codice_fiscale, @telefono, @email, @lavoro, @inviato_da, @sport, @diagnosi,
              @tipo_intervento, @data_intervento, @precauzioni, @patologia_id, @fase_corrente_id, @gruppo_id)`
        )
        .run({ ...data, nome: data.nome.trim(), cognome: data.cognome.trim() }).lastInsertRowid
    )
  })
  handle('pazienti:update', (id: number, data: PazienteInput) => {
    richiedeTesto(data.nome, 'Il nome')
    richiedeTesto(data.cognome, 'Il cognome')
    validaData(data.data_nascita, 'La data di nascita')
    validaData(data.data_intervento, "La data dell'intervento")
    getDb()
      .prepare(
        `UPDATE pazienti SET nome = @nome, cognome = @cognome,
         data_nascita = @data_nascita, codice_fiscale = @codice_fiscale, telefono = @telefono, email = @email,
         lavoro = @lavoro, inviato_da = @inviato_da, sport = @sport, diagnosi = @diagnosi,
         tipo_intervento = @tipo_intervento, data_intervento = @data_intervento,
         precauzioni = @precauzioni, arto_operato = @arto_operato, gruppo_id = @gruppo_id
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
    const p = getDb().prepare('SELECT nome, cognome FROM pazienti WHERE id = ?').get(id) as
      | { nome: string; cognome: string }
      | undefined
    eliminaConCestino('pazienti', id, 'Paziente', `${p?.cognome ?? ''} ${p?.nome ?? ''}`.trim())
  })
  // ---- Screening ----
  handle('screening:sport', () =>
    (
      getDb()
        .prepare('SELECT DISTINCT sport FROM screening_protocolli ORDER BY sport')
        .all() as { sport: string }[]
    ).map((r) => r.sport)
  )
  handle('screening:list', (sport: string | null) =>
    getDb()
      .prepare(
        `SELECT * FROM screening_protocolli
         WHERE (? IS NULL OR sport = ?)
         ORDER BY sport, ordine, id`
      )
      .all(sport, sport)
  )
  handle('screening:get', (id: number) => leggiProtocollo(id))
  handle('screening:create', (nome: string, sport: string) => {
    const db = getDb()
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM screening_protocolli')
      .get() as { next: number }
    const id = Number(
      db
        .prepare('INSERT INTO screening_protocolli (nome, sport, ordine) VALUES (?, ?, ?)')
        .run(nome.trim(), sport.trim(), next).lastInsertRowid
    )
    // Le due sezioni con cui si comincia quasi sempre: si rinominano e si
    // cancellano come le altre.
    const ins = db.prepare(
      'INSERT INTO screening_sezioni (protocollo_id, nome, ordine) VALUES (?, ?, ?)'
    )
    ins.run(id, 'In ambulatorio', 0)
    ins.run(id, 'In campo', 1)
    return id
  })
  handle('screening:rinomina', (id: number, nome: string) => {
    getDb().prepare('UPDATE screening_protocolli SET nome = ? WHERE id = ?').run(nome.trim(), id)
  })
  handle('screening:salva', (dati: ProtocolloScreeningCompleto) => salvaProtocollo(dati))
  handle('screening:duplica', (id: number, nome: string) => duplicaProtocollo(id, nome))
  handle('screening:delete', (id: number) => {
    eliminaConCestino('screening_protocolli', id, 'Protocollo di screening', nomeDi('screening_protocolli', id))
  })
  handle('screening:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE screening_protocolli SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Screening eseguiti ----
  handle('screeningSvolti:list', (pazienteId: number | null) => elencoScreening(pazienteId))
  handle('screeningSvolti:get', (id: number) => leggiScreening(id))
  handle(
    'screeningSvolti:create',
    (pazienteId: number, protocolloId: number, data: string) => {
      validaData(data, 'La data dello screening', { obbligatoria: true })
      return creaScreening(pazienteId, protocolloId, data)
    }
  )
  handle(
    'screeningSvolti:salva',
    (id: number, data: string, note: string | null, valori: ValoreScreening[]) => {
      validaData(data, 'La data dello screening', { obbligatoria: true })
      return salvaValori(id, data, note, valori)
    }
  )
  handle(
    'screeningSvolti:collegaQuestionario',
    (id: number, questionarioId: number, compilazioneId: number) =>
      collegaCompilazione(id, questionarioId, compilazioneId)
  )
  handle('screeningSvolti:punteggio', (id: number) => calcolaPunteggio(id))
  handle('screeningSvolti:anteprimaReport', (ids: number[]) => apriAnteprimaReport(ids))
  handle('screeningSvolti:report', (ids: number[]) => esportaReport(ids))
  handle('screeningSvolti:delete', (id: number) => {
    const sc = getDb()
      .prepare('SELECT data, protocollo_nome FROM screening_sessioni WHERE id = ?')
      .get(id) as { data: string; protocollo_nome: string } | undefined
    eliminaConCestino(
      'screening_sessioni',
      id,
      'Screening',
      `${sc?.protocollo_nome ?? 'Screening'} del ${dataIt(sc?.data)}`
    )
  })

  // ---- Follow-up ----
  // Le due liste escono dalla stessa query dell'elenco pazienti, divise per
  // stato: in trattamento in ordine di seduta piu' recente, in follow-up in
  // ordine di data da contattare (chi non ne ha in fondo).
  handle('followUp:list', () => {
    const righe = getDb()
      .prepare(
        `SELECT p.*, pat.nome AS patologia_nome, f.nome AS fase_nome,
                (SELECT MAX(s.data) FROM sedute s
                 WHERE s.paziente_id = p.id AND s.data <= date('now', 'localtime')) AS ultima_seduta
         FROM pazienti p
         LEFT JOIN patologie pat ON pat.id = p.patologia_id
         LEFT JOIN fasi f ON f.id = p.fase_corrente_id
         ORDER BY p.cognome, p.nome`
      )
      .all() as (PazienteDettaglio & { stato: StatoPaziente })[]

    const perSeduta = (a: PazienteDettaglio, b: PazienteDettaglio): number =>
      (b.ultima_seduta ?? '').localeCompare(a.ultima_seduta ?? '')
    // chi ha una data da rispettare viene prima, in ordine di scadenza
    const perScadenza = (a: PazienteDettaglio, b: PazienteDettaglio): number => {
      if (a.follow_up_il == null) return b.follow_up_il == null ? 0 : 1
      if (b.follow_up_il == null) return -1
      return a.follow_up_il.localeCompare(b.follow_up_il)
    }
    return {
      trattamento: righe.filter((p) => p.stato !== 'concluso').sort(perSeduta),
      concluso: righe.filter((p) => p.stato === 'concluso').sort(perScadenza)
    }
  })

  handle(
    'followUp:setStato',
    (id: number, stato: StatoPaziente, followUpIl: string | null) => {
      getDb()
        .prepare('UPDATE pazienti SET stato = ?, follow_up_il = ? WHERE id = ?')
        .run(stato, stato === 'concluso' ? followUpIl : null, id)
    }
  )
  handle('followUp:setFollowUp', (id: number, followUpIl: string | null) => {
    getDb().prepare('UPDATE pazienti SET follow_up_il = ? WHERE id = ?').run(followUpIl, id)
  })
  // Spuntare "contattato" segna la data di oggi e libera il prossimo contatto:
  // se ne serve un altro, la data la si rimette a mano.
  handle('followUp:segnaContattato', (id: number, contattato: boolean) => {
    const db = getDb()
    if (contattato) {
      db.prepare(
        "UPDATE pazienti SET contattato_il = date('now', 'localtime'), follow_up_il = NULL WHERE id = ?"
      ).run(id)
    } else {
      db.prepare('UPDATE pazienti SET contattato_il = NULL WHERE id = ?').run(id)
    }
  })
  handle('followUp:setRecensione', (id: number, recensione: boolean) => {
    getDb()
      .prepare('UPDATE pazienti SET recensione = ? WHERE id = ?')
      .run(recensione ? 1 : 0, id)
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
           VALUES (?, ?, date('now', 'localtime'))`
        )
        .run(pazienteId, obiettivoId)
    } else {
      getDb()
        .prepare('DELETE FROM paziente_obiettivi WHERE paziente_id = ? AND obiettivo_id = ?')
        .run(pazienteId, obiettivoId)
    }
  })
  // Il dolore nel tempo per la linguetta "Quadro": la query sta in un file
  // suo, cosi' il test la puo' eseguire.
  handle('pazienti:andamentoDolore', (pazienteId: number) => andamentoDolorePerPaziente(pazienteId))
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
    // Le misure dei segni di riferimento seguono la seduta in cui sono state
    // prese: si salvano e si cancellano con lei.
    const insSegno = db.prepare(
      'INSERT INTO segno_valori (segno_id, seduta_id, valore) VALUES (?, ?, ?)'
    )
    for (const v of input.segni) insSegno.run(v.segno_id, sedutaId, v.valore)
    const insTecnica = db.prepare(
      'INSERT OR IGNORE INTO seduta_tecniche (seduta_id, tecnica_id) VALUES (?, ?)'
    )
    for (const t of input.tecnica_ids ?? []) insTecnica.run(sedutaId, t)
    const insSez = db.prepare(
      'INSERT INTO seduta_sezioni (seduta_id, sezione_id, nome, ordine) VALUES (?, ?, ?, ?)'
    )
    const sezioneIds = input.sezioni.map(
      (s, i) => Number(insSez.run(sedutaId, s.sezione_id, s.nome.trim(), i).lastInsertRowid)
    )
    const insEs = db.prepare(
      `INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, serie, cluster,
                                    ripetizioni, rir, carico, recupero_cluster, recupero, nota,
                                    ordine, seduta_sezione_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    input.esercizi.forEach((e, i) =>
      insEs.run(
        sedutaId,
        e.esercizio_id,
        e.nome_libero,
        e.serie,
        e.cluster,
        e.ripetizioni,
        e.rir,
        e.carico,
        e.recupero_cluster,
        e.recupero,
        e.nota,
        i,
        e.sezioneIndex != null ? (sezioneIds[e.sezioneIndex] ?? null) : null
      )
    )
  }

  // Le sedute di tutti, in un intervallo di date: la schermata della settimana.
  handle('sedute:settimana', (dal: string, al: string) => seduteDellaSettimana(dal, al))
  handle('archivio:controlla', () => controllaArchivio())
  handle('sedute:list', (pazienteId: number) =>
    getDb()
      .prepare(
        `SELECT s.id, s.paziente_id, s.data, s.ora, s.focus, s.dolore, s.sforzo, f.nome AS fase_nome,
           COALESCE(f.campo, 0) AS fase_campo, s.note,
           s.riferito_andamento, s.riferito, s.trattamento,
           (SELECT GROUP_CONCAT(t.nome, ' · ')
              FROM seduta_tecniche st JOIN tecniche t ON t.id = st.tecnica_id
              WHERE st.seduta_id = s.id) AS tecniche_nomi,
           (SELECT COUNT(*) FROM seduta_esercizi se WHERE se.seduta_id = s.id) AS num_esercizi
         FROM sedute s
         LEFT JOIN fasi f ON f.id = s.fase_id
         WHERE s.paziente_id = ?
         ORDER BY s.data DESC, s.id DESC`
      )
      .all(pazienteId)
  )
  // I focus gia' scritti, dal piu' usato di recente: si ripropongono mentre si
  // scrive, cosi' "preparazione corsa" si scrive una volta sola.
  handle('sedute:focusUsati', () =>
    (
      getDb()
        .prepare(
          `SELECT focus FROM sedute
           WHERE focus IS NOT NULL AND TRIM(focus) <> ''
           GROUP BY focus ORDER BY MAX(data) DESC, MAX(id) DESC LIMIT 30`
        )
        .all() as { focus: string }[]
    ).map((r) => r.focus)
  )
  // Com'era dosato ogni esercizio l'ultima volta che questo paziente l'ha
  // fatto: la query sta in un file suo, cosi' il test la puo' eseguire.
  handle('sedute:ultimaVolta', (pazienteId: number, escludi: number | null) =>
    ultimaVoltaPerPaziente(pazienteId, escludi)
  )
  handle('sedute:precedente', (pazienteId: number, escludi: number | null, finoAl: string) =>
    sedutaPrecedente(pazienteId, escludi, finoAl)
  )

  // ---- Tecniche del trattamento ----
  handle('tecniche:list', (includiArchiviate: boolean) =>
    getDb()
      .prepare(
        `SELECT * FROM tecniche ${includiArchiviate ? '' : 'WHERE archiviata = 0'}
         ORDER BY ordine, nome`
      )
      .all()
  )
  handle('tecniche:crea', (nome: string) => {
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
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM tecniche')
      .get() as { next: number }
    return Number(
      db.prepare('INSERT INTO tecniche (nome, ordine) VALUES (?, ?)').run(pulito, next).lastInsertRowid
    )
  })
  handle('tecniche:setArchiviata', (id: number, archiviata: boolean) => {
    getDb().prepare('UPDATE tecniche SET archiviata = ? WHERE id = ?').run(archiviata ? 1 : 0, id)
  })
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
        `SELECT se.esercizio_id, se.nome_libero,
                COALESCE(e.nome, se.nome_libero) AS nome, c.nome AS categoria_nome, e.link,
                e.unita_carico,
                (e.immagine IS NOT NULL) AS ha_immagine,
                se.serie, se.cluster, se.ripetizioni, se.rir, se.carico, se.recupero_cluster,
                se.recupero, se.nota, se.seduta_sezione_id
         FROM seduta_esercizi se
         LEFT JOIN esercizi e ON e.id = se.esercizio_id
         LEFT JOIN categorie c ON c.id = e.categoria_id
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
    const tecnica_ids = (
      db.prepare('SELECT tecnica_id FROM seduta_tecniche WHERE seduta_id = ?').all(id) as {
        tecnica_id: number
      }[]
    ).map((t) => t.tecnica_id)
    return { ...seduta, tecnica_ids, sezioni }
  })
  function validaSeduta(input: SedutaInput): void {
    validaData(input.data, 'La data della seduta', { obbligatoria: true })
    validaOra(input.ora, "L'orario della seduta")
    validaScala010(input.dolore, 'Il dolore')
    validaScala010(input.sforzo, 'Lo sforzo percepito')
    // Ogni riga viene dalla libreria (esercizio_id) oppure e' scritta al volo
    // per questa seduta (nome_libero): mai tutte e due, mai nessuna delle due.
    for (const e of input.esercizi) {
      if ((e.esercizio_id == null) === (e.nome_libero == null)) {
        throw new Error(
          "Un esercizio della seduta non ha ne' un esercizio di libreria ne' un nome: riprova."
        )
      }
    }
  }

  handle('sedute:create', (input: SedutaInput) => {
    validaSeduta(input)
    const db = getDb()
    return db.transaction(() => {
      const sid = db
        .prepare(
          `INSERT INTO sedute (paziente_id, data, ora, fase_id, focus, dolore, sforzo,
                               riferito_andamento, riferito, trattamento, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.paziente_id,
          input.data,
          input.ora,
          input.fase_id,
          input.focus,
          input.dolore,
          input.sforzo,
          input.riferito_andamento ?? null,
          input.riferito ?? null,
          input.trattamento ?? null,
          input.note
        ).lastInsertRowid
      insertFigliSeduta(sid, input)
      return Number(sid)
    })()
  })
  // Programmare la settimana: la stessa seduta copiata su piu' giorni. Chi
  // prepara il lunedi', il mercoledi' e il venerdi' lo fa una volta sola, e poi
  // il giorno stesso apre quella del giorno e cambia i due esercizi che vuole.
  handle('sedute:programma', (origineId: number, date: string[], ora: string | null = null) => {
    validaOra(ora, "L'orario della seduta")
    for (const data of date) validaData(data, 'La data della seduta', { obbligatoria: true })
    const db = getDb()
    const sorgente = db.prepare('SELECT * FROM sedute WHERE id = ?').get(origineId) as
      | { paziente_id: number; fase_id: number | null; focus: string | null; note: string | null }
      | undefined
    if (!sorgente) throw new Error('Seduta da copiare non trovata.')
    const sezioni = db
      .prepare('SELECT id, sezione_id, nome FROM seduta_sezioni WHERE seduta_id = ? ORDER BY ordine, id')
      .all(origineId) as { id: number; sezione_id: number | null; nome: string }[]
    const esercizi = db
      .prepare(
        `SELECT esercizio_id, nome_libero, serie, cluster, ripetizioni, rir, carico,
                recupero_cluster, recupero, nota, seduta_sezione_id
         FROM seduta_esercizi WHERE seduta_id = ? ORDER BY ordine, id`
      )
      .all(origineId) as {
      esercizio_id: number | null
      nome_libero: string | null
      serie: string | null
      cluster: string | null
      ripetizioni: string | null
      rir: string | null
      carico: string | null
      recupero_cluster: string | null
      recupero: string | null
      nota: string | null
      seduta_sezione_id: number | null
    }[]

    return db.transaction(() => {
      const create: number[] = []
      for (const data of date) {
        const sid = db
          .prepare(
            'INSERT INTO sedute (paziente_id, data, ora, fase_id, focus, note) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(sorgente.paziente_id, data, ora, sorgente.fase_id, sorgente.focus, sorgente.note)
          .lastInsertRowid
        insertFigliSeduta(sid, {
          paziente_id: sorgente.paziente_id,
          data,
          // L'orario e' quello scelto per il nuovo appuntamento, non quello
          // (se mai ce l'aveva) della seduta da cui si copia il programma.
          ora,
          fase_id: sorgente.fase_id,
          focus: sorgente.focus,
          // Dolore e sforzo non si copiano: sono come e' andata quella volta,
          // non qualcosa da programmare.
          dolore: null,
          sforzo: null,
          segni: [],
          // Nemmeno cosa riferisce e il trattamento: si scrivono il giorno stesso.
          riferito_andamento: null,
          riferito: null,
          tecnica_ids: [],
          trattamento: null,
          note: sorgente.note,
          sezioni: sezioni.map((z) => ({ sezione_id: z.sezione_id, nome: z.nome })),
          esercizi: esercizi.map((e) => ({
            esercizio_id: e.esercizio_id,
            nome_libero: e.nome_libero,
            serie: e.serie,
            cluster: e.cluster,
            ripetizioni: e.ripetizioni,
            rir: e.rir,
            carico: e.carico,
            recupero_cluster: e.recupero_cluster,
            recupero: e.recupero,
            nota: e.nota,
            sezioneIndex:
              e.seduta_sezione_id == null
                ? null
                : (() => {
                    const i = sezioni.findIndex((z) => z.id === e.seduta_sezione_id)
                    return i < 0 ? null : i
                  })()
          }))
        })
        create.push(Number(sid))
      }
      return create
    })()
  })
  handle('sedute:update', (id: number, input: SedutaInput) => {
    validaSeduta(input)
    const db = getDb()
    db.transaction(() => {
      db.prepare(
        `UPDATE sedute SET data = ?, ora = ?, fase_id = ?, focus = ?, dolore = ?, sforzo = ?,
           riferito_andamento = ?, riferito = ?, trattamento = ?, note = ?
         WHERE id = ?`
      ).run(
        input.data,
        input.ora,
        input.fase_id,
        input.focus,
        input.dolore,
        input.sforzo,
        input.riferito_andamento ?? null,
        input.riferito ?? null,
        input.trattamento ?? null,
        input.note,
        id
      )
      db.prepare('DELETE FROM segno_valori WHERE seduta_id = ?').run(id)
      db.prepare('DELETE FROM seduta_tecniche WHERE seduta_id = ?').run(id)
      db.prepare('DELETE FROM seduta_esercizi WHERE seduta_id = ?').run(id)
      db.prepare('DELETE FROM seduta_sezioni WHERE seduta_id = ?').run(id)
      insertFigliSeduta(id, input)
    })()
  })
  handle('sedute:delete', (id: number) => {
    const s = getDb()
      .prepare(
        `SELECT s.data, p.nome, p.cognome FROM sedute s
         JOIN pazienti p ON p.id = s.paziente_id WHERE s.id = ?`
      )
      .get(id) as { data: string; nome: string; cognome: string } | undefined
    eliminaConCestino(
      'sedute',
      id,
      'Seduta',
      `Seduta del ${dataIt(s?.data)} — ${s?.cognome ?? ''} ${s?.nome ?? ''}`.trim()
    )
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
    eliminaConCestino('questionario_categorie', id, 'Categoria di questionari', nomeDi('questionario_categorie', id))
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
    // Un questionario gia' compilato da qualcuno non si cancella: le sue
    // compilazioni sono dati del paziente, e senza il questionario non si
    // saprebbe piu' cosa vogliono dire. Il vincolo del database lo impedisce
    // comunque, ma da solo direbbe "FOREIGN KEY constraint failed".
    const usi = getDb()
      .prepare('SELECT COUNT(*) AS n FROM paziente_questionari WHERE questionario_id = ?')
      .get(id) as { n: number }
    if (usi.n > 0) {
      throw new Error(
        `Questo questionario è stato compilato ${usi.n === 1 ? 'una volta' : `${usi.n} volte`} e non si può eliminare: usa "Archivia" per toglierlo dall'elenco senza perdere quelle compilazioni.`
      )
    }
    eliminaConCestino('questionari', id, 'Questionario', nomeDi('questionari', id))
  })
  handle('questionari:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE questionari SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

  // ---- Compilazioni di un paziente ----
  handle('compilazioni:list', (pazienteId: number) => elencoCompilazioni(pazienteId))
  handle('compilazioni:risposte', (compilazioneId: number) =>
    getDb()
      .prepare('SELECT domanda_id, valore FROM questionario_risposte WHERE compilazione_id = ?')
      .all(compilazioneId)
  )
  handle('compilazioni:create', (dati: CompilazioneInput) => salvaCompilazione(dati))
  handle('compilazioni:update', (id: number, dati: CompilazioneInput) =>
    aggiornaCompilazione(id, dati)
  )
  handle('compilazioni:delete', (id: number) => {
    const c = getDb()
      .prepare(
        `SELECT pq.data, q.nome FROM paziente_questionari pq
         JOIN questionari q ON q.id = pq.questionario_id WHERE pq.id = ?`
      )
      .get(id) as { data: string; nome: string } | undefined
    eliminaConCestino(
      'paziente_questionari',
      id,
      'Questionario',
      `${c?.nome ?? 'Questionario'} del ${dataIt(c?.data)}`
    )
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
    eliminaConCestino('test_categorie', id, 'Categoria di test', nomeDi('test_categorie', id))
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
    eliminaConCestino('test_valutazione', id, 'Test', nomeDi('test_valutazione', id))
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
        `SELECT id, descrizione, andamento, durata_numero, durata_unita, da_quanto, episodio,
                esordio, esordio_modo, traumatico, comportamento, aggrava, allevia,
                nprs_attuale, nprs_peggiore, nprs_migliore
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
      notturno_sn: null,
      dolore_notturno: null,
      sonno_sn: null,
      disturbi_sonno: null,
      neuro_sn: null,
      neuro_tipi: null,
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
           (paziente_id, motivo_consulto, notturno_sn, dolore_notturno, sonno_sn, disturbi_sonno,
            tosse_starnuto, neuro_sn, neuro_tipi, sintomi_neurologici, relazione_sintomi, note,
            note_giorno, note_esordio)
         VALUES (@paziente_id, @motivo_consulto, @notturno_sn, @dolore_notturno, @sonno_sn,
                 @disturbi_sonno, @tosse_starnuto, @neuro_sn, @neuro_tipi, @sintomi_neurologici,
                 @relazione_sintomi, @note, @note_giorno, @note_esordio)
         ON CONFLICT(paziente_id) DO UPDATE SET
           motivo_consulto = excluded.motivo_consulto,
           notturno_sn = excluded.notturno_sn,
           dolore_notturno = excluded.dolore_notturno,
           sonno_sn = excluded.sonno_sn,
           disturbi_sonno = excluded.disturbi_sonno,
           tosse_starnuto = excluded.tosse_starnuto,
           neuro_sn = excluded.neuro_sn,
           neuro_tipi = excluded.neuro_tipi,
           sintomi_neurologici = excluded.sintomi_neurologici,
           relazione_sintomi = excluded.relazione_sintomi,
           note = excluded.note,
           note_giorno = excluded.note_giorno,
           note_esordio = excluded.note_esordio`
      ).run({
        paziente_id: pazienteId,
        motivo_consulto: dati.motivo_consulto,
        notturno_sn: dati.notturno_sn ?? null,
        dolore_notturno: dati.dolore_notturno,
        sonno_sn: dati.sonno_sn ?? null,
        disturbi_sonno: dati.disturbi_sonno,
        tosse_starnuto: dati.tosse_starnuto,
        neuro_sn: dati.neuro_sn ?? null,
        neuro_tipi: dati.neuro_tipi ?? null,
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
           (paziente_id, descrizione, andamento, durata_numero, durata_unita, da_quanto, episodio,
            esordio, esordio_modo, traumatico, comportamento, aggrava, allevia,
            nprs_attuale, nprs_peggiore, nprs_migliore, ordine)
         VALUES (@paziente_id, @descrizione, @andamento, @durata_numero, @durata_unita, @da_quanto,
                 @episodio, @esordio, @esordio_modo, @traumatico, @comportamento, @aggrava,
                 @allevia, @nprs_attuale, @nprs_peggiore, @nprs_migliore, @ordine)`
      )
      const upd = db.prepare(
        `UPDATE anamnesi_sintomi SET descrizione = @descrizione, andamento = @andamento,
           durata_numero = @durata_numero, durata_unita = @durata_unita,
           da_quanto = @da_quanto, episodio = @episodio, esordio = @esordio,
           esordio_modo = @esordio_modo, traumatico = @traumatico,
           comportamento = @comportamento, aggrava = @aggrava, allevia = @allevia,
           nprs_attuale = @nprs_attuale, nprs_peggiore = @nprs_peggiore,
           nprs_migliore = @nprs_migliore, ordine = @ordine
         WHERE id = @id`
      )
      const insPunto = db.prepare(
        `INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, data, dolore)
         VALUES (?, ?, ?, ?, ?)`
      )
      dati.sintomi.forEach((x, i) => {
        const { punti, ...resto } = x
        // i campi nuovi possono mancare in una bozza scritta prima
        const campi = {
          ...resto,
          durata_numero: resto.durata_numero ?? null,
          durata_unita: resto.durata_unita ?? null,
          esordio_modo: resto.esordio_modo ?? null,
          nprs_attuale: resto.nprs_attuale ?? null,
          nprs_peggiore: resto.nprs_peggiore ?? null,
          nprs_migliore: resto.nprs_migliore ?? null,
          paziente_id: pazienteId,
          ordine: i
        }
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
    patologie: null,
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
           (paziente_id, patologie, traumi, interventi, riabilitazioni, bioimmagini_note,
            peso, febbre, sudorazione, nausea, fumo, neoplasie, gravidanza, pacemaker, schegge)
         VALUES (@paziente_id, @patologie, @traumi, @interventi, @riabilitazioni, @bioimmagini_note,
            @peso, @febbre, @sudorazione, @nausea, @fumo, @neoplasie, @gravidanza,
            @pacemaker, @schegge)
         ON CONFLICT(paziente_id) DO UPDATE SET
           patologie = excluded.patologie,
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

  // ---- Scheda mostrata al paziente ----
  handle('scheda:apri', (sedutaId: number) => apriScheda(sedutaId))
  handle('scheda:dati', (sedutaId: number) => datiScheda(sedutaId))
  // I pulsanti della barra disegnata in cima: comandano la finestra da cui
  // arriva la richiesta. Non passano dal solito aiutante perche' serve sapere
  // quale finestra e'.
  ipcMain.handle('finestra:comando', (evento, comando: 'riduci' | 'ingrandisci' | 'chiudi') => {
    const finestra = BrowserWindow.fromWebContents(evento.sender)
    if (!finestra || finestra.isDestroyed()) return
    if (comando === 'riduci') finestra.minimize()
    else if (comando === 'ingrandisci') {
      if (finestra.isMaximized()) finestra.unmaximize()
      else finestra.maximize()
    } else if (comando === 'chiudi') finestra.close()
  })
  ipcMain.handle('finestra:ingrandita', (evento) => {
    const finestra = BrowserWindow.fromWebContents(evento.sender)
    return finestra != null && !finestra.isDestroyed() && finestra.isMaximized()
  })

  // ---- Obiettivi terapeutici ----
  // Le aspettative stanno sul paziente ma si scrivono qui, dove si parla di
  // obiettivi: leggerle e salvarle e' un giro a se', senza passare dalla
  // finestra dell'anagrafica.
  handle('obiettiviTerapeutici:aspettative', (pazienteId: number) => {
    const r = getDb()
      .prepare('SELECT aspettative FROM pazienti WHERE id = ?')
      .get(pazienteId) as { aspettative: string | null } | undefined
    return r?.aspettative ?? null
  })
  handle(
    'obiettiviTerapeutici:salvaAspettative',
    (pazienteId: number, testo: string | null) => {
      getDb()
        .prepare('UPDATE pazienti SET aspettative = ? WHERE id = ?')
        .run(testo?.trim() || null, pazienteId)
    }
  )
  handle('obiettiviTerapeutici:list', (pazienteId: number) =>
    getDb()
      .prepare(
        'SELECT id, testo, termine FROM obiettivi_terapeutici WHERE paziente_id = ? ORDER BY ordine, id'
      )
      .all(pazienteId)
  )
  handle(
    'obiettiviTerapeutici:create',
    (pazienteId: number, testo: string, termine: TermineObiettivo) => {
      const db = getDb()
      const { next } = db
        .prepare(
          'SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM obiettivi_terapeutici WHERE paziente_id = ?'
        )
        .get(pazienteId) as { next: number }
      return Number(
        db
          .prepare(
            'INSERT INTO obiettivi_terapeutici (paziente_id, testo, termine, ordine) VALUES (?, ?, ?, ?)'
          )
          .run(pazienteId, testo.trim(), termine, next).lastInsertRowid
      )
    }
  )
  handle('obiettiviTerapeutici:update', (id: number, testo: string, termine: TermineObiettivo) => {
    getDb()
      .prepare('UPDATE obiettivi_terapeutici SET testo = ?, termine = ? WHERE id = ?')
      .run(testo.trim(), termine, id)
  })
  handle('obiettiviTerapeutici:remove', (id: number) => {
    getDb().prepare('DELETE FROM obiettivi_terapeutici WHERE id = ?').run(id)
  })
  handle('obiettiviTerapeutici:reorder', (ids: number[]) => {
    const db = getDb()
    const stmt = db.prepare('UPDATE obiettivi_terapeutici SET ordine = ? WHERE id = ?')
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
  })

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
       VALUES (?, ?, ?, ?, date('now', 'localtime'), ?)`
    )
    let aggiunti = 0
    for (const percorso of filePaths) {
      const nome = basename(percorso)
      const pdf = percorso.toLowerCase().endsWith('.pdf')
      let tipo: string
      let dataUrl: string
      // Il nome del file dice quasi sempre di chi e' il referto ("Rossi_Mario_RM
      // ginocchio.pdf"): chi usa il programma lo legge nell'errore, ma nel
      // registro degli errori non deve finire. Vale anche per gli errori del
      // sistema, che citano il percorso intero.
      try {
        if (pdf) {
          const buf = readFileSync(percorso)
          if (buf.length > BIO_PESO_MAX) {
            throw erroreSenzaDatiNelRegistro(
              `"${nome}" e' troppo pesante (oltre 12 MB).`,
              'Referto troppo pesante.'
            )
          }
          tipo = 'application/pdf'
          dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`
        } else {
          // le foto si rimpiccioliscono: un referto fotografato col telefono
          // arriva a diversi megabyte e farebbe crescere l'archivio senza motivo
          let img = nativeImage.createFromPath(percorso)
          if (img.isEmpty()) {
            throw erroreSenzaDatiNelRegistro(`"${nome}" non e' leggibile.`, 'Referto non leggibile.')
          }
          if (img.getSize().width > 1600) img = img.resize({ width: 1600, quality: 'good' })
          tipo = 'image/jpeg'
          dataUrl = `data:image/jpeg;base64,${img.toJPEG(82).toString('base64')}`
        }
      } catch (e) {
        if (e instanceof Error && 'perRegistro' in e) throw e
        throw erroreSenzaDatiNelRegistro(
          `Non riesco a leggere "${nome}".`,
          'Referto non leggibile o non accessibile.'
        )
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
    // Per mostrarlo a un altro programma il referto esce per un momento dal
    // database cifrato: in una cartella sua, con un nome casuale, e da
    // cancellare. Il programma che lo apre lo tiene aperto, quindi il primo
    // tentativo e' dopo un minuto e poi si riprova; quello che resta lo
    // tolgono la chiusura e il prossimo avvio.
    const tmp = await scriviTemporaneo(estensione, Buffer.from(base64, 'base64'))
    const errore = await shell.openPath(tmp)
    if (errore) {
      eliminaTemporaneo(tmp)
      throw new Error('Sul computer non c’è un programma che apra questo referto.')
    }
    eliminaTemporaneoPresto(tmp, 60_000)
  })

  handle('bioimmagini:delete', (id: number) => {
    eliminaConCestino('bioimmagini', id, 'Documento', nomeDi('bioimmagini', id))
  })

  // ---- Body chart ----
  handle('bodyChart:list', (pazienteId: number) =>
    getDb()
      .prepare(
        `SELECT b.id, b.data, b.note, b.tipo,
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
  handle('bodyChart:create', (pazienteId: number, data: string, tipo: TipoChart) => {
    validaData(data, 'La data della body chart', { obbligatoria: true })
    return Number(
      getDb()
        .prepare('INSERT INTO body_chart (paziente_id, data, tipo) VALUES (?, ?, ?)')
        .run(pazienteId, data, tipo === 'piede' ? 'piede' : 'corpo').lastInsertRowid
    )
  })
  handle('bodyChart:salva', (dati: BodyChartCompleta) => {
    validaData(dati.chart.data, 'La data della body chart', { obbligatoria: true })
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
    const b = getDb().prepare('SELECT data FROM body_chart WHERE id = ?').get(id) as
      | { data: string }
      | undefined
    eliminaConCestino('body_chart', id, 'Body chart', `Body chart del ${dataIt(b?.data)}`)
  })

  // ---- Blocco automatico e registro degli errori ----
  handle('sicurezza:blocco', () => blocco())
  handle('sicurezza:setBlocco', (b: { attivo: boolean; minuti: number }) => impostaBlocco(b))
  // Verifica la password senza toccare il database: serve a rientrare dopo il
  // blocco, quando l'archivio e' gia' aperto.
  handle('sicurezza:verificaPassword', (password: string) => {
    try {
      loginAuth(authPath(), password)
      return true
    } catch {
      return false
    }
  })
  handle('registro:ultimi', () => ultimiErrori())
  handle('registro:apri', () => {
    void shell.showItemInFolder(percorsoRegistro())
  })

  // ---- Cestino ----
  handle('cestino:list', () => elencoCestino())
  handle('cestino:ripristina', (id: number) => ripristina(id))
  handle('cestino:svuota', (id?: number) => svuotaCestino(id))

  // ---- Export ----
  handle('esporta:schedaIllustrata', (sedutaId: number) =>
    anteprimaSchedaIllustrata(sedutaId)
  )
  handle('esporta:anteprimaCartella', (pazienteId: number, sezioni: SezioneCartella[]) =>
    apriAnteprimaCartella(pazienteId, sezioni)
  )
  handle('esporta:cartella', (pazienteId: number, sezioni: SezioneCartella[]) =>
    esportaCartella(pazienteId, sezioni)
  )
  handle('esporta:anteprimaRelazione', (pazienteId: number, tipo: TipoRelazione) =>
    apriAnteprimaRelazione(pazienteId, tipo)
  )
  handle('esporta:relazione', (pazienteId: number, tipo: TipoRelazione) =>
    esportaRelazione(pazienteId, tipo)
  )
  handle('esporta:certificato', (dati: CertificatoInput) => esportaCertificato(dati))
  handle('esporta:seduta', (sedutaId: number, formato: FormatoExport, illustrata?: boolean) =>
    esportaSeduta(sedutaId, formato, illustrata === true)
  )
  handle('esporta:storico', (pazienteId: number, dal: string, al: string, formato: FormatoExport) =>
    esportaStorico(pazienteId, dal, al, formato)
  )
}
