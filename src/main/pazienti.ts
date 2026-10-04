// I pazienti: anagrafica, patologia e fase, follow-up, obiettivi e test della
// fase. Senza niente di Electron (modello: sedute.ts): in ipc.ts restano i
// canali, e le prove automatiche chiamano questo codice (test/pazienti.test.ts).
import { getDb } from './db'
import { eliminaConCestino, eliminaPazientePerSempre } from './cestino'
import { richiedeTesto, validaData } from './validazione'
import { andamentoDolorePerPaziente } from './andamento-dolore'
import type {
  PazienteCreateInput,
  PazienteDettaglio,
  PazienteInput,
  StatoPaziente
} from '../shared/types'

// La fase corrente deve appartenere alla patologia assegnata al paziente.
export function checkFaseCoerente(patologiaId: number | null, faseId: number | null): void {
  if (faseId == null) return
  if (patologiaId == null) throw new Error('Imposta prima la patologia del paziente.')
  const fase = getDb()
    .prepare('SELECT patologia_id, campo FROM fasi WHERE id = ?')
    .get(faseId) as { patologia_id: number; campo: number } | undefined
  if (!fase || fase.patologia_id !== patologiaId) {
    throw new Error('La fase selezionata non appartiene alla patologia del paziente.')
  }
  // Il campo e' un percorso parallelo: la fase corrente e' sempre di palestra,
  // altrimenti "Avanza" non saprebbe da dove ripartire.
  if (fase.campo === 1) {
    throw new Error(
      'Una fase del campo non si imposta come fase corrente: il campo si sceglie sulla singola seduta.'
    )
  }
}

// L'ultima seduta e' l'ultima fatta, non l'ultima in calendario: una seduta
// gia' fissata per la settimana prossima portava il paziente in cima
// all'elenco prima ancora di vederlo.
export function elencoPazienti(): PazienteDettaglio[] {
  return getDb()
    .prepare(
      `SELECT p.*, pat.nome AS patologia_nome, f.nome AS fase_nome, g.nome AS gruppo_nome,
              (SELECT MAX(s.data) FROM sedute s
               WHERE s.paziente_id = p.id AND s.data <= date('now', 'localtime')) AS ultima_seduta
       FROM pazienti p
       LEFT JOIN patologie pat ON pat.id = p.patologia_id
       LEFT JOIN fasi f ON f.id = p.fase_corrente_id
       LEFT JOIN gruppi g ON g.id = p.gruppo_id
       -- in cima chi ha la seduta piu' recente; chi non ne ha ancora resta in
       -- fondo, in ordine alfabetico
       ORDER BY ultima_seduta IS NULL, ultima_seduta DESC, p.cognome, p.nome`
    )
    .all() as PazienteDettaglio[]
}

export function creaPaziente(data: PazienteCreateInput): number {
  richiedeTesto(data.nome, 'Il nome')
  richiedeTesto(data.cognome, 'Il cognome')
  validaData(data.data_nascita, 'La data di nascita')
  validaData(data.data_intervento, "La data dell'intervento")
  checkFaseCoerente(data.patologia_id, data.fase_corrente_id)
  return Number(
    getDb()
      .prepare(
        `INSERT INTO pazienti
           (nome, cognome, data_nascita, codice_fiscale, telefono, email, lavoro, inviato_da, sport, diagnosi,
            tipo_intervento, data_intervento, precauzioni, patologia_id, fase_corrente_id, gruppo_id)
         VALUES
           (@nome, @cognome, @data_nascita, @codice_fiscale, @telefono, @email, @lavoro, @inviato_da, @sport, @diagnosi,
            @tipo_intervento, @data_intervento, @precauzioni, @patologia_id, @fase_corrente_id, @gruppo_id)`
      )
      .run({ ...data, nome: data.nome.trim(), cognome: data.cognome.trim() }).lastInsertRowid
  )
}

export function aggiornaPaziente(id: number, data: PazienteInput): void {
  richiedeTesto(data.nome, 'Il nome')
  richiedeTesto(data.cognome, 'Il cognome')
  validaData(data.data_nascita, 'La data di nascita')
  validaData(data.data_intervento, "La data dell'intervento")
  getDb()
    .prepare(
      `UPDATE pazienti SET nome = @nome, cognome = @cognome,
       data_nascita = @data_nascita, codice_fiscale = @codice_fiscale, telefono = @telefono, email = @email,
       lavoro = @lavoro, inviato_da = @inviato_da, sport = @sport, diagnosi = @diagnosi,
       tipo_intervento = @tipo_intervento, data_intervento = @data_intervento,
       precauzioni = @precauzioni, arto_operato = @arto_operato, gruppo_id = @gruppo_id
       WHERE id = @id`
    )
    .run({ ...data, nome: data.nome.trim(), cognome: data.cognome.trim(), id })
}

export function impostaPatologiaFase(id: number, patologiaId: number | null, faseId: number | null): void {
  checkFaseCoerente(patologiaId, faseId)
  getDb()
    .prepare('UPDATE pazienti SET patologia_id = ?, fase_corrente_id = ? WHERE id = ?')
    .run(patologiaId, faseId, id)
}

