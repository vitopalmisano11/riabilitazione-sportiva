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
import type { Tema } from '../shared/temi'

// La barra in cima a tutte le finestre del programma.
//
// Quella di Windows e' alta circa 32 e non si puo' cambiare, e con i colori
// dell'app i suoi pulsanti riduci e ingrandisci non si illuminavano al
// passaggio del mouse. La finestra nasce senza barra, e la pagina ne disegna
// una sua: titolo, striscia da trascinare e i tre pulsanti.
export const ALTEZZA_BARRA = 38

export function barraDisegnata(): Pick<BrowserWindowConstructorOptions, 'titleBarStyle'> {
  return { titleBarStyle: 'hidden' }
}

// I colori della barra sono quelli della colonna laterale dell'app, tema per
// tema: gli stessi di styles.css (--barra, --barra-testo, --barra-bordo). Le
// pagine generate non hanno quel foglio di stile, percio' stanno anche qui.
export interface ColoriBarra {
  fondo: string
  testo: string
  bordo: string
}

const BARRA_TEMA: Record<Tema, { chiara: ColoriBarra; scura: ColoriBarra }> = {
  verde: {
    chiara: { fondo: '#e6dcc9', testo: '#4a4237', bordo: '#cfc2a9' },
    scura: { fondo: '#15201b', testo: '#e7efea', bordo: '#0f1814' }
  },
  terracotta: {
    chiara: { fondo: '#efe1d3', testo: '#524134', bordo: '#d6bfa8' },
    scura: { fondo: '#241a15', testo: '#f2e6dd', bordo: '#1a120e' }
  },
  blu: {
    chiara: { fondo: '#e4ebf5', testo: '#35455c', bordo: '#c6d1e2' },
    scura: { fondo: '#18202b', testo: '#e6eaf0', bordo: '#131a24' }
  },
  prugna: {
    chiara: { fondo: '#ece5f2', testo: '#453a52', bordo: '#cfc2de' },
    scura: { fondo: '#1e1826', testo: '#ece5f2', bordo: '#150f1c' }
  },
  ardesia: {
    chiara: { fondo: '#e6ebef', testo: '#3b4a54', bordo: '#c9d2d9' },
    scura: { fondo: '#172026', testo: '#e6ecf0', bordo: '#10171c' }
  },
  bordeaux: {
    chiara: { fondo: '#f0e2e6', testo: '#4d3a40', bordo: '#d8bec6' },
    scura: { fondo: '#221217', testo: '#f2e4e8', bordo: '#180c10' }
  }
}

// La modalita' scura ha la sua colonna, grigio scuro, tranne dove il tema ha
// gia' una colonna scura sua.
const BARRA_MODALITA_SCURA: ColoriBarra = { fondo: '#131317', testo: '#e6e2de', bordo: '#101014' }

export function coloriBarra(tema: Tema, colonnaScura: boolean, modalitaScura: boolean): ColoriBarra {
  const t = BARRA_TEMA[tema] ?? BARRA_TEMA.verde
  if (modalitaScura) return colonnaScura && tema !== 'verde' ? t.scura : BARRA_MODALITA_SCURA
  return colonnaScura ? t.scura : t.chiara
}

const ICONA_INGRANDISCI =
  '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'
const ICONA_RIPRISTINA =
  '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="3.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.5 3.5V1.5h7v7h-2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'

// La stessa barra per le pagine generate (l'anteprima della cartella, le
// relazioni, il report dello screening), che non hanno React: il titolo, i tre
// pulsanti — comandati attraverso il piccolo ponte preload/finestra.ts — e uno
// spazio della stessa altezza prima del contenuto. In stampa non c'e', e nella
// finestra nascosta da cui nasce il PDF questa funzione non si usa proprio.
// colori: quelli della colonna laterale (vedi coloriBarra).
export function conBarra(
  html: string,
  titolo: string,
  colori: ColoriBarra = BARRA_TEMA.verde.chiara
): string {
  const esc = titolo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const { fondo, testo, bordo } = colori
  const stile = `<style>
  .barra-finestra { position: fixed; z-index: 1000; top: 0; left: 0; right: 0;
    height: ${ALTEZZA_BARRA}px; overflow: hidden; display: flex; align-items: center;
    padding-left: 16px; background: ${fondo}; box-shadow: 0 1px 0 ${bordo}; color: ${testo};
    font: 600 14px 'Segoe UI', system-ui, sans-serif; user-select: none; -webkit-app-region: drag; }
  .barra-finestra .titolo-barra { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap;
    text-overflow: ellipsis; }
  .barra-finestra .comandi-finestra { display: flex; height: 100%; -webkit-app-region: no-drag; }
  .barra-finestra .comando-finestra { width: 46px; height: 100%; display: flex; align-items: center;
    justify-content: center; border: none; border-radius: 0; background: transparent; color: inherit;
    cursor: default; transition: background-color 0.15s ease, color 0.15s ease; }
  .barra-finestra .comando-finestra:hover { background: rgba(128, 128, 128, 0.22); }
  .barra-finestra .comando-finestra.chiudi:hover { background: #c42b1c; color: #fff; }
  .spazio-barra { height: ${ALTEZZA_BARRA}px; }
  @media print { .barra-finestra, .spazio-barra { display: none; } }
</style>`
  const icona = (d: string): string =>
    `<svg width="12" height="12" viewBox="0 0 12 12"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`
  const barra = `<div class="barra-finestra"><span class="titolo-barra">${esc}</span>
  <div class="comandi-finestra">
    <button class="comando-finestra" title="Riduci a icona" onclick="window.finestra && window.finestra.comando('riduci')">${icona('M1.5 6h9')}</button>
    <button class="comando-finestra comando-ingrandisci" title="Ingrandisci" onclick="window.finestra && window.finestra.comando('ingrandisci')">${ICONA_INGRANDISCI}</button>
    <button class="comando-finestra chiudi" title="Chiudi" onclick="window.finestra && window.finestra.comando('chiudi')">${icona('M2 2l8 8M10 2l-8 8')}</button>
  </div></div><div class="spazio-barra"></div>
  <script>
  (function () {
    var b = document.querySelector('.comando-ingrandisci');
    function aggiorna() {
      if (!window.finestra || !b) return;
      window.finestra.ingrandita().then(function (m) {
        b.title = m ? 'Ripristina' : 'Ingrandisci';
        b.innerHTML = m ? '${ICONA_RIPRISTINA}' : '${ICONA_INGRANDISCI}';
      });
    }
    window.addEventListener('resize', aggiorna);
    aggiorna();
  })();
  </script>`
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
