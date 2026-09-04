import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import {
  impostaPosizioneFinestra,
  migraDaUserData,
  posizioneFinestra
} from './impostazioni'
import { backupDiChiusura } from './backup'
import icona from '../../resources/icon.png?asset'

// In sviluppo l'app tiene dati e cache propri: le prove — comprese le migrazioni,
// che non si annullano — non toccano i dati dell'app installata.
if (!app.isPackaged) {
  app.setPath('userData', `${app.getPath('userData')} (dev)`)
}

function createWindow(): void {
  const salvata = posizioneFinestra()
  const win = new BrowserWindow({
    width: salvata?.larghezza ?? 1280,
    height: salvata?.altezza ?? 800,
    x: salvata?.x,
    y: salvata?.y,
    show: false,
    autoHideMenuBar: true,
    icon: icona,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    // La prima volta si apre massimizzata; dopo, com'era quando l'hai chiusa.
    if (salvata == null || salvata.massimizzata) win.maximize()
    win.show()
  })

  // Si registra dove sta un attimo dopo l'ultimo spostamento: scrivere il file a
  // ogni pixel trascinato sarebbe centinaia di scritture per una finestra
  // spostata a mano.
  let attesa: NodeJS.Timeout | null = null
  const ricorda = (): void => {
    if (attesa) clearTimeout(attesa)
    attesa = setTimeout(() => {
      if (win.isDestroyed()) return
      // Da massimizzata si registra la misura "normale": e' quella a cui
      // tornerebbe la finestra, e serve per la volta dopo.
      const b = win.getNormalBounds()
      impostaPosizioneFinestra({
        x: b.x,
        y: b.y,
        larghezza: b.width,
        altezza: b.height,
        massimizzata: win.isMaximized()
      })
    }, 500)
  }
  win.on('resize', ricorda)
  win.on('move', ricorda)
  win.on('maximize', ricorda)
  win.on('unmaximize', ricorda)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Sposta db e auth dalla vecchia posizione (userData) alla cartella dati, se serve.
  migraDaUserData()
  // Il database viene aperto solo dopo il login (vedi handler auth:* in ipc.ts).
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Alla chiusura si aggiorna la copia del giorno, cosi' contiene anche il lavoro
// appena fatto e non solo com'era l'archivio all'accesso.
app.on('before-quit', () => {
  backupDiChiusura()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
