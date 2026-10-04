// Cartella completa del paziente.
//
// Legge dal database tutto quello che riguarda il paziente e lo riduce a
// "blocchi": titoli, paragrafi, coppie etichetta/valore, tabelle, elenchi e le
// figure della body chart. Da questi nasce l'HTML, e dall'HTML il PDF. Tenerli
// separati dal formato serve a mostrare in anteprima esattamente il documento
// che poi si salva.
//
// Il corpo intero, nella body chart, e' la stessa foto che si vede nell'app
// (una per vista): qui si incolla nell'SVG come immagine, incorporata nel
// file cosi' il PDF resta un unico documento. Il piede resta disegnato in
// vettoriale (src/shared/figure-piede.ts): nessuna foto e' stata fornita per
// quello, e nel documento appare come lo hai segnato.
//
// Il lavoro e' diviso per argomento: cartella-comune.ts (forma dei blocchi),
// cartella-sezioni.ts (cosa legge ogni sezione), cartella-grafici.ts (i
// disegni). Qui restano l'ordine delle sezioni e la resa in HTML.
import { getDb } from './db'
import { esc } from './html'
import { coloriTema } from '../shared/temi'
import { intestazioneHtml } from './export-doc'
import { type SezioneCartella, type TipoRelazione } from '../shared/types'
import { relazioneAnamnesi } from './relazione-anamnesi'
import { relazioneValutazione } from './relazione-valutazione'
import {
  type Blocco,
  type Cartella,
  type SezioneComposta,
  coppie,
  data,
  testo
} from './cartella-comune'
import {
  sezAnagrafica,
  sezAnamnesi,
  sezBodyChart,
  sezObiettivi,
  sezQuestionari,
  sezRemota,
  sezSedute,
  sezValutazioni
} from './cartella-sezioni'

export const SEZIONI: { chiave: SezioneCartella; titolo: string }[] = [
  { chiave: 'anagrafica', titolo: 'Dati del paziente' },
  { chiave: 'anamnesi', titolo: 'Anamnesi prossima' },
  // La body chart sta fra le due anamnesi: e' il disegno di quello che il
  // paziente ha appena raccontato, e leggerlo dopo l'anamnesi remota vorrebbe
  // dire tornare indietro.
  { chiave: 'bodychart', titolo: 'Body chart' },
  { chiave: 'remota', titolo: 'Anamnesi remota' },
  { chiave: 'valutazioni', titolo: 'Valutazione obiettiva' },
  { chiave: 'questionari', titolo: 'Questionari' },
  { chiave: 'obiettivi', titolo: 'Obiettivi terapeutici' },
  { chiave: 'sedute', titolo: 'Diario delle sedute' }
]

// ---- composizione ----

export function componiCartella(pazienteId: number, sezioni: SezioneCartella[]): Cartella {
  const p = getDb()
    .prepare(
      `SELECT pz.*, pat.nome AS patologia_nome, f.nome AS fase_nome
       FROM pazienti pz
       LEFT JOIN patologie pat ON pat.id = pz.patologia_id
       LEFT JOIN fasi f ON f.id = pz.fase_corrente_id
       WHERE pz.id = ?`
    )
    .get(pazienteId) as Record<string, unknown> | undefined
  if (!p) throw new Error('Paziente non trovato.')

  const contenuto: Record<SezioneCartella, () => Blocco[]> = {
    anagrafica: () => sezAnagrafica(p),
    anamnesi: () => sezAnamnesi(pazienteId),
    remota: () => sezRemota(pazienteId),
    bodychart: () => sezBodyChart(pazienteId),
    valutazioni: () => sezValutazioni(pazienteId),
    questionari: () => sezQuestionari(pazienteId),
    obiettivi: () => sezObiettivi(pazienteId),
    sedute: () => sezSedute(pazienteId)
  }

  return {
    nome: String(p.nome),
    cognome: String(p.cognome),
    // una sezione senza niente dentro non si stampa, anche se e' stata spuntata
    sezioni: SEZIONI.filter((s) => sezioni.includes(s.chiave))
      .map((s) => ({ titolo: s.titolo, blocchi: contenuto[s.chiave]() }))
      .filter((s) => s.blocchi.length > 0)
  }
}

