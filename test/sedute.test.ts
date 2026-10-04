// Sedute: bozza, settimana, ultima volta, dolore, esercizi al volo, diario.
import { test } from 'vitest'
import { archivioDiProva } from './archivio-di-prova'
import assert from 'node:assert/strict'
import { getDb } from '../src/main/db'
import { seduteDellaSettimana } from '../src/main/settimana'
import { ultimaVoltaPerPaziente } from '../src/main/ultima-volta'
import { andamentoDolorePerPaziente } from '../src/main/andamento-dolore'
import { generaCartella } from '../src/main/export-cartella'
import { sedutaPrecedente } from '../src/main/seduta-precedente'
import { nellaFascia } from '../src/shared/orari'

// Un archivio cifrato tutto suo, in una cartella temporanea.
archivioDiProva()

test('Bozza della seduta: una per paziente, e si sostituisce', () => {
  const c = getDb()
  const pzB = Number(
    c.prepare("INSERT INTO pazienti (nome, cognome) VALUES ('Boz', 'Za')").run().lastInsertRowid
  )
  const salva = (contenuto: string): void => {
    c.prepare(
      `INSERT INTO bozze_seduta (paziente_id, aggiornata_il, contenuto) VALUES (?, ?, ?)
       ON CONFLICT(paziente_id) DO UPDATE SET aggiornata_il = excluded.aggiornata_il,
         contenuto = excluded.contenuto`
    ).run(pzB, new Date().toISOString(), contenuto)
  }
  salva('{"note":"prima"}')
  salva('{"note":"seconda"}')
  const righe = c.prepare('SELECT contenuto FROM bozze_seduta WHERE paziente_id = ?').all(pzB) as {
    contenuto: string
  }[]
  assert.equal(righe.length, 1)
  assert.equal(righe[0].contenuto, '{"note":"seconda"}')
  // cancellando il paziente se ne va anche la bozza
  c.prepare('DELETE FROM pazienti WHERE id = ?').run(pzB)
  assert.equal(
    (c.prepare('SELECT COUNT(*) AS n FROM bozze_seduta').get() as { n: number }).n,
    0
  )
})

test('La settimana: le sedute di tutti fra due date', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pz1 = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Anna', 'Bianchi')")
  const pz2 = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Marco', 'Rossi')")
  ins(
    "INSERT INTO sedute (paziente_id, data, focus) VALUES (?, '2026-10-05', 'preparazione corsa')",
    pz1
  )
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-10-07')", pz2)
  // fuori dalla settimana chiesta: non deve comparire
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-10-13')", pz1)

  // Una seduta costruita su una fase del campo si riconosce.
  const patC = ins("INSERT INTO patologie (nome, ha_campo) VALUES ('LCA', 1)")
  const faseCampo = ins(
    "INSERT INTO fasi (patologia_id, nome, campo) VALUES (?, 'Campo 4 mesi', 1)",
    patC
  )
  const fasePal = ins("INSERT INTO fasi (patologia_id, nome) VALUES (?, 'Intermedia')", patC)
  ins("INSERT INTO sedute (paziente_id, data, fase_id) VALUES (?, '2026-10-09', ?)", pz2, faseCampo)
  ins("INSERT INTO sedute (paziente_id, data, fase_id) VALUES (?, '2026-10-06', ?)", pz2, fasePal)

  const sett = seduteDellaSettimana('2026-10-05', '2026-10-11')
  assert.equal(sett.length, 4)
  assert.equal(sett.filter((x) => x.fase_campo === 1).length, 1)
  assert.equal(sett.find((x) => x.fase_campo === 1)?.fase_nome, 'Campo 4 mesi')
  // le sedute di palestra non si segnano come campo
  assert.equal(sett.filter((x) => x.fase_campo !== 1).length, 3)
  // in ordine di data, e con il nome gia' pronto da mostrare
  assert.equal(sett[0].data, '2026-10-05')
  assert.equal(sett[0].paziente, 'Bianchi Anna')
  assert.equal(sett[1].paziente, 'Rossi Marco')
  assert.equal(typeof sett[0].num_esercizi, 'number')
  // il focus della giornata arriva fino alla riga della settimana
  assert.equal(sett[0].focus, 'preparazione corsa')
  assert.equal(sett[1].focus, null)

  // Lo stesso giorno, piu' pazienti: l'ordine segue l'orario dell'appuntamento,
  // chi non ce l'ha segnato resta in fondo alla giornata.
  const pz3 = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Luca', 'Verdi')")
  ins("INSERT INTO sedute (paziente_id, data, ora) VALUES (?, '2026-10-08', '15:30')", pz1)
  ins("INSERT INTO sedute (paziente_id, data, ora) VALUES (?, '2026-10-08', '09:00')", pz2)
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-10-08')", pz3)
  const giorno = seduteDellaSettimana('2026-10-08', '2026-10-08')
  assert.equal(giorno.length, 3)
  assert.equal(giorno[0].ora, '09:00')
  assert.equal(giorno[0].paziente, 'Rossi Marco')
  assert.equal(giorno[1].ora, '15:30')
  assert.equal(giorno[1].paziente, 'Bianchi Anna')
  assert.equal(giorno[2].ora, null)
  assert.equal(giorno[2].paziente, 'Verdi Luca')
})

