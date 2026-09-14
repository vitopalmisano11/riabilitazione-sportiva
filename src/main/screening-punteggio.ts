// Il punteggio di un protocollo di screening: il risultato del cluster.
//
// I test della libreria hanno gia' i loro cut-off e i loro valori di
// riferimento, e quelli restano. Il punteggio invece e' del protocollo: lo stesso
// side hop puo' valere 4 punti nell'Ankle-GO e avere soglie diverse in un altro
// cluster, senza toccare il test.
//
// Le regole: per ogni voce (una misura di un test, o il punteggio di un
// questionario) delle soglie "da ... a ... → punti", lette dall'alto — vale la
// prima che si avvera, e i limiti sono compresi. Poi le fasce del risultato
// sul totale, come nei questionari.
//
// Un protocollo senza regole non ha punteggio: in esecuzione e nel report non
// compare niente.
import { getDb } from './db'
import { lsi, valoreDi, type RigaValore } from '../shared/misure'
import type {
  FasciaPunteggio,
  MisuraTest,
  PunteggioProtocollo,
  RegolaPunteggio,
  RisultatoPunteggio,
  SogliaPunteggio,
  VoceRisultato
} from '../shared/types'

type Db = ReturnType<typeof getDb>

export function leggiPunteggioProtocollo(protocolloId: number): PunteggioProtocollo {
  const db = getDb()
  const regole = (
    db
      .prepare(
        `SELECT id, misura_id, punteggio_id, lato, nome, soglie
         FROM screening_punteggio_regole WHERE protocollo_id = ? ORDER BY ordine, id`
      )
      .all(protocolloId) as (Omit<RegolaPunteggio, 'soglie'> & { soglie: string })[]
  ).map((r) => ({ ...r, soglie: leggiSoglie(r.soglie) }))
  const fasce = db
    .prepare(
      `SELECT etichetta, minimo, massimo FROM screening_punteggio_fasce
       WHERE protocollo_id = ? ORDER BY ordine, id`
    )
    .all(protocolloId) as FasciaPunteggio[]
  return { regole, fasce }
}

