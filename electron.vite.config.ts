import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

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
    plugins: [react()]
  }
})
