// Esc nella finestra di un paziente nuovo: vuota si chiude, con qualcosa scritto
// chiede se salvare o annullare, e dalla domanda si puo' tornare indietro.
import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

test('Esc nel nuovo paziente: chiude se e\' vuota, altrimenti chiede', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await vaiA(pagina, 'Pazienti')
    const finestra = pagina.locator('.modal-paziente')
    const domanda = pagina.locator('.modal-domanda')

    // vuota: Esc chiude senza chiedere niente
    await pagina.getByRole('button', { name: 'Nuovo paziente' }).first().click()
    await expect(finestra).toBeVisible()
    await pagina.keyboard.press('Escape')
    await expect(finestra).toBeHidden()
    await expect(domanda).toBeHidden()

    // con qualcosa scritto: chiede
    await pagina.getByRole('button', { name: 'Nuovo paziente' }).first().click()
    await pagina.getByLabel('Nome', { exact: true }).fill('Mario')
    await pagina.keyboard.press('Escape')
    await expect(domanda).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '62-esc-nuovo-paziente.png') })

    // Esc sulla domanda: si torna alla finestra, con quello che c'era
    await pagina.keyboard.press('Escape')
    await expect(domanda).toBeHidden()
    await expect(finestra).toBeVisible()
    await expect(pagina.getByLabel('Nome', { exact: true })).toHaveValue('Mario')

    // «Annulla creazione»: la finestra si chiude e il paziente non c'e'
    await pagina.keyboard.press('Escape')
    await domanda.getByRole('button', { name: 'Annulla creazione' }).click()
    await expect(finestra).toBeHidden()
    expect(await pagina.evaluate(async () => (await window.api.pazienti.list()).length)).toBe(0)

    // «Salva e chiudi»: il paziente viene creato
    await pagina.getByRole('button', { name: 'Nuovo paziente' }).first().click()
    await pagina.getByLabel('Nome', { exact: true }).fill('Mario')
    await pagina.getByLabel('Cognome', { exact: true }).fill('Rossi')
    await pagina.keyboard.press('Escape')
    await domanda.getByRole('button', { name: 'Salva e chiudi' }).click()
    await expect(finestra).toBeHidden()
    await expect(pagina.getByRole('heading', { name: 'Rossi Mario' })).toBeVisible()

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
