// L'anamnesi del paziente: prossima (i sintomi di adesso, con i loro grafici),
// attivita' e partecipazione, e remota (cio' che si porta dietro da prima).
// Senza niente di Electron (modello: sedute.ts). Il codice e' quello che stava
// nei canali di ipc.ts, spostato com'era.
import { getDb } from './db'
import type { AnamnesiProssima, AnamnesiRemota, AttivitaPartecipazione } from '../shared/types'

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

export function leggiAnamnesi(pazienteId: number): AnamnesiProssima {
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
  } as unknown as AnamnesiProssima
}

export function salvaAnamnesi(pazienteId: number, dati: AnamnesiProssima): void {
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
}

export function leggiAttivita(pazienteId: number): AttivitaPartecipazione {
  const riga = getDb()
    .prepare('SELECT attivita, partecipazione, fattori_interni FROM anamnesi_attivita WHERE paziente_id = ?')
    .get(pazienteId)
  return (riga ?? { attivita: null, partecipazione: null, fattori_interni: null }) as AttivitaPartecipazione
}

export function salvaAttivita(pazienteId: number, dati: AttivitaPartecipazione): void {
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
}

export function leggiRemota(pazienteId: number): AnamnesiRemota {
  const riga = getDb()
    .prepare('SELECT * FROM anamnesi_remota WHERE paziente_id = ?')
    .get(pazienteId) as Record<string, unknown> | undefined
  return { ...REMOTA_VUOTA, ...(riga ?? {}) }
}

export function salvaRemota(pazienteId: number, dati: AnamnesiRemota): void {
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
}
