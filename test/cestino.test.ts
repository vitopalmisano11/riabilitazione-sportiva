// Cestino: eliminare si puo' disfare, per pazienti e libreria.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import assert from 'node:assert/strict'
import { getDb } from '../src/main/db'
import {
  elencoCestino,
  eliminaConCestino,
  ripristina,
  ripuliscilCestino,
  svuotaCestino
} from '../src/main/cestino'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

test('Cestino: eliminare un paziente si puo\' disfare', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pzC = ins("INSERT INTO pazienti (nome, cognome, telefono) VALUES ('Ces', 'Tino', '333')")
  const patC = ins("INSERT INTO patologie (nome) VALUES ('Prova cestino')")
  c.prepare('UPDATE pazienti SET patologia_id = ? WHERE id = ?').run(patC, pzC)
  const sedC = ins("INSERT INTO sedute (paziente_id, data, note) VALUES (?, '2026-09-01', 'nota')", pzC)
  const catC = ins("INSERT INTO categorie (nome) VALUES ('Cat cestino')")
  const esC = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Es cestino', catC)
  ins(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ordine) VALUES (?, ?, '3', 0)",
    sedC,
    esC
  )
  ins("INSERT INTO obiettivi_terapeutici (paziente_id, testo, termine, ordine) VALUES (?, 'Obiettivo', 'breve', 0)", pzC)

  eliminaConCestino('pazienti', pzC, 'Paziente', 'Tino Ces')
  const contati = (sql: string, ...a: unknown[]): number =>
    (c.prepare(sql).get(...a) as { n: number }).n
  assert.equal(contati('SELECT COUNT(*) AS n FROM pazienti WHERE id = ?', pzC), 0)
  assert.equal(contati('SELECT COUNT(*) AS n FROM sedute WHERE id = ?', sedC), 0)

  const voci = elencoCestino()
  assert.equal(voci.length, 1)
  assert.equal(voci[0].etichetta, 'Tino Ces')
  // paziente + seduta + esercizio della seduta + obiettivo
  assert.ok(voci[0].righe >= 4, `righe raccolte: ${voci[0].righe}`)

  ripristina(voci[0].id)
  assert.equal(contati('SELECT COUNT(*) AS n FROM pazienti WHERE id = ?', pzC), 1)
  assert.equal(contati('SELECT COUNT(*) AS n FROM sedute WHERE id = ?', sedC), 1)
  assert.equal(
    contati('SELECT COUNT(*) AS n FROM seduta_esercizi WHERE seduta_id = ?', sedC),
    1
  )
  assert.equal(
    contati('SELECT COUNT(*) AS n FROM obiettivi_terapeutici WHERE paziente_id = ?', pzC),
    1
  )
  // il telefono torna com'era: si rimette la riga, non una copia vuota
  assert.equal(
    (c.prepare('SELECT telefono FROM pazienti WHERE id = ?').get(pzC) as { telefono: string })
      .telefono,
    '333'
  )
  assert.equal(elencoCestino().length, 0)

  // svuotare butta via davvero
  eliminaConCestino('sedute', sedC, 'Seduta', 'Seduta di prova')
  svuotaCestino()
  assert.equal(elencoCestino().length, 0)
  assert.equal(contati('SELECT COUNT(*) AS n FROM sedute WHERE id = ?', sedC), 0)
})

// Rimettere a posto il paziente per primo non puo' riuscire: la sua patologia
// non c'e'. Deve dire cosa fare (non "impossibile eliminare"), lasciare tutto
// com'era, e funzionare una volta rimessa a posto la patologia.
test('Cestino: il paziente e la sua patologia sono stati eliminati tutti e due', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const contati = (sql: string, ...a: unknown[]): number =>
    (c.prepare(sql).get(...a) as { n: number }).n
  const patM = ins("INSERT INTO patologie (nome) VALUES ('Patologia sparita')")
  const pzM = ins("INSERT INTO pazienti (nome, cognome, patologia_id) VALUES ('Mia', 'Rossi', ?)", patM)
  eliminaConCestino('pazienti', pzM, 'Paziente', 'Rossi Mia')
  eliminaConCestino('patologie', patM, 'Patologia', 'Patologia sparita')

  const vocePz = elencoCestino().find((v) => v.etichetta === 'Rossi Mia')!
  const vocePat = elencoCestino().find((v) => v.etichetta === 'Patologia sparita')!
  assert.throws(
    () => ripristina(vocePz.id),
    (e: unknown) =>
      e instanceof Error &&
      e.message.includes('Patologia sparita') &&
      !e.message.includes('FOREIGN KEY') &&
      !e.message.includes('eliminare')
  )
  // niente a meta': il paziente non e' tornato e la voce e' ancora li'
  assert.equal(contati('SELECT COUNT(*) AS n FROM pazienti WHERE id = ?', pzM), 0)
  assert.equal(elencoCestino().length, 2)

  ripristina(vocePat.id)
  ripristina(vocePz.id)
  assert.equal(contati('SELECT COUNT(*) AS n FROM pazienti WHERE id = ? AND patologia_id = ?', pzM, patM), 1)
  assert.equal(elencoCestino().length, 0)

  // se la patologia e' sparita anche dal cestino, lo si dice senza girarci intorno
  eliminaConCestino('pazienti', pzM, 'Paziente', 'Rossi Mia')
  eliminaConCestino('patologie', patM, 'Patologia', 'Patologia sparita')
  svuotaCestino(elencoCestino().find((v) => v.etichetta === 'Patologia sparita')!.id)
  assert.throws(
    () => ripristina(elencoCestino()[0].id),
    (e: unknown) =>
      e instanceof Error && e.message.includes('una patologia') && !e.message.includes('FOREIGN KEY')
  )
  svuotaCestino()
})

