// Le progressioni di esercizi a step (es. "Vertical braking"): la libreria di
// quelle che si possono usare, il loro collegamento alle fasi di una patologia e
// lo step a cui e' arrivato ogni paziente. Senza niente di Electron (modello:
// sedute.ts). Servono solo a programmare: niente di questo entra in cartella,
// referti o stampe.
import { getDb } from './db'
import { eliminaConCestino, nomeDi } from './cestino'
import { elencoSemplice, prossimoOrdine, riordina } from './elenchi'
import { posizioneInProgressione, type EsitoDatato } from '../shared/progressioni'
import type {
  EsitoProgressione,
  Progressione,
  ProgressioneInput,
  ProgressioniFase,
  StatoProgressione,
  StepProgressione
} from '../shared/types'

// ---- Gruppi (es. "Braking strategies": dentro Vertical e Horizontal) ----
export const gruppiProgressioni = elencoSemplice('progressione_gruppi', 'Gruppo di progressioni')

// ---- Progressioni e step ----
export function elencoProgressioni(): Progressione[] {
  const db = getDb()
  const righe = db
    .prepare(
      `SELECT p.id, p.gruppo_id, p.nome, p.criteri
       FROM progressioni p LEFT JOIN progressione_gruppi g ON g.id = p.gruppo_id
       ORDER BY COALESCE(g.ordine, 1000000), p.ordine, p.id`
    )
    .all() as Omit<Progressione, 'step'>[]
  const step = db
    .prepare(
      `SELECT s.id, s.progressione_id, s.esercizio_id, e.nome AS esercizio_nome,
              e.archiviato, s.requisito
       FROM progressione_step s JOIN esercizi e ON e.id = s.esercizio_id
       ORDER BY s.ordine, s.id`
    )
    .all() as (StepProgressione & { progressione_id: number })[]
  return righe.map((p) => ({
    ...p,
    step: step
      .filter((s) => s.progressione_id === p.id)
      .map(({ progressione_id: _ignora, ...resto }) => resto)
  }))
}

const nomeValido = (nome: string): string => {
  const pulito = nome.trim()
  if (pulito === '') throw new Error('Scrivi il nome.')
  return pulito
}

const vuotoNull = (testo: string | null): string | null => testo?.trim() || null

// I criteri con cui si passa allo step dopo: in una progressione nuova ci sono
// gia', si cambiano se servono.
export const CRITERI_PREDEFINITI = 'Competenza, nessun dolore, gonfiore lieve, nessun compenso'

export function creaProgressione(nome: string, gruppoId: number | null): number {
  return Number(
    getDb()
      .prepare('INSERT INTO progressioni (gruppo_id, nome, criteri, ordine) VALUES (?, ?, ?, ?)')
      .run(gruppoId, nomeValido(nome), CRITERI_PREDEFINITI, prossimoOrdine('progressioni')).lastInsertRowid
  )
}

export function aggiornaProgressione(id: number, dati: ProgressioneInput): void {
  getDb()
    .prepare('UPDATE progressioni SET nome = ?, gruppo_id = ?, criteri = ? WHERE id = ?')
    .run(nomeValido(dati.nome), dati.gruppo_id, vuotoNull(dati.criteri), id)
}

export function eliminaProgressione(id: number): void {
  eliminaConCestino('progressioni', id, 'Progressione di esercizi', nomeDi('progressioni', id))
}

export const riordinaProgressioni = (ids: number[]): void => riordina('progressioni', ids)

export function aggiungiStep(progressioneId: number, esercizioId: number, requisito: string | null): number {
  const db = getDb()
  const gia = db
    .prepare('SELECT 1 FROM progressione_step WHERE progressione_id = ? AND esercizio_id = ?')
    .get(progressioneId, esercizioId)
  if (gia) throw new Error('Questo esercizio è già uno step di questa progressione.')
  return Number(
    db
      .prepare('INSERT INTO progressione_step (progressione_id, esercizio_id, requisito, ordine) VALUES (?, ?, ?, ?)')
      .run(
        progressioneId,
        esercizioId,
        vuotoNull(requisito),
        prossimoOrdine('progressione_step', { colonna: 'progressione_id', id: progressioneId })
      ).lastInsertRowid
  )
}

export function aggiornaStep(id: number, requisito: string | null): void {
  getDb().prepare('UPDATE progressione_step SET requisito = ? WHERE id = ?').run(vuotoNull(requisito), id)
}

// Togliere uno step non tocca le sedute: cambia solo la scala, e lo step di chi
// la sta percorrendo si ricalcola.
export function togliStep(id: number): void {
  getDb().prepare('DELETE FROM progressione_step WHERE id = ?').run(id)
}

export const riordinaStep = (ids: number[]): void => riordina('progressione_step', ids)

