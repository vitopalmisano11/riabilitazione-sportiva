// Cosa aveva fatto il paziente l'ultima volta, esercizio per esercizio.
//
// Quando si compone una seduta la domanda e' sempre la stessa: la settimana
// scorsa quanto gli avevo messo? Il dato c'e' gia' nelle sedute salvate, ma
// senza questa lettura bisogna aprire la seduta precedente e leggerla riga per
// riga — e a memoria si sbaglia.
//
// Sta in un file suo, senza niente di Electron dentro, cosi' lo smoke test puo'
// eseguire davvero la query invece di limitarsi a compilarla.
import { getDb } from './db'
import type { UltimaVolta } from '../shared/types'

export function ultimaVoltaPerPaziente(
  pazienteId: number,
  escludi: number | null,
  // La data di riferimento si puo' passare per provare la funzione su date
  // fisse; normalmente e' oggi.
  oggi?: string
): UltimaVolta[] {
  return getDb()
    .prepare(
      `SELECT esercizio_id, data, serie, cluster, ripetizioni, carico,
              recupero_cluster, recupero
       FROM (
         SELECT se.esercizio_id, s.data, se.serie, se.cluster, se.ripetizioni,
                se.carico, se.recupero_cluster, se.recupero,
                ROW_NUMBER() OVER (
                  PARTITION BY se.esercizio_id ORDER BY s.data DESC, s.id DESC
                ) AS n
         FROM seduta_esercizi se
         JOIN sedute s ON s.id = se.seduta_id
         WHERE s.paziente_id = ?
           -- le sedute programmate nei giorni che verranno non le ha ancora
           -- fatte, e la seduta che si sta modificando non e' "l'ultima volta"
           AND s.data <= COALESCE(?, date('now', 'localtime'))
           AND (? IS NULL OR s.id <> ?)
       )
       WHERE n = 1`
    )
    .all(pazienteId, oggi ?? null, escludi, escludi) as UltimaVolta[]
}
