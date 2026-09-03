// Valutazione obiettiva: libreria dei distretti e rilievi sul paziente.
//
// Movimenti e test appartengono al distretto, non alla patologia. Il salvataggio
// del distretto e' in blocco: gli elementi con id restano quelli, cosi' le
// valutazioni gia' fatte continuano a puntare al movimento giusto.
import { getDb } from './db'
import type {
  Distretto,
  DistrettoCompleto,
  MovimentoDistretto,
  TestDistretto,
  Valutazione,
  ValutazioneCompleta
} from '../shared/types'

type Db = ReturnType<typeof getDb>

export function leggiDistretto(id: number): DistrettoCompleto {
  const db = getDb()
  const distretto = db.prepare('SELECT * FROM distretti WHERE id = ?').get(id) as
    | Distretto
    | undefined
  if (!distretto) throw new Error('Distretto non trovato.')
  const movimenti = db
    .prepare(
      'SELECT id, nome, gradi FROM distretto_movimenti WHERE distretto_id = ? ORDER BY ordine, id'
    )
    .all(id) as MovimentoDistretto[]
  const test = db
    .prepare(
      'SELECT id, nome, gruppo, risposta FROM distretto_test WHERE distretto_id = ? ORDER BY ordine, id'
    )
    .all(id) as TestDistretto[]
  return { distretto, movimenti, test }
}

// Elimina i figli spariti, poi aggiorna o inserisce quelli rimasti.
function eliminaMancanti(db: Db, tabella: string, distrettoId: number, ids: number[]): void {
  const segnaposto = ids.map(() => '?').join(', ')
  const dove = ids.length > 0 ? ` AND id NOT IN (${segnaposto})` : ''
  db.prepare(`DELETE FROM ${tabella} WHERE distretto_id = ?${dove}`).run(distrettoId, ...ids)
}

export function salvaDistretto(dati: DistrettoCompleto): void {
  const db = getDb()
  const id = dati.distretto.id

  db.transaction(() => {
    db.prepare('UPDATE distretti SET nome = ? WHERE id = ?').run(dati.distretto.nome.trim(), id)

    eliminaMancanti(
      db,
      'distretto_movimenti',
      id,
      dati.movimenti.map((m) => m.id).filter((x): x is number => x != null && x > 0)
    )
    const insM = db.prepare(
      'INSERT INTO distretto_movimenti (distretto_id, nome, gradi, ordine) VALUES (?, ?, ?, ?)'
    )
    const updM = db.prepare(
      'UPDATE distretto_movimenti SET nome = ?, gradi = ?, ordine = ? WHERE id = ?'
    )
    dati.movimenti.forEach((m, i) => {
      if (m.id == null || m.id < 0) insM.run(id, m.nome.trim(), m.gradi, i)
      else updM.run(m.nome.trim(), m.gradi, i, m.id)
    })

    eliminaMancanti(
      db,
      'distretto_test',
      id,
      dati.test.map((t) => t.id).filter((x): x is number => x != null && x > 0)
    )
    const insT = db.prepare(
      'INSERT INTO distretto_test (distretto_id, nome, gruppo, risposta, ordine) VALUES (?, ?, ?, ?, ?)'
    )
    const updT = db.prepare(
      'UPDATE distretto_test SET nome = ?, gruppo = ?, risposta = ?, ordine = ? WHERE id = ?'
    )
    dati.test.forEach((t, i) => {
      if (t.id == null || t.id < 0) insT.run(id, t.nome.trim(), t.gruppo, t.risposta, i)
      else updT.run(t.nome.trim(), t.gruppo, t.risposta, i, t.id)
    })
  })()
}

export function leggiValutazione(id: number): ValutazioneCompleta {
  const db = getDb()
  const valutazione = db.prepare('SELECT * FROM valutazioni WHERE id = ?').get(id) as
    | Valutazione
    | undefined
  if (!valutazione) throw new Error('Valutazione non trovata.')
  const distretti = db
    .prepare(
      'SELECT distretto_id, nota_attivo, nota_passivo FROM valutazione_distretti WHERE valutazione_id = ?'
    )
    .all(id) as { distretto_id: number; nota_attivo: string | null; nota_passivo: string | null }[]
  const distretto_ids = distretti.map((r) => r.distretto_id)
  const note_movimenti = distretti.map((r) => ({
    distretto_id: r.distretto_id,
    attivo: r.nota_attivo,
    passivo: r.nota_passivo
  }))
  const movimenti = db
    .prepare(
      `SELECT movimento_id, attivo_restrizione, attivo_dolore, attivo_gradi,
              passivo_restrizione, passivo_dolore, passivo_gradi, nota
       FROM valutazione_movimenti WHERE valutazione_id = ?`
    )
    .all(id) as ValutazioneCompleta['movimenti']
  const test = db
    .prepare('SELECT test_id, valore, nota FROM valutazione_test WHERE valutazione_id = ?')
    .all(id) as ValutazioneCompleta['test']
  return { valutazione, distretto_ids, movimenti, note_movimenti, test }
}

export function salvaValutazione(dati: ValutazioneCompleta): void {
  const db = getDb()
  const id = dati.valutazione.id

  db.transaction(() => {
    db.prepare(
      `UPDATE valutazioni SET data = @data, ispezione = @ispezione, note = @note,
         carico_locale = @carico_locale, carico_generale = @carico_generale,
         capacita_locale = @capacita_locale, capacita_generale = @capacita_generale
       WHERE id = @id`
    ).run(dati.valutazione)

    // I rilievi si riscrivono per intero: nessun'altra tabella li cita.
    db.prepare('DELETE FROM valutazione_distretti WHERE valutazione_id = ?').run(id)
    const insD = db.prepare(
      `INSERT INTO valutazione_distretti (valutazione_id, distretto_id, nota_attivo, nota_passivo)
       VALUES (?, ?, ?, ?)`
    )
    for (const d of dati.distretto_ids) {
      const n = dati.note_movimenti.find((x) => x.distretto_id === d)
      insD.run(id, d, n?.attivo || null, n?.passivo || null)
    }

    db.prepare('DELETE FROM valutazione_movimenti WHERE valutazione_id = ?').run(id)
    const insM = db.prepare(
      `INSERT INTO valutazione_movimenti
         (valutazione_id, movimento_id, attivo_restrizione, attivo_dolore, attivo_gradi,
          passivo_restrizione, passivo_dolore, passivo_gradi, nota)
       VALUES (@valutazione_id, @movimento_id, @attivo_restrizione, @attivo_dolore,
          @attivo_gradi, @passivo_restrizione, @passivo_dolore, @passivo_gradi, @nota)`
    )
    for (const m of dati.movimenti) {
      // niente da memorizzare per un movimento non ancora valutato
      const vuoto =
        m.attivo_restrizione == null &&
        m.attivo_dolore == null &&
        m.attivo_gradi == null &&
        m.passivo_restrizione == null &&
        m.passivo_dolore == null &&
        m.passivo_gradi == null &&
        !m.nota
      if (!vuoto) insM.run({ ...m, valutazione_id: id })
    }

    db.prepare('DELETE FROM valutazione_test WHERE valutazione_id = ?').run(id)
    const insT = db.prepare(
      'INSERT INTO valutazione_test (valutazione_id, test_id, valore, nota) VALUES (?, ?, ?, ?)'
    )
    for (const t of dati.test) {
      if (t.valore || t.nota) insT.run(id, t.test_id, t.valore, t.nota)
    }
  })()
}
