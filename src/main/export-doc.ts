// Generazione documenti (HTML per il PDF, docx per Word) da dati già letti.
// Nessuna dipendenza da Electron: testabile con Node (vedi scripts/smoke.ts).
import { coloriTema } from '../shared/temi'
import { righeProfilo } from './profilo'
import {
  caricoTesto,
  intensitaTesto,
  rirTesto,
  recuperoEsteso,
  recuperoTesto,
  ripetizioniTesto,
  volumeTesto
} from '../shared/dosaggio'
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx'

export interface DatiPazienteExport {
  nome: string
  cognome: string
  tipo_intervento: string | null
  data_intervento: string | null
  patologia_nome: string | null
  // Cosa deve fare a casa: ogni quanto, e le indicazioni scelte per lui.
  // Finiscono in fondo al foglio, dopo il programma.
  frequenza_casa?: string | null
  indicazioni?: string[]
}

export interface DatiSedutaExport {
  data: string
  fase_nome: string | null
  note: string | null
  obiettivi: string[]
  sezioni: {
    nome: string | null // null = esercizi senza sezione (sedute v1)
    esercizi: {
      nome: string
      categoria_nome: string
      unita_carico: string | null
      serie: string | null
      cluster: string | null
      ripetizioni: string | null
      rir: string | null
      carico: string | null
      recupero_cluster: string | null
      recupero: string | null
      nota: string | null
      // Solo per la scheda illustrata: la spiegazione dell'esercizio, il video
      // e la foto (data URL). Nella scheda normale restano a null, cosi' le
      // immagini non vengono nemmeno lette dal database.
      nota_tecnica?: string | null
      link?: string | null
      immagine?: string | null
    }[]
  }[]
}

function formatData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function infoPaziente(p: DatiPazienteExport): string[] {
  const parti: string[] = []
  if (p.patologia_nome) parti.push(`Patologia: ${p.patologia_nome}`)
  if (p.tipo_intervento) parti.push(`Intervento: ${p.tipo_intervento}`)
  if (p.data_intervento) parti.push(`Data intervento: ${formatData(p.data_intervento)}`)
  return parti
}

// La scheda illustrata e' pensata per il paziente che deve allenarsi da solo:
// una foto per esercizio, la spiegazione e il link al video. Le foto stanno
// tutte in riquadri della stessa misura (ritagliate al centro), altrimenti una
// verticale e una orizzontale sfalserebbero tutta la pagina.
// L'intestazione di chi firma, uguale in tutti i documenti: chi sei sopra,
// come ti si trova sotto, e una riga sottile che la stacca dal contenuto. Se
// il profilo e' vuoto non esce niente e il foglio resta come prima.
export function intestazioneHtml(colore: string): string {
  const { chi, dove } = righeProfilo()
  if (chi === '' && dove === '') return ''
  return `<div class="carta-intestata">
    ${chi ? `<div class="ci-chi">${esc(chi)}</div>` : ''}
    ${dove ? `<div class="ci-dove">${esc(dove)}</div>` : ''}
  </div>
  <style>
    .carta-intestata { border-bottom: 1px solid ${colore}; padding-bottom: 5px;
                       margin-bottom: 10px; }
    .carta-intestata .ci-chi { font-size: 12.5px; font-weight: 600; color: ${colore}; }
    .carta-intestata .ci-dove { font-size: 10px; color: #6b7280; margin-top: 1px; }
  </style>`
}