export function eliminaPaziente(id: number): void {
  const p = getDb().prepare('SELECT nome, cognome FROM pazienti WHERE id = ?').get(id) as
    | { nome: string; cognome: string }
    | undefined
  eliminaConCestino('pazienti', id, 'Paziente', `${p?.cognome ?? ''} ${p?.nome ?? ''}`.trim())
}

export function eliminaPazienteDefinitivamente(id: number): void {
  eliminaPazientePerSempre(id)
}

// ---- Follow-up ----
// Le due liste escono dalla stessa query dell'elenco pazienti, divise per
// stato: in trattamento in ordine di seduta piu' recente, in follow-up in
// ordine di data da contattare (chi non ne ha in fondo).
export function elencoFollowUp(): { trattamento: PazienteDettaglio[]; concluso: PazienteDettaglio[] } {
  const righe = getDb()
    .prepare(
      `SELECT p.*, pat.nome AS patologia_nome, f.nome AS fase_nome,
              (SELECT MAX(s.data) FROM sedute s
               WHERE s.paziente_id = p.id AND s.data <= date('now', 'localtime')) AS ultima_seduta
       FROM pazienti p
       LEFT JOIN patologie pat ON pat.id = p.patologia_id
       LEFT JOIN fasi f ON f.id = p.fase_corrente_id
       ORDER BY p.cognome, p.nome`
    )
    .all() as (PazienteDettaglio & { stato: StatoPaziente })[]

  const perSeduta = (a: PazienteDettaglio, b: PazienteDettaglio): number =>
    (b.ultima_seduta ?? '').localeCompare(a.ultima_seduta ?? '')
  // chi ha una data da rispettare viene prima, in ordine di scadenza
  const perScadenza = (a: PazienteDettaglio, b: PazienteDettaglio): number => {
    if (a.follow_up_il == null) return b.follow_up_il == null ? 0 : 1
    if (b.follow_up_il == null) return -1
    return a.follow_up_il.localeCompare(b.follow_up_il)
  }
  return {
    trattamento: righe.filter((p) => p.stato !== 'concluso').sort(perSeduta),
    concluso: righe.filter((p) => p.stato === 'concluso').sort(perScadenza)
  }
}

export function impostaStato(id: number, stato: StatoPaziente, followUpIl: string | null): void {
  getDb()
    .prepare('UPDATE pazienti SET stato = ?, follow_up_il = ? WHERE id = ?')
    .run(stato, stato === 'concluso' ? followUpIl : null, id)
}

export function impostaFollowUp(id: number, followUpIl: string | null): void {
  getDb().prepare('UPDATE pazienti SET follow_up_il = ? WHERE id = ?').run(followUpIl, id)
}

// Spuntare "contattato" segna la data di oggi e libera il prossimo contatto:
// se ne serve un altro, la data la si rimette a mano.
export function segnaContattato(id: number, contattato: boolean): void {
  const db = getDb()
  if (contattato) {
    db.prepare(
      "UPDATE pazienti SET contattato_il = date('now', 'localtime'), follow_up_il = NULL WHERE id = ?"
    ).run(id)
  } else {
    db.prepare('UPDATE pazienti SET contattato_il = NULL WHERE id = ?').run(id)
  }
}

export function impostaRecensione(id: number, recensione: boolean): void {
  getDb().prepare('UPDATE pazienti SET recensione = ? WHERE id = ?').run(recensione ? 1 : 0, id)
}

// ---- Obiettivi raggiunti e test della fase ----
export function obiettiviRaggiunti(pazienteId: number): number[] {
  return (
    getDb()
      .prepare('SELECT obiettivo_id FROM paziente_obiettivi WHERE paziente_id = ?')
      .all(pazienteId) as { obiettivo_id: number }[]
  ).map((r) => r.obiettivo_id)
}

export function impostaObiettivoRaggiunto(pazienteId: number, obiettivoId: number, raggiunto: boolean): void {
  if (raggiunto) {
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO paziente_obiettivi (paziente_id, obiettivo_id, raggiunto_il)
         VALUES (?, ?, date('now', 'localtime'))`
      )
      .run(pazienteId, obiettivoId)
  } else {
    getDb()
      .prepare('DELETE FROM paziente_obiettivi WHERE paziente_id = ? AND obiettivo_id = ?')
      .run(pazienteId, obiettivoId)
  }
}

// Il dolore nel tempo per la linguetta "Quadro": la query sta in un file suo.
export { andamentoDolorePerPaziente as andamentoDolore }

export function valoriTest(pazienteId: number, faseId: number): unknown[] {
  return getDb()
    .prepare(
      `SELECT t.id AS test_id, t.nome,
              COALESCE(pt.eseguito, 0) AS eseguito,
              pt.valore
       FROM test_avanzamento t
       LEFT JOIN paziente_test pt ON pt.test_id = t.id AND pt.paziente_id = ?
       WHERE t.fase_id = ?
       ORDER BY t.ordine, t.id`
    )
    .all(pazienteId, faseId)
}

export function impostaValoreTest(
  pazienteId: number,
  testId: number,
  eseguito: boolean,
  valore: string | null
): void {
  getDb()
    .prepare(
      `INSERT INTO paziente_test (paziente_id, test_id, eseguito, valore)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(paziente_id, test_id) DO UPDATE SET eseguito = excluded.eseguito, valore = excluded.valore`
    )
    .run(pazienteId, testId, eseguito ? 1 : 0, valore)
}
