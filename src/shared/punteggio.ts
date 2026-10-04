// Le frasi che accompagnano il punteggio del cluster, uguali a schermo e nel
// report: dicono perche' il totale non e' quello definitivo.
import type { RisultatoPunteggio, VoceRisultato } from './types'

// La casella dei punti di una voce.
export function puntiTesto(v: VoceRisultato, numero: (n: number) => string): string {
  if (v.fuoriFascia) return 'fuori dalle soglie'
  return v.punti == null ? '—' : `${numero(v.punti)} / ${numero(v.massimo)}`
}

// Cosa manca perche' il punteggio sia completo, o null se e' tutto a posto.
export function avvisoPunteggio(r: RisultatoPunteggio): string | null {
  const fuori = r.voci.filter((v) => v.fuoriFascia).map((v) => v.nome)
  const mancano = r.voci.some((v) => v.valore == null)
  const frasi: string[] = []
  if (fuori.length > 0) {
    frasi.push(
      `${fuori.length === 1 ? 'Il valore di' : 'I valori di'} ${fuori.join(', ')} non ${
        fuori.length === 1 ? 'rientra' : 'rientrano'
      } in nessuna soglia: controlla le soglie del protocollo in Configurazione.`
    )
  }
  if (mancano) frasi.push('Mancano i valori di qualche voce.')
  if (frasi.length > 0) return `${frasi.join(' ')} Il totale è parziale e la fascia non si calcola.`
  if (r.fasciaMancante) {
    return 'Il totale non rientra in nessuna fascia: controlla le fasce del protocollo in Configurazione.'
  }
  return null
}