test('L\'ultima volta che il paziente ha fatto un esercizio', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Ugo', 'Verdi')")
  const cat = ins("INSERT INTO categorie (nome) VALUES ('Forza')")
  const es1 = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Squat', cat)
  const es2 = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Ponte', cat)
  const vecchia = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-01-10')", pz)
  const recente = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-02-20')", pz)
  // una seduta programmata per il futuro: non l'ha ancora fatta
  const futura = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2099-01-01')", pz)
  const insEs = (sid: number, eid: number, serie: string, carico: string): void => {
    c.prepare(
      'INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, carico, ordine) VALUES (?, ?, ?, ?, 0)'
    ).run(sid, eid, serie, carico)
  }
  insEs(vecchia, es1, '3', '40')
  insEs(recente, es1, '4', '50')
  insEs(vecchia, es2, '2', '')
  insEs(futura, es1, '5', '999')

  const u = ultimaVoltaPerPaziente(pz, null)
  assert.equal(u.length, 2)
  const squat = u.find((x) => x.esercizio_id === es1)
  // vince la piu' recente fra quelle gia' fatte, non la programmata
  assert.equal(squat?.data, '2026-02-20')
  assert.equal(squat?.serie, '4')
  assert.equal(squat?.carico, '50')
  // escludendo la seduta che si sta modificando si torna a quella prima
  const senza = ultimaVoltaPerPaziente(pz, recente)
  assert.equal(senza.find((x) => x.esercizio_id === es1)?.carico, '40')
  // un paziente che non ha mai fatto niente non ha nessun precedente
  const altro = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Ida', 'Neri')")
  assert.equal(ultimaVoltaPerPaziente(altro, null).length, 0)
})

