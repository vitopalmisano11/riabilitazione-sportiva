// I numeri dell'atleta: i massimali (con cui "80%" diventa un peso) e peso e
// altezza. Senza niente di Electron (modello: sedute.ts).
import { getDb } from './db'
import { richiedeTesto, validaData, validaNumeroPositivo } from './validazione'

export const elencoMassimali = (pazienteId: number): unknown[] =>
  getDb().prepare('SELECT * FROM massimali WHERE paziente_id = ? ORDER BY data DESC, id DESC').all(pazienteId)

export function creaMassimale(
  pazienteId: number,
  esercizio: string,
  valore: number,
  unita: string | null,
  data: string
): number {
  richiedeTesto(esercizio, "Il nome dell'esercizio")
  validaNumeroPositivo(valore, 'Il valore')
  validaData(data, 'La data', { obbligatoria: true })
  return Number(
    getDb()
      .prepare('INSERT INTO massimali (paziente_id, esercizio, valore, unita, data) VALUES (?, ?, ?, ?, ?)')
      .run(pazienteId, esercizio.trim(), valore, unita?.trim() || null, data).lastInsertRowid
  )
}

export function eliminaMassimale(id: number): void {
  getDb().prepare('DELETE FROM massimali WHERE id = ?').run(id)
}

export function impostaMisure(pazienteId: number, peso: number | null, altezza: number | null): void {
  if (peso != null) validaNumeroPositivo(peso, 'Il peso')
  if (altezza != null) validaNumeroPositivo(altezza, "L'altezza")
  getDb().prepare('UPDATE pazienti SET peso = ?, altezza = ? WHERE id = ?').run(peso, altezza, pazienteId)
}
