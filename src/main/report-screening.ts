// Report di uno screening.
//
// Ricalca il referto che si usa nei laboratori di forza: per ogni misura una
// ciambella con i due lati e l'asimmetria, e accanto l'andamento nel tempo
// delle sedute precedenti dello stesso paziente. I disegni sono SVG scritti
// qui: non serve nessuna libreria e il PDF li stampa come sono.
//
// La linea rossa dei valori normativi compare solo dove una soglia c'e'
// davvero. Niente fascia di popolazione: non abbiamo un archivio di atleti a
// cui confrontarsi e un riferimento inventato sarebbe peggio di nessuno.
import { getDb } from './db'
import { esc } from './html'
import { coloriTema } from '../shared/temi'
import { intestazioneHtml } from './export-doc'
import {
  arrotonda,
  asimmetria,
  DECIMALI_MISURA,
  DECIMALI_PERCENTUALE,
  esito,
  lsi,
  superaSoglia,
  valoreDi,
  type RigaValore
} from '../shared/misure'
import { type MisuraTest } from '../shared/types'
import { calcolaPunteggio } from './screening-punteggio'
import { data, distanza, numero, variazione } from './report-screening-comune'
import { CAMBIAMENTO_DA_DIRE, Riassunto, cambioPercentuale, punteggioHtml } from './report-screening-riassunto'
import { type PuntoStorico, andamento, ciambella } from './report-screening-disegni'

// ---- lettura dei dati ----

// Il valore riassunto di una misura (valoreDi) sta in shared/misure.ts: lo
// usa anche il punteggio del cluster, che deve leggere lo stesso numero.

export interface DatiReport {
  html: string
  cognome: string
  nome: string
  data: string
}

