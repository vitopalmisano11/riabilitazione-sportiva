// Il riassunto scritto del report dello screening e il riquadro del punteggio
// del cluster (report-screening.ts).
import { esc } from './html'
import { type RisultatoPunteggio } from '../shared/types'
import { avvisoPunteggio, puntiTesto } from '../shared/punteggio'
import { data } from './report-screening-comune'

// ---- il riassunto scritto ----
//
// In fondo al report, dopo i test: per ogni qualita' valutata
// (forza, reattivita'...) una riga che dice se c'e' un deficit, se e' tutto
// nella norma e cosa e' cambiato dal primo screening del confronto.
//
// Sono frasi fisse scelte dalle regole che il fisioterapista ha gia' scritto in
// libreria (la soglia sulla simmetria, la soglia della misura): il programma non
// inventa giudizi, rilegge i suoi. Un test senza "cosa valuta" si raggruppa
// sotto al suo nome.

// Da quanto in su un cambiamento vale la pena di dirlo: sotto il 10% e' spesso
// la variabilita' fra una prova e l'altra.
export const CAMBIAMENTO_DA_DIRE = 10

interface GruppoRiassunto {
  titolo: string
  deficit: string[]
  giudicati: number
  meglio: string[]
  peggio: string[]
  esiti: string[]
}

export class Riassunto {
  private gruppi = new Map<string, GruppoRiassunto>()

  gruppo(titolo: string): GruppoRiassunto {
    const chiave = titolo.trim().toLowerCase()
    let g = this.gruppi.get(chiave)
    if (!g) {
      g = { titolo: titolo.trim(), deficit: [], giudicati: 0, meglio: [], peggio: [], esiti: [] }
      this.gruppi.set(chiave, g)
    }
    return g
  }

  html(): string {
    const righe = [...this.gruppi.values()]
      .map((g) => {
        // Ogni pezzo e' una frase: dopo il primo, che segue i due punti del
        // titolo, comincia con la maiuscola.
        const parti: string[] = []
        const frase = (classe: string, parola: string, resto: string): void => {
          const p = parti.length === 0 ? parola : parola.charAt(0).toUpperCase() + parola.slice(1)
          parti.push(`<span class="${classe}">${p}</span>${resto}`)
        }
        if (g.deficit.length > 0) {
          frase('ko', 'deficit', ` ${g.deficit.map(esc).join('; ')}`)
        } else if (g.giudicati > 0) {
          frase('ok', 'nella norma', ', test superati')
        }
        if (g.meglio.length > 0) {
          frase('ok', 'in miglioramento', `: ${g.meglio.map(esc).join('; ')}`)
        }
        if (g.peggio.length > 0) {
          frase('ko', 'in peggioramento', `: ${g.peggio.map(esc).join('; ')}`)
        }
        parti.push(...g.esiti.map(esc))
        if (parti.length === 0) return ''
        const titolo = g.titolo.charAt(0).toUpperCase() + g.titolo.slice(1)
        return `<li><b>${esc(titolo)}</b>: ${parti.join('. ')}.</li>`
      })
      .filter(Boolean)
    return righe.length === 0
      ? ''
      : `<div class="riassunto"><h2>Riassunto</h2><ul>${righe.join('')}</ul></div>`
  }
}

// Di quanto e' cambiato un valore rispetto al primo screening, in percentuale:
// null se non c'e' niente da confrontare.
export function cambioPercentuale(adesso: number | null, prima: number | null): number | null {
  if (adesso == null || prima == null || prima === 0) return null
  const delta = ((adesso - prima) / Math.abs(prima)) * 100
  return Number.isFinite(delta) ? delta : null
}

// ---- il punteggio del cluster ----
//
// Solo per i protocolli che ne hanno uno: gli altri non stampano niente. Le
// voci con i loro punti, il totale, la fascia, e — se si confrontano piu'
// screening — i totali delle volte prima.
export function punteggioHtml(
  risultato: RisultatoPunteggio | null,
  prima: { data: string; risultato: RisultatoPunteggio | null }[]
): string {
  if (!risultato) return ''
  // il valore e' gia' arrotondato come lo si giudica: si stampa tutto
  const n = (v: number | null): string => (v == null ? '—' : String(v).replace('.', ','))
  const avviso = avvisoPunteggio(risultato)
  const righe = risultato.voci
    .map(
      (v) =>
        `<tr><td class="voce">${esc(v.nome)}</td><td>${n(v.valore)}${
          v.valore != null && v.unita ? ` ${esc(v.unita)}` : ''
        }</td><td>${esc(puntiTesto(v, n))}</td></tr>`
    )
    .join('')
  const storico = prima.flatMap((p) =>
    p.risultato
      ? [
          `${data(p.data)}: ${n(p.risultato.totale)} / ${n(p.risultato.massimo)}${
            p.risultato.fascia ? ` (${esc(p.risultato.fascia)})` : ''
          }`
        ]
      : []
  )
  return `<div class="punteggio">
    <h2>Punteggio: ${n(risultato.totale)} / ${n(risultato.massimo)}${
      risultato.fascia ? `<span class="fascia">${esc(risultato.fascia)}</span>` : ''
    }</h2>
    <table class="prove tabella-punteggio"><thead><tr><th>Voce</th><th>Valore</th><th>Punti</th></tr></thead>
    <tbody>${righe}</tbody></table>
    ${avviso ? `<p class="vuoto-test">${esc(avviso)}</p>` : ''}
    ${storico.length > 0 ? `<p class="storico-punteggio">Screening precedenti — ${storico.join(' · ')}</p>` : ''}
  </div>`
}
