// Le sedute: leggere, scrivere, copiare su piu' giorni, eliminare.
//
// E' il modello per tutti i domini: qui la logica (SQL, validazione,
// transazioni), senza niente di Electron, cosi' le prove automatiche la
// chiamano davvero (test/sedute.test.ts) invece di ricopiarne le query; in
// ipc.ts restano solo i canali che la collegano all'interfaccia.
//
// Le query che servono anche altrove stanno nei loro file: la settimana
// (settimana.ts), l'ultima volta di un esercizio (ultima-volta.ts), la seduta
// prima (seduta-precedente.ts).
import { getDb } from './db'
import { dataIt, eliminaConCestino } from './cestino'
import { validaData, validaOra, validaScala010 } from './validazione'
import type { SedutaDettaglio, SedutaInput, SedutaRiepilogo } from '../shared/types'

// Le parti della seduta che stanno in tabelle loro: misure dei segni,
// tecniche, sezioni ed esercizi. Si scrivono sempre tutte insieme, dentro alla
// transazione di chi chiama.
function scriviFigli(sedutaId: number | bigint, input: SedutaInput): void {
  const db = getDb()
  // Le misure dei segni di riferimento seguono la seduta in cui sono state
  // prese: si salvano e si cancellano con lei.
  const insSegno = db.prepare('INSERT INTO segno_valori (segno_id, seduta_id, valore) VALUES (?, ?, ?)')
  for (const v of input.segni) insSegno.run(v.segno_id, sedutaId, v.valore)
  const insTecnica = db.prepare('INSERT OR IGNORE INTO seduta_tecniche (seduta_id, tecnica_id) VALUES (?, ?)')
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
  // Come sono andati gli esercizi delle progressioni: solo avanza e indietro,
  // "continua" e' non scrivere niente.
  const insEsito = db.prepare(
    'INSERT OR REPLACE INTO seduta_progressioni (seduta_id, progressione_id, esito) VALUES (?, ?, ?)'
  )
  for (const p of input.progressioni ?? []) insEsito.run(sedutaId, p.progressione_id, p.esito)
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

export function validaSeduta(input: SedutaInput): void {
  validaData(input.data, 'La data della seduta', { obbligatoria: true })
  validaOra(input.ora, "L'orario della seduta")
  validaScala010(input.dolore, 'Il dolore')
  validaScala010(input.sforzo, 'Lo sforzo percepito')
  // Ogni riga viene dalla libreria (esercizio_id) oppure e' scritta al volo
  // per questa seduta (nome_libero): mai tutte e due, mai nessuna delle due.
  for (const e of input.esercizi) {
    if ((e.esercizio_id == null) === (e.nome_libero == null)) {
      throw new Error("Un esercizio della seduta non ha ne' un esercizio di libreria ne' un nome: riprova.")
    }
  }
  for (const p of input.progressioni ?? []) {
    if (p.esito !== 'avanza' && p.esito !== 'indietro') {
      throw new Error("L'esito di una progressione non è valido: riprova.")
    }
  }
}

// Il diario del paziente, dalla piu' recente.
export function elencoSedute(pazienteId: number): SedutaRiepilogo[] {
  return getDb()
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
    .all(pazienteId) as SedutaRiepilogo[]
}

// I focus gia' scritti, dal piu' usato di recente: si ripropongono mentre si
// scrive, cosi' "preparazione corsa" si scrive una volta sola.
export function focusUsati(): string[] {
  return (
    getDb()
      .prepare(
        `SELECT focus FROM sedute
         WHERE focus IS NOT NULL AND TRIM(focus) <> ''
         GROUP BY focus ORDER BY MAX(data) DESC, MAX(id) DESC LIMIT 30`
      )
      .all() as { focus: string }[]
  ).map((r) => r.focus)
}

export function leggiSeduta(id: number): SedutaDettaglio {
  const db = getDb()
  const seduta = db
    .prepare('SELECT s.*, f.nome AS fase_nome FROM sedute s LEFT JOIN fasi f ON f.id = s.fase_id WHERE s.id = ?')
    .get(id)
  if (!seduta) throw new Error('Seduta non trovata.')
  const sezioniRows = db
    .prepare('SELECT id, sezione_id, nome FROM seduta_sezioni WHERE seduta_id = ? ORDER BY ordine, id')
    .all(id) as { id: number; sezione_id: number | null; nome: string }[]
  // Un esercizio "al volo" non ha una riga in libreria: LEFT JOIN, e il nome
  // e' quello scritto li' per li'.
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
  const progressioni = db
    .prepare('SELECT progressione_id, esito FROM seduta_progressioni WHERE seduta_id = ? ORDER BY progressione_id')
    .all(id)
  return { ...seduta, tecnica_ids, sezioni, progressioni } as unknown as SedutaDettaglio
}

export function creaSeduta(input: SedutaInput): number {
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
    scriviFigli(sid, input)
    return Number(sid)
  })()
}

export function aggiornaSeduta(id: number, input: SedutaInput): void {
  validaSeduta(input)
  const db = getDb()
  db.transaction(() => {
    const cambiata = db
      .prepare(
        `UPDATE sedute SET data = ?, ora = ?, fase_id = ?, focus = ?, dolore = ?, sforzo = ?,
           riferito_andamento = ?, riferito = ?, trattamento = ?, note = ?
         WHERE id = ?`
      )
      .run(
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
      ).changes
    // Una seduta eliminata nel frattempo (per esempio da un'altra finestra):
    // senza questo controllo le sue righe figlie finivano attaccate a niente.
    if (cambiata === 0) throw new Error('Seduta non trovata: forse è stata eliminata.')
    db.prepare('DELETE FROM segno_valori WHERE seduta_id = ?').run(id)
    db.prepare('DELETE FROM seduta_tecniche WHERE seduta_id = ?').run(id)
    db.prepare('DELETE FROM seduta_esercizi WHERE seduta_id = ?').run(id)
    db.prepare('DELETE FROM seduta_sezioni WHERE seduta_id = ?').run(id)
    db.prepare('DELETE FROM seduta_progressioni WHERE seduta_id = ?').run(id)
    scriviFigli(id, input)
  })()
}

// Programmare la settimana: la stessa seduta copiata su piu' giorni. Chi
// prepara il lunedi', il mercoledi' e il venerdi' lo fa una volta sola, e poi
// il giorno stesso apre quella del giorno e cambia i due esercizi che vuole.
export function programmaSeduta(origineId: number, date: string[], ora: string | null = null): number[] {
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
        .prepare('INSERT INTO sedute (paziente_id, data, ora, fase_id, focus, note) VALUES (?, ?, ?, ?, ?, ?)')
        .run(sorgente.paziente_id, data, ora, sorgente.fase_id, sorgente.focus, sorgente.note).lastInsertRowid
      scriviFigli(sid, {
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
        // Nemmeno gli esiti delle progressioni: un "avanza" copiato su tre
        // sedute farebbe avanzare tre volte.
        progressioni: [],
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
}

// Nel cestino, con il nome del paziente: si rimette a posto per un mese.
export function eliminaSeduta(id: number): void {
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
}
