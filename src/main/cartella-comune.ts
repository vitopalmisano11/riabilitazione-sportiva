// La forma dei contenuti della cartella del paziente (i "blocchi") e le piccole
// funzioni che servono a costruirli. Le usano le sezioni, i grafici e la resa in
// HTML di export-cartella.ts.
import { etaInAnni } from '../shared/eta'
import { type ParagrafoRelazione } from './relazione-anamnesi'

// ---- forma dei contenuti ----

export type Blocco =
  | { tipo: 'sottotitolo'; testo: string }
  | { tipo: 'testo'; titolo?: string; corpo: string }
  | { tipo: 'coppie'; voci: [string, string][] }
  // colonna: quante voci al massimo per colonna, prima di affiancarne una
  // nuova (il diario delle sedute, con tante sedute, altrimenti farebbe una
  // cartella lunghissima da scorrere)
  | { tipo: 'elenco'; voci: string[]; perColonna?: number }
  // testo di seguito, un paragrafo dopo l'altro, con gli elenchi puntati che
  // lo seguono: le relazioni scritte
  | { tipo: 'paragrafi'; voci: ParagrafoRelazione[] }
  | { tipo: 'tabella'; intestazioni: string[]; righe: string[][] }
  | { tipo: 'figure'; viste: { didascalia: string; svg: string }[] }
  | { tipo: 'riquadro'; titolo: string; colore?: string; blocchi: Blocco[] }
  | {
      tipo: 'grafici'
      grafici: { titolo: string; svg: string }[]
      legenda: { colore: string; testo: string }[]
    }

export interface SezioneComposta {
  titolo: string
  blocchi: Blocco[]
}

export interface Cartella {
  nome: string
  cognome: string
  sezioni: SezioneComposta[]
}

// ---- utilità ----

export function data(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

export function eta(nascita: string | null): string {
  const anni = etaInAnni(nascita)
  return anni == null ? '' : ` (${anni} anni)`
}

export function pieno(v: unknown): boolean {
  return v != null && String(v).trim() !== ''
}

// Coppie etichetta/valore, saltando quelle vuote. Niente coppie piene, niente
// blocco: le domande non fatte non si stampano.
export function coppie(voci: [string, unknown][]): Blocco[] {
  const piene = voci.filter(([, v]) => pieno(v)).map(([k, v]) => [k, String(v)] as [string, string])
  return piene.length === 0 ? [] : [{ tipo: 'coppie', voci: piene }]
}

export function testo(titolo: string, corpo: unknown): Blocco[] {
  return pieno(corpo) ? [{ tipo: 'testo', titolo, corpo: String(corpo) }] : []
}
