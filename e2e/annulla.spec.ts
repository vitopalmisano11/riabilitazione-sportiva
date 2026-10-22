// Eliminare si puo' annullare: l'avviso porta "Annulla" e la cosa torna com'era.
import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

test('eliminazione: l\'avviso offre Annulla e rimette tutto a posto', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)

    // senza pazienti la pagina dice cosa fare
    await vaiA(pagina, 'Pazienti')
    await expect(pagina.getByText('Ancora nessun paziente')).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '60-pazienti-vuota.png') })

    const id = await pagina.evaluate(() => window.api.categorie.create('Da annullare'))
    await pagina.evaluate((x) => window.api.categorie.remove(x), id)

    const avviso = pagina.locator('.toast', { hasText: 'Eliminato: Da annullare' })
    await expect(avviso).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '61-annulla.png') })
    await avviso.getByRole('button', { name: 'Annulla' }).click()
    await expect(pagina.locator('.toast', { hasText: 'è tornato al suo posto' })).toBeVisible()

    const nomi = await pagina.evaluate(async () => (await window.api.categorie.list()).map((c) => c.nome))
    expect(nomi).toContain('Da annullare')
    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
