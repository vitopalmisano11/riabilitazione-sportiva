// Una seduta: si scrive, si salva, si ritrova nel diario e con la ricerca, e la
// scheda del paziente (la finestra a parte, col suo ponte) si apre. Con la
// Content-Security-Policy accesa nessuna di queste schermate deve lasciare
// errori nella console.
import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, nuovoPaziente } from './app'

test('seduta: si salva, si ritrova nel diario e con la ricerca', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await nuovoPaziente(pagina, { nome: 'Luca', cognome: 'Seduta' })

    await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
    await expect(pagina.getByRole('button', { name: 'Salva seduta' }).first()).toBeVisible()
    await pagina.getByPlaceholder('es. preparazione corsa').fill('Spalla destra')
    await pagina
      .getByPlaceholder('Osservazioni generali, cose da riprendere la prossima volta…')
      .fill('Fitta alla spalla nei movimenti sopra la testa, migliora dopo il riscaldamento.')
    await pagina.getByPlaceholder('Aggiungi una sezione a questa seduta… (es. Defaticamento)').fill('Mobilità')
    await pagina.getByPlaceholder('Aggiungi una sezione a questa seduta… (es. Defaticamento)').press('Enter')
    await pagina.screenshot({ path: join(FOTO, '06-seduta.png'), fullPage: true })
    await pagina.getByRole('button', { name: 'Salva seduta' }).first().click()

    // salvata: si torna alla settimana o alla scheda; nel diario c'e'
    await pagina.locator('.sidebar').getByRole('button', { name: 'Pazienti', exact: true }).click()
    await pagina.getByText('Seduta Luca').first().click()
    await pagina.getByRole('button', { name: 'Diario sedute' }).click()
    await expect(pagina.getByText('Spalla destra').first()).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '07-diario.png'), fullPage: true })

    // la scheda per il paziente: una finestra a parte, col ponte piccolo
    const [scheda] = await Promise.all([
      prova.app.waitForEvent('window'),
      pagina.getByTitle('Mostra la scheda al paziente (si apre in una finestra a parte)').click()
    ])
    await expect(scheda.getByText('Fitta alla spalla', { exact: false })).toBeVisible()
    await scheda.screenshot({ path: join(FOTO, '08-scheda-paziente.png') })
    await scheda.close()

    // la scheda illustrata: HTML in un iframe senza script, sotto la CSP
    await pagina.getByTitle('Scheda illustrata per il paziente (foto e spiegazioni)').click()
    const anteprima = pagina.frameLocator('iframe.anteprima-frame')
    await expect(anteprima.locator('body')).toContainText('Seduta')
    await pagina.screenshot({ path: join(FOTO, '09-scheda-illustrata.png') })
    await pagina.locator('.modal').getByRole('button', { name: 'Chiudi', exact: true }).click()

    // la ricerca trova la parola nelle note e apre la seduta
    await pagina.keyboard.press('Control+k')
    await pagina.getByPlaceholder(/Cerca un paziente/).fill('sopra la testa')
    const voce = pagina.locator('.ricerca-voce')
    await expect(voce).toHaveCount(1)
    await expect(voce).toContainText('Note')
    await voce.click()
    await expect(pagina.getByText('Modifica seduta')).toBeVisible()
    await expect(
      pagina.getByPlaceholder('Osservazioni generali, cose da riprendere la prossima volta…')
    ).toHaveValue(/sopra la testa/)

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
