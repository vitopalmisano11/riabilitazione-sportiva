import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Content-Security-Policy della finestra del programma, scritta solo nella
// versione costruita: quella di sviluppo carica il codice da Vite, che ha
// bisogno di script in linea e di una connessione propria.
//
// Tutto quello che la pagina usa sta nel programma stesso: niente script, font
// o immagini da internet. Le foto stanno nel database come data: URL; gli stili
// in linea servono a React (style={...}) e alla scheda illustrata. Se qualcosa
// riuscisse a scrivere HTML nella pagina, non potrebbe ne' eseguire script ne'
// mandare dati fuori (connect-src, form-action, img-src senza http).
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src 'self' about: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

function csp(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      )
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // tre ponti: quello dell'app; quello della scheda che guarda il paziente,
    // che vede solo il programma della sua seduta; e quello piccolissimo delle
    // finestre dei documenti, che serve solo ai pulsanti della barra in cima
    build: {
      rollupOptions: {
        input: {
          index: 'src/preload/index.ts',
          scheda: 'src/preload/scheda.ts',
          finestra: 'src/preload/finestra.ts'
        }
      }
    }
  },
  renderer: {
    plugins: [react(), csp()]
  }
})
