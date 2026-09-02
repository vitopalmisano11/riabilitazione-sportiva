// Protocolli di screening.
//
// Un protocollo non contiene test propri: raccoglie quelli gia' scritti nella
// libreria dei test di valutazione (e i questionari), li ordina e li divide in
// sezioni. Cosi' un test si descrive una volta sola — protocollo, misure,
// unita', cutoff — e i suoi risultati restano confrontabili che lo si esegua
// dentro uno screening o da solo.
//
// Il salvataggio e' in blocco, come per i questionari: arrivano protocollo,
// sezioni e voci tutti insieme, e quello che non c'e' piu' nell'elenco viene
// eliminato. Le sezioni e le voci non ancora salvate hanno un id negativo,
// assegnato dall'interfaccia, che qui si traduce nel vero id.
import { getDb } from './db'
import type { ProtocolloScreeningCompleto } from '../shared/types'

function eliminaMancanti(
  db: ReturnType<typeof getDb>,
  tabella: string,
  colonnaPadre: string,
  padreId: number,
  daTenere: number[]
): void {
  const segnaposto = daTenere.map(() => '?').join(', ')
  const dove = daTenere.length > 0 ? ` AND id NOT IN (${segnaposto})` : ''
  db.prepare(`DELETE FROM ${tabella} WHERE ${colonnaPadre} = ?${dove}`).run(padreId, ...daTenere)
}

export function leggiProtocollo(id: number): ProtocolloScreeningCompleto {
  const db = getDb()
  const protocollo = db.prepare('SELECT * FROM screening_protocolli WHERE id = ?').get(id) as
    | ProtocolloScreeningCompleto['protocollo']
    | undefined
  if (!protocollo) throw new Error('Protocollo non trovato.')

  const sezioni = db
    .prepare('SELECT id, nome FROM screening_sezioni WHERE protocollo_id = ? ORDER BY ordine, id')
    .all(id) as { id: number; nome: string }[]

  // Il nome della voce arriva dalla libreria: se un test viene rinominato, il
  // protocollo mostra subito il nome nuovo.
  const vociStmt = db.prepare(
    `SELECT v.id, v.test_id, v.questionario_id,
            COALESCE(t.nome, q.nome) AS nome
     FROM screening_voci v
     LEFT JOIN test_valutazione t ON t.id = v.test_id
     LEFT JOIN questionari q ON q.id = v.questionario_id
     WHERE v.sezione_id = ? ORDER BY v.ordine, v.id`
  )

  return {
    protocollo,
    sezioni: sezioni.map((s) => ({
      id: s.id,
      nome: s.nome,
      voci: vociStmt.all(s.id) as ProtocolloScreeningCompleto['sezioni'][number]['voci']
    }))
  }
}

export function salvaProtocollo(dati: ProtocolloScreeningCompleto): void {
  const db = getDb()
  const pid = dati.protocollo.id

  db.transaction(() => {
    db.prepare('UPDATE screening_protocolli SET nome = ?, sport = ?, note = ? WHERE id = ?').run(
      dati.protocollo.nome.trim(),
      dati.protocollo.sport.trim(),
      dati.protocollo.note,
      pid
    )

    const idsSezioni = dati.sezioni.map((s) => s.id).filter((x): x is number => x != null && x > 0)
    eliminaMancanti(db, 'screening_sezioni', 'protocollo_id', pid, idsSezioni)

    const insSez = db.prepare(
      'INSERT INTO screening_sezioni (protocollo_id, nome, ordine) VALUES (?, ?, ?)'
    )
    const updSez = db.prepare('UPDATE screening_sezioni SET nome = ?, ordine = ? WHERE id = ?')
    const insVoce = db.prepare(
      'INSERT INTO screening_voci (sezione_id, test_id, questionario_id, ordine) VALUES (?, ?, ?, ?)'
    )
    const updVoce = db.prepare(
      'UPDATE screening_voci SET test_id = ?, questionario_id = ?, ordine = ? WHERE id = ?'
    )

    dati.sezioni.forEach((s, i) => {
      const nome = s.nome.trim() || 'Senza nome'
      const sezId =
        s.id != null && s.id > 0
          ? (updSez.run(nome, i, s.id), s.id)
          : Number(insSez.run(pid, nome, i).lastInsertRowid)

      const idsVoci = s.voci.map((v) => v.id).filter((x): x is number => x != null && x > 0)
      eliminaMancanti(db, 'screening_voci', 'sezione_id', sezId, idsVoci)

      s.voci.forEach((v, j) => {
        if (v.id != null && v.id > 0) updVoce.run(v.test_id, v.questionario_id, j, v.id)
        else insVoce.run(sezId, v.test_id, v.questionario_id, j)
      })
    })
  })()
}

// Copia di un protocollo esistente: il calcio e il basket condividono buona
// parte della batteria, e riscriverla da capo sarebbe solo lavoro inutile.
export function duplicaProtocollo(id: number, nome: string): number {
  const originale = leggiProtocollo(id)
  const db = getDb()
  return db.transaction(() => {
    const { next } = db
      .prepare('SELECT COALESCE(MAX(ordine), -1) + 1 AS next FROM screening_protocolli')
      .get() as { next: number }
    const nuovo = Number(
      db
        .prepare(
          'INSERT INTO screening_protocolli (nome, sport, note, ordine) VALUES (?, ?, ?, ?)'
        )
        .run(nome.trim(), originale.protocollo.sport, originale.protocollo.note, next)
        .lastInsertRowid
    )
    salvaProtocollo({
      protocollo: { ...originale.protocollo, id: nuovo, nome: nome.trim() },
      // id azzerati: sezioni e voci vanno create nuove, non spostate
      sezioni: originale.sezioni.map((s) => ({
        ...s,
        id: null,
        voci: s.voci.map((v) => ({ ...v, id: null }))
      }))
    })
    return nuovo
  })()
}
