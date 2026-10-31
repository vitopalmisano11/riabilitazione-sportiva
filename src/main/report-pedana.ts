// Il report dei soli test con la pedana: i test che si scelgono nella linguetta
// Pedana del paziente, uno solo o piu' di uno (dello stesso test, a confronto
// nel tempo). Ha lo stesso foglio del report di screening, ma senza screening:
// la testata del paziente e, dopo, i test.
import { getDb } from './db'
import { esc } from './html'
import { coloriTema } from '../shared/temi'
import { intestazioneHtml } from './export-doc'
import { archivioPedana } from './pedana'
import { frasiRiepilogoPedana, pedanaHtmlScreening } from './pedana-report'
import { Riassunto } from './report-screening-riassunto'
import { data, distanza } from './report-screening-comune'
import { stileReport, type DatiReport } from './report-screening'

export function generaReportPedana(pazienteId: number, pedanaIds: number[]): DatiReport {
  if (pedanaIds.length === 0) throw new Error('Nessun test da stampare.')
  const p = getDb()
    .prepare(
      `SELECT nome, cognome, data_nascita, diagnosi, tipo_intervento, data_intervento, arto_operato
       FROM pazienti WHERE id = ?`
    )
    .get(pazienteId) as Record<string, unknown> | undefined
  if (!p) throw new Error('Paziente non trovato.')

  // solo i test di questo paziente: un id di un altro non entra mai nel foglio
  const suoi = new Set(archivioPedana(pazienteId).test.map((t) => t.id))
  const ids = pedanaIds.filter((id) => suoi.has(id))
  if (ids.length === 0) throw new Error('Nessun test da stampare.')
  const date = archivioPedana(pazienteId)
    .test.filter((t) => ids.includes(t.id))
    .map((t) => t.data)
    .sort()
  const primo = date[0]
  const ultimo = date[date.length - 1]

  const riassunto = new Riassunto()
  for (const f of frasiRiepilogoPedana(pazienteId, ids)) riassunto.gruppo(f.titolo).esiti.push(f.frase)

  const lato = p.arto_operato as 'dx' | 'sx' | null
  const info: [string, unknown][] = [
    ['Infortunio / intervento', p.tipo_intervento || p.diagnosi],
    ['Data intervento', p.data_intervento ? data(p.data_intervento as string) : null],
    ['Tempo trascorso', distanza(p.data_intervento as string | null, ultimo)],
    ['Lato operato/infortunato', lato === 'dx' ? 'Destro' : lato === 'sx' ? 'Sinistro' : null]
  ]

  const { accento, accentoScuro, intestazione } = coloriTema()
  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
${stileReport(accento, accentoScuro, intestazione)}
</style>
</head>
<body>
<div class="comandi">
  <button onclick="window.print()">Scarica in PDF</button>
</div>
<div class="foglio">
  ${intestazioneHtml(accento)}
  <h1>${esc(p.cognome)} ${esc(p.nome)}</h1>
  <p class="sotto">Test con pedana${
    primo === ultimo ? ` del ${data(primo)}` : ` · dal ${data(primo)} al ${data(ultimo)}`
  }</p>
  <dl class="info">${info
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('')}</dl>

  ${pedanaHtmlScreening(pazienteId, ids)}

  ${riassunto.html()}

</div>
</body>
</html>`

  return { html, cognome: String(p.cognome), nome: String(p.nome), data: ultimo }
}
