// Il ponte della finestra che guarda il paziente.
//
// Quella finestra sta aperta sul lettino, rivolta verso chi non e' il
// fisioterapista, e a volte resta li' da sola. Il ponte grande dell'app le
// darebbe in mano tutto l'archivio: l'elenco dei pazienti, le loro cartelle, il
// cambio password, il ripristino delle copie. Non le serve niente di tutto
// questo: le serve il programma della sua seduta, e basta.
//
// ATTENZIONE: questa finestra gira in sandbox, e in sandbox un ponte deve essere
// un file solo. Qui dentro non si puo' importare niente di nostro, nemmeno per
// non ripetersi: se un pezzo finisse in un file a parte, il programma di
// compilazione lo metterebbe da una parte sua, il ponte non riuscirebbe a
// caricarlo e la finestra resterebbe vuota davanti al paziente. Per questo il
// pezzo del tema qui sotto e' una copia di quello del ponte grande: toccandone
// uno, va toccato anche l'altro.
import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

// Il tema si applica prima che la pagina compaia, se no si vedrebbe un lampo
// dei colori di partenza a ogni scheda aperta. Il ponte non e' compilato con i
// tipi del browser, percio' della pagina si dichiara solo il poco che serve.
interface PaginaMinima {
  readyState: string
  documentElement: { dataset: Record<string, string> }
  addEventListener(tipo: string, ascoltatore: () => void): void
}

try {
  const salvato = ipcRenderer.sendSync('impostazioni:temaSubito') as {
    tema: string
    scuro: boolean
    barraScura: boolean
  }
  const pagina = (globalThis as { document?: PaginaMinima }).document
  const applica = (): void => {
    if (!pagina) return
    pagina.documentElement.dataset.tema = salvato.tema
    pagina.documentElement.dataset.barra = salvato.barraScura ? 'scura' : 'chiara'
    pagina.documentElement.dataset.barraDisegnata = 'si'
    if (salvato.scuro) pagina.documentElement.dataset.scuro = 'si'
  }
  if (pagina?.readyState === 'loading') pagina.addEventListener('DOMContentLoaded', applica)
  else applica()

  setInterval(() => {
    if (!pagina) return
    try {
      const ora = ipcRenderer.sendSync('impostazioni:temaSubito') as { scuro: boolean }
      const d = pagina.documentElement.dataset
      if (ora.scuro && d.scuro !== 'si') d.scuro = 'si'
      if (!ora.scuro && d.scuro === 'si') delete d.scuro
    } catch {
      // un minuto dopo si riprova
    }
  }, 60_000)
} catch {
  // senza risposta resta il tema di partenza: non e' un motivo per non aprire
}

// La pagina e' la stessa dell'app, quindi legge `window.api`: quello che cambia
// e' cosa ci trova dentro. Il tipo e' un pezzo del contratto vero, non una
// copia: se un giorno la scheda avra' bisogno di altro, il typecheck lo dira'.
const api: Pick<Api, 'scheda' | 'finestra'> = {
  scheda: {
    dati: (sedutaId: number) => ipcRenderer.invoke('scheda:dati', sedutaId),
    // Aprire altre finestre e' roba dell'app, non della scheda.
    apri: () => Promise.reject(new Error('Non disponibile in questa finestra.'))
  },
  finestra: {
    comando: (c: 'riduci' | 'ingrandisci' | 'chiudi') => ipcRenderer.invoke('finestra:comando', c),
    ingrandita: () => ipcRenderer.invoke('finestra:ingrandita')
  }
}

contextBridge.exposeInMainWorld('api', api)
