import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import {
  impostaPosizioneFinestra,
  ingrandimento,
  migraDaUserData,
  posizioneFinestra
} from './impostazioni'
import { backupDiChiusura, copiaPrimaDellaMigrazione } from './backup'
import { impostaCopiaPrimaDelleMigrazioni } from './db'
import { barraDisegnata } from './finestre'
import { ripulisciTemporanei, usaCartellaTemporanei } from './temporanei'
import icona from '../../resources/icon.png?asset'

// In sviluppo l'app tiene dati e cache propri: le prove — comprese le migrazioni,
// che non si annullano — non toccano i dati dell'app installata.
if (!app.isPackaged) {
  app.setPath('userData', `${app.getPath('userData')} (dev)`)
}

// I file in chiaro che servono per un momento (un referto da aprire, l'anteprima
// di una cartella) stanno tutti qui, e non in %TEMP% alla rinfusa. Anche qui la
// versione di prova ha la sua, per non cancellare i file dell'altra mentre e'
// aperta.
usaCartellaTemporanei(
  join(app.getPath('temp'), app.isPackaged ? 'riabilitazione-sportiva' : 'riabilitazione-sportiva (dev)')
)

function createWindow(): void {
  const salvata = posizioneFinestra()
  const win = new BrowserWindow({
    width: salvata?.larghezza ?? 1280,
    height: salvata?.altezza ?? 800,
    x: salvata?.x,
    y: salvata?.y,
    show: false,
    autoHideMenuBar: true,
    ...barraDisegnata(),
    icon: icona,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Quanto grande si vede il programma. Si applica qui, alla finestra, e solo
  // a pagina caricata: chiamarlo prima (dal ponte, con webFrame) faceva morire
  // il renderer e la finestra non compariva piu'. Vale solo per questa
  // finestra: quella della scheda del paziente ha la sua misura.

  // Quanto grande si vede il programma. Si applica qui, alla finestra, e a
  // pagina caricata. Non si fa dal ponte con webFrame: chiamato li', prima che
  // la pagina esista, il renderer muore e la finestra non compare piu'.
  // Riguarda solo questa finestra: quella della scheda del paziente ha la sua
  // misura, che si cambia con Ctrl e la rotella.
  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) win.webContents.setZoomFactor(ingrandimento())
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
      try {
        impostaPosizioneFinestra({
          x: b.x,
          y: b.y,
          larghezza: b.width,
          altezza: b.height,
          massimizzata: win.isMaximized()
        })
      } catch {
        // Dove sta la finestra non vale un errore in mezzo al lavoro: se il
        // file delle impostazioni non si legge, la posizione non si ricorda.
      }
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

// Un link dentro a una finestra del programma (il video di un esercizio nella
// scheda illustrata, per esempio) non deve portarla via: prima la finestra
// diventava quella pagina internet, e il documento non si ritrovava piu'. I
// link internet si aprono nel browser; tutto il resto non si apre.
app.on('web-contents-created', (_evento, contenuti) => {
  // Gli strumenti da sviluppatore servono mentre si lavora al programma, non
  // nell'app installata: da li' si legge e si cambia tutto quello che la pagina
  // ha in mano, saltando l'interfaccia. Vale per ogni finestra, compresa quella
  // della scheda, che sta aperta davanti al paziente.
  if (app.isPackaged) {
    contenuti.on('devtools-opened', () => contenuti.closeDevTools())
  }

  const nelBrowser = (url: string): void => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  }
  contenuti.setWindowOpenHandler(({ url }) => {
    nelBrowser(url)
    return { action: 'deny' }
  })
  contenuti.on('will-navigate', (evento, url) => {
    const sviluppo = process.env['ELECTRON_RENDERER_URL']
    if (sviluppo && url.startsWith(sviluppo)) return
    evento.preventDefault()
    nelBrowser(url)
  })
})

app.whenReady().then(() => {
  // Prima di ogni aggiornamento dello schema dell'archivio, una copia com'era.
  impostaCopiaPrimaDelleMigrazioni(copiaPrimaDellaMigrazione)
  // Resti di una chiusura andata male: un referto rimasto aperto altrove, o
  // un'anteprima non cancellata.
  ripulisciTemporanei()
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
  // Quello che un altro programma tiene ancora aperto resta: lo toglie il
  // prossimo avvio.
  ripulisciTemporanei()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
