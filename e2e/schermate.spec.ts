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
    // le copie e le cartelle sono gia' pronte: niente «Caricamento…» nemmeno per un istante
    expect(await pagina.getByText('Caricamento…').count()).toBe(0)
    await expect(pagina.getByText('Copie di sicurezza', { exact: false }).first()).toBeVisible()
    await expect(pagina.getByText('Cartella dei dati', { exact: false }).first()).toBeVisible()
    await expect(pagina.getByText('Cestino', { exact: false }).first()).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '15-impostazioni-dati.png'), fullPage: true })
    // la spiegazione dei dati sta nella Guida, non piu' in una finestra qui
    await expect(pagina.getByText('Come vengono conservati', { exact: false })).toHaveCount(0)

    await pagina.getByRole('button', { name: 'Guida', exact: true }).click()
    const campo = pagina.getByLabel('Cerca nella guida')
    await expect(campo).toBeVisible()
    // l'elenco mostra i titoli; il testo si legge solo aprendone uno
    await expect(pagina.getByRole('button', { name: /Esercizi in libreria/ })).toBeVisible()
    await expect(pagina.locator('.guida-testo')).toHaveCount(0)
    await pagina.screenshot({ path: join(FOTO, '16-impostazioni-guida.png'), fullPage: true })

    // un clic su un titolo apre la finestra con quell'argomento
    await pagina.getByRole('button', { name: /Dati, copie e chiave di recupero/ }).click()
    await expect(pagina.getByRole('heading', { name: 'Dati, copie e chiave di recupero' })).toBeVisible()
    await expect(pagina.getByText('Se il computer si rompe', { exact: true })).toBeVisible()
    // l'entrata della finestra dura un attimo: lo scatto parte a cose ferme
    await pagina.waitForTimeout(400)
    await pagina.screenshot({ path: join(FOTO, '16b-impostazioni-guida-aperta.png'), fullPage: true })
    // Esc chiude la finestra
    await pagina.keyboard.press('Escape')
    await expect(pagina.locator('.guida-testo')).toHaveCount(0)
    // anche il pulsante Chiudi
    await pagina.getByRole('button', { name: /Esercizi in libreria/ }).click()
    await expect(pagina.locator('.guida-testo')).toBeVisible()
    await pagina.locator('.modal-guida').getByRole('button', { name: 'Chiudi' }).click()
    await expect(pagina.locator('.guida-testo')).toHaveCount(0)

    // si cerca: l'elenco si restringe e si apre la voce che si sceglie
    await campo.fill('sedute a settimana')
    await expect(pagina.getByRole('button', { name: /Dose per seduta e per settimana/ })).toBeVisible()
    await expect(pagina.getByRole('button', { name: /Dati, copie e chiave di recupero/ })).toHaveCount(0)
    await pagina.getByRole('button', { name: /Dose per seduta e per settimana/ }).click()
    await expect(pagina.getByRole('heading', { name: 'Dose per seduta e per settimana' })).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '17-impostazioni-guida-ricerca.png'), fullPage: true })
    await pagina.locator('.modal-guida').getByRole('button', { name: 'Chiudi' }).click()
    await campo.fill('zzzz')
    await expect(pagina.getByText('Nessun argomento parla di', { exact: false })).toBeVisible()
    // Esc svuota la ricerca e riporta l'elenco intero
    await campo.press('Escape')
    await expect(campo).toHaveValue('')
    await expect(pagina.getByRole('button', { name: /Dati, copie e chiave di recupero/ })).toBeVisible()

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
    await pagina.getByLabel('Storia precedente').fill('Distorsione due anni fa, un mese di fisioterapia')
    await pagina.getByRole('button', { name: 'Aggiungi sintomo' }).click()
    await expect(pagina.getByText('Nuova misurazione', { exact: false }).first()).toBeHidden()
    await pagina.screenshot({ path: join(FOTO, '16-anamnesi-prossima.png'), fullPage: true })
    // si salva da solo: riaprendola il motivo c'e'
    await pagina.waitForTimeout(2200)
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('heading', { name: 'Anamnesi prossima' })).toBeHidden()
    await pagina.getByTitle('Anamnesi prossima').click()
    await expect(pagina.getByPlaceholder(/Che cosa la porta qui/)).toHaveValue(/tre settimane/)
    await expect(pagina.getByLabel('Storia precedente')).toHaveValue(/Distorsione due anni fa/)
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
