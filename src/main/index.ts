import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDb } from './db'
import { registerIpc } from './ipc'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Per ora il db vive nel profilo utente; la scelta della cartella (es. Documenti)
  // arriva nello step "packaging", insieme alla cifratura SQLCipher.
  initDb(join(app.getPath('userData'), 'riabilitazione.db'))
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
