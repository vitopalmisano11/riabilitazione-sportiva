// Smoke test senza la trappola del modulo nativo.
//
// Il modulo SQLite e' compilato per l'ABI di Electron (serve all'app). Eseguire
// lo smoke con Node vorrebbe dire ricompilarlo avanti e indietro, e non e'
// nemmeno possibile mentre l'app e' aperta, perche' tiene il file bloccato.
// Qui si esegue lo stesso test dentro il runtime di Electron avviato come Node:
// stessa ABI dell'app, nessuna ricompilazione.
import { spawnSync } from 'node:child_process'
import electron from 'electron'

const esito = spawnSync(electron, ['node_modules/tsx/dist/cli.mjs', 'scripts/smoke.ts'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(esito.status ?? 1)