// La pulizia parte a ogni accesso: le voci piu' vecchie di 30 giorni si buttano,
// quelle piu' recenti restano e si possono ancora rimettere a posto.
test('Cestino: tiene un mese, poi le voci se ne vanno', () => {
  const c = getDb()
  const giorniFa = (n: number): string => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
  const metti = (etichetta: string, quando: string): void => {
    c.prepare('INSERT INTO cestino (tipo, etichetta, quando, contenuto) VALUES (?, ?, ?, ?)').run(
      'Prova',
      etichetta,
      quando,
      '[]'
    )
  }
  svuotaCestino()
  metti('di due mesi fa', giorniFa(60))
  metti('di 31 giorni fa', giorniFa(31))
  metti('di 29 giorni fa', giorniFa(29))
  metti('di ieri', giorniFa(1))
  ripuliscilCestino()
  assert.deepEqual(
    elencoCestino()
      .map((v) => v.etichetta)
      .sort(),
    ['di 29 giorni fa', 'di ieri']
  )
  svuotaCestino()
})

// Una sezione e' citata dalle sedute gia' fatte con un legame ON DELETE SET
// NULL: quelle righe non vengono cancellate, quindi non devono nemmeno finire
// nella fotografia, altrimenti il ripristino proverebbe a reinserirle.
test('Cestino: anche la libreria si recupera', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const contati = (sql: string, ...a: unknown[]): number =>
    (c.prepare(sql).get(...a) as { n: number }).n

  const patL = ins("INSERT INTO patologie (nome) VALUES ('Patologia libreria')")
  const faseL = ins('INSERT INTO fasi (patologia_id, nome) VALUES (?, ?)', patL, 'Fase libreria')
  const sezL = ins('INSERT INTO sezioni (fase_id, nome) VALUES (?, ?)', faseL, 'Riscaldamento')
  const catL = ins("INSERT INTO categorie (nome) VALUES ('Cat libreria')")
  ins('INSERT INTO sezione_categorie (sezione_id, categoria_id) VALUES (?, ?)', sezL, catL)
  const pzL = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Lib', 'Reria')")
  const sedL = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-09-02')", pzL)
  const ssL = ins(
    'INSERT INTO seduta_sezioni (seduta_id, sezione_id, nome) VALUES (?, ?, ?)',
    sedL,
    sezL,
    'Riscaldamento'
  )

  eliminaConCestino('sezioni', sezL, 'Sezione', 'Riscaldamento')
  assert.equal(contati('SELECT COUNT(*) AS n FROM sezioni WHERE id = ?', sezL), 0)
  // la seduta gia' fatta resta leggibile: perde solo il rimando alla sezione
  assert.equal(contati('SELECT COUNT(*) AS n FROM seduta_sezioni WHERE id = ?', ssL), 1)

  const vociL = elencoCestino()
  assert.equal(vociL.length, 1)
  assert.equal(vociL[0].tipo, 'Sezione')
  ripristina(vociL[0].id)
  assert.equal(contati('SELECT COUNT(*) AS n FROM sezioni WHERE id = ?', sezL), 1)
  // torna anche quello che le stava appeso davvero
  assert.equal(contati('SELECT COUNT(*) AS n FROM sezione_categorie WHERE sezione_id = ?', sezL), 1)
  assert.equal(elencoCestino().length, 0)

  // e un esercizio della libreria si recupera con tutto il suo contenuto
  const esL = ins(
    "INSERT INTO esercizi (nome, categoria_id, nota_tecnica) VALUES (?, ?, 'Ginocchio in linea')",
    'Affondo',
    catL
  )
  eliminaConCestino('esercizi', esL, 'Esercizio', 'Affondo')
  assert.equal(contati('SELECT COUNT(*) AS n FROM esercizi WHERE id = ?', esL), 0)
  ripristina(elencoCestino()[0].id)
  assert.equal(
    (c.prepare('SELECT nota_tecnica FROM esercizi WHERE id = ?').get(esL) as {
      nota_tecnica: string
    }).nota_tecnica,
    'Ginocchio in linea'
  )
  svuotaCestino()
})

