// La body chart: dove sente dolore il paziente, segnato sulla figura (corpo o
// piede). Senza niente di Electron (modello: sedute.ts).
import { getDb } from './db'
import { dataIt, eliminaConCestino } from './cestino'
import { validaData } from './validazione'
import type { BodyChartCompleta, TipoChart } from '../shared/types'

export function elencoBodyChart(pazienteId: number): unknown[] {
  return getDb()
    .prepare(
      `SELECT b.id, b.data, b.note, b.tipo,
              (SELECT COUNT(*) FROM body_chart_segni s WHERE s.chart_id = b.id) AS num_segni
       FROM body_chart b
       WHERE b.paziente_id = ?
       ORDER BY b.data DESC, b.id DESC`
    )
    .all(pazienteId)
}

export function leggiBodyChart(id: number): BodyChartCompleta {
  const db = getDb()
  const chart = db.prepare('SELECT * FROM body_chart WHERE id = ?').get(id)
  if (!chart) throw new Error('Body chart non trovata.')
  const segni = db
    .prepare(
      `SELECT id, vista, tipo, x, y, dimensione, intensita
       FROM body_chart_segni WHERE chart_id = ? ORDER BY ordine, id`
    )
    .all(id)
  return { chart, segni } as unknown as BodyChartCompleta
}

export function creaBodyChart(pazienteId: number, data: string, tipo: TipoChart): number {
  validaData(data, 'La data della body chart', { obbligatoria: true })
  return Number(
    getDb()
      .prepare('INSERT INTO body_chart (paziente_id, data, tipo) VALUES (?, ?, ?)')
      .run(pazienteId, data, tipo === 'piede' ? 'piede' : 'corpo').lastInsertRowid
  )
}

// I segni si riscrivono tutti insieme, nell'ordine in cui sono stati messi.
export function salvaBodyChart(dati: BodyChartCompleta): void {
  validaData(dati.chart.data, 'La data della body chart', { obbligatoria: true })
  const db = getDb()
  db.transaction(() => {
    db.prepare('UPDATE body_chart SET data = ?, note = ? WHERE id = ?').run(
      dati.chart.data,
      dati.chart.note,
      dati.chart.id
    )
    db.prepare('DELETE FROM body_chart_segni WHERE chart_id = ?').run(dati.chart.id)
    const ins = db.prepare(
      `INSERT INTO body_chart_segni (chart_id, vista, tipo, x, y, dimensione, intensita, ordine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    dati.segni.forEach((s, i) =>
      ins.run(dati.chart.id, s.vista, s.tipo, s.x, s.y, s.dimensione, s.intensita, i)
    )
  })()
}

export function eliminaBodyChart(id: number): void {
  const b = getDb().prepare('SELECT data FROM body_chart WHERE id = ?').get(id) as
    | { data: string }
    | undefined
  eliminaConCestino('body_chart', id, 'Body chart', `Body chart del ${dataIt(b?.data)}`)
}
