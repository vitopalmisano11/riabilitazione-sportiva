// Finestra con la scheda da mostrare al paziente.
//
// Durante la seduta il paziente guarda il proprio programma sullo schermo:
// serve una finestra a se', una per paziente, che si possano tenere aperte
// affiancate. Dentro non c'e' l'archivio: la finestra riceve una sola scheda e
// non ha modo di arrivare alle altre.
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { datiScheda } from './scheda-dati'
import { chiudiConEsc } from './finestre'
import icona from '../../resources/icon.png?asset'

// Una finestra per seduta: riaprendo la stessa scheda si porta in primo piano
// quella che c'e' gia', invece di accumulare doppioni sullo schermo.
const aperte = new Map<number, BrowserWindow>()

export function apriScheda(sedutaId: number): void {
  const gia = aperte.get(sedutaId)
  if (gia && !gia.isDestroyed()) {
    gia.focus()
    return
  }

  const dati = datiScheda(sedutaId)
  const win = new BrowserWindow({
    width: 820,
    height: 980,
    // il bianco e' anche il fondo della finestra: senza, mentre carica si vede
    // un lampo del colore di sistema
    backgroundColor: '#ffffff',
    title: `Scheda — ${dati.paziente}`,
    autoHideMenuBar: true,
    icon: icona,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  // il titolo lo decidiamo noi: la pagina non deve poterlo cambiare
  win.on('page-title-updated', (e) => e.preventDefault())
  chiudiConEsc(win)
  win.on('closed', () => aperte.delete(sedutaId))
  aperte.set(sedutaId, win)

  const rotta = `scheda=${sedutaId}`
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${rotta}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: rotta })
  }
}
