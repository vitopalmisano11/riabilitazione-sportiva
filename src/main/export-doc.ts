// Generazione documenti (HTML per il PDF, docx per Word) da dati già letti.
// Nessuna dipendenza da Electron: testabile con Node (vedi scripts/smoke.ts).
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
  esercizi: {
    nome: string
    categoria_nome: string
    serie: string | null
    ripetizioni: string | null
    carico: string | null
    nota: string | null
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

export function generaHtml(p: DatiPazienteExport, sedute: DatiSedutaExport[]): string {
  const sedHtml = sedute
    .map(
      (s, i) => `
    <section class="seduta${i > 0 ? ' nuova-pagina' : ''}">
      <h2>Seduta del ${formatData(s.data)}${s.fase_nome ? ` <span class="fase">· ${esc(s.fase_nome)}</span>` : ''}</h2>
      ${
        s.obiettivi.length
          ? `<p class="obiettivi"><strong>Obiettivi:</strong> ${s.obiettivi.map(esc).join(', ')}</p>`
          : ''
      }
      <table>
        <thead>
          <tr><th>Esercizio</th><th>Serie</th><th>Ripetizioni</th><th>Carico</th><th>Note</th></tr>
        </thead>
        <tbody>
          ${s.esercizi
            .map(
              (e) => `<tr>
            <td>${esc(e.nome)}<div class="cat">${esc(e.categoria_nome)}</div></td>
            <td>${esc(e.serie ?? '')}</td>
            <td>${esc(e.ripetizioni ?? '')}</td>
            <td>${esc(e.carico ?? '')}</td>
            <td>${esc(e.nota ?? '')}</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
      ${s.note ? `<p class="note"><strong>Note della seduta:</strong> ${esc(s.note)}</p>` : ''}
    </section>`
    )
    .join('')

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1f2733; font-size: 12px; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .info { color: #555b66; margin: 0 0 6px; font-size: 11px; }
  h2 { font-size: 15px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin: 18px 0 8px; }
  h2 .fase { color: #2563eb; font-weight: 600; }
  .nuova-pagina { page-break-before: always; }
  .obiettivi { margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccd2da; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eef2f7; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  tr { page-break-inside: avoid; }
  .cat { color: #777e88; font-size: 10px; }
  .note { margin: 10px 0 0; background: #f5f6f8; padding: 8px 10px; border-radius: 4px; }
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

    const intestazione = new TableRow({
      children: ['Esercizio', 'Serie', 'Ripetizioni', 'Carico', 'Note'].map(
        (t) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })]
          })
      )
    })
    const righe = s.esercizi.map(
      (e) =>
        new TableRow({
          children: [
            e.nome,
            e.serie ?? '',
            e.ripetizioni ?? '',
            e.carico ?? '',
            e.nota ?? ''
          ].map((t) => new TableCell({ children: [new Paragraph(t)] }))
        })
    )
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3200, 900, 1300, 1500, 2600],
        rows: [intestazione, ...righe]
      })
    )

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
