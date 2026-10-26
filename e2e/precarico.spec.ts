// Premendo una linguetta della configurazione le schede ci sono gia' al primo
// disegno della pagina: non compare prima la pagina vuota e poi le schede
// (src/renderer/src/precarico.ts).
import { test, expect } from '@playwright/test'
import { avvia, creaArchivio, vaiA } from './app'

test('configurazione: le schede ci sono gia\' quando la pagina compare', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await pagina.evaluate(async () => {
      await window.api.categorie.create('Rinforzo')
      await window.api.categorie.create('Mobilità')
    })

    await vaiA(pagina, 'Configurazione')
    await expect(pagina.locator('.config-tabs-top')).toBeVisible()
    // il tempo di leggere gli elenchi, che parte appena si entra
    await pagina.waitForTimeout(800)

    // Si guarda cosa c'e' nella pagina nell'istante stesso in cui compare il suo
    // titolo, prima che arrivi qualunque lettura: senza il precarico e' vuota.
    const schede = await pagina.evaluate(
      () =>
        new Promise<number>((risolvi) => {
          const osservatore = new MutationObserver(() => {
            if (Array.from(document.querySelectorAll('h2')).some((h) => h.textContent === 'Libreria esercizi')) {
              osservatore.disconnect()
              risolvi(document.querySelectorAll('.scelta-tile').length)
            }
          })
          osservatore.observe(document.body, { childList: true, subtree: true })
          const linguetta = Array.from(document.querySelectorAll('.config-tabs-top button')).find(
            (b) => b.textContent === 'Libreria esercizi'
          ) as HTMLElement
          linguetta.click()
        })
    )
    expect(schede).toBe(2)

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
