// Il ponte delle finestre dei documenti: l'anteprima della cartella, le
// relazioni e il report dello screening.
//
// Quelle pagine non hanno accesso all'archivio, e non devono averlo. Serve solo
// che i tre pulsanti della barra in cima (riduci, ingrandisci, chiudi) possano
// comandare la loro finestra: questo e' tutto quello che espone.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('finestra', {
  comando: (c: 'riduci' | 'ingrandisci' | 'chiudi'): Promise<void> =>
    ipcRenderer.invoke('finestra:comando', c),
  ingrandita: (): Promise<boolean> => ipcRenderer.invoke('finestra:ingrandita')
})
