// Le sedute di una settimana, di tutti i pazienti insieme.
//
// Programmare la settimana si fa paziente per paziente, ma poi la domanda del
// lunedi' mattina e' un'altra: "oggi chi viene?". Senza questa lettura bisogna
// aprire dieci schede per ricostruire una cosa che il database sa gia'.
//
// Sta in un file suo, senza niente di Electron dentro, cosi' lo smoke test puo'
// eseguire davvero la query invece di limitarsi a compilarla.
import { getDb } from './db'

export interface SedutaSettimana {
  id: number
  data: string
  paziente_id: number
  paziente: string
  fase_nome: string | null
  // 1 se la seduta e' del percorso al campo: nella settimana si riconosce.
  fase_campo: 0 | 1
  num_esercizi: number
}

export function seduteDellaSettimana(dal: string, al: string): SedutaSettimana[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.data, s.paziente_id,
              p.cognome || ' ' || p.nome AS paziente,
              f.nome AS fase_nome, COALESCE(f.campo, 0) AS fase_campo,
              (SELECT COUNT(*) FROM seduta_esercizi se WHERE se.seduta_id = s.id) AS num_esercizi
       FROM sedute s
       JOIN pazienti p ON p.id = s.paziente_id
       LEFT JOIN fasi f ON f.id = s.fase_id
       WHERE s.data BETWEEN ? AND ?
       ORDER BY s.data, p.cognome, p.nome`
    )
    .all(dal, al) as SedutaSettimana[]
}