test('Andamento del dolore (linguetta "Quadro"): sedute e anamnesi unite', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pzD = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Dolo', 'Re')")
  // il primo sintomo registrato e' quello del motivo della visita: i suoi
  // punti "dall'esordio" precedono le sedute, che devono ancora iniziare
  const sint1 = ins(
    "INSERT INTO anamnesi_sintomi (paziente_id, descrizione, ordine) VALUES (?, 'Ginocchio', 0)",
    pzD
  )
  // un secondo sintomo: i suoi punti non contano, si guarda solo il primo
  const sint2 = ins(
    "INSERT INTO anamnesi_sintomi (paziente_id, descrizione, ordine) VALUES (?, 'Caviglia', 1)",
    pzD
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2026-01-15', 6)",
    sint1
  )
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2026-01-01', 8)",
    sint1
  )
  // un punto del grafico "giorno" non c'entra con l'andamento nel tempo
  ins("INSERT INTO sintomo_punti (sintomo_id, grafico, minuti, dolore) VALUES (?, 'giorno', 480, 7)", sint1)
  ins(
    "INSERT INTO sintomo_punti (sintomo_id, grafico, data, dolore) VALUES (?, 'esordio', '2025-01-01', 9)",
    sint2
  )
  ins("INSERT INTO sedute (paziente_id, data, dolore) VALUES (?, '2026-02-10', 3)", pzD)
  ins("INSERT INTO sedute (paziente_id, data, dolore) VALUES (?, '2026-02-01', 5)", pzD)
  // una seduta senza dolore segnato non entra nella serie
  ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-02-05')", pzD)
  // una seduta programmata nel futuro non e' ancora "andamento"
  ins("INSERT INTO sedute (paziente_id, data, dolore) VALUES (?, '2099-01-01', 1)", pzD)

  const serie = andamentoDolorePerPaziente(pzD)
  assert.deepEqual(serie, [
    { data: '2026-01-01', dolore: 8, origine: 'anamnesi' },
    { data: '2026-01-15', dolore: 6, origine: 'anamnesi' },
    { data: '2026-02-01', dolore: 5, origine: 'seduta' },
    { data: '2026-02-10', dolore: 3, origine: 'seduta' }
  ])

  // un paziente senza numeri sul dolore non ha nessun punto
  const pzSenza = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Senza', 'Numeri')")
  assert.equal(andamentoDolorePerPaziente(pzSenza).length, 0)
})

test('Programmare la settimana: la stessa seduta su piu\' giorni', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)
  const pzP = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Pro', 'Gramma')")
  const catP = ins("INSERT INTO categorie (nome) VALUES ('Cat programma')")
  const esP = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Squat', catP)
  const sedP = ins("INSERT INTO sedute (paziente_id, data, note) VALUES (?, '2026-09-07', 'lunedì')", pzP)
  const sezP = ins("INSERT INTO seduta_sezioni (seduta_id, nome, ordine) VALUES (?, 'Rinforzo', 0)", sedP)
  ins(
    `INSERT INTO seduta_esercizi (seduta_id, seduta_sezione_id, esercizio_id, serie, ripetizioni, ordine)
     VALUES (?, ?, ?, '3', '12', 0)`,
    sedP,
    sezP,
    esP
  )

  // il canale IPC non si puo' chiamare da qui: si ripete quello che fa, cioe'
  // copiare la seduta su due date nuove
  const copiaSu = (data: string): number => {
    const nuovo = ins(
      'INSERT INTO sedute (paziente_id, data, fase_id, note) SELECT paziente_id, ?, fase_id, note FROM sedute WHERE id = ?',
      data,
      sedP
    )
    const sez = ins(
      'INSERT INTO seduta_sezioni (seduta_id, sezione_id, nome, ordine) SELECT ?, sezione_id, nome, ordine FROM seduta_sezioni WHERE id = ?',
      nuovo,
      sezP
    )
    ins(
      `INSERT INTO seduta_esercizi (seduta_id, seduta_sezione_id, esercizio_id, serie, ripetizioni, carico, recupero, nota, ordine)
       SELECT ?, ?, esercizio_id, serie, ripetizioni, carico, recupero, nota, ordine
       FROM seduta_esercizi WHERE seduta_id = ?`,
      nuovo,
      sez,
      sedP
    )
    return nuovo
  }
  const mer = copiaSu('2026-09-09')
  const ven = copiaSu('2026-09-11')

  const esercizi = (id: number): number =>
    (
      c.prepare('SELECT COUNT(*) AS n FROM seduta_esercizi WHERE seduta_id = ?').get(id) as {
        n: number
      }
    ).n
  assert.equal(esercizi(mer), 1)
  assert.equal(esercizi(ven), 1)
  // ogni copia ha la sua sezione, non quella dell'originale
  const sezioniDi = (id: number): number =>
    (
      c.prepare('SELECT COUNT(*) AS n FROM seduta_sezioni WHERE seduta_id = ?').get(id) as {
        n: number
      }
    ).n
  assert.equal(sezioniDi(mer), 1)
  assert.equal(
    (
      c.prepare('SELECT COUNT(*) AS n FROM sedute WHERE paziente_id = ?').get(pzP) as { n: number }
    ).n,
    3
  )
})

