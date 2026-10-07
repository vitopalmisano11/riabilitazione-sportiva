// Valutazione obiettiva: libreria dei distretti e rilievi sul paziente.
//
// Movimenti e test appartengono al distretto, non alla patologia. Il salvataggio
// del distretto e' in blocco: gli elementi con id restano quelli, cosi' le
// valutazioni gia' fatte continuano a puntare al movimento giusto.
import { getDb } from './db'
import { eliminaMancanti } from './figli'
import { validaData } from './validazione'
import type {
  Distretto,
  DistrettoCompleto,
  MovimentoDistretto,
  TestDistretto,
  TipoVoceNeuro,
  Valutazione,
  VoceNeuro,
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
  const neuro = db
    .prepare(
      'SELECT id, tipo, nome FROM distretto_neuro WHERE distretto_id = ? ORDER BY ordine, id'
    )
    .all(id) as VoceNeuro[]
  return { distretto, movimenti, test, neuro }
}

const TIPI_NEURO: TipoVoceNeuro[] = ['radice', 'muscolo', 'riflesso']

// Un valore e' valido solo per il tipo di voce a cui appartiene: la forza e'
// una cifra da 0 a 5, la sensibilita' ridotta o aumentata (la radice normale
// non si scrive), il riflesso ipo / normale / iper.
function valoreNeuroValido(tipo: string, valore: string): boolean {
  if (tipo === 'radice') return valore === 'ridotta' || valore === 'aumentata'
  if (tipo === 'muscolo') return /^[0-5]$/.test(valore)
  if (tipo === 'riflesso') return valore === 'ipo' || valore === 'normale' || valore === 'iper'
  return false
}