function leggiSoglie(testo: string): SogliaPunteggio[] {
  try {
    const lista = JSON.parse(testo) as SogliaPunteggio[]
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

// Si riscrive per intero: nessun'altra tabella cita le regole o le fasce.
export function salvaPunteggioProtocollo(db: Db, protocolloId: number, dati: PunteggioProtocollo): void {
  db.prepare('DELETE FROM screening_punteggio_regole WHERE protocollo_id = ?').run(protocolloId)
  db.prepare('DELETE FROM screening_punteggio_fasce WHERE protocollo_id = ?').run(protocolloId)
  const insRegola = db.prepare(
    `INSERT INTO screening_punteggio_regole
       (protocollo_id, misura_id, punteggio_id, lato, nome, soglie, ordine)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  dati.regole.forEach((r, i) => {
    // una regola senza da dove prendere il valore non si salva
    if (r.misura_id == null && r.punteggio_id == null) return
    const soglie = r.soglie
      .filter((s) => Number.isFinite(Number(s.punti)))
      .map((s) => ({ minimo: numero(s.minimo), massimo: numero(s.massimo), punti: Number(s.punti) }))
    insRegola.run(
      protocolloId,
      r.misura_id,
      r.misura_id != null ? null : r.punteggio_id,
      r.misura_id != null ? r.lato : null,
      r.nome.trim() || 'Voce',
      JSON.stringify(soglie),
      i
    )
  })
  const insFascia = db.prepare(
    `INSERT INTO screening_punteggio_fasce (protocollo_id, etichetta, minimo, massimo, ordine)
     VALUES (?, ?, ?, ?, ?)`
  )
  dati.fasce.forEach((f, i) => {
    if (!f.etichetta.trim()) return
    insFascia.run(protocolloId, f.etichetta.trim(), numero(f.minimo), numero(f.massimo), i)
  })
}

function numero(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// La prima soglia che si avvera; nessuna, zero punti.
export function puntiPer(valore: number, soglie: SogliaPunteggio[]): number {
  const s = soglie.find(
    (x) => (x.minimo == null || valore >= x.minimo) && (x.massimo == null || valore <= x.massimo)
  )
  return s ? s.punti : 0
}

export function calcolaPunteggio(sessioneId: number): RisultatoPunteggio | null {
  const db = getDb()
  const s = db
    .prepare(
      `SELECT s.protocollo_id, p.arto_operato FROM screening_sessioni s
       JOIN pazienti p ON p.id = s.paziente_id WHERE s.id = ?`
    )
    .get(sessioneId) as { protocollo_id: number | null; arto_operato: 'dx' | 'sx' | null } | undefined
  if (!s || s.protocollo_id == null) return null

  const { regole, fasce } = leggiPunteggioProtocollo(s.protocollo_id)
  if (regole.length === 0) return null

  const valori = db
    .prepare('SELECT misura_id, lato, prova, valore FROM screening_valori WHERE sessione_id = ?')
    .all(sessioneId) as RigaValore[]
  const misuraStmt = db.prepare(
    `SELECT m.*, t.per_lato, t.nome AS test_nome FROM test_misure m
     JOIN test_valutazione t ON t.id = m.test_id WHERE m.id = ?`
  )
  const misureTestStmt = db.prepare('SELECT * FROM test_misure WHERE test_id = ?')
  const punteggioQStmt = db.prepare(
    `SELECT qp.nome, qp.questionario_id FROM questionario_punteggi qp WHERE qp.id = ?`
  )
  const compilatoStmt = db.prepare(
    `SELECT cp.valore FROM screening_questionari sq
     JOIN compilazione_punteggi cp ON cp.compilazione_id = sq.compilazione_id
     WHERE sq.sessione_id = ? AND sq.questionario_id = ? AND cp.nome = ?`
  )

  const voci: VoceRisultato[] = regole.map((r): VoceRisultato => {
    const massimo = Math.max(0, ...r.soglie.map((x) => x.punti))
    let valore: number | null = null
    let unita: string | null = null

    if (r.misura_id != null) {
      const m = misuraStmt.get(r.misura_id) as
        | (MisuraTest & { per_lato: number; test_id: number })
        | undefined
      if (m) {
        const tutte = misureTestStmt.all(m.test_id) as MisuraTest[]
        if (Number(m.per_lato) === 1) {
          const dx = valoreDi(valori, m, tutte, 'dx')
          const sx = valoreDi(valori, m, tutte, 'sx')
          if (r.lato === 'lsi') {
            valore = lsi(dx, sx, s.arto_operato)
            unita = '%'
          } else {
            // Il lato interessato; se nel paziente non e' scritto, il lato
            // peggiore — quello che il cluster vuole giudicare.
            unita = m.unita
            if (s.arto_operato === 'dx') valore = dx
            else if (s.arto_operato === 'sx') valore = sx
            else if (dx != null && sx != null) {
              valore = m.cutoff_direzione === 'max' ? Math.max(dx, sx) : Math.min(dx, sx)
            } else valore = dx ?? sx
          }
        } else {
          valore = valoreDi(valori, m, tutte, null)
          unita = m.unita
        }
      }
    } else if (r.punteggio_id != null) {
      const p = punteggioQStmt.get(r.punteggio_id) as
        | { nome: string; questionario_id: number }
        | undefined
      if (p) {
        const c = compilatoStmt.get(sessioneId, p.questionario_id, p.nome) as
          | { valore: number }
          | undefined
        valore = c ? Number(c.valore) : null
      }
    }

    return {
      nome: r.nome,
      valore,
      unita,
      punti: valore == null ? null : puntiPer(valore, r.soglie),
      massimo
    }
  })

  const totale = voci.reduce((somma, v) => somma + (v.punti ?? 0), 0)
  const massimo = voci.reduce((somma, v) => somma + v.massimo, 0)
  const completo = voci.every((v) => v.punti != null)
  // La fascia si dice solo a punteggio completo: con un test mancante il totale
  // e' piu' basso di quello vero, e la fascia sarebbe sbagliata.
  const fascia = completo
    ? (fasce.find(
        (f) => (f.minimo == null || totale >= f.minimo) && (f.massimo == null || totale <= f.massimo)
      )?.etichetta ?? null)
    : null

  return { totale, massimo, fascia, completo, voci }
}
