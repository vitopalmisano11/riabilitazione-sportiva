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

export function chiudiConEsc(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (_evento, tasto) => {
    if (tasto.type === 'keyDown' && tasto.key === 'Escape' && !win.isDestroyed()) {
      win.close()
    }
  })
}
