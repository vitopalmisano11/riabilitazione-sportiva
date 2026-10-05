// Prove dell'interfaccia (e2e/): il programma vero, costruito con `npm run build`,
// guidato come lo userebbe una persona. Ogni prova parte da una cartella
// temporanea tutta sua (vedi e2e/app.ts): i dati veri non si toccano mai.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  // una finestra per volta: piu' copie di Electron insieme rallentano tutte
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: 'e2e-risultati'
})
