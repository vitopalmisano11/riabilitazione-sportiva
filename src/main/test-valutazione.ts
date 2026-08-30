// Test di valutazione da letteratura: lettura e salvataggio della scheda.
// Come per i questionari il salvataggio e' in blocco (gli elementi con id
// restano, i nuovi si inseriscono, gli spariti si eliminano), cosi' i dati che
// un domani citeranno una misura continueranno a puntare a quella giusta.
import { getDb } from './db'
import type {
  MisuraTest,
  ParametroTest,
  TestValutazione,
  TestValutazioneCompleto
} from '../shared/types'

export function leggiTest(id: number): TestValutazioneCompleto {
  const db = getDb()
  const test = db
    .prepare(
      `SELECT id, categoria_id, nome, descrizione, protocollo, link, prove, ordine, archiviato
       FROM test_valutazione WHERE id = ?`
    )
    .get(id) as TestValutazione | undefined
  if (!test) throw new Error('Test non trovato.')

  const parametri = db
    .prepare('SELECT id, nome, valore, unita FROM test_parametri WHERE test_id = ? ORDER BY ordine, id')
    .all(id) as ParametroTest[]
  const misure = db
    .prepare(
      `SELECT id, nome, unita, per_prova, riassunto, cutoff, cutoff_direzione
       FROM test_misure WHERE test_id = ? ORDER BY ordine, id`
    )
    .all(id) as MisuraTest[]

  return { test, parametri, misure }
}

export function salvaTest(dati: TestValutazioneCompleto): void {
  const db = getDb()
  const id = dati.test.id

  db.transaction(() => {
    db.prepare(
      `UPDATE test_valutazione
       SET nome = ?, descrizione = ?, protocollo = ?, link = ?, prove = ?
       WHERE id = ?`
    ).run(
      dati.test.nome.trim(),
      dati.test.descrizione,
      dati.test.protocollo,
      dati.test.link,
      Math.max(1, dati.test.prove),
      id
    )

    riscriviParametri(db, id, dati.parametri)
    riscriviMisure(db, id, dati.misure)
  })()
}

type Db = ReturnType<typeof getDb>

// Elimina i figli non piu' presenti, poi inserisce/aggiorna quelli rimasti.
function eliminaMancanti(db: Db, tabella: string, testId: number, ids: number[]): void {
  const segnaposto = ids.map(() => '?').join(', ')
  const dove = ids.length > 0 ? ` AND id NOT IN (${segnaposto})` : ''
  db.prepare(`DELETE FROM ${tabella} WHERE test_id = ?${dove}`).run(testId, ...ids)
}

function riscriviParametri(db: Db, testId: number, parametri: ParametroTest[]): void {
  eliminaMancanti(
    db,
    'test_parametri',
    testId,
    parametri.map((p) => p.id).filter((x): x is number => x != null)
  )
  const insert = db.prepare(
    'INSERT INTO test_parametri (test_id, nome, valore, unita, ordine) VALUES (?, ?, ?, ?, ?)'
  )
  const update = db.prepare(
    'UPDATE test_parametri SET nome = ?, valore = ?, unita = ?, ordine = ? WHERE id = ?'
  )
  parametri.forEach((p, i) => {
    if (p.id == null) insert.run(testId, p.nome.trim(), p.valore, p.unita, i)
    else update.run(p.nome.trim(), p.valore, p.unita, i, p.id)
  })
}

function riscriviMisure(db: Db, testId: number, misure: MisuraTest[]): void {
  eliminaMancanti(
    db,
    'test_misure',
    testId,
    misure.map((m) => m.id).filter((x): x is number => x != null)
  )
  const insert = db.prepare(
    `INSERT INTO test_misure (test_id, nome, unita, per_prova, riassunto, cutoff, cutoff_direzione, ordine)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const update = db.prepare(
    `UPDATE test_misure SET nome = ?, unita = ?, per_prova = ?, riassunto = ?, cutoff = ?,
     cutoff_direzione = ?, ordine = ? WHERE id = ?`
  )
  misure.forEach((m, i) => {
    // senza soglia la direzione non ha significato
    const direzione = m.cutoff == null ? null : (m.cutoff_direzione ?? 'min')
    if (m.id == null) {
      insert.run(testId, m.nome.trim(), m.unita, m.per_prova, m.riassunto, m.cutoff, direzione, i)
    } else {
      update.run(m.nome.trim(), m.unita, m.per_prova, m.riassunto, m.cutoff, direzione, i, m.id)
    }
  })
}
