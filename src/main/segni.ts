// I segni di riferimento: le due o tre cose che si ricontrollano a ogni seduta
// ("dolore nello squat", "flessione del ginocchio"), con le loro misure.
// Senza niente di Electron (modello: sedute.ts).
import { getDb } from './db'
import { prossimoOrdine } from './elenchi'

export const elencoSegni = (pazienteId: number): unknown[] =>
  getDb().prepare('SELECT * FROM segni WHERE paziente_id = ? ORDER BY ordine, id').all(pazienteId)

// Prima misura e ultima, con le date: e' quello che si legge nella scheda
// ("dolore nello squat: da 7 a 3"). Il resto delle misure non serve li'.
export function andamentoSegni(pazienteId: number): unknown[] {
  return getDb()
    .prepare(
      `SELECT g.*,
         (SELECT s.data FROM segno_valori v JOIN sedute s ON s.id = v.seduta_id
           WHERE v.segno_id = g.id ORDER BY s.data, s.id LIMIT 1) AS prima_data,
         (SELECT v.valore FROM segno_valori v JOIN sedute s ON s.id = v.seduta_id
           WHERE v.segno_id = g.id ORDER BY s.data, s.id LIMIT 1) AS prima_valore,
         (SELECT s.data FROM segno_valori v JOIN sedute s ON s.id = v.seduta_id
           WHERE v.segno_id = g.id ORDER BY s.data DESC, s.id DESC LIMIT 1) AS ultima_data,
         (SELECT v.valore FROM segno_valori v JOIN sedute s ON s.id = v.seduta_id
           WHERE v.segno_id = g.id ORDER BY s.data DESC, s.id DESC LIMIT 1) AS ultima_valore,
         (SELECT COUNT(*) FROM segno_valori v WHERE v.segno_id = g.id) AS misure
       FROM segni g WHERE g.paziente_id = ? ORDER BY g.ordine, g.id`
    )
    .all(pazienteId)
}

export function creaSegno(pazienteId: number, nome: string, unita: string | null): number {
  return Number(
    getDb()
      .prepare('INSERT INTO segni (paziente_id, nome, unita, ordine) VALUES (?, ?, ?, ?)')
      .run(
        pazienteId,
        nome.trim(),
        unita?.trim() || null,
        prossimoOrdine('segni', { colonna: 'paziente_id', id: pazienteId })
      ).lastInsertRowid
  )
}

export function rinominaSegno(id: number, nome: string, unita: string | null): void {
  getDb().prepare('UPDATE segni SET nome = ?, unita = ? WHERE id = ?').run(nome.trim(), unita?.trim() || null, id)
}

// Eliminando il segno se ne vanno anche le misure: senza il segno non
// vogliono dire piu' niente.
export function eliminaSegno(id: number): void {
  getDb().prepare('DELETE FROM segni WHERE id = ?').run(id)
}

export const segniDellaSeduta = (sedutaId: number): unknown[] =>
  getDb().prepare('SELECT segno_id, valore FROM segno_valori WHERE seduta_id = ?').all(sedutaId)