export function salvaDistretto(dati: DistrettoCompleto): void {
  const db = getDb()
  const id = dati.distretto.id

  db.transaction(() => {
    db.prepare('UPDATE distretti SET nome = ?, bilaterale = ?, esame_neuro = ? WHERE id = ?').run(
      dati.distretto.nome.trim(),
      dati.distretto.bilaterale === 1 ? 1 : 0,
      dati.distretto.esame_neuro === 1 ? 1 : 0,
      id
    )

    eliminaMancanti(
      db,
      'distretto_movimenti',
      'distretto_id',
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
      'distretto_id',
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

    // Le voci dell'esame neurologico restano scritte anche se l'esame e'
    // spento: riaccenderlo non fa perdere gli elenchi.
    const voci = (dati.neuro ?? []).filter((v) => TIPI_NEURO.includes(v.tipo))
    eliminaMancanti(
      db,
      'distretto_neuro',
      'distretto_id',
      id,
      voci.map((v) => v.id).filter((x): x is number => x != null && x > 0)
    )
    const insN = db.prepare(
      'INSERT INTO distretto_neuro (distretto_id, tipo, nome, ordine) VALUES (?, ?, ?, ?)'
    )
    const updN = db.prepare('UPDATE distretto_neuro SET nome = ?, ordine = ? WHERE id = ?')
    voci.forEach((v, i) => {
      if (v.id == null || v.id < 0) insN.run(id, v.tipo, v.nome.trim(), i)
      else updN.run(v.nome.trim(), i, v.id)
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
      `SELECT distretto_id, nota_attivo, nota_passivo, nota_neuro
       FROM valutazione_distretti WHERE valutazione_id = ?`
    )
    .all(id) as {
    distretto_id: number
    nota_attivo: string | null
    nota_passivo: string | null
    nota_neuro: string | null
  }[]
  const distretto_ids = distretti.map((r) => r.distretto_id)
  const note_movimenti = distretti.map((r) => ({
    distretto_id: r.distretto_id,
    attivo: r.nota_attivo,
    passivo: r.nota_passivo,
    neuro: r.nota_neuro
  }))
  const movimenti = db
    .prepare(
      `SELECT movimento_id, lato, norma, passivo_norma, attivo_restrizione, attivo_dolore,
              attivo_gradi, passivo_restrizione, passivo_dolore, passivo_gradi, nota
       FROM valutazione_movimenti WHERE valutazione_id = ?`
    )
    .all(id) as ValutazioneCompleta['movimenti']
  const test = db
    .prepare('SELECT test_id, lato, valore, nota FROM valutazione_test WHERE valutazione_id = ?')
    .all(id) as ValutazioneCompleta['test']
  const neuro = db
    .prepare('SELECT voce_id, lato, valore FROM valutazione_neuro WHERE valutazione_id = ?')
    .all(id) as ValutazioneCompleta['neuro']
  return { valutazione, distretto_ids, movimenti, note_movimenti, test, neuro }
}

// Nuova valutazione che riparte da una precedente.
//
// A fine fase si rivedono gli stessi movimenti dello stesso distretto: partire
// dai valori dell'altra volta significa cambiare solo quelli che sono cambiati,
// e avere sotto gli occhi da dove si veniva. I testi discorsivi (ispezione,
// note, carico e capacita') non si copiano: sono il racconto di quel giorno, e
// ricopiarli vorrebbe dire ritrovarseli firmati come nuovi.
export function duplicaValutazione(id: number, data: string): number {
  validaData(data, 'La data della valutazione', { obbligatoria: true })
  const db = getDb()
  const sorgente = leggiValutazione(id)
  return db.transaction(() => {
    const nuovo = Number(
      db
        .prepare('INSERT INTO valutazioni (paziente_id, data) VALUES (?, ?)')
        .run(sorgente.valutazione.paziente_id, data).lastInsertRowid
    )
    salvaValutazione({
      ...sorgente,
      valutazione: {
        ...sorgente.valutazione,
        id: nuovo,
        data,
        ispezione: null,
        note: null,
        carico_locale: null,
        carico_generale: null,
        capacita_locale: null,
        capacita_generale: null
      }
    })
    return nuovo
  })()
}

export function salvaValutazione(dati: ValutazioneCompleta): void {
  validaData(dati.valutazione.data, 'La data della valutazione', { obbligatoria: true })
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
      `INSERT INTO valutazione_distretti
         (valutazione_id, distretto_id, nota_attivo, nota_passivo, nota_neuro)
       VALUES (?, ?, ?, ?, ?)`
    )
    for (const d of dati.distretto_ids) {
      const n = dati.note_movimenti.find((x) => x.distretto_id === d)
      insD.run(id, d, n?.attivo || null, n?.passivo || null, n?.neuro || null)
    }

    db.prepare('DELETE FROM valutazione_movimenti WHERE valutazione_id = ?').run(id)
    const insM = db.prepare(
      `INSERT INTO valutazione_movimenti
         (valutazione_id, movimento_id, lato, norma, passivo_norma, attivo_restrizione,
          attivo_dolore, attivo_gradi, passivo_restrizione, passivo_dolore, passivo_gradi, nota)
       VALUES (@valutazione_id, @movimento_id, @lato, @norma, @passivo_norma, @attivo_restrizione,
          @attivo_dolore, @attivo_gradi, @passivo_restrizione, @passivo_dolore,
          @passivo_gradi, @nota)`
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
        m.norma == null &&
        m.passivo_norma == null &&
        !m.nota
      if (!vuoto) {
        insM.run({
          ...m,
          lato: m.lato ?? '',
          norma: m.norma ?? null,
          passivo_norma: m.passivo_norma ?? null,
          valutazione_id: id
        })
      }
    }

    db.prepare('DELETE FROM valutazione_test WHERE valutazione_id = ?').run(id)
    const insT = db.prepare(
      'INSERT INTO valutazione_test (valutazione_id, test_id, lato, valore, nota) VALUES (?, ?, ?, ?, ?)'
    )
    for (const t of dati.test) {
      if (t.valore || t.nota) insT.run(id, t.test_id, t.lato ?? '', t.valore, t.nota)
    }

    // L'esame neurologico: solo le voci che esistono ancora, con un valore
    // adatto al loro tipo. Un doppione (stessa voce e lato) vale l'ultimo.
    db.prepare('DELETE FROM valutazione_neuro WHERE valutazione_id = ?').run(id)
    const tipoDi = new Map(
      (db.prepare('SELECT id, tipo FROM distretto_neuro').all() as { id: number; tipo: string }[]).map(
        (v) => [v.id, v.tipo]
      )
    )
    const insN = db.prepare(
      'INSERT OR REPLACE INTO valutazione_neuro (valutazione_id, voce_id, lato, valore) VALUES (?, ?, ?, ?)'
    )
    for (const n of dati.neuro ?? []) {
      const tipo = tipoDi.get(n.voce_id)
      if (!tipo || (n.lato !== 'sx' && n.lato !== 'dx')) continue
      if (valoreNeuroValido(tipo, String(n.valore))) insN.run(id, n.voce_id, n.lato, String(n.valore))
    }
  })()
}
