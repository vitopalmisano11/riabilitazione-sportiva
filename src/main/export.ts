// Export sedute in PDF (via finestra nascosta + printToPDF) e Word (docx).
import { app, BrowserWindow, dialog, shell } from 'electron'
import { unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { getDb } from './db'
import {
  generaDocx,
  generaHtml,
  type DatiPazienteExport,
  type DatiSedutaExport
} from './export-doc'

export type FormatoExport = 'pdf' | 'docx'

function leggiPaziente(id: number): DatiPazienteExport {
  const p = getDb()
    .prepare(
      `SELECT p.nome, p.cognome, p.tipo_intervento, p.data_intervento, pat.nome AS patologia_nome
       FROM pazienti p LEFT JOIN patologie pat ON pat.id = p.patologia_id
       WHERE p.id = ?`
    )
    .get(id) as DatiPazienteExport | undefined
  if (!p) throw new Error('Paziente non trovato.')
  return p
}

function leggiSeduta(id: number): DatiSedutaExport & { paziente_id: number } {
  const db = getDb()
  const s = db
    .prepare(
      `SELECT s.paziente_id, s.data, s.note, f.nome AS fase_nome
       FROM sedute s LEFT JOIN fasi f ON f.id = s.fase_id WHERE s.id = ?`
    )
    .get(id) as
    | { paziente_id: number; data: string; note: string | null; fase_nome: string | null }
    | undefined
  if (!s) throw new Error('Seduta non trovata.')
  const obiettivi = (
    db
      .prepare(
        `SELECT o.nome FROM seduta_obiettivi so JOIN obiettivi o ON o.id = so.obiettivo_id
         WHERE so.seduta_id = ? ORDER BY o.ordine, o.id`
      )
      .all(id) as { nome: string }[]
  ).map((r) => r.nome)
  const esercizi = db
    .prepare(
      `SELECT e.nome, c.nome AS categoria_nome, se.serie, se.ripetizioni, se.carico, se.nota
       FROM seduta_esercizi se
       JOIN esercizi e ON e.id = se.esercizio_id
       JOIN categorie c ON c.id = e.categoria_id
       WHERE se.seduta_id = ? ORDER BY se.ordine, se.id`
    )
    .all(id) as DatiSedutaExport['esercizi']
  return { ...s, obiettivi, esercizi }
}

function slug(s: string): string {
  return s.trim().replace(/[^\p{L}\p{N}]+/gu, '_') || 'export'
}

async function htmlToPdf(html: string, destPath: string): Promise<void> {
  const tmp = join(app.getPath('temp'), `riab-export-${Date.now()}.html`)
  await writeFile(tmp, html, 'utf-8')
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await win.loadFile(tmp)
    const buf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    })
    await writeFile(destPath, buf)
  } finally {
    win.destroy()
    void unlink(tmp).catch(() => undefined)
  }
}

async function salvaExport(
  paziente: DatiPazienteExport,
  sedute: DatiSedutaExport[],
  nomeBase: string,
  formato: FormatoExport
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Esporta',
    defaultPath: join(app.getPath('documents'), `${nomeBase}.${formato}`),
    filters:
      formato === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [{ name: 'Documento Word', extensions: ['docx'] }]
  })
  if (canceled || !filePath) return null
  if (formato === 'docx') {
    await writeFile(filePath, await generaDocx(paziente, sedute))
  } else {
    await htmlToPdf(generaHtml(paziente, sedute), filePath)
  }
  shell.showItemInFolder(filePath)
  return filePath
}

export async function esportaSeduta(
  sedutaId: number,
  formato: FormatoExport
): Promise<string | null> {
  const seduta = leggiSeduta(sedutaId)
  const paziente = leggiPaziente(seduta.paziente_id)
  const nomeBase = `${slug(paziente.cognome)}_${slug(paziente.nome)}_seduta_${seduta.data}`
  return salvaExport(paziente, [seduta], nomeBase, formato)
}

export async function esportaStorico(
  pazienteId: number,
  dal: string,
  al: string,
  formato: FormatoExport
): Promise<string | null> {
  const ids = (
    getDb()
      .prepare(
        'SELECT id FROM sedute WHERE paziente_id = ? AND data >= ? AND data <= ? ORDER BY data, id'
      )
      .all(pazienteId, dal, al) as { id: number }[]
  ).map((r) => r.id)
  if (ids.length === 0) throw new Error('Nessuna seduta nel periodo selezionato.')
  const paziente = leggiPaziente(pazienteId)
  const sedute = ids.map(leggiSeduta)
  const nomeBase = `${slug(paziente.cognome)}_${slug(paziente.nome)}_sedute_${dal}_${al}`
  return salvaExport(paziente, sedute, nomeBase, formato)
}
