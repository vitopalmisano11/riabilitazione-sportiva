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
import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'

// La barra in cima a tutte le finestre del programma.
//
// Quella di Windows e' alta circa 32 e non si puo' cambiare: per averla piu'
// alta la finestra nasce senza, Windows ci mette sopra solo riduci, ingrandisci
// e chiudi, e il titolo con la striscia da trascinare li disegna la pagina.
// I colori di partenza sono quelli chiari: la pagina, appena carica, chiede i
// suoi.
export const ALTEZZA_BARRA = 38

export function barraAlta(): Pick<BrowserWindowConstructorOptions, 'titleBarStyle' | 'titleBarOverlay'> {
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#ffffff', symbolColor: '#1c242b', height: ALTEZZA_BARRA }
  }
}

// La stessa barra per le pagine generate (l'anteprima della cartella, il report
// dello screening), che non hanno React: un titolo fisso in cima e uno spazio
// della stessa altezza prima del contenuto. Le misure vengono da env(), che
// vale zero dove la barra non c'e' — cioe' nella finestra nascosta da cui nasce
// il PDF: li' non compare niente.
export function conBarra(html: string, titolo: string): string {
  const esc = titolo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const stile = `<style>
  .barra-finestra { position: fixed; z-index: 1000; top: 0; left: 0; right: 0;
    height: env(titlebar-area-height, 0px); overflow: hidden;
    display: flex; align-items: center; padding: 0 16px;
    padding-right: calc(100% - env(titlebar-area-width, 100%) + 16px);
    background: #ffffff; box-shadow: 0 1px 0 #e2e6ea; color: #1c242b;
    font: 600 calc(env(titlebar-area-height, 0px) * 0.37) 'Segoe UI', system-ui, sans-serif;
    white-space: nowrap; user-select: none; -webkit-app-region: drag; }
  .spazio-barra { height: env(titlebar-area-height, 0px); }
  @media print { .barra-finestra, .spazio-barra { display: none; } }
</style>`
  const barra = `<div class="barra-finestra">${esc}</div><div class="spazio-barra"></div>`
  const conStile = html.includes('</head>') ? html.replace('</head>', `${stile}</head>`) : stile + html
  return /<body[^>]*>/.test(conStile)
    ? conStile.replace(/<body[^>]*>/, (b) => b + barra)
    : barra + conStile
}

// La sessione tutta sua di una finestra secondaria.
//
// Chromium ricorda l'ingrandimento per indirizzo, e tutte le finestre del
// programma hanno lo stesso: Ctrl + sulla scheda degli esercizi ingrandiva
// anche il gestionale dietro, e viceversa. Con una sessione separata ogni
// finestra ha la sua misura. Il nome dice di chi e': riaprendo la stessa scheda
// si riusa la stessa, invece di crearne una nuova ogni volta.
export function sessioneSeparata(nome: string): string {
  return `finestra-${nome}`
}

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
