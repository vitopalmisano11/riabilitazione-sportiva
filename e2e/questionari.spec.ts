// Il modo di calcolo di un punteggio si sceglie nell'editor del questionario e
// resta scelto.
import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

test('questionari: il punteggio in percentuale si sceglie e resta', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await pagina.evaluate(async () => {
      const api = window.api
      const cat = await api.questionariCategorie.create('Colonna')
      const qid = await api.questionari.create('Mini ODI', cat)
      const q = await api.questionari.get(qid)
      await api.questionari.salva({
        ...q,
        domande: [1, 2, 3].map((n) => ({
          id: -n,
          testo: `Domanda ${n}`,
          tipo: 'scala' as const,
          scala_min: 0,
          scala_max: 5,
          etichetta_min: null,
          etichetta_max: null,
          opzioni: []
        })),
        punteggi: [{ id: -101, nome: 'Totale', tipo: 'somma', domanda_ids: [-1, -2, -3] }]
      })
    })

    await vaiA(pagina, 'Configurazione')
    await pagina.getByRole('button', { name: 'Questionari', exact: true }).click()
    await pagina.getByText('Colonna', { exact: true }).first().click()
    await pagina.getByText('Mini ODI', { exact: true }).first().click()
    await pagina.getByRole('button', { name: 'Punteggi', exact: true }).click()

    const calcolo = pagina.locator('label', { hasText: 'Come si calcola' }).locator('.menu-scelta-bottone')
    await expect(calcolo).toContainText('Somma delle risposte')
    await calcolo.click()
    await pagina.locator('.menu-scelta-popup').getByRole('button', { name: 'Percentuale del massimo (0–100)' }).click()
    await expect(pagina.getByText('Come l’ODI o l’IKDC soggettivo', { exact: false })).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '12-punteggi-questionario.png'), fullPage: true })
    await pagina.getByRole('button', { name: 'Salva questionario' }).click()

    // riletto dall'archivio
    await expect
      .poll(() =>
        pagina.evaluate(async () => {
          const elenco = await window.api.questionari.list(false)
          const q = await window.api.questionari.get(elenco.find((x) => x.nome === 'Mini ODI')!.id)
          return q.punteggi.map((p) => p.tipo)
        })
      )
      .toEqual(['percentuale'])
    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