// Riceve gli screening da mettere a confronto: il piu' recente e' quello che si
// legge nelle tabelle, gli altri diventano i punti dell'andamento. Sceglierli
// invece di prenderli tutti serve a fare un T0/T1 pulito senza le sedute in
// mezzo.
export function generaReportScreening(sessioneIds: number[]): DatiReport {
  if (sessioneIds.length === 0) throw new Error('Nessuno screening da stampare.')
  const db = getDb()
  const segnaposto = sessioneIds.map(() => '?').join(', ')
  const scelti = db
    .prepare(
      `SELECT id, data FROM screening_sessioni WHERE id IN (${segnaposto}) ORDER BY data, id`
    )
    .all(...sessioneIds) as { id: number; data: string }[]
  if (scelti.length === 0) throw new Error('Screening non trovato.')
  const sessioneId = scelti[scelti.length - 1].id

  const s = db
    .prepare(
      `SELECT s.*, p.nome, p.cognome, p.data_nascita, p.diagnosi, p.tipo_intervento,
              p.data_intervento, p.arto_operato
       FROM screening_sessioni s JOIN pazienti p ON p.id = s.paziente_id
       WHERE s.id = ?`
    )
    .get(sessioneId) as Record<string, unknown> | undefined
  if (!s) throw new Error('Screening non trovato.')

  const latoInteressato = (s.arto_operato as 'dx' | 'sx' | null) ?? null

  const valoriStmt = db.prepare(
    'SELECT misura_id, lato, prova, valore FROM screening_valori WHERE sessione_id = ?'
  )
  const valori = valoriStmt.all(sessioneId) as RigaValore[]

  // Gli screening scelti, in ordine di data: da qui nascono le linee
  // dell'andamento.
  const precedenti = scelti
  const valoriPer = new Map<number, RigaValore[]>()
  for (const p of precedenti) valoriPer.set(p.id, valoriStmt.all(p.id) as RigaValore[])

  const sezioni = s.protocollo_id
    ? (db
        .prepare(
          'SELECT id, nome FROM screening_sezioni WHERE protocollo_id = ? ORDER BY ordine, id'
        )
        .all(s.protocollo_id) as { id: number; nome: string }[])
    : []

  const vociStmt = db.prepare(
    `SELECT v.test_id, v.questionario_id, COALESCE(t.nome, q.nome) AS nome,
            t.prove, t.per_lato, t.lsi_cutoff, t.qualita
     FROM screening_voci v
     LEFT JOIN test_valutazione t ON t.id = v.test_id
     LEFT JOIN questionari q ON q.id = v.questionario_id
     WHERE v.sezione_id = ? ORDER BY v.ordine, v.id`
  )
  const misureStmt = db.prepare(
    `SELECT id, nome, unita, per_prova, riassunto, cutoff, cutoff_direzione,
            calcolo, calcolo_a, calcolo_b
     FROM test_misure WHERE test_id = ? ORDER BY ordine, id`
  )
  const questStmt = db.prepare(
    `SELECT pq.data, pq.fascia, pq.id
     FROM screening_questionari sq JOIN paziente_questionari pq ON pq.id = sq.compilazione_id
     WHERE sq.sessione_id = ? AND sq.questionario_id = ?`
  )
  const punteggiStmt = db.prepare(
    'SELECT nome, valore FROM compilazione_punteggi WHERE compilazione_id = ? ORDER BY ordine'
  )

  const riassunto = new Riassunto()

  const blocchi = sezioni
    .map((sez) => {
      const voci = vociStmt.all(sez.id) as Record<string, unknown>[]
      const corpo = voci
        .map((v) => {
          if (v.questionario_id != null) {
            const c = questStmt.get(sessioneId, v.questionario_id) as
              | { data: string; fascia: string | null; id: number }
              | undefined
            if (!c) {
              return `<div class="test"><h4>${esc(v.nome)}</h4>
                <p class="vuoto-test">Questionario non compilato in questo screening.</p></div>`
            }
            const punteggi = punteggiStmt.all(c.id) as { nome: string; valore: number }[]
            if (c.fascia) riassunto.gruppo(String(v.nome)).esiti.push(c.fascia)
            return `<div class="test"><h4>${esc(v.nome)}</h4>
              <p class="riga-questionario">
                ${esc(data(c.data))} · ${esc(
                  punteggi.map((p) => `${p.nome} ${p.valore}`).join(' · ')
                )}
                ${c.fascia ? `<span class="fascia">${esc(c.fascia)}</span>` : ''}
              </p></div>`
          }

          const misure = misureStmt.all(v.test_id) as MisuraTest[]
          const perLato = Number(v.per_lato) === 1
          const soglia = (v.lsi_cutoff as number | null) ?? null
          const prove = Number(v.prove ?? 1)

          const corpoMisure = misure
            .map((m) => {
              const dx = valoreDi(valori, m, misure, perLato ? 'dx' : null)
              const sx = perLato ? valoreDi(valori, m, misure, 'sx') : null
              if (dx == null && sx == null) return ''

              const storico: PuntoStorico[] = precedenti.map((p) => {
                const vv = valoriPer.get(p.id) ?? []
                return {
                  data: p.data,
                  dx: valoreDi(vv, m, misure, perLato ? 'dx' : null),
                  sx: perLato ? valoreDi(vv, m, misure, 'sx') : null
                }
              })

              // il primo degli screening scelti e' il termine di paragone
              const iniziale = storico.length > 1 ? storico[0] : null
              const menoEMeglio = m.cutoff_direzione === 'max'

              const valLsi = perLato ? lsi(dx, sx, latoInteressato, m.cutoff_direzione) : null
              const valAsim = perLato ? asimmetria(dx, sx) : null
              const superato = esito(valLsi, soglia)

              // Il riassunto: sotto la qualita' del test, o sotto al suo nome.
              const g = riassunto.gruppo(String(v.qualita ?? '').trim() || String(v.nome))
              const etichetta = `${v.nome} – ${m.nome}`
              const nomeLato = (l: 'dx' | 'sx'): string =>
                latoInteressato === l ? 'sul lato operato' : l === 'dx' ? 'a destra' : 'a sinistra'

              // La simmetria: il lato in difetto e' l'operato, se lo si sa;
              // altrimenti quello col valore peggiore.
              if (superato != null) g.giudicati++
              if (superato === false && dx != null && sx != null) {
                const debole: 'dx' | 'sx' =
                  latoInteressato ?? ((menoEMeglio ? dx > sx : dx < sx) ? 'dx' : 'sx')
                g.deficit.push(
                  `${nomeLato(debole)} in ${etichetta} (${latoInteressato ? 'LSI' : 'simmetria'} ${numero(valLsi, DECIMALI_PERCENTUALE)}%, soglia ${soglia}%)`
                )
              }

              // La soglia della misura, lato per lato.
              if (m.cutoff != null) {
                const lati: ['dx' | 'sx' | null, number | null][] = perLato
                  ? [['dx', dx], ['sx', sx]]
                  : [[null, dx]]
                for (const [l, val] of lati) {
                  if (val == null) continue
                  g.giudicati++
                  if (superaSoglia(val, m.cutoff, m.cutoff_direzione, DECIMALI_MISURA)) continue
                  g.deficit.push(
                    `${l ? `${nomeLato(l)} ` : ''}in ${etichetta} (${arrotonda(val, DECIMALI_MISURA)}${m.unita ? ` ${m.unita}` : ''}, soglia ${menoEMeglio ? 'al massimo' : 'almeno'} ${m.cutoff})`
                  )
                }
              }

              // Cosa e' cambiato dal primo screening del confronto. Con il lato
              // operato noto conta quello; altrimenti si guardano tutti e due.
              if (iniziale) {
                const lati: ['dx' | 'sx' | null, number | null, number | null][] = !perLato
                  ? [[null, dx, iniziale.dx]]
                  : latoInteressato
                    ? [[latoInteressato, latoInteressato === 'dx' ? dx : sx, iniziale[latoInteressato]]]
                    : [['dx', dx, iniziale.dx], ['sx', sx, iniziale.sx]]
                for (const [l, adesso, prima] of lati) {
                  const delta = cambioPercentuale(adesso, prima)
                  if (delta == null || Math.abs(delta) < CAMBIAMENTO_DA_DIRE) continue
                  const testo = `${etichetta}${l && !latoInteressato ? (l === 'dx' ? ' destra' : ' sinistra') : ''} ${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(0)}%`
                  const migliorato = menoEMeglio ? delta < 0 : delta > 0
                  ;(migliorato ? g.meglio : g.peggio).push(testo)
                }
              }

              // Le singole prove, come nel foglio di carta.
              const righeProve = perLato
                ? (['dx', 'sx'] as const).map((lato) => {
                    const celle = Array.from({ length: prove }, (_, i) => {
                      const r = valori.find(
                        (x) => x.misura_id === m.id && x.lato === lato && x.prova === i + 1
                      )
                      return `<td>${r ? numero(r.valore) : ''}</td>`
                    }).join('')
                    const sintesi = lato === 'dx' ? dx : sx
                    const prima = iniziale ? iniziale[lato] : null
                    return `<tr><th>${lato === 'dx' ? 'Destra' : 'Sinistra'}${
                      latoInteressato === lato ? ' <span class="interessato">(interessato)</span>' : ''
                    }</th>${celle}<td class="sintesi">${numero(sintesi)}${variazione(
                      sintesi,
                      prima,
                      menoEMeglio
                    )}</td></tr>`
                  }).join('')
                : // test bilaterale: nessun lato da nominare, quindi nessuna
                  // colonna vuota a sinistra
                  `<tr>${Array.from({ length: prove }, (_, i) => {
                    const r = valori.find(
                      (x) => x.misura_id === m.id && x.lato === null && x.prova === i + 1
                    )
                    return `<td>${r ? numero(r.valore) : ''}</td>`
                  }).join('')}<td class="sintesi">${numero(dx)}${variazione(
                    dx,
                    iniziale ? iniziale.dx : null,
                    menoEMeglio
                  )}</td></tr>`

              const intestazioni = Array.from(
                { length: prove },
                (_, i) => `<th>Prova&nbsp;${i + 1}</th>`
              ).join('')

              return `<div class="misura">
                <div class="misura-testa">
                  <span class="misura-nome">${esc(m.nome)}</span>
                  ${m.unita ? `<span class="unita">${esc(m.unita)}</span>` : ''}
                </div>
                <div class="misura-corpo${perLato ? '' : ' bilaterale'}">
                  <div class="colonna-numeri">
                    <table class="prove">
                      <thead><tr>${
                        perLato ? '<th></th>' : ''
                      }${intestazioni}<th>Valore</th></tr></thead>
                      <tbody>${righeProve}</tbody>
                    </table>
                    ${
                      perLato
                        ? `<div class="grafico-lati">
                            <div class="lato sinistra">
                              <span class="etichetta">Sinistra</span>
                              <span class="numero">${numero(sx)}</span>
                              ${variazione(sx, iniziale ? iniziale.sx : null, menoEMeglio)}
                            </div>
                            ${ciambella(dx, sx)}
                            <div class="lato destra">
                              <span class="etichetta">Destra</span>
                              <span class="numero">${numero(dx)}</span>
                              ${variazione(dx, iniziale ? iniziale.dx : null, menoEMeglio)}
                            </div>
                          </div>
                          <p class="asimmetria">${
                            valAsim != null ? `${numero(valAsim)}% asimmetria` : ''
                          }${
                            valLsi != null
                              ? ` · ${latoInteressato ? 'LSI' : 'simmetria'} ${numero(valLsi)}%`
                              : ''
                          }${
                            superato == null
                              ? ''
                              : superato
                                ? ` · <span class="ok">superato</span>`
                                : ` · <span class="ko">sotto la soglia di ${soglia}%</span>`
                          }</p>`
                        : ''
                    }
                  </div>
                  <div class="colonna-grafico">
                    ${
                      andamento(storico, m.riferimento ?? null, m.unita) ||
                      '<p class="vuoto-test">L’andamento compare dal secondo screening.</p>'
                    }
                    ${
                      storico.length > 1
                        ? `<p class="legenda">${
                             // in un test bilaterale c'e' una linea sola: dire
                             // "destra e sinistra" sarebbe falso
                             perLato
                               ? '<span class="pallino blu"></span>Destra' +
                                 '<span class="pallino rosso"></span>Sinistra'
                               : '<span class="pallino blu"></span>Valore'
                           }${
                             m.riferimento != null
                               ? '<span class="tratteggio"></span>riferimento'
                               : ''
                           }</p>`
                        : ''
                    }
                  </div>
                </div>
              </div>`
            })
            .filter(Boolean)
            .join('')

          if (corpoMisure === '') {
            return `<div class="test"><h4>${esc(v.nome)}</h4>
              <p class="vuoto-test">Nessun valore registrato.</p></div>`
          }
          return `<div class="test"><h4>${esc(v.nome)}</h4>${corpoMisure}</div>`
        })
        .join('')
      return corpo === '' ? '' : `<section><h3>${esc(sez.nome)}</h3>${corpo}</section>`
    })
    .filter(Boolean)
    .join('')

  const dalTrauma = distanza(s.data_intervento as string | null, s.data as string)
  const info: [string, unknown][] = [
    ['Sport', s.sport],
    ['Protocollo', s.protocollo_nome],
    ['Infortunio / intervento', s.tipo_intervento || s.diagnosi],
    ['Data intervento', s.data_intervento ? data(s.data_intervento as string) : null],
    ['Tempo trascorso', dalTrauma],
    [
      'Lato operato/infortunato',
      latoInteressato === 'dx' ? 'Destro' : latoInteressato === 'sx' ? 'Sinistro' : null
    ]
  ]

  const { accento, accentoScuro, intestazione } = coloriTema()
  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 12mm; }
  /* I margini interni stanno dentro la larghezza dichiarata: senza, il foglio
     e' piu' largo di 210mm e la barra dei comandi qui sopra non gli si allinea. */
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2733; font-size: 11px; margin: 0; }

  /* Solo a schermo: il foglio sta dentro la finestra come un foglio su una
     scrivania, staccato dai bordi. In stampa non vale niente di tutto questo,
     i margini li da' @page. */
  @media screen {
    body { background: #eef1f5; padding: 28px 0; }
    .foglio {
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
      padding: 26px 30px;
      border-radius: 6px;
      box-shadow: 0 6px 26px rgba(15, 23, 42, 0.16);
    }
  }
  h1 { font-size: 20px; margin: 0; }
  .sotto { color: #555b66; font-size: 11px; margin: 2px 0 10px; }
  dl.info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px 18px; margin: 0 0 14px; }
  dl.info div { display: flex; gap: 6px; }
  dl.info dt { color: #6b7280; margin: 0; }
  dl.info dt::after { content: ':'; }
  dl.info dd { margin: 0; font-weight: 600; }
  h3 { font-size: 13px; margin: 16px 0 6px; padding: 5px 8px; background: ${accento}; color: #fff;
       border-radius: 3px; }
  /* Il titolo del test non e' una casella colorata: e' una riga bianca con una
     sottolineatura. Dentro al report resta tutto bianco tranne le intestazioni
     delle colonne. */
  h4 { font-size: 12px; margin: 10px 0 6px; padding: 0 0 4px; color: ${accentoScuro};
       border-bottom: 1px solid #e0d7c6; }
  /* Ogni test dentro il suo riquadro: con quattro o cinque test di fila,
     tabelle e grafici si confonderebbero fra loro. */
  /* Lo spazio sopra al titolo e' lo stesso che c'e' sotto al riquadro: senza,
     il titolo era appiccicato al bordo di sopra e staccato da quello di sotto. */
  .test { page-break-inside: avoid; margin: 0 0 12px; border: 1px solid #e4e9f0;
          border-radius: 5px; padding: 9px 10px 10px; }
  .test h4 { margin: 0 0 8px; }
  .misura + .misura { border-top: 1px dashed #e4e9f0; padding-top: 8px; }
  .misura { display: block; margin: 6px 0 10px; }
  .misura-testa { display: flex; align-items: baseline; gap: 6px; margin-bottom: 3px; }
  .misura-nome { font-weight: 600; }
  .unita { color: #777e88; }
  .misura-corpo { display: flex; gap: 14px; align-items: flex-start; page-break-inside: avoid; }
  .colonna-numeri { flex: 1 1 46%; min-width: 0; }
  .colonna-grafico { flex: 1 1 54%; min-width: 0; }
  /* Senza la ciambella la colonna dei numeri e' solo una tabellina: lasciarle
     meta' foglio vorrebbe dire mezza pagina vuota. */
  .misura-corpo.bilaterale .colonna-numeri { flex: 0 1 auto; }
  .misura-corpo.bilaterale .colonna-grafico { flex: 1 1 auto; }
  table.prove { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.prove th, table.prove td { border: 1px solid #ccd2da; padding: 3px 6px;
                                   text-align: center; white-space: nowrap; }
  table.prove thead th { background: ${intestazione}; font-size: 10px; }
  table.prove tbody th { text-align: left; font-weight: 400; color: #555b66; white-space: nowrap; }
  /* La variazione sta di fianco al numero, tra parentesi: "5,0 (+67%)". */
  td.sintesi .variazione { margin-left: 4px; }
  table.prove td.sintesi { font-weight: 700; }
  /* Solo un'annotazione su quale dei due lati e' quello interessato: il rosso
     lo faceva sembrare un allarme. */
  .interessato { color: inherit; }
  .grafico-lati { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .ciambella { width: 96px; height: 96px; }
  .ciambella .vuoto { font-size: 11px; fill: #8b93a0; text-anchor: middle; }
  .lato { text-align: center; min-width: 62px; white-space: nowrap; }
  .lato .etichetta { display: block; font-size: 10px; color: #6b7280; }
  .lato .numero { font-size: 15px; font-weight: 700; }
  .lato.sinistra .numero { color: #d64545; }
  .lato.destra .numero { color: #2563eb; }
  .asimmetria { text-align: center; margin: 4px 0 0; font-size: 11px; color: #555b66; }
  .asimmetria .ok { color: #1f9d61; font-weight: 700; }
  .asimmetria .ko { color: #d64545; font-weight: 700; }
  .andamento { width: 100%; height: auto; }
  .andamento .etichetta-x { font-size: 9px; fill: #8b93a0; text-anchor: middle; }
  .andamento .etichetta-y { font-size: 9px; fill: #8b93a0; text-anchor: end; }
  .andamento .etichetta-unita { font-size: 9px; fill: #8b93a0; text-anchor: end; }
  .andamento .etichetta-soglia { font-size: 8px; fill: #d64545; text-anchor: end; }
  .legenda { margin: 0; font-size: 9px; color: #6b7280; text-align: center; }
  .pallino { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin: 0 3px 0 8px; }
  .pallino.blu { background: #2563eb; }
  .pallino.rosso { background: #d64545; }
  .tratteggio { display: inline-block; width: 12px; border-top: 1.4px dashed #d64545; margin: 0 3px 0 8px;
                vertical-align: middle; }
  .riga-questionario { margin: 2px 0 0; }
  .fascia { margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: ${intestazione}; color: ${accentoScuro}; }
  .vuoto-test { color: #8b93a0; margin: 2px 0; }
  .punteggio { border: 1px solid #dfe4ea; border-radius: 4px; padding: 8px 10px; margin: 14px 0 0;
               page-break-inside: avoid; }
  .punteggio h2 { font-size: 13px; margin: 0 0 6px; color: ${accentoScuro}; }
  .tabella-punteggio td.voce, .tabella-punteggio th:first-child { text-align: left; }
  .storico-punteggio { margin: 6px 0 0; color: #555b66; }
  .riassunto { border: 1px solid #dfe4ea; background: #f7f9fb; border-radius: 4px;
               padding: 8px 10px; margin: 14px 0 12px; page-break-inside: avoid; }
  .riassunto h2 { font-size: 12px; margin: 0 0 4px; color: ${accentoScuro}; }
  .riassunto ul { margin: 0; padding-left: 16px; }
  .riassunto li { margin: 2px 0; line-height: 1.4; }
  .riassunto .ok { color: #1f9d61; font-weight: 700; }
  .riassunto .ko { color: #d64545; font-weight: 700; }
  .note { margin-top: 14px; }
  .pie { margin-top: 14px; color: #8b93a0; font-size: 9px; }
  .variazione { display: inline-block; margin-left: 6px; font-size: 10px; font-weight: 700; }
  td.sintesi { line-height: 1.25; }
  .variazione.su { color: #1f9d61; }
  .variazione.giu { color: #d64545; }
  .variazione.pari { color: #8b93a0; }
  .lato .variazione { margin-left: 3px; }

  /* La barra dei comandi vive solo a schermo: in stampa non deve esserci. */
  .comandi { display: none; }
  @media screen {
    .comandi {
      display: flex;
      justify-content: flex-end;
      max-width: 210mm;
      margin: 0 auto 10px;
    }
    .comandi button {
      font: inherit;
      font-size: 13px;
      padding: 9px 16px;
      border: 1px solid ${accento};
      border-radius: 8px;
      background: ${accento};
      color: #fff;
      cursor: pointer;
    }
    .comandi button:hover { background: ${accentoScuro}; }
  }
</style>
</head>
<body>
<div class="comandi">
  <button onclick="window.print()">Scarica in PDF</button>
</div>
<div class="foglio">
  ${intestazioneHtml(accento)}
  <h1>${esc(s.cognome)} ${esc(s.nome)}</h1>
  <p class="sotto">Screening del ${data(s.data as string)}${
    scelti.length > 1
      ? ` · confronto con ${data(scelti[0].data)}`
      : ''
  }</p>
  <dl class="info">${info
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('')}</dl>

  ${blocchi || '<p class="vuoto-test">Nessun valore registrato in questo screening.</p>'}

  ${punteggioHtml(
    calcolaPunteggio(sessioneId),
    scelti.slice(0, -1).map((x) => ({ data: x.data, risultato: calcolaPunteggio(x.id) }))
  )}

  ${
    // Il riassunto in fondo, dopo i test: prima si leggono i numeri, poi
    // quello che se ne ricava.
    riassunto.html()
  }

  ${
    s.note
      ? `<div class="note"><h4>Note</h4><p>${esc(s.note).replace(/\n/g, '<br>')}</p></div>`
      : ''
  }
  <p class="pie">Contiene dati sanitari: trattare con riservatezza.</p>
</div>
</body>
</html>`

  return {
    html,
    cognome: String(s.cognome),
    nome: String(s.nome),
    data: String(s.data)
  }
}
