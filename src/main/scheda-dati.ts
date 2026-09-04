// Lettura della scheda che si mostra al paziente.
//
// Sta in un file suo, senza niente di Electron dentro, cosi' lo smoke test puo'
// eseguire davvero queste query invece di limitarsi a compilarle: un nome di
// colonna sbagliato qui si vedrebbe solo al primo clic del fisioterapista.
import { getDb } from './db'

export interface EsercizioScheda {
  nome: string
  categoria_nome: string
  serie: string | null
  cluster: string | null
  ripetizioni: string | null
  carico: string | null
  recupero_cluster: string | null
  recupero: string | null
  nota: string | null
}

export interface SchedaPaziente {
  paziente: string
  data: string
  fase_nome: string | null
  note: string | null
  sezioni: { nome: string; esercizi: EsercizioScheda[] }[]
}

// Tutto quello che serve alla finestra, in una volta sola: cosi' quella finestra
// non ha bisogno di chiedere altro all'archivio.
export function datiScheda(sedutaId: number): SchedaPaziente {
  const db = getDb()
  const s = db
    .prepare(
      `SELECT s.data, f.nome AS fase_nome, s.note, p.nome, p.cognome
       FROM sedute s
       JOIN pazienti p ON p.id = s.paziente_id
       LEFT JOIN fasi f ON f.id = s.fase_id
       WHERE s.id = ?`
    )
    .get(sedutaId) as
    | { data: string; fase_nome: string | null; note: string | null; nome: string; cognome: string }
    | undefined
  if (!s) throw new Error('Seduta non trovata.')

  const sezioniRows = db
    .prepare('SELECT id, nome FROM seduta_sezioni WHERE seduta_id = ? ORDER BY ordine, id')
    .all(sedutaId) as { id: number; nome: string }[]

  const esercizi = db
    .prepare(
      `SELECT e.nome, c.nome AS categoria_nome,
              se.serie, se.cluster, se.ripetizioni, se.carico, se.recupero_cluster,
              se.recupero, se.nota, se.seduta_sezione_id
       FROM seduta_esercizi se
       JOIN esercizi e ON e.id = se.esercizio_id
       JOIN categorie c ON c.id = e.categoria_id
       WHERE se.seduta_id = ?
       ORDER BY se.ordine, se.id`
    )
    .all(sedutaId) as (EsercizioScheda & { seduta_sezione_id: number | null })[]

  const spoglia = ({
    seduta_sezione_id: _ignora,
    ...resto
  }: EsercizioScheda & { seduta_sezione_id: number | null }): EsercizioScheda => resto

  const sezioni = sezioniRows
    .map((sez) => ({
      nome: sez.nome,
      esercizi: esercizi.filter((e) => e.seduta_sezione_id === sez.id).map(spoglia)
    }))
    .filter((sez) => sez.esercizi.length > 0)
  // sedute vecchie: esercizi senza sezione
  const orfani = esercizi.filter((e) => e.seduta_sezione_id == null).map(spoglia)
  if (orfani.length > 0) sezioni.push({ nome: 'Esercizi', esercizi: orfani })

  return {
    paziente: `${s.nome} ${s.cognome}`,
    data: s.data,
    fase_nome: s.fase_nome,
    note: s.note,
    sezioni
  }
}
