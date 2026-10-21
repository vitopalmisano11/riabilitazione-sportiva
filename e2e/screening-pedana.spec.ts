// Screening: salvando si torna alla schermata del paziente con tutti i suoi
// screening, Esc chiude le finestre, e nel report si possono richiamare i test
// della pedana (anche partendo dallo screening aperto).
import { test, expect } from '@playwright/test'
import { join, resolve } from 'node:path'
import { avvia, creaArchivio, FOTO, nuovoPaziente, vaiA } from './app'

test('screening: salva e torna al paziente, Esc, test della pedana nel report', async () => {
  const prova = await avvia()
  try {
    const { pagina, app } = prova
    await creaArchivio(pagina)
    await nuovoPaziente(pagina, { nome: 'Mario', cognome: 'Rossi' })

    // il file della pedana nel paziente
    const file = resolve(__dirname, '..', 'docs', 'esempio.pedana.json')
    await app.evaluate(({ dialog }, percorso) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [percorso] })
    }, file)
    await pagina.getByRole('button', { name: 'Pedana', exact: true }).click()
    await pagina.getByRole('button', { name: 'Importa', exact: true }).click()
    await pagina.getByRole('button', { name: /^Importa \(/ }).click()
    await expect(pagina.locator('.elenco-pedana .riga-pedana').first()).toBeVisible()

    // un protocollo con un test e una misura
    await pagina.evaluate(async () => {
      const api = window.api
      const cat = await api.testCategorie.create('Salti')
      const test = await api.testValutazione.create('CMJ', cat)
      const t = await api.testValutazione.get(test)
      await api.testValutazione.salva({
        ...t,
        misure: [
          {
            id: null,
            nome: 'Altezza',
            unita: 'cm',
            per_prova: 0,
            riassunto: 'migliore',
            cutoff: null,
            cutoff_direzione: null,
            riferimento: null,
            calcolo: null,
            calcolo_a: null,
            calcolo_b: null
          }
        ]
      })
      const prot = await api.screening.create('Off season', 'Calcio')
      const p = await api.screening.get(prot)
      await api.screening.salva({
        ...p,
        sezioni: [{ id: null, nome: 'Salti', voci: [{ id: null, test_id: test, questionario_id: null }] }]
      })
    })

    // nuovo screening dal menu
    await vaiA(pagina, 'Return To Play')
    await pagina.getByTitle('Nuovo screening').click()
    // Esc chiude la finestra
    await expect(pagina.getByRole('heading', { name: 'Nuovo screening' })).toBeVisible()
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('heading', { name: 'Nuovo screening' })).toBeHidden()
    await pagina.getByTitle('Nuovo screening').click()
    await pagina.getByLabel('Paziente').click()
    await pagina.getByText('Rossi Mario').click()
    await pagina.getByLabel('Protocollo').click()
    await pagina.getByText('Calcio · Off season').click()
    await pagina.getByRole('button', { name: 'Comincia' }).click()

    // la compilazione: si scrive un valore e si salva
    await expect(pagina.locator('.pagina-compila-screening')).toBeVisible()
    await pagina.locator('.sezione-screening input[type="text"], .sezione-screening input:not([type])').first().fill('30')
    await pagina.getByRole('button', { name: 'Salva' }).click()
    // si torna alla schermata del paziente con tutti i suoi screening
    await expect(pagina.getByRole('heading', { name: /Rossi Mario/ })).toBeVisible()
    await expect(pagina.getByText('Screening svolti')).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '50-screening-paziente.png') })

    // Report dalla schermata del paziente: ci sono i test della pedana; Esc chiude
    await pagina.getByRole('button', { name: 'Report' }).click()
    await expect(pagina.getByText('Test con pedana (facoltativo)')).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '51-screening-report-pedana.png') })
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByText('Test con pedana (facoltativo)')).toBeHidden()
    // Esc di nuovo: torna all'elenco dei pazienti
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByText('Pazienti con screening')).toBeVisible()

    // Report dallo screening aperto: stessa scelta dei test della pedana
    await pagina.getByTitle('Vedi i suoi screening').first().click()
    await pagina.getByTitle('Apri lo screening').first().click()
    await pagina.getByRole('button', { name: 'Report' }).click()
    await expect(pagina.getByText('Test con pedana (facoltativo)')).toBeVisible()
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByText('Test con pedana (facoltativo)')).toBeHidden()
    // Esc dallo screening aperto: torna agli screening del paziente
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByText('Screening svolti')).toBeVisible()

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
