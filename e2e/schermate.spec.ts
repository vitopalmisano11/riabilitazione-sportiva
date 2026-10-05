// Le schermate grandi (impostazioni, anamnesi prossima, valutazione obiettiva)
// si aprono e si usano: ognuna e' fatta di piu' file, e un nome o un import
// sbagliato in uno di essi si vedrebbe solo aprendola. Una prova che lascia
// errori nella console non passa (vedi app.ts).
import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, nuovoPaziente, vaiA } from './app'

test('impostazioni: ogni scheda si apre', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await vaiA(pagina, 'Impostazioni')
    await expect(pagina.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()

    await pagina.getByRole('button', { name: 'Profilo', exact: true }).click()
    await expect(pagina.getByText('Chi firma i fogli', { exact: false })).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '13-impostazioni-profilo.png'), fullPage: true })

    await pagina.getByRole('button', { name: 'Accesso e aspetto', exact: true }).click()
    await expect(pagina.getByText('Cambia password', { exact: false }).first()).toBeVisible()
    await expect(pagina.getByText('Recupero della password', { exact: false }).first()).toBeVisible()
    await expect(pagina.getByText('Colore dell', { exact: false }).first()).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '14-impostazioni-accesso.png'), fullPage: true })

    await pagina.getByRole('button', { name: 'Dati e backup', exact: true }).click()
    await expect(pagina.getByText('Cartella dei dati', { exact: false }).first()).toBeVisible()
    await expect(pagina.getByText('Cestino', { exact: false }).first()).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '15-impostazioni-dati.png'), fullPage: true })

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})

test('clinica: anamnesi prossima e valutazione obiettiva si aprono e si salvano', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    // un archivio nuovo non ha distretti: se ne crea uno con un movimento e due test
    await pagina.evaluate(async () => {
      const api = window.api
      const id = await api.distretti.create('Spalla')
      const d = await api.distretti.get(id)
      await api.distretti.salva({
        ...d,
        movimenti: [{ id: null, nome: 'Flessione', gradi: 1 }],
        test: [
          { id: null, nome: 'Test di Neer', gruppo: 'provocazione', risposta: 'posneg' },
          { id: null, nome: 'Rotazione esterna', gruppo: 'forza', risposta: 'scala5' }
        ]
      })
    })
    await nuovoPaziente(pagina, { nome: 'Anna', cognome: 'Clinica' })
    await pagina.getByRole('button', { name: 'Clinica', exact: true }).click()

    // anamnesi prossima: motivo, un sintomo, e i grafici che compaiono col sintomo
    await pagina.getByTitle('Anamnesi prossima').click()
    await expect(pagina.getByRole('heading', { name: 'Anamnesi prossima' })).toBeVisible()
    await pagina.getByPlaceholder(/Che cosa la porta qui/).fill('Dolore alla spalla da tre settimane')
    await pagina.getByRole('button', { name: 'Aggiungi sintomo' }).click()
    await expect(pagina.getByText('Nuova misurazione', { exact: false }).first()).toBeHidden()
    await pagina.screenshot({ path: join(FOTO, '16-anamnesi-prossima.png'), fullPage: true })
    // si salva da solo: riaprendola il motivo c'e'
    await pagina.waitForTimeout(2200)
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('heading', { name: 'Anamnesi prossima' })).toBeHidden()
    await pagina.getByTitle('Anamnesi prossima').click()
    await expect(pagina.getByPlaceholder(/Che cosa la porta qui/)).toHaveValue(/tre settimane/)
    await expect(pagina.getByText('Aggiungi sintomo')).toBeVisible()
    // Esc non chiude con il cursore in una casella di testo (vedi scorciatoie.ts)
    await pagina.getByRole('heading', { name: 'Anamnesi prossima' }).click()
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('heading', { name: 'Anamnesi prossima' })).toBeHidden()

    // valutazione obiettiva: si sceglie un distretto e si apre la scheda con le tabelle
    await pagina.getByTitle('Nuova valutazione').click()
    const distretto = pagina.locator('.scelte-questionari button').first()
    await expect(distretto).toBeVisible()
    await distretto.click()
    await expect(pagina.getByRole('heading', { name: /Valutazione obiettiva — modifica/ })).toBeVisible()
    await expect(pagina.getByText('Flessione').first()).toBeVisible()
    await expect(pagina.getByText('Test di Neer').first()).toBeVisible()
    await pagina.waitForTimeout(500) // la finestra compare con una dissolvenza
    await pagina.screenshot({ path: join(FOTO, '17-valutazione.png'), fullPage: true })

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