// Le indicazioni per casa, in fondo al foglio: ogni quanto farlo e come
// regolarsi. Sono la parte che decide se il programma verra' fatto bene, e
// finora sul foglio non c'era.
function indicazioniHtml(p: DatiPazienteExport): string {
  const voci = p.indicazioni ?? []
  const quando = (p.frequenza_casa ?? '').trim()
  if (voci.length === 0 && quando === '') return ''
  return `<div class="per-casa">
    <div class="pc-titolo">Da fare a casa</div>
    ${quando ? `<div class="pc-quando">${esc(quando)}</div>` : ''}
    ${voci.length ? `<ul>${voci.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>` : ''}
  </div>`
}

export function generaHtml(
  p: DatiPazienteExport,
  sedute: DatiSedutaExport[],
  illustrata = false
): string {
  // I dettagli in riga servono ancora alla scheda illustrata, dove ogni
  // esercizio ha la sua foto e il suo riquadro.
  const dettagli = (e: DatiSedutaExport['sezioni'][number]['esercizi'][number]): string =>
    [volumeTesto(e), caricoTesto(e.carico, e.unita_carico), rirTesto(e), recuperoEsteso(e)]
      .filter(Boolean)
      .map((x) => esc(String(x)))
      .join(' · ')

  // La stessa tabella della finestra che si mostra al paziente: quattro colonne
  // sempre nello stesso posto — cosa fare, quanto, con che carico, quanto
  // riposare. Quello che si legge a schermo e quello che si stampa sono la
  // stessa cosa, e i numeri incolonnati si ritrovano a colpo d'occhio.
  const tabella = (esercizi: DatiSedutaExport['sezioni'][number]['esercizi']): string =>
    `<table class="tabella-scheda">
      <thead><tr>
        <th>Esercizio</th><th>Serie &times; rip.</th><th>Carico</th><th>Recupero</th>
      </tr></thead>
      <tbody>
      ${esercizi
        .map(
          (e) => `<tr>
            <td class="col-esercizio"><span class="nome">${esc(e.nome)}</span>${
              e.nota ? `<span class="nota-es">${esc(e.nota)}</span>` : ''
            }</td>
            <td class="col-dose">${esc(volumeTesto(e) ?? '—')}</td>
            <td class="col-dose">${esc(intensitaTesto(e) ?? '—')}</td>
            <td class="col-dose">${esc(recuperoTesto(e) ?? '—')}</td>
          </tr>`
        )
        .join('')}
      </tbody>
    </table>`

  // Un esercizio per riga: foto a sinistra, testo a destra, numerati come in un
  // programma da portare a casa. Il paziente inesperto legge una cosa per volta,
  // e la foto e la spiegazione stanno vicine.
  let numero = 0
  // I tre numeri come nella tabella: etichetta piccola sopra, valore sotto.
  // Cosi' anche con la foto accanto si leggono nello stesso modo del resto.
  const numeri = (e: DatiSedutaExport['sezioni'][number]['esercizi'][number]): string => {
    const voci: [string, string | null][] = [
      ['Serie × rip.', volumeTesto(e)],
      ['Carico', caricoTesto(e.carico, e.unita_carico)],
      ['RIR', rirTesto(e) === null ? null : String(e.rir).trim()],
      ['Recupero', recuperoTesto(e)]
    ]
    const presenti = voci.filter(([, v]) => v)
    if (presenti.length === 0) return ''
    return `<div class="numeri">${presenti
      .map(
        ([et, v]) =>
          `<div class="numero"><span class="et">${esc(et)}</span><span class="val">${esc(
            String(v)
          )}</span></div>`
      )
      .join('')}</div>`
  }

  const schede = (esercizi: DatiSedutaExport['sezioni'][number]['esercizi']): string => {
    // Il riquadro della foto si tiene anche dove la foto manca, cosi' le righe
    // restano allineate. Ma se in tutta la sezione non ce n'e' nessuna, sarebbe
    // solo una colonna di rettangoli grigi: allora si toglie.
    const conFoto = esercizi.some((e) => e.immagine)
    return `<div class="schede">
      ${esercizi
        .map((e) => {
          numero += 1
          return `<div class="scheda-es">
            ${
              conFoto
                ? `<div class="foto">${
                    e.immagine ? `<img src="${esc(e.immagine)}" alt="">` : ''
                  }</div>`
                : ''
            }
            <div class="testo">
              <span class="num">${numero}</span>
              <div class="corpo">
                <div class="nome">${esc(e.nome)}</div>
                ${numeri(e)}
                ${
                  e.nota_tecnica
                    ? `<div class="come">${esc(e.nota_tecnica).replace(/\n/g, '<br>')}</div>`
                    : ''
                }
                ${e.nota ? `<div class="nota-es">${esc(e.nota)}</div>` : ''}
                ${e.link ? `<a class="video" href="${esc(e.link)}">Guarda il video</a>` : ''}
              </div>
            </div>
          </div>`
        })
        .join('')}
    </div>`
  }

  const sedHtml = sedute
    .map((s, i) => {
      // La numerazione riparte da 1 a ogni seduta: chi la legge ha in mano un
      // programma per volta.
      numero = 0
      return `
    <section class="seduta${i > 0 ? ' nuova-pagina' : ''}">
      <h2>Seduta del ${formatData(s.data)}${s.fase_nome ? ` <span class="fase">· ${esc(s.fase_nome)}</span>` : ''}</h2>
      ${
        s.obiettivi.length
          ? `<p class="obiettivi"><strong>Obiettivi:</strong> ${s.obiettivi.map(esc).join(', ')}</p>`
          : ''
      }
      ${s.sezioni
        .map(
          (sez) => `
      ${sez.nome ? `<h3><span class="fascetta">${esc(sez.nome)}</span></h3>` : ''}
      ${illustrata ? schede(sez.esercizi) : tabella(sez.esercizi)}`
        )
        .join('')}
      ${s.note ? `<p class="note"><strong>Note della seduta:</strong> ${esc(s.note)}</p>` : ''}
    </section>`
    })
    .join('')

  const { accento, intestazione } = coloriTema()

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2733; font-size: 12px; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .info { color: #555b66; margin: 0 0 6px; font-size: 11px; }
  h2 { font-size: 15px; border-bottom: 2px solid ${accento}; padding-bottom: 4px; margin: 18px 0 8px; }
  h2 .fase { color: ${accento}; font-weight: 600; }
  h3 { font-size: 13px; margin: 16px 0 7px; color: ${accento}; }
  /* La fascetta della sezione, come nella finestra che si mostra al paziente:
     tenue, non un blocco di colore. Sulla carta il beige pieno pesava. */
  h3 .fascetta { display: inline-block;
                 background: color-mix(in srgb, ${intestazione} 55%, #fff);
                 color: ${accento}; border-radius: 999px; padding: 3px 11px;
                 font-size: 10.5px; font-weight: 600;
                 text-transform: uppercase; letter-spacing: 0.05em; }
  .nuova-pagina { page-break-before: always; }
  .obiettivi { margin: 0 0 8px; }
  .gruppo-esercizi { margin: 0 0 8px; page-break-inside: avoid; }
  .gruppo-esercizi .cat { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
                          color: ${accento}; margin-bottom: 2px; }
  /* La tabella della seduta: la stessa che il paziente vede a schermo. Niente
     griglia di bordi, solo una riga sottile fra un esercizio e l'altro. */
  table.tabella-scheda { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  /* La riga dei titoli non ha sfondo: colorata come la fascetta della sezione
     le due cose si confondevano. Restano il maiuscolo e il colore chiaro. */
  table.tabella-scheda th { background: none; border: none;
                            border-bottom: 1.5px solid #ccd2da; padding: 0 8px 4px;
                            font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
                            color: #6b7280; text-align: center; white-space: nowrap; }
  table.tabella-scheda th:first-child { text-align: left; }
  table.tabella-scheda td { border: none; border-bottom: 1px solid #e6eaef; padding: 6px 8px;
                            vertical-align: top; }
  table.tabella-scheda tr { page-break-inside: avoid; }
  table.tabella-scheda .col-esercizio { width: auto; }
  table.tabella-scheda .nome { display: block; font-weight: 600; font-size: 12.5px; }
  table.tabella-scheda .nota-es { display: block; margin-top: 2px; color: #555b66;
                                  font-size: 11px; font-style: italic; }
  table.tabella-scheda .col-dose { width: 1%; white-space: nowrap; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccd2da; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: ${intestazione}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  tr { page-break-inside: avoid; }
  .cat { color: #777e88; font-size: 10px; }
  .note { margin: 10px 0 0; background: #f5f6f8; padding: 8px 10px; border-radius: 4px; }
  /* Scheda illustrata: un esercizio per riga, foto a sinistra. Il riquadro e'
     sempre della stessa misura, cosi' le righe non si sfalsano, ma la foto ci
     sta dentro intera: ritagliata al centro perdeva pezzi di esercizio, e in
     una foto verticale spariva mezza persona. Lo spazio che avanza resta del
     colore del fondo. */
  .schede { margin-bottom: 10px; }
  .scheda-es { display: flex; gap: 12px; border: 1px solid #dfe4ea; border-radius: 5px;
               padding: 9px 11px; margin-bottom: 8px; page-break-inside: avoid; }
  .scheda-es .foto { flex: 0 0 150px; height: 110px; background: #f2f3f5; border-radius: 4px;
                     overflow: hidden; }
  .scheda-es .foto img { width: 100%; height: 100%; object-fit: contain; display: block; }
  /* Il numero sta in una colonna sua: dentro la riga del nome, tutto quello che
     segue (dosaggio, spiegazione) partiva dal bordo del pallino e non dal nome. */
  .scheda-es .testo { flex: 1; min-width: 0; display: flex; gap: 7px; }
  .scheda-es .corpo { flex: 1; min-width: 0; }
  .scheda-es .nome { font-weight: 600; font-size: 13.5px; }
  .scheda-es .num { flex: 0 0 auto; width: 17px; height: 17px; margin-top: 1px;
                    border-radius: 50%; background: ${accento}; color: #fff; font-size: 10px;
                    text-align: center; line-height: 17px; }
  /* I numeri come le colonne della tabella: etichetta piccola in maiuscolo e
     sotto il valore. */
  .scheda-es .numeri { display: flex; gap: 18px; margin-top: 5px; }
  .scheda-es .numero { display: flex; flex-direction: column; }
  .scheda-es .numero .et { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em;
                           color: #6b7280; }
  .scheda-es .numero .val { font-size: 13px; }
  .scheda-es .come { color: #555b66; margin-top: 4px; }
  .scheda-es .nota-es { color: #555b66; margin-top: 4px; font-style: italic; }
  .scheda-es .video { display: inline-block; margin-top: 6px; color: ${accento}; font-weight: 600; }
  /* Le indicazioni per casa: un riquadro chiaro in fondo, staccato dal
     programma ma sullo stesso foglio. */
  .per-casa { margin-top: 16px; padding: 9px 12px; border: 1px solid #dfe4ea;
              border-radius: 5px; page-break-inside: avoid; }
  .per-casa .pc-titolo { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
                         color: ${accento}; font-weight: 600; }
  .per-casa .pc-quando { font-size: 13px; font-weight: 600; margin-top: 2px; }
  .per-casa ul { margin: 5px 0 0; padding-left: 16px; }
  .per-casa li { margin-bottom: 2px; }
</style>
</head>
<body>
  ${intestazioneHtml(accento)}
  <h1>${esc(p.cognome)} ${esc(p.nome)}</h1>
  <p class="info">${infoPaziente(p).map(esc).join(' &nbsp;·&nbsp; ')}</p>
  ${sedHtml}
  ${indicazioniHtml(p)}
</body>
</html>`
}

export async function generaDocx(
  p: DatiPazienteExport,
  sedute: DatiSedutaExport[]
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = []

  // Anche il documento Word esce con l'intestazione di chi firma: chi lo
  // riceve deve sapere da chi arriva, in qualunque formato.
  const { chi, dove } = righeProfilo()
  if (chi !== '') {
    children.push(new Paragraph({ children: [new TextRun({ text: chi, bold: true })] }))
  }
  if (dove !== '') {
    children.push(
      new Paragraph({ children: [new TextRun({ text: dove, size: 16, color: '6B7280' })] })
    )
  }

  children.push(
    new Paragraph({ text: `${p.cognome} ${p.nome}`, heading: HeadingLevel.TITLE })
  )
  const info = infoPaziente(p)
  if (info.length > 0) {
    children.push(new Paragraph({ text: info.join('  ·  '), spacing: { after: 200 } }))
  }

  sedute.forEach((s, i) => {
    children.push(
      new Paragraph({
        text: `Seduta del ${formatData(s.data)}${s.fase_nome ? ` — ${s.fase_nome}` : ''}`,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: i > 0
      })
    )
    if (s.obiettivi.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Obiettivi: ', bold: true }),
            new TextRun(s.obiettivi.join(', '))
          ],
          spacing: { after: 150 }
        })
      )
    }

    for (const sez of s.sezioni) {
      if (sez.nome) {
        children.push(
          new Paragraph({
            text: sez.nome,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          })
        )
      }
      const intestazione = new TableRow({
        children: ['Esercizio', 'Serie', 'Ripetizioni', 'Carico', 'Recupero', 'Note'].map(
          (t) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })]
            })
        )
      })
      const righe = sez.esercizi.map(
        (e) =>
          new TableRow({
            children: [
              e.nome,
              e.serie ?? '',
              // A cluster: "3 × 2" sono i cluster per le ripetizioni di ognuno.
              ripetizioniTesto(e) ?? '',
              caricoTesto(e.carico, e.unita_carico) ?? '',
              recuperoTesto(e) ?? '',
              e.nota ?? ''
            ].map((t) => new TableCell({ children: [new Paragraph(t)] }))
          })
      )
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [2800, 800, 1200, 1300, 1200, 2200],
          rows: [intestazione, ...righe]
        })
      )
    }

    if (s.note) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Note della seduta: ', bold: true }),
            new TextRun(s.note)
          ],
          spacing: { before: 200 }
        })
      )
    }
  })

  // Le indicazioni per casa anche nel Word, in fondo come sul foglio.
  const perCasa = p.indicazioni ?? []
  const quandoCasa = (p.frequenza_casa ?? '').trim()
  if (perCasa.length > 0 || quandoCasa !== '') {
    children.push(
      new Paragraph({
        text: 'Da fare a casa',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300 }
      })
    )
    if (quandoCasa !== '') {
      children.push(new Paragraph({ children: [new TextRun({ text: quandoCasa, bold: true })] }))
    }
    for (const v of perCasa) children.push(new Paragraph({ text: v, bullet: { level: 0 } }))
  }

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}
