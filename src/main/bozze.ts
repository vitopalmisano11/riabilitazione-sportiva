// La bozza della seduta in costruzione: una per paziente, si mette da parte da
// sola mentre si compone e si sostituisce a ogni salvataggio. Se il programma
// si chiude a meta', la seduta si riprende da qui. Senza niente di Electron
// (modello: sedute.ts).
import { getDb } from './db'

export function leggiBozza(pazienteId: number): { aggiornata_il: string; contenuto: string } | null {
  return (
    (getDb().prepare('SELECT aggiornata_il, contenuto FROM bozze_seduta WHERE paziente_id = ?').get(pazienteId) as
      | { aggiornata_il: string; contenuto: string }
      | undefined) ?? null
  )
}

export function salvaBozza(pazienteId: number, contenuto: string): void {
  getDb()
    .prepare(
      `INSERT INTO bozze_seduta (paziente_id, aggiornata_il, contenuto) VALUES (?, ?, ?)
       ON CONFLICT(paziente_id) DO UPDATE SET aggiornata_il = excluded.aggiornata_il,
         contenuto = excluded.contenuto`
    )
    .run(pazienteId, new Date().toISOString(), contenuto)
}

export function eliminaBozza(pazienteId: number): void {
  getDb().prepare('DELETE FROM bozze_seduta WHERE paziente_id = ?').run(pazienteId)
}
