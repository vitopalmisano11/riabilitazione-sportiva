// Comportamenti comuni alle finestre di sola lettura.
//
// La scheda che si mostra al paziente, l'anteprima della cartella e il report
// dello screening sono cose da guardare o da stampare: dentro non si scrive
// niente, quindi chiuderle non fa perdere niente. Si chiudono con Esc, senza
// chiedere conferma, come una finestra di stampa.
//
// Il tasto si intercetta prima che arrivi alla pagina (before-input-event):
// cosi' funziona anche dove la pagina e' un HTML generato, senza codice suo e
// senza preload.
import type { BrowserWindow } from 'electron'

// Ingrandire e rimpicciolire quello che si sta guardando: un report fitto si
// legge meglio ingrandito, e una scheda che non ci sta tutta si rimpicciolisce
// invece di scorrerla. Funziona con Ctrl+rotella e con il pizzico sul trackpad
// (che Windows manda proprio come Ctrl+rotella), o con Ctrl + e Ctrl -;
// Ctrl 0 torna alla misura normale.
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const PASSO = 0.1

export function zoomabile(win: BrowserWindow): void {
  const cambia = (delta: number): void => {
    if (win.isDestroyed()) return
    const attuale = win.webContents.getZoomFactor()
    win.webContents.setZoomFactor(
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((attuale + delta) * 100) / 100))
    )
  }

  win.webContents.on('zoom-changed', (_evento, direzione) =>
    cambia(direzione === 'in' ? PASSO : -PASSO)
  )

  win.webContents.on('before-input-event', (_evento, tasto) => {
    if (tasto.type !== 'keyDown' || !(tasto.control || tasto.meta)) return
    if (tasto.key === '+' || tasto.key === '=') cambia(PASSO)
    else if (tasto.key === '-') cambia(-PASSO)
    else if (tasto.key === '0' && !win.isDestroyed()) win.webContents.setZoomFactor(1)
  })
}

export function chiudiConEsc(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (_evento, tasto) => {
    if (tasto.type === 'keyDown' && tasto.key === 'Escape' && !win.isDestroyed()) {
      win.close()
    }
  })
}