test('Esercizio "al volo": un nome scritto solo per questa seduta, senza passare dalla libreria', () => {
  const c = getDb()
  const ins = (sql: string, ...a: unknown[]): number =>
    Number(c.prepare(sql).run(...a).lastInsertRowid)

  const pzV = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Vito', 'Alvolo')")
  const catV = ins("INSERT INTO categorie (nome) VALUES ('Cat al volo')")
  const esV = ins('INSERT INTO esercizi (nome, categoria_id) VALUES (?, ?)', 'Affondo laterale', catV)
  const sedV = ins("INSERT INTO sedute (paziente_id, data) VALUES (?, '2026-09-15')", pzV)

  // il vincolo CHECK impone esattamente uno tra esercizio_id e nome_libero:
  // ne' tutti e due ne' nessuno dei due
  assert.throws(
    () =>
      c
        .prepare(
          'INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, ordine) VALUES (?, NULL, NULL, 0)'
        )
        .run(sedV),
    /CHECK constraint/
  )
  assert.throws(
    () =>
      c
        .prepare(
          "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, ordine) VALUES (?, ?, 'Doppio', 0)"
        )
        .run(sedV, esV),
    /CHECK constraint/
  )

  // una riga di libreria normale...
  ins(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, serie, ripetizioni, ordine) VALUES (?, ?, '3', '10', 0)",
    sedV,
    esV
  )
  // ...e una "al volo": niente esercizio_id, solo il nome scritto li' per li'
  ins(
    "INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, serie, ripetizioni, ordine) VALUES (?, NULL, ?, '4', '12', 1)",
    sedV,
    'Slancio con elastico rosso'
  )

  type RigaLetta = {
    esercizio_id: number | null
    nome_libero: string | null
    nome: string
    categoria_nome: string | null
  }
  // il canale IPC non si puo' chiamare da qui: si ripete la lettura che fa
  // sedute:get, con lo stesso LEFT JOIN (non piu' un JOIN rigido) e la stessa
  // COALESCE del nome fra libreria e nome_libero
  const leggi = (sedutaId: number): RigaLetta[] =>
    c
      .prepare(
        `SELECT se.esercizio_id, se.nome_libero, COALESCE(e.nome, se.nome_libero) AS nome,
                c2.nome AS categoria_nome
         FROM seduta_esercizi se
         LEFT JOIN esercizi e ON e.id = se.esercizio_id
         LEFT JOIN categorie c2 ON c2.id = e.categoria_id
         WHERE se.seduta_id = ? ORDER BY se.ordine, se.id`
      )
      .all(sedutaId) as RigaLetta[]

  const righe = leggi(sedV)
  assert.equal(righe.length, 2)
  assert.equal(righe[0].nome, 'Affondo laterale')
  assert.equal(righe[0].categoria_nome, 'Cat al volo')
  assert.equal(righe[1].esercizio_id, null)
  assert.equal(righe[1].nome_libero, 'Slancio con elastico rosso')
  assert.equal(righe[1].nome, 'Slancio con elastico rosso')
  // un esercizio al volo non ha categoria: sparisce, non rompe la lettura
  assert.equal(righe[1].categoria_nome, null)

  // programmando la seduta su un'altra data (come fa sedute:programma), la
  // riga al volo deve seguirla col suo nome
  const nuova = ins(
    'INSERT INTO sedute (paziente_id, data, fase_id, note) SELECT paziente_id, ?, fase_id, note FROM sedute WHERE id = ?',
    '2026-09-22',
    sedV
  )
  ins(
    `INSERT INTO seduta_esercizi (seduta_id, esercizio_id, nome_libero, serie, ripetizioni, carico, recupero, nota, ordine)
     SELECT ?, esercizio_id, nome_libero, serie, ripetizioni, carico, recupero, nota, ordine
     FROM seduta_esercizi WHERE seduta_id = ?`,
    nuova,
    sedV
  )
  const copia = leggi(nuova)
  assert.equal(copia.length, 2)
  assert.equal(copia[0].nome, 'Affondo laterale')
  assert.equal(copia[1].esercizio_id, null)
  assert.equal(copia[1].nome, 'Slancio con elastico rosso')
})

