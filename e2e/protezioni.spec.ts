// Le difese della finestra: il ponte gira nel sandbox, e la Content-Security-
// Policy non lascia ne' eseguire script scritti nella pagina ne' caricare
// niente da internet. Se un giorno qualcuno le togliesse per sbaglio, qui si vede.
import { test, expect } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { avvia } from './app'

// Nel sandbox un ponte puo' chiedere solo "electron" e non puo' caricare altri
// file: se la build lo spezzasse in pezzi (un modulo in comune fra due ponti),
// la finestra si aprirebbe senza window.api.
test('i ponti costruiti sono un file solo ciascuno, e chiedono solo electron', () => {
  const cartella = join(__dirname, '..', 'out', 'preload')
  const file = readdirSync(cartella)
  expect(file.sort()).toEqual(['finestra.js', 'index.js', 'scheda.js'])
  for (const f of file) {
    const richiesti = [...readFileSync(join(cartella, f), 'utf-8').matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1])
    expect(new Set(richiesti), f).toEqual(new Set(['electron']))
  }
})

test('la finestra gira nel sandbox, con la CSP', async () => {
  const prova = await avvia()
  try {
    const { app, pagina } = prova
    const preferenze = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      // c'e' in Electron ma non nei suoi tipi: se un giorno sparisse, la prova
      // si ferma qui invece di passare senza controllare niente
      type Preferenze = { sandbox?: boolean; contextIsolation?: boolean; nodeIntegration?: boolean }
      const p = (w.webContents as unknown as { getLastWebPreferences(): Preferenze | null }).getLastWebPreferences()
      return { sandbox: p?.sandbox, isolamento: p?.contextIsolation, node: p?.nodeIntegration }
    })
    expect(preferenze).toEqual({ sandbox: true, isolamento: true, node: false })

    // la pagina non vede niente di Node
    expect(await pagina.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
    expect(await pagina.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe('undefined')

    // la CSP c'e' e ferma un'immagine da internet e uno script scritto nella pagina
    const violazioni = await pagina.evaluate(async () => {
      const viste: string[] = []
      document.addEventListener('securitypolicyviolation', (e) => viste.push(e.violatedDirective))
      const img = document.createElement('img')
      img.src = 'https://example.com/spia.png'
      document.body.appendChild(img)
      const s = document.createElement('script')
      s.textContent = 'window.__eseguito = true'
      document.body.appendChild(s)
      await new Promise((r) => setTimeout(r, 300))
      img.remove()
      s.remove()
      return { viste, eseguito: (window as { __eseguito?: boolean }).__eseguito === true }
    })
    expect(violazioni.eseguito).toBe(false)
    expect(violazioni.viste).toEqual(expect.arrayContaining(['img-src', 'script-src-elem']))
  } finally {
    await prova.chiudi()
  }
})
