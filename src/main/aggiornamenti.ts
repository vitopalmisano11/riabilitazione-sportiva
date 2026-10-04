// Aggiornamenti automatici dai Releases di GitHub.
//
// Le correzioni servono a poco se restano su GitHub: chi usa il programma non
// va a controllare se ce n'e' una nuova. Qui il programma guarda da solo, poco
// dopo l'avvio e poi ogni qualche ora, scarica la versione nuova in sottofondo
// e la installa quando lo si chiude (o subito, se lo si chiede). I dati non si
// toccano: stanno fuori dalla cartella del programma, e alla prima apertura la
// versione nuova aggiorna l'archivio da sola, dopo averne fatto una copia.
//
// Da dove arriva: il file latest.yml del Release piu' recente, che dice nome e
// impronta (sha512) dell'installer. Un installer scaricato che non corrisponde
// all'impronta non si installa.
//
// Solo nel programma installato: la versione di prova (npm run dev,
// avvia-prova.cmd) non si aggiorna da sola.
import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { StatoAggiornamento } from '../shared/types'
import { registraErrore } from './registro'

// Il gestore degli aggiornamenti si crea solo quando serve, cioe' nel programma
// installato: toccarlo all'avvio, anche nella versione di prova, lo
// costruirebbe per niente.
const aggiornatore = (): typeof electronUpdater.autoUpdater => electronUpdater.autoUpdater

const PRIMO_CONTROLLO = 15_000
const OGNI = 6 * 60 * 60 * 1000

let stato: StatoAggiornamento = { stato: 'nessuno' }

function cambia(nuovo: StatoAggiornamento): void {
  stato = nuovo
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('aggiornamento:stato', stato)
  }
}

export function statoAggiornamento(): StatoAggiornamento {
  return stato
}

export function avviaAggiornamenti(): void {
  if (!app.isPackaged) return
  const autoUpdater = aggiornatore()
  // niente righe su ogni controllo: nel registro vanno solo gli errori
  autoUpdater.logger = null
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => cambia({ stato: 'scaricamento', versione: info.version }))
  autoUpdater.on('update-downloaded', (info) => cambia({ stato: 'pronto', versione: info.version }))
  autoUpdater.on('error', (e) => {
    // Di solito e' il computer senza rete: si riprova al prossimo giro. Una
    // riga nel registro serve a capire perche' un aggiornamento non arriva.
    registraErrore('aggiornamento', e)
    if (stato.stato === 'scaricamento') cambia({ stato: 'nessuno' })
  })

  const controlla = (): void => {
    // gia' scaricato: si aspetta la chiusura
    if (stato.stato === 'pronto') return
    autoUpdater.checkForUpdates().catch(() => undefined) // l'errore passa da 'error'
  }
  setTimeout(controlla, PRIMO_CONTROLLO)
  setInterval(controlla, OGNI)

  // L'installer parte solo all'ultimo, quando le finestre sono gia' chiuse:
  // vedi installaAdesso.
  app.on('will-quit', () => {
    if (riapriDopo && stato.stato === 'pronto') aggiornatore().quitAndInstall(true, true)
  })
}

let riapriDopo = false

// Chiude il programma, installa e lo riapre.
//
// Non si chiama subito quitAndInstall: avvierebbe l'installer prima che il
// programma si chiuda, e l'installer chiude a forza un programma che non se ne
// va; una schermata che sta ancora salvando perderebbe quello che c'e' scritto.
// Si chiude invece per la strada solita (le schermate salvano, si fa la copia
// di chiusura), e l'installer parte da 'will-quit', a finestre chiuse. Se la
// chiusura si annulla (un salvataggio non riuscito, e si resta), non succede
// niente: l'aggiornamento si installa alla prossima chiusura.
export function installaAdesso(): void {
  if (stato.stato !== 'pronto') throw new Error('Non c’è nessun aggiornamento pronto da installare.')
  riapriDopo = true
  app.quit()
}
