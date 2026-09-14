import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // due ponti: quello dell'app, e quello piccolissimo delle finestre dei
    // documenti, che serve solo ai pulsanti della barra in cima
    build: {
      rollupOptions: {
        input: {
          index: 'src/preload/index.ts',
          finestra: 'src/preload/finestra.ts'
        }
      }
    }
  },
  renderer: {
    plugins: [react()]
  }
})
