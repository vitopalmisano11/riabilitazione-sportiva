// Le progressioni di esercizi a step, gesto per gesto: la scala nella libreria,
// il collegamento alla fase, i suggerimenti e l'esito in seduta, lo specchietto
// nella scheda del paziente. Servono solo a programmare: niente di questo deve
// comparire altrove.
import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

// Tre esercizi, una patologia con una fase e un paziente in quella fase.
async function prepara(pagina: Page): Promise<void> {
  await pagina.evaluate(async () => {
    const api = window.api
    const cat = await api.categorie.create('Pliometria')
    for (const nome of ['Wall sit', 'Front squat', 'Drop catch 2 leg']) {
      await api.esercizi.create({
        nome,
        categoria_id: cat,
        serie_default: '3',
        cluster_default: null,
        ripetizioni_default: '8',
        rir_default: null,
        carico_default: null,
        unita_carico: null,
        recupero_cluster_default: null,
        recupero_default: null,
        nota_tecnica: null,
        link: null
      })
    }
    const pat = await api.patologie.create('LCA')
    const fase = await api.fasi.create(pat, 'Intermedia')
    const sez = await api.sezioni.create(fase, 'Forza')
    await api.sezioni.setCategorie(sez, [cat])
    await api.pazienti.create({
      nome: 'Marco',
      cognome: 'Progressioni',
      data_nascita: null,
      codice_fiscale: null,
      telefono: null,
      email: null,
      lavoro: null,
      inviato_da: null,
      sport: null,
      diagnosi: null,
      tipo_intervento: null,
      data_intervento: null,
      precauzioni: null,
      arto_operato: null,
      gruppo_id: null,
      patologia_id: pat,
      fase_corrente_id: fase
    })
  })
}

async function apriPaziente(pagina: Page): Promise<void> {
  await vaiA(pagina, 'Pazienti')
  await expect(pagina.getByPlaceholder('Cerca paziente…')).toBeVisible()
  await pagina.locator('main').getByText('Progressioni Marco', { exact: true }).click()
  await expect(pagina.getByRole('heading', { name: 'Progressioni Marco' })).toBeVisible()
}

