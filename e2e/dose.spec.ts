// La dose della fase e il monopodalico, gesto per gesto: la categoria si conta
// come pliometria o forza, la fase prende i numeri degli appunti con un clic, il
// paziente ha le sue sedute a settimana, e in seduta una riga sola dice se ci
// siamo. Il bottoncino Bipodalico/Monopodalico c'e' solo sugli esercizi a scelta.
import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

async function prepara(pagina: Page): Promise<void> {
  await pagina.evaluate(async () => {
    const api = window.api
    const rinforzo = await api.categorie.create('Rinforzo')
    await api.categorie.setContaCome(rinforzo, 'forza')
    const quad = await api.categorie.create('Quadricipite')
    await api.categorie.setPadre(quad, rinforzo)
    const ham = await api.categorie.create('Hamstring')
    await api.categorie.setPadre(ham, rinforzo)
    const plio = await api.categorie.create('Pliometria')
    const esercizio = (nome: string, categoria_id: number, serie: string, rip: string, gambe: 'due' | 'scelta' | 'una') =>
      api.esercizi.create({
        nome,
        categoria_id,
        serie_default: serie,
        cluster_default: null,
        ripetizioni_default: rip,
        rir_default: null,
        carico_default: null,
        unita_carico: null,
        recupero_cluster_default: null,
        recupero_default: null,
        nota_tecnica: null,
        link: null,
        gambe
      })
    await esercizio('Leg extension', quad, '3', '10', 'due')
    await esercizio('Leg curl', ham, '3', '10', 'due')
    await esercizio('Single leg hop', plio, '3', '10', 'una')
    await esercizio('Broad jump', plio, '2', '15', 'scelta')
    const pat = await api.patologie.create('LCA')
    const fase = await api.fasi.create(pat, 'RTP 1')
    const sezPlio = await api.sezioni.create(fase, 'Pliometria')
    await api.sezioni.setCategorie(sezPlio, [plio])
    const sezForza = await api.sezioni.create(fase, 'Forza')
    await api.sezioni.setCategorie(sezForza, [rinforzo])
    await api.pazienti.create({
      nome: 'Luca',
      cognome: 'Dose',
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
  await pagina.locator('main').getByText('Dose Luca', { exact: true }).click()
  await expect(pagina.getByRole('heading', { name: 'Dose Luca' })).toBeVisible()
}

const riga = (pagina: Page, nome: string) => pagina.locator('.righe-seduta li', { hasText: nome })

test('dose: la categoria si conta, la fase prende i numeri, la seduta dice se ci siamo', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await prepara(pagina)

    // ---- la pliometria si conta in contatti: si sceglie sulla categoria
    await vaiA(pagina, 'Configurazione')
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Libreria esercizi' }).click()
    // i comandi della piastrella compaiono passandoci sopra
    const piastrella = pagina.locator('.scelta-tile', { hasText: 'Pliometria' })
    await piastrella.hover()
    await piastrella.getByTitle('Modifica').click()
    await pagina.locator('.modal label', { hasText: 'Nel conto della dose' }).locator('.menu-scelta-bottone').click()
    await pagina.locator('.menu-scelta-popup').getByRole('button', { name: /Pliometria estensiva/ }).click()
    await pagina.locator('.modal').screenshot({ path: join(FOTO, '40-dose-categoria.png') })
    await pagina.locator('.modal').getByRole('button', { name: 'Salva' }).click()
    await expect(pagina.locator('.scelta-tile', { hasText: 'Pliometria' }).locator('.badge')).toHaveText(
      'pliometria est.'
    )

    // ---- la fase prende i numeri degli appunti con un clic
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Patologie e fasi' }).click()
    await pagina.getByText('LCA', { exact: true }).first().click()
    await pagina.getByText('RTP 1', { exact: true }).first().click()
    await pagina.locator('.config-tabs').getByRole('button', { name: 'Dose', exact: true }).click()
    await pagina.locator('.modelli-dose').getByRole('button', { name: 'RTP 1' }).click()
    await expect(pagina.getByLabel('Pliometria estensiva, da')).toHaveValue('80')
    await expect(pagina.getByLabel('Pliometria estensiva, a')).toHaveValue('120')
    await expect(pagina.getByLabel('Quadricipite, da')).toHaveValue('3')
    await expect(pagina.getByLabel('Hamstring, da')).toHaveValue('3')
    await pagina.screenshot({ path: join(FOTO, '41-dose-fase.png'), fullPage: true })

    // ---- il paziente fa tre sedute a settimana
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Percorso', exact: true }).click()
    await pagina.getByLabel('Sedute a settimana').fill('3')
    await pagina.getByLabel('Sedute a settimana').press('Enter')

    // ---- in seduta: la riga della dose e il monopodalico
    await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
    const dose = pagina.locator('.riga-dose')
    await expect(dose).toContainText('Pliometria est. 0')
    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').nth(0).click()
    await pagina.getByTitle('Aggiungi Single leg hop').click()
    await pagina.getByTitle('Aggiungi Broad jump').click()
    // il bottoncino c'e' solo sull'esercizio "a scelta"
    await expect(riga(pagina, 'Single leg hop').locator('.btn-monopodalico')).toHaveCount(0)
    // single leg hop 3 × 10 a una gamba = 60, broad jump 2 × 15 = 30
    await expect(dose.locator('.voce-dose', { hasText: 'Pliometria' })).toHaveText(/90/)
    await riga(pagina, 'Broad jump').getByRole('button', { name: 'Bipodalico' }).click()
    await expect(riga(pagina, 'Broad jump').getByRole('button', { name: 'Monopodalico' })).toBeVisible()
    await expect(dose.locator('.voce-dose', { hasText: 'Pliometria' })).toHaveText(/120/)
    await expect(dose.locator('.voce-dose', { hasText: 'Pliometria' })).toHaveClass(/ok/)

    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').nth(1).click()
    await pagina.getByTitle('Aggiungi Leg extension').click()
    await expect(dose.locator('.voce-dose', { hasText: 'Quadricipite' })).toHaveClass(/ok/)
    await expect(dose.locator('.voce-dose', { hasText: 'Hamstring' })).toHaveClass(/poco/)
    await dose.locator('.riga-dose-sintesi').click()
    await expect(dose).toContainText('in settimana 0 su almeno 9')
    await pagina.screenshot({ path: join(FOTO, '42-dose-seduta.png'), fullPage: true })
    await pagina.getByRole('button', { name: /Salva seduta \(3 esercizi\)/ }).click()

    // riaperta, il segno c'e'
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Diario sedute' }).click()
    await pagina.getByTitle('Modifica la seduta').first().click()
    await expect(riga(pagina, 'Broad jump').getByRole('button', { name: 'Monopodalico' })).toBeVisible()
    await pagina.getByRole('button', { name: 'Annulla' }).first().click()

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
