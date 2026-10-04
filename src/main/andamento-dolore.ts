// Il dolore nel tempo, per la linguetta "Quadro" della scheda paziente.
//
// La domanda del fisioterapista e' "sta migliorando?", e oggi per rispondere
// deve ricostruirla a mente da due posti diversi: le sedute svolte e
// l'anamnesi iniziale. Qui le due fonti si uniscono in un'unica serie, gia'
// ordinata, senza chiedere nessun dato nuovo al paziente.
//
// Sta in un file suo, senza niente di Electron dentro, cosi' le prove automatiche
// possono eseguire davvero la query invece di limitarsi a compilarla.
import { getDb } from './db'
import type { PuntoAndamentoDolore } from '../shared/types'

export function andamentoDolorePerPaziente(pazienteId: number): PuntoAndamentoDolore[] {
  const db = getDb()

  const sedute = db
    .prepare(
      `SELECT data, dolore FROM sedute
       WHERE paziente_id = ? AND dolore IS NOT NULL
         -- le sedute future non sono ancora "andamento": non sono state fatte
         AND data <= date('now', 'localtime')
       ORDER BY data`
    )
    .all(pazienteId) as { data: string; dolore: number }[]

  // Solo il primo sintomo registrato: e' quello del motivo della visita, non
  // gli altri eventualmente aggiunti dopo per completezza dell'anamnesi.
  const primoSintomo = db
    .prepare('SELECT id FROM anamnesi_sintomi WHERE paziente_id = ? ORDER BY ordine, id LIMIT 1')
    .get(pazienteId) as { id: number } | undefined

  const puntiAnamnesi = primoSintomo
    ? (db
        .prepare(
          `SELECT data, dolore FROM sintomo_punti
           WHERE sintomo_id = ? AND grafico = 'esordio' AND data IS NOT NULL
           ORDER BY data`
        )
        .all(primoSintomo.id) as { data: string; dolore: number }[])
    : []

  const punti: PuntoAndamentoDolore[] = [
    ...puntiAnamnesi.map((p) => ({ ...p, origine: 'anamnesi' as const })),
    ...sedute.map((s) => ({ ...s, origine: 'seduta' as const }))
  ]

  // A parita' di data l'anamnesi precede la seduta: racconta com'era prima
  // che il percorso cominciasse.
  return punti.sort(
    (a, b) => a.data.localeCompare(b.data) || (a.origine === b.origine ? 0 : a.origine === 'anamnesi' ? -1 : 1)
  )
}