test('progressioni: dalla libreria alla seduta e allo specchietto', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await prepara(pagina)

    // ---- la scala, nella libreria
    await vaiA(pagina, 'Configurazione')
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Libreria esercizi' }).click()
    await pagina.getByRole('button', { name: 'Progressioni', exact: true }).click()
    await pagina.getByRole('button', { name: 'Gruppo', exact: true }).click()
    await pagina.getByPlaceholder('es. Braking strategies').fill('Braking strategies')
    await pagina.getByPlaceholder('es. Braking strategies').press('Enter')
    await expect(pagina.locator('.prog-gruppo', { hasText: 'Braking strategies' })).toBeVisible()

    await pagina.getByRole('button', { name: 'Progressione', exact: true }).click()
    await pagina.getByPlaceholder('es. Vertical braking').fill('Vertical braking')
    await pagina.locator('.add-row-gruppo .apri-scelta').click()
    await pagina.locator('.elenco-scelta').getByRole('button', { name: 'Braking strategies' }).click()
    await pagina.getByRole('button', { name: 'OK', exact: true }).click()
    // creata e subito aperta, con i criteri generali gia' scritti
    await expect(pagina.getByLabel('Criteri per passare allo step dopo')).toHaveValue(/Competenza, nessun dolore/)

    // la ricerca resta aperta dopo ogni aggiunta: se ne mettono tre di fila
    await pagina.getByRole('button', { name: 'Step', exact: true }).click()
    for (const nome of ['Wall sit', 'Front squat', 'Drop catch 2 leg']) {
      await pagina.getByPlaceholder("Cerca l'esercizio nella libreria…").fill(nome)
      await pagina.getByTitle(`Aggiungi ${nome}`).click()
      await expect(pagina.locator('.step-editor li', { hasText: nome })).toBeVisible()
    }
    await pagina
      .locator('.step-editor li', { hasText: 'Drop catch 2 leg' })
      .getByPlaceholder('requisito per arrivarci…')
      .fill('solo se il front squat è di qualità')
    await pagina.getByLabel('Criteri per passare allo step dopo').click() // esce dalla casella: salva
    await pagina.locator('.step-editor').screenshot({ path: join(FOTO, '20-progressioni-libreria.png') })

    // un esercizio che e' uno step non si elimina dalla libreria
    await pagina.getByRole('button', { name: 'Esercizi', exact: true }).click()
    await pagina.getByPlaceholder('Cerca esercizio…').fill('Wall sit')
    await pagina.getByTitle('Elimina').first().click()
    await pagina.getByRole('button', { name: /Elimina|Conferma|Sì/ }).last().click()
    await expect(pagina.getByText(/uno step di una progressione/)).toBeVisible()

    // ---- collegata alla fase
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Patologie e fasi' }).click()
    await pagina.getByText('LCA', { exact: true }).first().click()
    await pagina.getByText('Intermedia', { exact: true }).first().click()
    await pagina.locator('.config-tabs').getByRole('button', { name: 'Progressioni', exact: true }).click()
    await pagina.getByLabel(/Braking strategies/).check()
    await pagina.screenshot({ path: join(FOTO, '21-progressioni-fase.png'), fullPage: true })

    // ---- lo specchietto nella scheda del paziente: primo step da fare
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Percorso', exact: true }).click()
    // una casella per progressione, col nome e lo step (1/3); premendola si apre la scala
    const casella = pagina.locator('.scelta-tile', { hasText: 'Vertical braking' })
    await expect(casella.locator('.badge')).toHaveText('1/3')
    await casella.click()
    const scala = pagina.locator('.modal .scala-prog', { hasText: 'Vertical braking' })
    await expect(scala.locator('.step-prog.attuale')).toContainText('Wall sit')
    await expect(scala.locator('.step-prog.da_sbloccare')).toHaveCount(2)
    await expect(scala.getByText('Requisito: solo se il front squat è di qualità')).toBeVisible()
    await scala.screenshot({ path: join(FOTO, '22-progressioni-specchietto.png') })
    await pagina.locator('.modal').getByRole('button', { name: 'Chiudi', exact: true }).click()

    // ---- in seduta: suggerimenti, specchietto, esito
    await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').click()
    const suggeriti = pagina.locator('.suggeriti-prog')
    await expect(suggeriti).toContainText('Wall sit')
    await suggeriti.screenshot({ path: join(FOTO, '23-progressioni-suggeriti.png') })
    await pagina.getByRole('button', { name: 'Vedi dove siamo' }).click()
    await expect(pagina.getByRole('heading', { name: 'Dove siamo nelle progressioni' })).toBeVisible()
    await pagina.locator('.modal-specchietto').getByRole('button', { name: 'Chiudi', exact: true }).click()

    // nessun pulsante in piu' nelle righe: l'esito sta in fondo, e solo con un esercizio della progressione
    await expect(pagina.locator('.esiti-prog')).toHaveCount(0)
    await suggeriti.getByTitle('Aggiungi Wall sit').click()
    await expect(pagina.locator('.esiti-prog')).toContainText('Vertical braking')
    await pagina.getByRole('button', { name: '↑ Avanza' }).click()
    await pagina.locator('.esiti-prog').screenshot({ path: join(FOTO, '24-progressioni-esito.png') })
    await pagina.getByRole('button', { name: /Salva seduta \(1 esercizi\)/ }).click()

    // ---- lo specchietto si aggiorna: wall sit fatto, front squat da lavorare
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Percorso', exact: true }).click()
    await expect(pagina.locator('.scelta-tile', { hasText: 'Vertical braking' }).locator('.badge')).toHaveText('2/3')
    await pagina.locator('.scelta-tile', { hasText: 'Vertical braking' }).click()
    await expect(scala.locator('.step-prog.fatto')).toContainText('Wall sit')
    await expect(scala.locator('.step-prog.attuale')).toContainText('Front squat')
    await scala.screenshot({ path: join(FOTO, '26-progressioni-dopo-avanza.png') })
    await pagina.locator('.modal').getByRole('button', { name: 'Chiudi', exact: true }).click()

    // la seduta salvata si riapre con l'esito che aveva
    await pagina.getByRole('button', { name: 'Diario sedute' }).click()
    await pagina.getByTitle('Modifica la seduta').first().click()
    await expect(pagina.getByRole('button', { name: '↑ Avanza' })).toHaveClass(/attivo/)
    await pagina.getByRole('button', { name: 'Annulla' }).first().click()

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})

test('paziente: la finestra a due colonne e peso e altezza salvati', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await vaiA(pagina, 'Pazienti')
    await pagina.getByRole('button', { name: 'Nuovo paziente' }).click()
    await pagina.getByLabel('Nome *', { exact: true }).fill('Anna')
    await pagina.getByLabel('Cognome *', { exact: true }).fill('Misure')
    await pagina.getByLabel('Peso (kg)').fill('62,5')
    await pagina.getByLabel('Altezza (cm)').fill('171')
    // dati anagrafici a sinistra, quadro clinico a destra
    const sinistra = await pagina.getByLabel('Nome *', { exact: true }).boundingBox()
    const destra = await pagina.getByLabel('Diagnosi', { exact: true }).boundingBox()
    expect(sinistra && destra && destra.x > sinistra.x + 300).toBe(true)
    await pagina.screenshot({ path: join(FOTO, '25-nuovo-paziente.png') })
    await pagina.getByRole('button', { name: 'Crea paziente' }).click()
    await expect(pagina.getByRole('heading', { name: 'Misure Anna' })).toBeVisible()

    // la linguetta Misure non c'e' piu'; peso e altezza sono nei dati
    await expect(pagina.locator('.barra-scheda').getByRole('button', { name: 'Misure', exact: true })).toHaveCount(0)
    await expect(pagina.getByText('62.5 kg')).toBeVisible()
    await expect(pagina.getByText('171 cm')).toBeVisible()
    await pagina.getByRole('button', { name: 'Percorso', exact: true }).click()
    await expect(pagina.getByRole('heading', { name: 'Massimali' })).toBeVisible()
    await pagina.getByRole('button', { name: 'Clinica', exact: true }).click()
    await expect(pagina.getByText('Segni di riferimento').first()).toBeVisible()

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
