// Export sedute in PDF (via finestra nascosta + printToPDF) e Word (docx).
import { app, BrowserWindow, dialog, shell } from 'electron'
import icona from '../../resources/icon.png?asset'
import { unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { getDb } from './db'
import { cartellaExport, impostaCartellaExport } from './impostazioni'
import { componiCartella, generaCartella, oggiIso } from './export-cartella'
import { generaReportScreening } from './report-screening'
import type { SezioneCartella } from '../shared/types'
import {
  generaDocx,
  generaHtml,
  type DatiPazienteExport,
  type DatiSedutaExport
} from './export-doc'

export type FormatoExport = 'pdf' | 'docx'

import type { AnteprimaScheda } from '../shared/types'

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

// Le foto pesano: si leggono solo per la scheda illustrata, e non finiscono
// nemmeno in memoria quando si esporta quella normale.
function leggiSeduta(
  id: number,
  illustrata = false
): DatiSedutaExport & { paziente_id: number } {
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
  const sezioniRows = db
    .prepare('SELECT id, nome FROM seduta_sezioni WHERE seduta_id = ? ORDER BY ordine, id')
    .all(id) as { id: number; nome: string }[]
  type RigaEsercizio = DatiSedutaExport['sezioni'][number]['esercizi'][number] & {
    seduta_sezione_id: number | null
  }
  const esercizi = db
    .prepare(
      `SELECT e.nome, c.nome AS categoria_nome, se.serie, se.cluster, se.ripetizioni,
              se.carico, se.recupero_cluster, se.recupero,
              se.nota, se.seduta_sezione_id${
                illustrata ? ', e.nota_tecnica, e.link, e.immagine' : ''
              }
       FROM seduta_esercizi se
       JOIN esercizi e ON e.id = se.esercizio_id
       JOIN categorie c ON c.id = e.categoria_id
       WHERE se.seduta_id = ? ORDER BY se.ordine, se.id`
    )
    .all(id) as RigaEsercizio[]
  const spoglia = ({ seduta_sezione_id: _ignora, ...resto }: RigaEsercizio) => resto
  const sezioni = sezioniRows
    .map((sez) => ({
      nome: sez.nome as string | null,
      esercizi: esercizi.filter((e) => e.seduta_sezione_id === sez.id).map(spoglia)
    }))
    .filter((sez) => sez.esercizi.length > 0)
  const orfani = esercizi.filter((e) => e.seduta_sezione_id == null).map(spoglia)
  if (orfani.length > 0) sezioni.push({ nome: null, esercizi: orfani })
  return { ...s, obiettivi, sezioni }
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
  formato: FormatoExport,
  illustrata = false
): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Esporta',
    defaultPath: join(cartellaExport(), `${nomeBase}.${formato}`),
    filters:
      formato === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [{ name: 'Documento Word', extensions: ['docx'] }]
  })
  if (canceled || !filePath) return null
  if (formato === 'docx') {
    await writeFile(filePath, await generaDocx(paziente, sedute))
  } else {
    await htmlToPdf(generaHtml(paziente, sedute, illustrata), filePath)
  }
  impostaCartellaExport(dirname(filePath)) // ricorda l'ultima cartella scelta
  shell.showItemInFolder(filePath)
  return filePath
}

// Stesso HTML da cui nasce il PDF, restituito per la sola visualizzazione.
//
// Insieme all'HTML tornano gli esercizi a cui manca la foto o la spiegazione:
// la scheda illustrata vive di quelle due cose, e chi la prepara deve sapere
// subito quali esercizi andare a completare in Configurazione, invece di
// scoprirlo guardando il PDF finito.
export function anteprimaSchedaIllustrata(sedutaId: number): AnteprimaScheda {
  const seduta = leggiSeduta(sedutaId, true)
  const esercizi = seduta.sezioni.flatMap((sez) => sez.esercizi)
  return {
    html: generaHtml(leggiPaziente(seduta.paziente_id), [seduta], true),
    senzaFoto: esercizi.filter((e) => !e.immagine).map((e) => e.nome),
    senzaSpiegazione: esercizi.filter((e) => !e.nota_tecnica).map((e) => e.nome)
  }
}

export async function esportaSeduta(
  sedutaId: number,
  formato: FormatoExport,
  illustrata = false
): Promise<string | null> {
  const seduta = leggiSeduta(sedutaId, illustrata)
  const paziente = leggiPaziente(seduta.paziente_id)
  const nomeBase = `${slug(paziente.cognome)}_${slug(paziente.nome)}_${
    illustrata ? 'scheda' : 'seduta'
  }_${seduta.data}`
  return salvaExport(paziente, [seduta], nomeBase, formato, illustrata)
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
  const sedute = ids.map((id) => leggiSeduta(id))
  const nomeBase = `${slug(paziente.cognome)}_${slug(paziente.nome)}_sedute_${dal}_${al}`
  return salvaExport(paziente, sedute, nomeBase, formato)
}

