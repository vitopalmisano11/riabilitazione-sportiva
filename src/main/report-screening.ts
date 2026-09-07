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
import { coloriTema } from '../shared/temi'
import { intestazioneHtml } from './export-doc'
import { asimmetria, combina, esito, lsi, riassumi } from '../shared/misure'
import type { MisuraTest, RiassuntoMisura } from '../shared/types'

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function data(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// Quanto tempo e' passato, detto come lo direbbe una persona.
function distanza(da: string | null, a: string): string | null {
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

function numero(v: number | null, decimali = 1): string {
  return v == null ? '—' : v.toFixed(decimali)
}

// Quanto e' cambiato rispetto al primo screening del confronto, in percentuale.
// E' il "+92%" del referto: dice in un colpo d'occhio se si sta recuperando.
//
// Il verde non e' "e' salito", e' "e' migliorato": in un tempo cronometrato
// scendere e' un progresso. Il verso lo dice la direzione del cutoff della
// misura ('max' = "al massimo", quindi meno e' meglio). Dove il cutoff non c'e'
// si assume che piu' alto sia meglio, che e' il caso di forze e distanze.
function variazione(
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
  return `<span class="variazione ${classe}">${segno}${Math.abs(delta).toFixed(0)}%</span>`
}

// ---- disegni ----

const ROSSO = '#d64545'
const BLU = '#2563eb'
const GRIGIO = '#8b93a0'

// La ciambella dei due lati: l'ampiezza di ogni spicchio e' proporzionale al
// valore, quindi il disegno mostra subito da che parte pende.
function ciambella(dx: number | null, sx: number | null): string {
  const R = 52
  const spessore = 22
  const totale = (dx ?? 0) + (sx ?? 0)
  if (totale <= 0) {
    return `<svg viewBox="0 0 140 140" class="ciambella">
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="#e4e9f0" stroke-width="${spessore}"/>
      <text x="70" y="75" class="vuoto">nessun valore</text></svg>`
  }
  const quota = (sx ?? 0) / totale
  const circonferenza = 2 * Math.PI * R
  // Il primo arco parte in alto e gira in senso orario.
  return `<svg viewBox="0 0 140 140" class="ciambella">
    <g transform="rotate(-90 70 70)">
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="${BLU}" stroke-width="${spessore}"/>
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="${ROSSO}" stroke-width="${spessore}"
        stroke-dasharray="${(circonferenza * quota).toFixed(2)} ${circonferenza.toFixed(2)}"/>
    </g>
  </svg>`
}

interface PuntoStorico {
  data: string
  dx: number | null
  sx: number | null
}

// L'andamento nel tempo: una linea per lato, i punti sulle date delle sedute.
// Con una sola seduta non c'e' niente da confrontare e il grafico non si stampa.
function andamento(punti: PuntoStorico[], soglia: number | null, unita: string | null): string {
  if (punti.length < 2) return ''
  const L = 420
  const A = 170
  const bordo = { su: 18, giu: 30, sx: 44, dx: 16 }

  const valori = punti.flatMap((p) => [p.dx, p.sx]).filter((v): v is number => v != null)
  if (valori.length === 0) return ''
  const candidati = soglia != null ? [...valori, soglia] : valori
  let min = Math.min(...candidati)
  let max = Math.max(...candidati)
  if (min === max) {
    min -= 1
    max += 1
  }
  // un po' d'aria sopra e sotto, altrimenti i punti toccano il bordo
  const respiro = (max - min) * 0.12
  min -= respiro
  max += respiro

  const x = (i: number): number =>
    bordo.sx + (i * (L - bordo.sx - bordo.dx)) / Math.max(1, punti.length - 1)
  const y = (v: number): number =>
    A - bordo.giu - ((v - min) / (max - min)) * (A - bordo.su - bordo.giu)

  const linea = (lato: 'dx' | 'sx', colore: string): string => {
    const presi = punti
      .map((p, i) => ({ i, v: p[lato] }))
      .filter((p): p is { i: number; v: number } => p.v != null)
    if (presi.length === 0) return ''
    const d = presi.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')
    const pallini = presi
      .map((p) => `<circle cx="${x(p.i)}" cy="${y(p.v)}" r="3.5" fill="${colore}"/>`)
      .join('')
    return `<path d="${d}" fill="none" stroke="${colore}" stroke-width="2"/>${pallini}`
  }

  const rigaSoglia =
    soglia == null
      ? ''
      : `<line x1="${bordo.sx}" y1="${y(soglia)}" x2="${L - bordo.dx}" y2="${y(soglia)}"
           stroke="${ROSSO}" stroke-width="1.4" stroke-dasharray="6 4"/>
         <text x="${L - bordo.dx}" y="${y(soglia) - 4}" class="etichetta-soglia">riferimento</text>`

  const etichette = punti
    .map(
      (p, i) =>
        `<text x="${x(i)}" y="${A - 10}" class="etichetta-x">${esc(data(p.data).slice(0, 5))}</text>`
    )
    .join('')

  return `<svg viewBox="0 0 ${L} ${A}" class="andamento">
    <line x1="${bordo.sx}" y1="${bordo.su}" x2="${bordo.sx}" y2="${A - bordo.giu}" stroke="#dfe4ea"/>
    <line x1="${bordo.sx}" y1="${A - bordo.giu}" x2="${L - bordo.dx}" y2="${A - bordo.giu}" stroke="#dfe4ea"/>
    <text x="${bordo.sx - 6}" y="${y(max - respiro) + 4}" class="etichetta-y">${numero(max - respiro)}</text>
    <text x="${bordo.sx - 6}" y="${y(min + respiro) + 4}" class="etichetta-y">${numero(min + respiro)}</text>
    ${rigaSoglia}
    ${linea('dx', BLU)}
    ${linea('sx', ROSSO)}
    ${etichette}
    <text x="${L - bordo.dx}" y="${bordo.su - 4}" class="etichetta-unita">${esc(unita ?? '')}</text>
  </svg>`
}

// ---- lettura dei dati ----

interface RigaValore {
  misura_id: number
  lato: 'dx' | 'sx' | null
  prova: number | null
  valore: number
}

// Il valore riassunto di una misura in una sessione, per lato.
function valoreDi(
  valori: RigaValore[],
  misura: MisuraTest,
  tutte: MisuraTest[],
  lato: 'dx' | 'sx' | null
): number | null {
  if (misura.calcolo != null && misura.calcolo_a != null && misura.calcolo_b != null) {
    const a = tutte.find((m) => m.id === misura.calcolo_a)
    const b = tutte.find((m) => m.id === misura.calcolo_b)
    return combina(
      a ? valoreDi(valori, a, tutte, lato) : null,
      b ? valoreDi(valori, b, tutte, lato) : null,
      misura.calcolo
    )
  }
  const prove = valori
    .filter((v) => v.misura_id === misura.id && v.lato === lato)
    .map((v) => v.valore)
  return riassumi(prove, misura.riassunto as RiassuntoMisura)
}

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
            t.prove, t.per_lato, t.lsi_cutoff
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

  const daGuardare: string[] = []

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
            if (c.fascia) daGuardare.push(`${v.nome}: ${c.fascia}`)
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

              const valLsi = perLato ? lsi(dx, sx, latoInteressato) : null
              const valAsim = perLato ? asimmetria(dx, sx) : null
              const superato = esito(valLsi, soglia)
              if (superato === false) {
                daGuardare.push(
                  `${v.nome} — ${m.nome}: ${numero(valLsi)}% (soglia ${soglia}%)`
                )
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
                               : '<span class="pallino blu"></span>valore'
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
  .test { page-break-inside: avoid; margin: 0 0 12px; border: 1px solid #e4e9f0;
          border-radius: 5px; padding: 0 10px 10px; }
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
  /* La variazione va sotto al numero: di fianco allargava la colonna e i
     valori non erano piu' incolonnati. */
  td.sintesi .variazione { display: block; margin: 1px 0 0; }
  table.prove td.sintesi { font-weight: 700; }
  /* Solo un'annotazione su quale dei due lati e' quello interessato: il rosso
     lo faceva sembrare un allarme. */
  .interessato { color: inherit; }
  .grafico-lati { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .ciambella { width: 96px; height: 96px; }
  .ciambella .vuoto { font-size: 11px; fill: #8b93a0; text-anchor: middle; }
  .lato { text-align: center; min-width: 62px; }
  .lato .etichetta { display: block; font-size: 10px; color: #6b7280; }
  .lato .numero { display: block; font-size: 15px; font-weight: 700; }
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
  .attenzione { border: 1px solid #f0c6c6; background: #fdf3f3; border-radius: 4px;
                padding: 8px 10px; margin: 0 0 12px; }
  .attenzione h2 { font-size: 12px; margin: 0 0 4px; color: #d64545; }
  .attenzione ul { margin: 0; padding-left: 16px; }
  .note { margin-top: 14px; }
  .pie { margin-top: 14px; color: #8b93a0; font-size: 9px; }
  .variazione { display: inline-block; margin-left: 6px; font-size: 10px; font-weight: 700; }
  td.sintesi { line-height: 1.25; }
  .variazione.su { color: #1f9d61; }
  .variazione.giu { color: #d64545; }
  .variazione.pari { color: #8b93a0; }
  .lato .variazione { display: block; margin: 1px 0 0; }

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
      ? ` · confronto con ${data(scelti[0].data)}, variazioni riferite a quella data`
      : ''
  }</p>
  <dl class="info">${info
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('')}</dl>

  ${
    daGuardare.length > 0
      ? `<div class="attenzione"><h2>Da guardare</h2><ul>${daGuardare
          .map((r) => `<li>${esc(r)}</li>`)
          .join('')}</ul></div>`
      : ''
  }

  ${blocchi || '<p class="vuoto-test">Nessun valore registrato in questo screening.</p>'}

  ${
    s.note
      ? `<div class="note"><h4>Note</h4><p>${esc(s.note).replace(/\n/g, '<br>')}</p></div>`
      : ''
  }
  <p class="pie">Riabilitazione Sportiva · contiene dati sanitari: trattare con riservatezza.</p>
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