// La misura di un segno sta sotto la seduta e sotto il segno: veniva fotografata
// due volte e rimessa prima del segno, e il ripristino falliva sempre. Si
// confronta l'intero archivio prima di eliminare e dopo aver rimesso a posto:
// deve essere identico, riga per riga.
test('Cestino: un paziente completo torna identico, anche con le misure dei segni', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const fotografiaArchivio = (): string => {
    const tabelle = (
      c
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'cestino' ORDER BY name"
        )
        .all() as { name: string }[]
    ).map((r) => r.name)
    // le righe in ordine di contenuto: le tabelle di collegamento non hanno un
    // id, e rimesse a posto possono cambiare posizione senza cambiare niente
    return JSON.stringify(
      tabelle.map((t) => [
        t,
        (c.prepare(`SELECT * FROM ${t}`).all() as unknown[]).map((r) => JSON.stringify(r)).sort()
      ])
    )
  }
  svuotaCestino()

  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Tutto', 'Completo')")
  const cat = ins("INSERT INTO categorie (nome) VALUES ('Cat completo')")
  const es = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Es completo', cat)
  const tec = ins("INSERT INTO tecniche (nome) VALUES ('Tecnica completo')")
  const segno1 = ins("INSERT INTO segni (paziente_id, nome) VALUES (?, 'Dolore squat')", pz)
  const segno2 = ins("INSERT INTO segni (paziente_id, nome, unita) VALUES (?, 'Flessione', '°')", pz)
  for (const data of ['2026-09-01', '2026-09-03']) {
    const sed = ins('INSERT INTO sedute (paziente_id, data, dolore) VALUES (?, ?, 4)', pz, data)
    const sez = ins("INSERT INTO seduta_sezioni (seduta_id, nome, ordine) VALUES (?, 'Rinforzo', 0)", sed)
    ins(
      "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ordine, seduta_sezione_id) VALUES (?, ?, '3', 0, ?)",
      sed,
      es,
      sez
    )
    ins("INSERT INTO seduta_esercizi (seduta_id, nome_libero, ordine) VALUES (?, 'Al volo', 1)", sed)
    c.prepare('INSERT INTO seduta_tecniche (seduta_id, tecnica_id) VALUES (?, ?)').run(sed, tec)
    c.prepare('INSERT INTO segno_valori (segno_id, seduta_id, valore) VALUES (?, ?, ?)').run(segno1, sed, 5)
    c.prepare('INSERT INTO segno_valori (segno_id, seduta_id, valore) VALUES (?, ?, ?)').run(segno2, sed, 110)
  }
  const sint = ins("INSERT INTO anamnesi_sintomi (paziente_id, descrizione) VALUES (?, 'Dolore anteriore')", pz)
  ins("INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, dolore) VALUES (?, 'giorno', 60, 3)", sint)
  const chart = ins("INSERT INTO body_chart (paziente_id, data, tipo) VALUES (?, '2026-09-01', 'corpo')", pz)
  ins("INSERT INTO body_chart_segni (chart_id, vista, tipo, x, y) VALUES (?, 'davanti', 'dolore', 0.5, 0.4)", chart)
  ins(
    "INSERT INTO bioimmagini (paziente_id, nome, tipo, contenuto, data) VALUES (?, 'rm.jpg', 'image/jpeg', 'data:image/jpeg;base64,AA==', '2026-09-01')",
    pz
  )
  ins("INSERT INTO obiettivi_terapeutici (paziente_id, testo, termine, ordine) VALUES (?, 'Correre', 'lungo', 0)", pz)

  const prima = fotografiaArchivio()
  eliminaConCestino('pazienti', pz, 'Paziente', 'Completo Tutto')
  assert.notEqual(fotografiaArchivio(), prima)
  // ogni riga una volta sola: le misure dei segni sono 4, non 8
  const voce = elencoCestino()[0]
  const contenuto = JSON.parse(
    (c.prepare('SELECT contenuto FROM cestino WHERE id = ?').get(voce.id) as { contenuto: string })
      .contenuto
  ) as { tabella: string; righe: unknown[] }[]
  const misure = contenuto.filter((f) => f.tabella === 'segno_valori')
  assert.equal(misure.length, 1)
  assert.equal(misure[0].righe.length, 4)
  // i segni vengono prima delle loro misure
  const ordine = contenuto.map((f) => f.tabella)
  assert.ok(ordine.indexOf('segni') < ordine.indexOf('segno_valori'), ordine.join(' > '))
  assert.ok(ordine.indexOf('sedute') < ordine.indexOf('segno_valori'), ordine.join(' > '))

  ripristina(voce.id)
  assert.equal(fotografiaArchivio(), prima)
  assert.equal(elencoCestino().length, 0)

  // Una voce scritta dalla versione di prima: misure doppie e messe prima dei
  // segni. Si deve poter rimettere a posto lo stesso.
  eliminaConCestino('pazienti', pz, 'Paziente', 'Completo Tutto')
  const id = elencoCestino()[0].id
  const vecchio = contenuto.flatMap((f) =>
    f.tabella === 'segni'
      ? [f, contenuto.find((x) => x.tabella === 'segno_valori')!]
      : f.tabella === 'sedute'
        ? [f, contenuto.find((x) => x.tabella === 'segno_valori')!]
        : f.tabella === 'segno_valori'
          ? []
          : [f]
  )
  // le misure compaiono due volte, la prima subito dopo le sedute (prima dei segni)
  assert.equal(vecchio.filter((f) => f.tabella === 'segno_valori').length, 2)
  assert.ok(
    vecchio.findIndex((f) => f.tabella === 'segno_valori') <
      vecchio.findIndex((f) => f.tabella === 'segni')
  )
  c.prepare('UPDATE cestino SET contenuto = ? WHERE id = ?').run(JSON.stringify(vecchio), id)
  // contate senza doppioni
  assert.equal(elencoCestino()[0].righe, voce.righe)
  ripristina(id)
  assert.equal(fotografiaArchivio(), prima)
  svuotaCestino()
})

