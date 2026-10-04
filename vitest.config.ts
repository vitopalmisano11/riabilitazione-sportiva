// Le prove automatiche (cartella test/). Si avviano con `npm test`, che le
// esegue dentro a Electron avviato come Node: stessa ABI del modulo SQLite
// dell'app, nessuna ricompilazione (vedi scripts/test-app.mjs).
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // ogni file in un processo suo: il database aperto e' uno per processo
    pool: 'forks',
    // scrypt e la cifratura sono lenti apposta
    testTimeout: 30_000
  }
})
