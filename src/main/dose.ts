// La dose di una fase (contatti di pliometria, serie di forza e di potenza per
// seduta) e il conto delle altre sedute della settimana. Senza niente di
// Electron (modello: sedute.ts); il calcolo sta in shared/dose.ts.
import { getDb } from './db'
import {
  contaRighe,
  settimanaDi,
  tipoValido,
  type CategoriaConto,
  type DoseFase,
  type DoseSettimana,
  type RigaConto
} from '../shared/dose'
import { caricoSettimane, type CaricoPaziente, type SedutaCarico } from '../shared/carico-settimane'

export function leggiDoseFase(faseId: number): DoseFase[] {
  return getDb()
    .prepare('SELECT chiave, minimo, massimo FROM fase_dose WHERE fase_id = ? ORDER BY chiave')
    .all(faseId) as DoseFase[]
}

const chiaveValida = (k: string): boolean => /^forza:\d+$/.test(k) || (tipoValido(k) && k !== 'forza')

const numero = (v: number | null, cosa: string): number | null => {
  if (v == null) return null
  if (!Number.isInteger(v) || v < 0 || v > 10000) {
    throw new Error(`${cosa}: scrivi un numero intero, senza virgola.`)
  }
  return v
}

// La dose intera della fase, al posto di quella di prima. Una riga senza
// numeri non si scrive: vuol dire "non si controlla".
export function salvaDoseFase(faseId: number, dosi: DoseFase[]): void {
  const db = getDb()
  const righe = dosi.map((d) => {
    if (!chiaveValida(d.chiave)) throw new Error('Una voce della dose non è valida: riprova.')
    const minimo = numero(d.minimo, 'Il numero più basso')
    const massimo = numero(d.massimo, 'Il numero più alto')
    if (minimo != null && massimo != null && minimo > massimo) {
      throw new Error('Il primo numero è più alto del secondo: scrivili dal più basso al più alto.')
    }
    return { chiave: d.chiave, minimo, massimo }
  })
  db.transaction(() => {
    db.prepare('DELETE FROM fase_dose WHERE fase_id = ?').run(faseId)
    const ins = db.prepare('INSERT INTO fase_dose (fase_id, chiave, minimo, massimo) VALUES (?, ?, ?, ?)')
    for (const r of righe) {
      if (r.minimo == null && r.massimo == null) continue
      ins.run(faseId, r.chiave, r.minimo, r.massimo)
    }
  })()
}

export function categoriePerConto(): CategoriaConto[] {
  return getDb().prepare('SELECT id, padre_id, conta_come FROM categorie').all() as CategoriaConto[]
}

// Le altre sedute della settimana (da lunedi' a domenica) di quel paziente:
// fatte o programmate, tranne quella che si sta componendo e quelle al campo.
export function doseSettimana(pazienteId: number, data: string, sedutaId: number | null): DoseSettimana {
  const db = getDb()
  const [lun, dom] = settimanaDi(data)
  const paziente = db.prepare('SELECT sedute_settimana FROM pazienti WHERE id = ?').get(pazienteId) as
    | { sedute_settimana: number | null }
    | undefined
  const filtro = `FROM sedute s LEFT JOIN fasi f ON f.id = s.fase_id
    WHERE s.paziente_id = ? AND s.data BETWEEN ? AND ?
      AND (? IS NULL OR s.id <> ?) AND COALESCE(f.campo, 0) = 0`
  const args = [pazienteId, lun, dom, sedutaId, sedutaId]
  const { n } = db.prepare(`SELECT COUNT(*) AS n ${filtro}`).get(...args) as { n: number }
  const righe = db
    .prepare(
      `SELECT e.categoria_id, e.gambe, se.monopodalico, se.serie, se.cluster, se.ripetizioni
       FROM seduta_esercizi se
       JOIN esercizi e ON e.id = se.esercizio_id
       WHERE se.seduta_id IN (SELECT s.id ${filtro})`
    )
    .all(...args) as RigaConto[]
  return {
    frequenza: paziente?.sedute_settimana ?? null,
    altreSedute: n,
    altre: contaRighe(righe, categoriePerConto())
  }
}

// Il carico settimana per settimana del paziente, per la linguetta Percorso:
// tutte le sedute fino a oggi, con le righe gia' pronte per il conto. Il
// calcolo sta in shared/carico-settimane.ts.
export function caricoPaziente(pazienteId: number): CaricoPaziente {
  const db = getDb()
  const { oggi } = db.prepare(`SELECT date('now', 'localtime') AS oggi`).get() as { oggi: string }
  const paziente = db.prepare('SELECT sedute_settimana FROM pazienti WHERE id = ?').get(pazienteId) as
    | { sedute_settimana: number | null }
    | undefined
  const sedute = db
    .prepare(
      `SELECT s.id, s.data, s.fase_id, f.nome AS fase_nome, COALESCE(f.campo, 0) AS campo, s.dolore, s.sforzo
       FROM sedute s LEFT JOIN fasi f ON f.id = s.fase_id
       WHERE s.paziente_id = ? AND s.data <= ?
       ORDER BY s.data, s.id`
    )
    .all(pazienteId, oggi) as (Omit<SedutaCarico, 'righe'> & { id: number })[]
  const righe = db
    .prepare(
      `SELECT se.seduta_id, e.categoria_id, e.gambe, se.monopodalico, se.serie, se.cluster, se.ripetizioni
       FROM seduta_esercizi se
       JOIN esercizi e ON e.id = se.esercizio_id
       JOIN sedute s ON s.id = se.seduta_id
       WHERE s.paziente_id = ? AND s.data <= ?`
    )
    .all(pazienteId, oggi) as (RigaConto & { seduta_id: number })[]
  const perSeduta = new Map<number, RigaConto[]>()
  for (const { seduta_id, ...r } of righe) perSeduta.set(seduta_id, [...(perSeduta.get(seduta_id) ?? []), r])

  const dosi: Record<number, DoseFase[]> = {}
  for (const id of new Set(sedute.map((s) => s.fase_id).filter((x): x is number => x != null))) {
    dosi[id] = leggiDoseFase(id)
  }

  const frequenza = paziente?.sedute_settimana ?? null
  const calcolo = caricoSettimane({
    sedute: sedute.map(({ id, ...s }) => ({ ...s, righe: perSeduta.get(id) ?? [] })),
    dosi,
    categorie: categoriePerConto(),
    frequenza,
    oggi
  })

  const nomi: Record<string, string> = {}
  const nome = db.prepare('SELECT nome FROM categorie WHERE id = ?')
  for (const k of calcolo.chiavi) {
    if (!k.startsWith('forza:')) continue
    const c = nome.get(Number(k.slice(6))) as { nome: string } | undefined
    nomi[k] = c?.nome ?? 'Forza'
  }
  return { ...calcolo, nomi, frequenza }
}