test('Cestino: il numero di righe sta in una colonna, e l\'elenco non apre le voci', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(c.prepare(sql).run(...a).lastInsertRowid)
  svuotaCestino()
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Righe', 'Prova')")
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-09-01')", pz)
  eliminaConCestino('pazienti', pz, 'Paziente', 'Prova Righe')
  const voce = c.prepare('SELECT righe, contenuto FROM cestino').get() as {
    righe: number | null
    contenuto: string
  }
  assert.equal(voce.righe, 2) // il paziente e la sua seduta
  assert.equal(elencoCestino()[0].righe, 2)
  // l'elenco legge solo la colonna: con un contenuto illeggibile funziona lo stesso
  c.prepare('UPDATE cestino SET contenuto = ?').run('non e json')
  assert.equal(elencoCestino()[0].righe, 2)
  // una voce di prima dell'aggiornamento: senza numero. L'elenco la conta lo
  // stesso e la pulizia dell'accesso lo scrive
  c.prepare('UPDATE cestino SET righe = NULL, contenuto = ?').run(voce.contenuto)
  assert.equal(elencoCestino()[0].righe, 2)
  assert.equal((c.prepare('SELECT righe FROM cestino').get() as { righe: number | null }).righe, null)
  ripuliscilCestino()
  assert.equal((c.prepare('SELECT righe FROM cestino').get() as { righe: number | null }).righe, 2)
  svuotaCestino()
})

// Il paziente va nel cestino; poi dal questionario che aveva compilato si toglie
// un punteggio. Rimettendolo a posto, il punteggio salvato torna con il suo nome
// e senza il rimando, invece di bloccare tutto.
test('Cestino: un rimando che il database azzererebbe non blocca il ripristino', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(c.prepare(sql).run(...a).lastInsertRowid)
  svuotaCestino()
  const q = ins("INSERT INTO questionari (nome) VALUES ('Cestino e punteggi')")
  const tot = ins("INSERT INTO questionario_punteggi (questionario_id, nome, ordine) VALUES (?, 'Totale', 0)", q)
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Set', 'Null')")
  const comp = ins("INSERT INTO paziente_questionari (paziente_id, questionario_id, data) VALUES (?, ?, '2026-09-01')", pz, q)
  ins(
    "INSERT INTO compilazione_punteggi (compilazione_id, punteggio_id, nome, valore, ordine) VALUES (?, ?, 'Totale', 12, 0)",
    comp,
    tot
  )
  eliminaConCestino('pazienti', pz, 'Paziente', 'Null Set')
  c.prepare('DELETE FROM questionario_punteggi WHERE id = ?').run(tot)
  ripristina(elencoCestino()[0].id)
  assert.deepEqual(
    c.prepare('SELECT punteggio_id AS p, nome, valore FROM compilazione_punteggi WHERE compilazione_id = ?').get(comp),
    { p: null, nome: 'Totale', valore: 12 }
  )
  assert.equal(elencoCestino().length, 0)
})
