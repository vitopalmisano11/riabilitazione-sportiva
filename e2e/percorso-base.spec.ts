// Il giro di tutti i giorni: primo avvio, un paziente, una ricerca, uscire e
// rientrare con la password. Le fotografie delle schermate restano in
// e2e-risultati/schermate per guardarle.
import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { accedi, avvia, creaArchivio, FOTO, nuovoPaziente, vaiA } from './app'

test('primo avvio, paziente, ricerca, nuovo accesso', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await pagina.screenshot({ path: join(FOTO, '01-primo-avvio.png') })
    await creaArchivio(pagina)
    await pagina.screenshot({ path: join(FOTO, '02-settimana.png') })

    await nuovoPaziente(pagina, { nome: 'Giosuè', cognome: 'Perrone', diagnosi: 'Lesione del crociato anteriore' })
    await pagina.screenshot({ path: join(FOTO, '03-scheda-paziente.png') })

    // Ctrl+K: la ricerca trova il paziente anche senza accento, e lo apre
    await vaiA(pagina, 'Pazienti')
    await pagina.keyboard.press('Control+k')
    const campo = pagina.getByPlaceholder(/Cerca un paziente/)
    await expect(campo).toBeFocused()
    await campo.fill('crociato')
    await expect(pagina.locator('.ricerca-voce')).toHaveCount(1)
    await expect(pagina.locator('.ricerca-voce')).toContainText('Perrone Giosuè')
    await expect(pagina.locator('.ricerca-voce')).toContainText('Diagnosi')
    await pagina.screenshot({ path: join(FOTO, '04-ricerca.png') })
    await campo.press('Enter')
    await expect(pagina.locator('.ricerca-globale')).toHaveCount(0)
    await expect(pagina.getByRole('heading', { name: 'Perrone Giosuè' })).toBeVisible()

    // Esc chiude senza aprire niente
    await pagina.keyboard.press('Control+k')
    await pagina.keyboard.press('Escape')
    await expect(pagina.locator('.ricerca-globale')).toHaveCount(0)

    // si chiude e si riapre: serve la password, e il paziente c'e' ancora
    await prova.app.close()
    const di_nuovo = await avvia(prova.cartella)
    try {
      await accedi(di_nuovo.pagina)
      await vaiA(di_nuovo.pagina, 'Pazienti')
      await expect(di_nuovo.pagina.getByText('Perrone')).toBeVisible()
      expect(di_nuovo.errori, 'errori nella console').toEqual([])
    } finally {
      await di_nuovo.chiudi()
    }
    expect(prova.errori, 'errori nella console').toEqual([])
  } catch (e) {
    await prova.pagina.screenshot({ path: join(FOTO, 'errore-percorso-base.png') }).catch(() => {})
    await prova.app.close().catch(() => {})
    throw e
  }
})

test('elimina per sempre: la conferma spiega cosa resta, poi il paziente non si trova piu\'', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await nuovoPaziente(pagina, { nome: 'Da', cognome: 'Cancellare' })

    await pagina.getByTitle('Elimina per sempre, senza passare dal cestino').click()
    const domanda = pagina.locator('.modal-domanda')
    await expect(domanda).toContainText('non passa dal cestino')
    await expect(domanda).toContainText('copie di sicurezza')
    await pagina.screenshot({ path: join(FOTO, '05-elimina-per-sempre.png') })
    await domanda.getByRole('button', { name: 'Elimina per sempre' }).click()
    await expect(pagina.getByText('è stato eliminato per sempre')).toBeVisible()

    await pagina.keyboard.press('Control+k')
    await pagina.getByPlaceholder(/Cerca un paziente/).fill('cancellare')
    await expect(pagina.getByText('Niente trovato')).toBeVisible()

    // e nel cestino non c'e'
    await pagina.keyboard.press('Escape')
    await vaiA(pagina, 'Impostazioni')
    await pagina.getByRole('button', { name: 'Dati e backup' }).click()
    await expect(pagina.getByText('Cestino — vuoto')).toBeVisible()
    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
