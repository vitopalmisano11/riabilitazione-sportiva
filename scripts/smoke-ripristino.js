// Lanciatore della prova del ripristino (scripts/smoke-ripristino.ts).
//
// Questa prova, a differenza dello smoke, ha bisogno delle vere funzioni di
// Electron (app.getPath, app.setPath): ci passano le impostazioni, e da li' la
// cartella dati e quella delle copie. Quindi non si puo' avviare ne' con Node
// ne' con Electron-come-Node (ELECTRON_RUN_AS_NODE=1), dove "electron" non e'
// l'app ma solo un percorso: serve Electron avviato per davvero.
//
// Lo stesso file fa due mestieri:
//  - avviato con Node, riavvia se stesso dentro a Electron;
//  - dentro a Electron, prepara le cartelle finte ed esegue la prova.
// Electron porta gia' con se' l'ABI giusta del modulo SQLite, la stessa che usa
// l'app: nessuna ricompilazione in piu'.
const electron = require('electron')

if (typeof electron === 'string') {
  // Siamo sotto Node: si riavvia dentro a Electron. La variabile
  // ELECTRON_RUN_AS_NODE va tolta davvero (non messa a undefined): se
  // l'ambiente ce l'ha gia', Electron partirebbe di nuovo come Node.
  const { spawnSync } = require('node:child_process')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const esito = spawnSync(electron, [__filename], { stdio: 'inherit', env })
  process.exit(esito.status ?? 1)
} else {
  // Siamo dentro a Electron. Tutto va dirottato in una cartella temporanea
  // PRIMA di caricare i moduli dell'app: impostazioni.ts legge il suo file
  // gia' al caricamento, e i dati veri non devono essere sfiorati.
  const { mkdtempSync, mkdirSync, rmSync } = require('node:fs')
  const { tmpdir } = require('node:os')
  const { join } = require('node:path')

  const base = mkdtempSync(join(tmpdir(), 'riab-ripristino-'))
  for (const nome of ['userData', 'documenti']) mkdirSync(join(base, nome), { recursive: true })
  electron.app.setPath('userData', join(base, 'userData'))
  electron.app.setPath('documents', join(base, 'documenti'))
  process.env.RIAB_PROVA_DIR = base

  try {
    require('tsx/cjs') // per poter caricare i file TypeScript dell'app
    require('./smoke-ripristino.ts')
  } catch (e) {
    console.error(e)
    rmSync(base, { recursive: true, force: true })
    electron.app.exit(1)
  }
}