// Quali progressioni usano un esercizio: serve a dire, prima di eliminarlo, da
// dove va tolto.
export function progressioniConEsercizio(esercizioId: number): string[] {
  return (
    getDb()
      .prepare(
        `SELECT p.nome FROM progressione_step s JOIN progressioni p ON p.id = s.progressione_id
         WHERE s.esercizio_id = ? ORDER BY p.nome`
      )
      .all(esercizioId) as { nome: string }[]
  ).map((r) => r.nome)
}

// ---- Collegamento alle fasi ----
export function progressioniDellaFase(faseId: number): ProgressioniFase {
  const db = getDb()
  return {
    gruppo_ids: (
      db.prepare('SELECT gruppo_id FROM fase_progressione_gruppi WHERE fase_id = ?').all(faseId) as {
        gruppo_id: number
      }[]
    ).map((r) => r.gruppo_id),
    progressione_ids: (
      db.prepare('SELECT progressione_id FROM fase_progressioni WHERE fase_id = ?').all(faseId) as {
        progressione_id: number
      }[]
    ).map((r) => r.progressione_id)
  }
}

// Si salva sempre tutto l'insieme, come le sezioni e le categorie.
export function impostaProgressioniFase(faseId: number, dati: ProgressioniFase): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM fase_progressione_gruppi WHERE fase_id = ?').run(faseId)
    db.prepare('DELETE FROM fase_progressioni WHERE fase_id = ?').run(faseId)
    const g = db.prepare('INSERT OR IGNORE INTO fase_progressione_gruppi (fase_id, gruppo_id) VALUES (?, ?)')
    for (const id of dati.gruppo_ids) g.run(faseId, id)
    const p = db.prepare('INSERT OR IGNORE INTO fase_progressioni (fase_id, progressione_id) VALUES (?, ?)')
    for (const id of dati.progressione_ids) p.run(faseId, id)
  })()
}

// ---- Dove e' arrivato il paziente ----

// Le progressioni di una fase (un gruppo intero vale per tutte le sue, anche
// per quelle aggiunte dopo) con, per ognuna, lo step a cui e' il paziente.
//
// Contano le sedute fino a `finoAl` (di solito oggi: quelle programmate per i
// giorni a venire non sono ancora andate in nessun modo) tranne `escludi`,
// cioe' quella che si sta scrivendo.
export function statoProgressioni(
  pazienteId: number,
  faseId: number | null,
  finoAl: string,
  escludi: number | null
): StatoProgressione[] {
  if (faseId == null) return []
  const db = getDb()
  const ids = (
    db
      .prepare(
        `SELECT p.id FROM progressioni p LEFT JOIN progressione_gruppi g ON g.id = p.gruppo_id
         WHERE p.id IN (SELECT progressione_id FROM fase_progressioni WHERE fase_id = ?)
            OR p.gruppo_id IN (SELECT gruppo_id FROM fase_progressione_gruppi WHERE fase_id = ?)
         ORDER BY COALESCE(g.ordine, 1000000), p.ordine, p.id`
      )
      .all(faseId, faseId) as { id: number }[]
  ).map((r) => r.id)
  if (ids.length === 0) return []

  const elenco = elencoProgressioni()
  const gruppi = new Map(
    (db.prepare('SELECT id, nome FROM progressione_gruppi').all() as { id: number; nome: string }[]).map((g) => [
      g.id,
      g.nome
    ])
  )
  const esitiSedute = db
    .prepare(
      `SELECT sp.progressione_id, s.data, sp.esito
       FROM seduta_progressioni sp JOIN sedute s ON s.id = sp.seduta_id
       WHERE s.paziente_id = ? AND s.data <= ? AND s.id <> COALESCE(?, -1)
       ORDER BY s.data, s.id`
    )
    .all(pazienteId, finoAl, escludi) as { progressione_id: number; data: string; esito: EsitoProgressione }[]

  const risultato: StatoProgressione[] = []
  for (const id of ids) {
    const p = elenco.find((x) => x.id === id)
    // senza step non c'e' niente da mostrare
    if (!p || p.step.length === 0) continue
    const esiti: EsitoDatato[] = esitiSedute
      .filter((e) => e.progressione_id === id)
      .map(({ data, esito }) => ({ data, esito }))
    const pos = posizioneInProgressione(p.step.length, esiti)
    risultato.push({
      id: p.id,
      nome: p.nome,
      criteri: p.criteri,
      gruppo_nome: p.gruppo_id == null ? null : (gruppi.get(p.gruppo_id) ?? null),
      posizione: pos.posizione,
      completata: pos.posizione >= p.step.length,
      attuale_dal: pos.attuale_dal,
      step: p.step.map((s, i) => ({
        ...s,
        stato: i < pos.posizione ? 'fatto' : i === pos.posizione ? 'attuale' : 'da_sbloccare',
        superato_il: pos.superato_il[i],
        rivisto_il: i === pos.posizione ? pos.rivisto_il[i] : null
      }))
    })
  }
  return risultato
}
