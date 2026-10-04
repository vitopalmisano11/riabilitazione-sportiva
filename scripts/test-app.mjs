// Prove automatiche senza la trappola del modulo nativo.
//
// Il modulo SQLite e' compilato per l'ABI di Electron (serve all'app). Eseguire
// le prove con Node vorrebbe dire ricompilarlo avanti e indietro, e non e'
// nemmeno possibile mentre l'app e' aperta, perche' tiene il file bloccato.
// Qui Vitest gira dentro il runtime di Electron avviato come Node: stessa ABI
// dell'app, nessuna ricompilazione. Gli argomenti passano a Vitest, per esempio
//   npm test -- cestino        (solo i file che contengono "cestino")
//   npm test -- --watch        (riparte a ogni modifica)
import { spawnSync } from 'node:child_process'
import electron from 'electron'

const argomenti = process.argv.slice(2)
const comando = argomenti.includes('--watch') ? [] : ['run']
const esito = spawnSync(
  electron,
  ['node_modules/vitest/vitest.mjs', ...comando, ...argomenti.filter((a) => a !== '--watch')],
  { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
)
process.exit(esito.status ?? 1)
