import { contextBridge, ipcRenderer } from 'electron'
import type { Api, ApiExtra, StatoAggiornamento } from '../shared/types'
import { MAPPA_API } from '../shared/canali'

// Il tema scelto si applica prima che la pagina compaia: e' l'unica cosa chiesta
// in modo immediato, perche' leggerlo dopo vorrebbe dire vedere un lampo dei
// colori di partenza ogni volta che si apre il programma.
//
// Il ponte non e' compilato con i tipi del browser (qui gira codice di sistema),
// percio' della pagina si dichiara solo il poco che serve.
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
    // la barra in cima alla finestra la disegna la pagina: le fa posto
    pagina.documentElement.dataset.barraDisegnata = 'si'
    if (salvato.scuro) pagina.documentElement.dataset.scuro = 'si'
  }
  if (pagina?.readyState === 'loading') pagina.addEventListener('DOMContentLoaded', applica)
  else applica()

  // Con la modalita' scura a orari fissi la pagina deve cambiare da sola
  // all'ora giusta, anche restando aperta: si ricontrolla ogni minuto.
  // Risposta asincrona: quella immediata di sopra serve solo prima del primo
  // disegno, ma ogni minuto in ogni finestra fermerebbe la pagina per niente.
  setInterval(() => {
    if (!pagina) return
    void (ipcRenderer.invoke('impostazioni:temaOra') as Promise<{ scuro: boolean }>)
      .then((ora) => {
        const d = pagina.documentElement.dataset
        if (ora.scuro && d.scuro !== 'si') d.scuro = 'si'
        if (!ora.scuro && d.scuro === 'si') delete d.scuro
      })
      .catch(() => {
        // un minuto dopo si riprova
      })
  }, 60_000)
} catch {
  // senza risposta resta il tema di partenza: non e' un motivo per non aprire
}

// window.api si costruisce dal contratto (src/shared/canali.ts): ogni metodo
// della mappa chiama il suo canale con gli stessi argomenti. A mano resta solo
// quello che non e' una chiamata.
type Albero = { [nome: string]: string | Albero }

function costruisci(mappa: Albero): Record<string, unknown> {
  const fuori: Record<string, unknown> = {}
  for (const [nome, valore] of Object.entries(mappa)) {
    fuori[nome] =
      typeof valore === 'string'
        ? (...argomenti: unknown[]) => ipcRenderer.invoke(valore, ...argomenti)
        : costruisci(valore)
  }
  return fuori
}

const extra: ApiExtra = {
  aggiornamenti: {
    quandoCambia: (fn: (s: StatoAggiornamento) => void) => {
      const ascolta = (_e: unknown, s: StatoAggiornamento): void => fn(s)
      ipcRenderer.on('aggiornamento:stato', ascolta)
      return () => {
        ipcRenderer.removeListener('aggiornamento:stato', ascolta)
      }
    }
  }
}

const daCanali = costruisci(MAPPA_API)
for (const [gruppo, metodi] of Object.entries(extra)) {
  daCanali[gruppo] = { ...(daCanali[gruppo] as object), ...metodi }
}
const api = daCanali as unknown as Api

contextBridge.exposeInMainWorld('api', api)
