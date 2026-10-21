// La linguetta Pedana: si importa il file di esempio dell'app della pedana,
// compare l'elenco (data e test) e ogni riga apre la finestra con le sezioni.
// Le fotografie finiscono in e2e-risultati/schermate per guardarle.
import { test, expect } from '@playwright/test'
import { join, resolve } from 'node:path'
import { avvia, creaArchivio, FOTO, nuovoPaziente } from './app'

async function importaEsempio(prova: Awaited<ReturnType<typeof avvia>>): Promise<void> {
  const { pagina, app } = prova
  await creaArchivio(pagina)
  await nuovoPaziente(pagina, { nome: 'Mario', cognome: 'Rossi' })
  const file = resolve(__dirname, '..', 'docs', 'esempio.pedana.json')
  await app.evaluate(({ dialog }, percorso) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [percorso] })
  }, file)
  await pagina.getByRole('button', { name: 'Pedana', exact: true }).click()
  await pagina.getByRole('button', { name: 'Importa', exact: true }).click()
  await expect(pagina.getByRole('heading', { name: 'Importa dalla pedana' })).toBeVisible()
  await pagina.screenshot({ path: join(FOTO, '30-pedana-importa.png') })
  await pagina.getByRole('button', { name: /^Importa \(/ }).click()
}

test('pedana: importa, elenco semplice, finestra a sezioni', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await importaEsempio(prova)

    // destro e sinistro della spalla stanno in una riga; 4 stabilometrie (due piedi insieme)
    const elenco = pagina.locator('.elenco-pedana .riga-pedana')
    await expect(elenco).toHaveCount(6)
    await pagina.screenshot({ path: join(FOTO, '31-pedana-elenco.png'), fullPage: true })

    // il salto: sezioni
    await elenco.filter({ hasText: 'Salto' }).first().click()
    const finestra = pagina.locator('.dettaglio-pedana')
    await expect(finestra).toBeVisible()
    await pagina.waitForTimeout(500)
    await pagina.screenshot({ path: join(FOTO, '32-pedana-risultato.png') })
    await finestra.getByRole('button', { name: 'Misure', exact: true }).click()
    await pagina.screenshot({ path: join(FOTO, '33-pedana-misure.png') })
    await finestra.getByRole('button', { name: 'Come è stato fatto', exact: true }).click()
    await expect(finestra.getByText('Peso corporeo')).toBeVisible()
    // Esc chiude e si resta sulla scheda del paziente, sulla pedana
    await pagina.keyboard.press('Escape')
    await expect(finestra).toBeHidden()
    await expect(pagina.getByRole('heading', { name: 'Test con pedana' })).toBeVisible()

    // la stabilometria: tracciato con ovale, poi oscillazione, report
    await elenco.filter({ hasText: 'Bipodalico, occhi aperti' }).click()
    await expect(finestra.getByText('Tracciato del centro di pressione')).toBeVisible()
    await expect(finestra.locator('.grafico-stabilogramma polygon')).toHaveCount(1)
    await expect(finestra.getByText('Oscillazione nel tempo')).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '36-pedana-stabilometria.png') })
    await finestra.getByRole('button', { name: 'Report sintetico', exact: true }).click()
    await expect(finestra.locator('.report-sintetico-pedana p')).not.toBeEmpty()
    await pagina.screenshot({ path: join(FOTO, '38-pedana-report.png') })
    // la X in alto chiude come Esc
    await finestra.getByRole('button', { name: 'Chiudi', exact: true }).first().click()
    await expect(finestra).toBeHidden()

    // il report dei test scelti: si apre in una finestra a parte
    await pagina.getByRole('button', { name: 'Report', exact: true }).click()
    await expect(pagina.getByRole('heading', { name: 'Report dei test con pedana' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Apri il report' })).toBeDisabled()
    await pagina.locator('.modal .checkbox-inline').first().locator('input').check()
    await pagina.locator('.modal .checkbox-inline').nth(1).locator('input').check()
    await pagina.screenshot({ path: join(FOTO, '41-pedana-report-scelta.png') })
    const [finestraReport] = await Promise.all([
      prova.app.waitForEvent('window'),
      pagina.getByRole('button', { name: 'Apri il report' }).click()
    ])
    await finestraReport.waitForLoadState('domcontentloaded')
    await expect(finestraReport.getByText('Test con pedana').first()).toBeVisible()
    await finestraReport.screenshot({ path: join(FOTO, '42-pedana-report.png') })
    await finestraReport.close()
    await expect(pagina.getByRole('heading', { name: 'Report dei test con pedana' })).toBeHidden()

    // il cestino sulla riga elimina il test (dopo la conferma)
    const prima = await elenco.count()
    const riga = elenco.filter({ hasText: 'Forza isometrica' }).locator('xpath=..')
    await riga.getByTitle('Elimina questo test').click()
    // Esc nella domanda dice no e non chiude altro
    await pagina.keyboard.press('Escape')
    await expect(elenco).toHaveCount(prima)
    await riga.getByTitle('Elimina questo test').click()
    await pagina.getByRole('button', { name: 'Elimina', exact: true }).click()
    await expect(elenco).toHaveCount(prima - 1)

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})

test('pedana: la stabilometria sinistra e destra stanno affiancate, con ovale e stessa scala', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await importaEsempio(prova)
    await pagina
      .locator('.elenco-pedana .riga-pedana')
      .filter({ hasText: 'Monopodalico, occhi aperti' })
      .click()
    const finestra = pagina.locator('.dettaglio-pedana')
    await expect(finestra.getByText('Tracciato del centro di pressione — piede destro')).toBeVisible()
    await expect(finestra.getByText('Tracciato del centro di pressione — piede sinistro')).toBeVisible()
    await expect(finestra.locator('.grafico-stabilogramma polygon')).toHaveCount(2)
    await expect(finestra.getByText('Oscillazione nel tempo — piede destro')).toBeVisible()
    await expect(finestra.getByText('Oscillazione nel tempo — piede sinistro')).toBeVisible()

    // i due tracciati sono affiancati: stessa altezza sullo schermo
    const caselle = await finestra.locator('.grafico-stabilogramma').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().toJSON())
    )
    expect(caselle).toHaveLength(2)
    expect(Math.abs(caselle[0].top - caselle[1].top)).toBeLessThan(2)
    await finestra.locator('.tracciati-pedana').scrollIntoViewIfNeeded()
    await pagina.screenshot({ path: join(FOTO, '39-pedana-tracciati-lati.png') })
    await finestra.locator('.curve-pedana').scrollIntoViewIfNeeded()
    await pagina.screenshot({ path: join(FOTO, '40-pedana-oscillazione-lati.png') })

    await finestra.getByRole('button', { name: 'Misure', exact: true }).click()
    await expect(finestra.getByText('Destro').first()).toBeVisible()
    await expect(finestra.getByText('Sinistro').first()).toBeVisible()
    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
