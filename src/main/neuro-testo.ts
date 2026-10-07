// L'esame neurologico di un distretto messo in parole, per la relazione scritta
// e per la cartella: stesse frasi nei due posti.
//
// Si scrive solo quello che e' alterato: la radice con sensibilita' ridotta o
// aumentata, il muscolo sotto 5/5, il riflesso ipo o iper. Una forza 5/5 e un
// riflesso normale sono stati valutati ma non si scrivono; quello non segnato
// non e' stato valutato e non compare. Se non c'e' niente di alterato e niente
// nella nota, il distretto non ha una riga neurologica.
import { getDb } from './db'

interface Riga {
  nome: string
  tipo: string
  lato: string
  valore: string
}

function elenco(voci: string[]): string {
  if (voci.length <= 1) return voci.join('')
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`
}

// "a destra", "a sinistra" o "bilateralmente" quando i due lati dicono lo stesso.
function dove(lati: { lato: string; valore: string }[]): string {
  const dx = lati.find((l) => l.lato === 'dx')
  const sx = lati.find((l) => l.lato === 'sx')
  return dx && sx ? 'bilateralmente' : dx ? 'a destra' : 'a sinistra'
}

// Le righe di una voce, una per lato, raggruppate per valore uguale:
// "4/5 a destra e 3/5 a sinistra".
function perVoce(righe: Riga[], formato: (valore: string) => string): Map<string, string> {
  const risultato = new Map<string, string>()
  for (const nome of new Set(righe.map((r) => r.nome))) {
    const sue = righe.filter((r) => r.nome === nome)
    const perValore = new Map<string, Riga[]>()
    for (const r of sue) perValore.set(r.valore, [...(perValore.get(r.valore) ?? []), r])
    risultato.set(
      nome,
      elenco([...perValore.entries()].map(([valore, rr]) => `${formato(valore)} ${dove(rr)}`))
    )
  }
  return risultato
}

export interface NeuroTestuale {
  // frasi complete di cio' che e' alterato, senza maiuscola ne' punto finale
  alterati: string[]
  nota: string | null
}

export function neuroTestuale(valutazioneId: number, distrettoId: number): NeuroTestuale {
  const db = getDb()
  const righe = db
    .prepare(
      `SELECT v.nome, v.tipo, n.lato, n.valore
       FROM distretto_neuro v
       JOIN valutazione_neuro n ON n.voce_id = v.id AND n.valutazione_id = ?
       WHERE v.distretto_id = ? ORDER BY v.ordine, v.id, n.lato`
    )
    .all(valutazioneId, distrettoId) as Riga[]
  const nota =
    (
      db
        .prepare(
          'SELECT nota_neuro FROM valutazione_distretti WHERE valutazione_id = ? AND distretto_id = ?'
        )
        .get(valutazioneId, distrettoId) as { nota_neuro: string | null } | undefined
    )?.nota_neuro?.trim() || null

  const alterati: string[] = []

  for (const valore of ['ridotta', 'aumentata']) {
    const voci = perVoce(
      righe.filter((r) => r.tipo === 'radice' && r.valore === valore),
      () => ''
    )
    if (voci.size > 0)
      alterati.push(
        `sensibilità ${valore} in ${elenco([...voci.entries()].map(([nome, d]) => `${nome} ${d.trim()}`))}`
      )
  }

  const forza = perVoce(
    righe.filter((r) => r.tipo === 'muscolo' && r.valore !== '5'),
    (v) => `${v}/5`
  )
  if (forza.size > 0)
    alterati.push(
      `forza ridotta: ${[...forza.entries()].map(([nome, d]) => `${nome.toLowerCase()} ${d}`).join('; ')}`
    )

  const riflessi = perVoce(
    righe.filter((r) => r.tipo === 'riflesso' && r.valore !== 'normale'),
    (v) => v
  )
  if (riflessi.size > 0)
    alterati.push(
      `riflessi alterati: ${[...riflessi.entries()].map(([nome, d]) => `${nome.toLowerCase()} ${d}`).join('; ')}`
    )

  return { alterati, nota }
}