// ---- Cartella completa del paziente ----
// Solo PDF: la cartella contiene le body chart, che sono disegni, e in Word non
// si porterebbero dietro.

export function anteprimaCartella(pazienteId: number, sezioni: SezioneCartella[]): string {
  return generaCartella(pazienteId, sezioni)
}

// Anteprima della cartella in una finestra sua: il documento e' alto, e dentro
// alla finestra delle spunte si vedrebbe da un buco. E' lo stesso HTML da cui
// nasce il PDF, quindi non puo' discostarsi dal file salvato. La finestra non
// ha preload: da li' non si arriva all'archivio.
const anteprimeAperte = new Map<number, BrowserWindow>()

export async function apriAnteprimaCartella(
  pazienteId: number,
  sezioni: SezioneCartella[]
): Promise<void> {
  const html = generaCartella(pazienteId, sezioni)
  const { cognome, nome } = componiCartella(pazienteId, sezioni)
  const tmp = join(app.getPath('temp'), `riab-anteprima-${pazienteId}-${Date.now()}.html`)
  await writeFile(tmp, html, 'utf-8')

  const gia = anteprimeAperte.get(pazienteId)
  if (gia && !gia.isDestroyed()) {
    // stessa finestra, contenuto aggiornato: cambiando le spunte non se ne
    // accumulano una sopra l'altra
    await gia.loadFile(tmp)
    gia.focus()
    void unlink(tmp).catch(() => undefined)
    return
  }

  const win = new BrowserWindow({
    width: 900,
    height: 1000,
    title: `Anteprima — ${cognome} ${nome}`,
    autoHideMenuBar: true,
    icon: icona,
    webPreferences: { sandbox: true }
  })
  win.on('page-title-updated', (e) => e.preventDefault())
  win.on('closed', () => anteprimeAperte.delete(pazienteId))
  anteprimeAperte.set(pazienteId, win)
  await win.loadFile(tmp)
  void unlink(tmp).catch(() => undefined)
}

export async function esportaCartella(
  pazienteId: number,
  sezioni: SezioneCartella[]
): Promise<string | null> {
  const { cognome, nome } = componiCartella(pazienteId, sezioni)
  const oggi = oggiIso()
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Esporta la cartella del paziente',
    defaultPath: join(cartellaExport(), `${slug(cognome)}_${slug(nome)}_cartella_${oggi}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return null
  await htmlToPdf(generaCartella(pazienteId, sezioni), filePath)
  impostaCartellaExport(dirname(filePath))
  shell.showItemInFolder(filePath)
  return filePath
}

// ---- Report di uno screening ----
// Stessa coppia di funzioni della cartella: si guarda in una finestra a parte e
// si salva in PDF, dallo stesso identico HTML.
const reportAperti = new Map<number, BrowserWindow>()

export async function apriAnteprimaReport(sessioneIds: number[]): Promise<void> {
  const r = generaReportScreening(sessioneIds)
  const sessioneId = sessioneIds[sessioneIds.length - 1]
  const tmp = join(app.getPath('temp'), `riab-report-${sessioneId}-${Date.now()}.html`)
  await writeFile(tmp, r.html, 'utf-8')

  const gia = reportAperti.get(sessioneId)
  if (gia && !gia.isDestroyed()) {
    await gia.loadFile(tmp)
    gia.focus()
    void unlink(tmp).catch(() => undefined)
    return
  }
  const win = new BrowserWindow({
    width: 980,
    height: 1000,
    title: `Report — ${r.cognome} ${r.nome}`,
    autoHideMenuBar: true,
    icon: icona,
    webPreferences: { sandbox: true }
  })
  win.on('page-title-updated', (e) => e.preventDefault())
  win.on('closed', () => reportAperti.delete(sessioneId))
  reportAperti.set(sessioneId, win)
  await win.loadFile(tmp)
  void unlink(tmp).catch(() => undefined)
}

export async function esportaReport(sessioneIds: number[]): Promise<string | null> {
  const r = generaReportScreening(sessioneIds)
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Esporta il report dello screening',
    defaultPath: join(
      cartellaExport(),
      `${slug(r.cognome)}_${slug(r.nome)}_screening_${r.data}.pdf`
    ),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return null
  await htmlToPdf(r.html, filePath)
  impostaCartellaExport(dirname(filePath))
  shell.showItemInFolder(filePath)
  return filePath
}