export function oggiIso(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ---- resa in HTML (da cui nasce il PDF) ----

// Le voci una accanto all'altra: si raggruppano quelle consecutive, cosi' la
// griglia le affianca a due a due e il resto (tabelle, riquadri, grafici) resta
// a tutta larghezza dov'era.
function blocchiHtml(blocchi: Blocco[]): string {
  let out = ''
  let gruppo: string[] = []
  const chiudi = (): void => {
    if (gruppo.length === 0) return
    out += `<div class="griglia-voci">${gruppo.join('')}</div>`
    gruppo = []
  }
  for (const b of blocchi) {
    if (b.tipo === 'testo') gruppo.push(bloccoHtml(b))
    else {
      chiudi()
      out += bloccoHtml(b)
    }
  }
  chiudi()
  return out
}

function bloccoHtml(b: Blocco): string {
  switch (b.tipo) {
    case 'sottotitolo':
      return `<h3>${esc(b.testo)}</h3>`
    case 'testo': {
      // Una risposta di due parole non deve prendersi una riga intera del
      // foglio: le corte stanno affiancate, le lunghe si allargano.
      const lunga = b.corpo.length > 90 || b.corpo.includes('\n')
      return `<div class="voce${lunga ? ' voce-larga' : ''}">${
        b.titolo ? `<h3>${esc(b.titolo)}</h3>` : ''
      }<p class="testo">${esc(b.corpo).replace(/\n/g, '<br>')}</p></div>`
    }
    case 'coppie':
      return `<dl class="dati">${b.voci
        .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
        .join('')}</dl>`
    case 'elenco': {
      // Oltre la soglia, le voci si affiancano su tre colonne invece di
      // scendere in un'unica lista lunga: un gruppo di 30 sta in una sola
      // schermata di riquadro, non su una pagina intera.
      if (!b.perColonna || b.voci.length <= b.perColonna) {
        return `<ul class="voci">${b.voci.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`
      }
      const colonne: string[][] = []
      for (let i = 0; i < b.voci.length; i += b.perColonna) {
        colonne.push(b.voci.slice(i, i + b.perColonna))
      }
      return `<div class="voci-colonne">${colonne
        .map((c) => `<ul class="voci">${c.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`)
        .join('')}</div>`
    }
    case 'paragrafi':
      return `<div class="paragrafi">${b.voci
        .map(
          (v) =>
            `${v.testo ? `<p>${esc(v.testo)}</p>` : ''}${
              v.elenchi && v.elenchi.length > 0
                ? `<div class="elenchi-relazione">${v.elenchi
                    .map(
                      (e) =>
                        `<div><div class="titolo-elenco">${esc(e.titolo)}</div><ul>${e.voci
                          .map((x) => `<li>${esc(x)}</li>`)
                          .join('')}</ul></div>`
                    )
                    .join('')}</div>`
                : ''
            }`
        )
        .join('')}</div>`
    case 'tabella':
      return `<table><thead><tr>${b.intestazioni
        .map((h) => `<th>${esc(h)}</th>`)
        .join('')}</tr></thead><tbody>${b.righe
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    case 'riquadro':
      return `<div class="riquadro"${
        b.colore ? ` style="border-left-color:${b.colore}"` : ''
      }><h3>${esc(b.titolo)}</h3>${blocchiHtml(b.blocchi)}</div>`
    case 'grafici':
      // Grafici e legenda in un contenitore solo: separati, la stampa
      // potrebbe lasciare la legenda sulla pagina dopo.
      return `<div class="grafici"><div class="disegni">${b.grafici
        .map(
          (g) =>
            `<figure><figcaption>${esc(g.titolo)}</figcaption>${g.svg}</figure>`
        )
        .join('')}</div><div class="legenda">${b.legenda
        .map(
          (v) =>
            `<span><i style="background:${v.colore}"></i>${esc(v.testo)}</span>`
        )
        .join('')}</div></div>`
    case 'figure':
      return `<div class="corpi">${b.viste
        .map(
          (v) =>
            `<figure class="corpo">${v.svg}<figcaption>${esc(v.didascalia)}</figcaption></figure>`
        )
        .join('')}</div>`
  }
}

export function generaCartella(pazienteId: number, sezioni: SezioneCartella[]): string {
  return documento(componiCartella(pazienteId, sezioni), 'Cartella fisioterapica')
}

// La relazione scritta dell'anamnesi: un documento suo, con la stessa veste
// della cartella — intestazione, nome del paziente, data — e dentro solo il
// testo. Le frasi le compone relazione-anamnesi.ts.
export function componiRelazione(pazienteId: number): Cartella {
  const p = getDb().prepare('SELECT nome, cognome FROM pazienti WHERE id = ?').get(pazienteId) as
    | { nome: string; cognome: string }
    | undefined
  if (!p) throw new Error('Paziente non trovato.')
  const { prossima, remota } = relazioneAnamnesi(pazienteId)
  const sezioni: SezioneComposta[] = []
  if (prossima.length > 0) {
    sezioni.push({ titolo: 'Anamnesi prossima', blocchi: [{ tipo: 'paragrafi', voci: prossima }] })
  }
  if (remota.length > 0) {
    sezioni.push({ titolo: 'Anamnesi remota', blocchi: [{ tipo: 'paragrafi', voci: remota }] })
  }
  return { nome: String(p.nome), cognome: String(p.cognome), sezioni }
}

// La relazione della valutazione obiettiva: una sezione per valutazione, dalla
// piu' recente.
export function componiRelazioneValutazione(pazienteId: number): Cartella {
  const p = getDb().prepare('SELECT nome, cognome FROM pazienti WHERE id = ?').get(pazienteId) as
    | { nome: string; cognome: string }
    | undefined
  if (!p) throw new Error('Paziente non trovato.')
  const sezioni: SezioneComposta[] = relazioneValutazione(pazienteId)
    .filter((v) => v.paragrafi.length > 0)
    .map((v) => ({
      titolo: v.titolo,
      blocchi: [{ tipo: 'paragrafi', voci: v.paragrafi.map((testo) => ({ testo })) }]
    }))
  return { nome: String(p.nome), cognome: String(p.cognome), sezioni }
}

export function generaRelazione(pazienteId: number, tipo: TipoRelazione = 'anamnesi'): string {
  return tipo === 'valutazione'
    ? documento(componiRelazioneValutazione(pazienteId), 'Relazione della valutazione obiettiva')
    : documento(componiRelazione(pazienteId), 'Relazione dell’anamnesi')
}

function documento(c: Cartella, cheCosa: string): string {
  const corpo = c.sezioni
    .map(
      (s) => `<section><h2>${esc(s.titolo)}</h2>${blocchiHtml(s.blocchi)}</section>`
    )
    .join('')

  const { accento, intestazione } = coloriTema()

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2733; font-size: 12px; margin: 0; }

  /* Solo a schermo: il documento sta dentro la finestra come un foglio su una
     scrivania, staccato dai bordi. In stampa non vale, i margini li da' @page. */
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
  h1 { font-size: 21px; margin: 0 0 2px; }
  .info { color: #555b66; margin: 0 0 4px; font-size: 11px; }
  h2 { font-size: 15px; border-bottom: 2px solid ${accento}; padding-bottom: 4px; margin: 20px 0 8px; }
  h3 { font-size: 13px; margin: 12px 0 4px; color: ${accento}; }
  /* Ogni sezione dentro il suo riquadro: con anamnesi, valutazione e sedute una
     dopo l'altra, senza una cornice si confondono fra loro. Il titolo fa da
     testata del riquadro. */
  section { page-break-inside: auto; border: 1px solid #dfe4ea; border-radius: 5px;
            padding: 0 12px 10px; margin-bottom: 12px; }
  section > h2 { margin: 0 -12px 10px; padding: 6px 12px; border-bottom: 2px solid ${accento};
                 background: ${intestazione}; border-radius: 5px 5px 0 0; }
  .testo { margin: 0 0 6px; }
  /* Le risposte corte a due a due: prima ognuna prendeva una riga intera e
     mezzo foglio restava bianco. Una risposta lunga si allarga su tutte e due
     le colonne, perche' spezzata in mezza pagina si leggerebbe peggio. */
  .griglia-voci { display: grid; grid-template-columns: 1fr 1fr; gap: 0 22px;
                  align-items: start; margin-bottom: 4px; }
  .griglia-voci .voce { page-break-inside: avoid; }
  .griglia-voci .voce-larga { grid-column: 1 / -1; }
  .paragrafi p { margin: 4px 0 8px; line-height: 1.55; }
  .elenchi-relazione { display: flex; flex-wrap: wrap; gap: 6px 36px; margin: -2px 0 10px 2px; }
  .elenchi-relazione .titolo-elenco { font-weight: 600; color: #555b66; }
  .elenchi-relazione ul { margin: 2px 0 0; padding-left: 18px; }
  .elenchi-relazione li { line-height: 1.45; }
  .griglia-voci .voce > h3 { margin-top: 8px; }
  dl.dati { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin: 0 0 8px; }
  dl.dati div { display: flex; gap: 6px; }
  dl.dati dt { color: #6b7280; margin: 0; }
  dl.dati dt::after { content: ':'; }
  dl.dati dd { margin: 0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 8px; }
  th, td { border: 1px solid #ccd2da; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: ${intestazione}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
  tr { page-break-inside: avoid; }
  /* Un sintomo per riquadro, col filo di colore della sua linea nei grafici. */
  .riquadro { border: 1px solid #e4e8ed; border-left: 3px solid #8b93a0; border-radius: 4px;
              background: #f7f7f6; padding: 2px 10px 6px; margin: 0 0 8px;
              page-break-inside: avoid; }
  .riquadro > h3 { margin: 8px 0 5px; color: #1f2733; }
  .riquadro dl.dati { margin-bottom: 4px; }
  /* I due grafici affiancati, la legenda sotto: e' la disposizione della
     raccolta anamnestica, cosi' chi ha compilato ritrova quello che ha visto. */
  /* I due grafici riempiono la riga, meta' per uno: dicono l'andamento in un
     colpo d'occhio, i valori esatti stanno nei riquadri sopra. */
  .grafici { page-break-inside: avoid; margin: 0 0 10px; }
  .grafici .disegni { display: flex; gap: 12px; }
  .grafici figure { margin: 0; flex: 1; min-width: 0; }
  .grafici figcaption { font-size: 11px; font-weight: 600; color: ${accento}; margin-bottom: 2px; }
  .grafici svg { width: 100%; height: auto; }
  .grafici .asse { font-size: 13px; fill: #8b93a0; text-anchor: end; }
  .grafici .asse-x { font-size: 13px; fill: #8b93a0; text-anchor: middle; }
  .grafici .asse-x.inizio { text-anchor: start; }
  .grafici .asse-x.fine { text-anchor: end; }
  .legenda { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 4px;
             font-size: 10px; color: #555b66; }
  .legenda span { display: flex; align-items: center; gap: 5px; }
  .legenda i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  ul.voci { margin: 0 0 8px; padding-left: 18px; }
  ul.voci li { margin-bottom: 3px; }
  /* Il diario delle sedute oltre le dieci voci: tre colonne invece di una
     lista lunghissima. */
  .voci-colonne { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 20px; align-items: start; }
  .voci-colonne ul.voci { margin: 0; }
  @media (max-width: 720px) { .voci-colonne { grid-template-columns: 1fr; } }
  .corpi { display: flex; gap: 6px; page-break-inside: avoid; }
  .corpi figure { margin: 0; flex: 1; text-align: center; }
  .corpi svg { width: 100%; height: auto; max-height: 190mm; }
  .corpi figcaption { font-size: 10px; color: #6b7280; }
  .pie { margin-top: 16px; color: #8b93a0; font-size: 10px; }
</style>
</head>
<body>
<div class="foglio">
  ${intestazioneHtml(accento)}
  <h1>${esc(c.cognome)} ${esc(c.nome)}</h1>
  <p class="info">${esc(cheCosa)} · stampata il ${data(oggiIso())}</p>
  ${corpo || '<p class="testo">Nessun contenuto da stampare.</p>'}
  <p class="pie">Contiene dati sanitari: trattare con riservatezza.</p>
</div>
</body>
</html>`
}