test('Il diario della seduta: cosa riferisce, trattamento, l\'ultima volta', () => {
  const db = getDb()
  const ins = (sql: string, ...a: unknown[]): number => Number(db.prepare(sql).run(...a).lastInsertRowid)
  // le tecniche di partenza ci sono gia'
  const tecniche = db.prepare('SELECT id, nome FROM tecniche ORDER BY ordine').all() as { id: number; nome: string }[]
  assert.ok(tecniche.some((t) => t.nome === 'Tecar'))
  const tecar = tecniche.find((t) => t.nome === 'Tecar')!.id
  const manuale = tecniche.find((t) => t.nome === 'Terapia manuale')!.id

  const paz = ins("INSERT INTO pazienti (nome, cognome) VALUES ('Diario', 'Prova')")
  const prima = ins(
    `INSERT INTO sedute (paziente_id, data, riferito_andamento, riferito, trattamento, dolore, note)
     VALUES (?, '2026-09-01', 'meglio', 'meno dolore la mattina', 'zona rotulea', 4, 'rivedere lo squat')`,
    paz
  )
  ins('INSERT INTO seduta_tecniche (seduta_id, tecnica_id) VALUES (?, ?)', prima, tecar)
  ins('INSERT INTO seduta_tecniche (seduta_id, tecnica_id) VALUES (?, ?)', prima, manuale)
  const segno = ins("INSERT INTO segni (paziente_id, nome, unita) VALUES (?, 'Dolore nello squat', '0-10')", paz)
  ins('INSERT INTO segno_valori (segno_id, seduta_id, valore) VALUES (?, ?, 5)', segno, prima)
  // una seduta programmata piu' avanti non conta come "l'ultima volta"
  ins("INSERT INTO sedute (paziente_id, data, riferito) VALUES (?, '2026-09-20', 'futura')", paz)

  const p = sedutaPrecedente(paz, null, '2026-09-05')
  assert.ok(p)
  assert.equal(p?.data, '2026-09-01')
  assert.equal(p?.riferito_andamento, 'meglio')
  assert.deepEqual(p?.tecniche, ['Terapia manuale', 'Tecar'])
  assert.deepEqual(p?.segni, [{ nome: 'Dolore nello squat', unita: '0-10', valore: 5 }])
  // modificando proprio quella seduta, la precedente non e' lei
  assert.equal(sedutaPrecedente(paz, prima, '2026-09-01'), null)

  // nel diario stampato: cosa riferisce, trattamento e dolore, non gli esercizi
  const cartellaDiario = generaCartella(paz, ['sedute'])
  assert.ok(
    cartellaDiario.includes(
      '01/09/2026 · riferisce: meglio, meno dolore la mattina · trattamento: Terapia manuale, Tecar; zona rotulea · dolore 4/10'
    )
  )

  // la modalita' scura a orari fissi, anche a cavallo della mezzanotte
  const alle = (h: number, m = 0): Date => new Date(2026, 8, 15, h, m)
  assert.equal(nellaFascia('20:00', '07:00', alle(21)), true)
  assert.equal(nellaFascia('20:00', '07:00', alle(6, 59)), true)
  assert.equal(nellaFascia('20:00', '07:00', alle(7)), false)
  assert.equal(nellaFascia('20:00', '07:00', alle(12)), false)
  assert.equal(nellaFascia('13:00', '15:00', alle(14)), true)
  assert.equal(nellaFascia('10:00', '10:00', alle(10)), false)
})
