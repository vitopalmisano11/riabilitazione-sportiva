// Le piccole funzioni che formattano date, distanze e numeri nel report dello
// screening Return To Play (report-screening.ts).
import { arrotonda } from '../shared/misure'

export function data(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// Quanto tempo e' passato, detto come lo direbbe una persona.
export function distanza(da: string | null, a: string): string | null {
  if (!da) return null
  const inizio = new Date(da)
  const fine = new Date(a)
  if (Number.isNaN(inizio.getTime()) || Number.isNaN(fine.getTime())) return null
  const giorni = Math.round((fine.getTime() - inizio.getTime()) / 86400000)
  if (giorni < 0) return null
  if (giorni < 45) return giorni === 1 ? '1 giorno' : `${giorni} giorni`
  const mesi = Math.round(giorni / 30.44)
  if (mesi < 24) return `${mesi} mesi`
  const anni = Math.floor(mesi / 12)
  const resto = mesi % 12
  return resto === 0 ? `${anni} anni` : `${anni} anni e ${resto} mesi`
}

// Arrotondato come si giudica (vedi arrotonda in shared/misure): il numero
// stampato e' lo stesso confrontato con la soglia.
export function numero(v: number | null, decimali = 1): string {
  return v == null ? '—' : arrotonda(v, decimali).toFixed(decimali)
}

// Quanto e' cambiato rispetto al primo screening del confronto, in percentuale.
// E' il "+92%" del referto: dice in un colpo d'occhio se si sta recuperando.
//
// Il verde non e' "e' salito", e' "e' migliorato": in un tempo cronometrato
// scendere e' un progresso. Il verso lo dice la direzione del cutoff della
// misura ('max' = "al massimo", quindi meno e' meglio). Dove il cutoff non c'e'
// si assume che piu' alto sia meglio, che e' il caso di forze e distanze.
export function variazione(
  adesso: number | null,
  prima: number | null,
  menoEMeglio: boolean
): string {
  if (adesso == null || prima == null || prima === 0) return ''
  const delta = ((adesso - prima) / Math.abs(prima)) * 100
  if (!Number.isFinite(delta)) return ''
  const segno = delta >= 0 ? '+' : '−'
  const migliorato = menoEMeglio ? delta < 0 : delta > 0
  const classe = delta === 0 ? 'pari' : migliorato ? 'su' : 'giu'
  return `<span class="variazione ${classe}">(${segno}${Math.abs(delta).toFixed(0)}%)</span>`
}
