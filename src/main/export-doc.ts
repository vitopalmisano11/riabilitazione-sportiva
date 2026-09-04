// Generazione documenti (HTML per il PDF, docx per Word) da dati già letti.
// Nessuna dipendenza da Electron: testabile con Node (vedi scripts/smoke.ts).
import { coloriTema } from '../shared/temi'
import {
  caricoTesto,
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
      serie: string | null
      cluster: string | null
      ripetizioni: string | null
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
export function generaHtml(
  p: DatiPazienteExport,
  sedute: DatiSedutaExport[],
  illustrata = false
): string {
  // Elenco puntato invece di una tabella per sezione: con dieci esercizi la
  // tabella occupava mezza pagina di righe quasi vuote. La categoria fa da
  // sottotitolo del gruppo, cosi' si legge su cosa si sta lavorando senza
  // ripeterla accanto a ogni esercizio.
  const dettagli = (e: DatiSedutaExport['sezioni'][number]['esercizi'][number]): string =>
    [volumeTesto(e), caricoTesto(e.carico), recuperoEsteso(e)]
      .filter(Boolean)
      .map((x) => esc(String(x)))
      .join(' · ')

  // Solo la sezione della seduta, senza la categoria: spesso ripete quello che
  // dice gia' il nome della sezione ("Rinforzo" dentro "Rinforzo").
  const tabella = (esercizi: DatiSedutaExport['sezioni'][number]['esercizi']): string =>
    `<ul class="elenco-esercizi">
      ${esercizi
        .map((e) => {
          const d = dettagli(e)
          return `<li><span class="nome">${esc(e.nome)}</span>${
            d ? ` — ${d}` : ''
          }${e.nota ? `<span class="nota-es">${esc(e.nota)}</span>` : ''}</li>`
        })
        .join('')}
    </ul>`

  // Un esercizio per riga: foto a sinistra, testo a destra, numerati come in un
  // programma da portare a casa. Il paziente inesperto legge una cosa per volta,
  // e la foto e la spiegazione stanno vicine.
  let numero = 0
  const schede = (esercizi: DatiSedutaExport['sezioni'][number]['esercizi']): string => {
    // Il riquadro della foto si tiene anche dove la foto manca, cosi' le righe
    // restano allineate. Ma se in tutta la sezione non ce n'e' nessuna, sarebbe
    // solo una colonna di rettangoli grigi: allora si toglie.
    const conFoto = esercizi.some((e) => e.immagine)
    return `<div class="schede">
      ${esercizi
        .map((e) => {
          const d = dettagli(e)
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
                ${d ? `<div class="dose">${d}</div>` : ''}
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
      ${sez.nome ? `<h3>${esc(sez.nome)}</h3>` : ''}
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
  h3 { font-size: 13px; margin: 12px 0 4px; color: ${accento}; }
  .nuova-pagina { page-break-before: always; }
  .obiettivi { margin: 0 0 8px; }
  .gruppo-esercizi { margin: 0 0 8px; page-break-inside: avoid; }
  .gruppo-esercizi .cat { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
                          color: ${accento}; margin-bottom: 2px; }
  ul.elenco-esercizi { margin: 0; padding-left: 18px; }
  ul.elenco-esercizi li { margin-bottom: 3px; }
  ul.elenco-esercizi .nome { font-weight: 600; }
  ul.elenco-esercizi .nota-es { display: block; color: #555b66; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccd2da; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: ${intestazione}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  tr { page-break-inside: avoid; }
  .cat { color: #777e88; font-size: 10px; }
  .note { margin: 10px 0 0; background: #f5f6f8; padding: 8px 10px; border-radius: 4px; }
  /* Scheda illustrata: un esercizio per riga, foto a sinistra. Le foto stanno
     tutte nello stesso riquadro (ritagliate al centro), altrimenti una verticale
     e una orizzontale sfalserebbero tutta la pagina. */
  .schede { margin-bottom: 10px; }
  .scheda-es { display: flex; gap: 12px; border: 1px solid #dfe4ea; border-radius: 5px;
               padding: 9px 11px; margin-bottom: 8px; page-break-inside: avoid; }
  .scheda-es .foto { flex: 0 0 150px; height: 110px; background: #f2f3f5; border-radius: 4px;
                     overflow: hidden; }
  .scheda-es .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* Il numero sta in una colonna sua: dentro la riga del nome, tutto quello che
     segue (dosaggio, spiegazione) partiva dal bordo del pallino e non dal nome. */
  .scheda-es .testo { flex: 1; min-width: 0; display: flex; gap: 7px; }
  .scheda-es .corpo { flex: 1; min-width: 0; }
  .scheda-es .nome { font-weight: 700; font-size: 13px; }
  .scheda-es .num { flex: 0 0 auto; width: 17px; height: 17px; margin-top: 1px;
                    border-radius: 50%; background: ${accento}; color: #fff; font-size: 10px;
                    text-align: center; line-height: 17px; }
  .scheda-es .dose { margin-top: 3px; font-weight: 600; }
  .scheda-es .come { color: #555b66; margin-top: 4px; }
  .scheda-es .nota-es { color: #555b66; margin-top: 4px; font-style: italic; }
  .scheda-es .video { display: inline-block; margin-top: 6px; color: ${accento}; font-weight: 600; }
</style>
</head>
<body>
  <h1>${esc(p.cognome)} ${esc(p.nome)}</h1>
  <p class="info">${infoPaziente(p).map(esc).join(' &nbsp;·&nbsp; ')}</p>
  ${sedHtml}
</body>
</html>`
}

export async function generaDocx(
  p: DatiPazienteExport,
  sedute: DatiSedutaExport[]
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = []

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
              caricoTesto(e.carico) ?? '',
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

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}
