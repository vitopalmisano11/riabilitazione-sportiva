// Avvio del programma per le prove dell'interfaccia.
//
// Ogni avvio ha la sua cartella temporanea: impostazioni e archivio stanno li'
// (RIABILITAZIONE_CARTELLA_PROVA, vedi src/main/cartelle-di-avvio.ts), e alla
// fine si butta. Si avvia la versione costruita in out/, non quella di
// sviluppo: e' la stessa che finisce nell'installer, con le stesse protezioni.
//
// Tutto quello che la pagina scrive come errore nella console (comprese le
// violazioni della Content-Security-Policy) finisce in `errori`: una prova che
// passa con errori nella console non e' una prova passata.
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const PASSWORD = 'una frase di prova lunga'

export interface AppDiProva {
  app: ElectronApplication
  pagina: Page
  cartella: string
  errori: string[]
  chiudi: (opzioni?: { tieniCartella?: boolean }) => Promise<void>
}

export async function avvia(cartella?: string): Promise<AppDiProva> {
  const dir = cartella ?? mkdtempSync(join(tmpdir(), 'riab-e2e-'))
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v != null) env[k] = v
  // con questa variabile Electron partirebbe come Node, non come programma
  delete env.ELECTRON_RUN_AS_NODE
  env.RIABILITAZIONE_CARTELLA_PROVA = dir

  const app = await electron.launch({ args: ['.'], env })
  const pagina = await app.firstWindow()
  const errori: string[] = []
  const ascolta = (p: Page): void => {
    p.on('console', (m) => {
      if (m.type() === 'error') errori.push(m.text())
    })
    p.on('pageerror', (e) => errori.push(e.message))
    // Chiudendo con un editor aperto la pagina ferma la chiusura (beforeunload)
    // per salvare, e poi chiude da se': non e' una finestra di dialogo vera, e
    // Playwright non deve provare a risponderle.
    p.on('dialog', (d) => {
      if (d.type() !== 'beforeunload') void d.dismiss()
    })
  }
  ascolta(pagina)
  app.on('window', ascolta)

  return {
    app,
    pagina,
    cartella: dir,
    errori,
    chiudi: async (opzioni = {}) => {
      await app.close()
      if (!opzioni.tieniCartella) rmSync(dir, { recursive: true, force: true })
    }
  }
}

// Spegne il programma di colpo, come un computer che si stacca: niente
// salvataggi in uscita. Su Windows serve fermare tutto l'albero dei processi,
// altrimenti i figli restano e il programma fa in tempo a chiudersi per bene.
export async function spegniDiColpo(app: ElectronApplication): Promise<void> {
  const pid = app.process().pid
  if (pid == null) throw new Error('Il programma non ha un processo da fermare.')
  if (process.platform === 'win32') execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)])
  else process.kill(pid, 'SIGKILL')
  await app.close().catch(() => undefined)
}

// Primo avvio: password, chiave di recupero, dentro.
export async function creaArchivio(pagina: Page): Promise<void> {
  await expect(pagina.getByRole('heading', { name: 'Gestionale Fisioterapia' })).toBeVisible()
  await pagina.getByLabel(/^Password/).fill(PASSWORD)
  await pagina.getByLabel('Conferma password').fill(PASSWORD)
  await pagina.getByRole('button', { name: 'Crea password e cifra i dati' }).click()
  await expect(pagina.getByRole('heading', { name: 'Chiave di recupero' })).toBeVisible({ timeout: 30_000 })
  await pagina.getByLabel('Ho salvato la chiave in un posto sicuro').check()
  await pagina.getByRole('button', { name: "Entra nell'app" }).click()
  await expect(pagina.locator('.sidebar').getByRole('button', { name: 'La settimana' })).toBeVisible()
}

export async function accedi(pagina: Page): Promise<void> {
  await pagina.getByLabel('Password').fill(PASSWORD)
  await pagina.getByRole('button', { name: 'Accedi' }).click()
  await expect(pagina.locator('.sidebar').getByRole('button', { name: 'La settimana' })).toBeVisible({ timeout: 30_000 })
}

// Una voce della barra laterale (sopra o in fondo).
export async function vaiA(pagina: Page, voce: string): Promise<void> {
  await pagina.locator('.sidebar').getByRole('button', { name: voce, exact: true }).click()
}

export async function nuovoPaziente(
  pagina: Page,
  dati: { nome: string; cognome: string; diagnosi?: string }
): Promise<void> {
  await vaiA(pagina, 'Pazienti')
  await pagina.getByRole('button', { name: 'Nuovo paziente' }).click()
  await pagina.getByLabel('Nome *', { exact: true }).fill(dati.nome)
  await pagina.getByLabel('Cognome *', { exact: true }).fill(dati.cognome)
  if (dati.diagnosi) await pagina.getByLabel('Diagnosi', { exact: true }).fill(dati.diagnosi)
  await pagina.getByRole('button', { name: 'Crea paziente' }).click()
  await expect(pagina.getByRole('heading', { name: `${dati.cognome} ${dati.nome}` })).toBeVisible()
}

// Le prove salvano qui le fotografie delle schermate, per guardarle.
export const FOTO = join(__dirname, '..', 'e2e-risultati', 'schermate')
