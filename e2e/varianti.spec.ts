// Le varianti di un esercizio, gesto per gesto: si scrivono sull'esercizio in
// libreria, diventano uno step della progressione, e in seduta il menu compare
// solo sugli esercizi che ne hanno (equilibrio normale o con uno stimolo).
import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

// Due esercizi (uno senza varianti), una patologia con una fase e la sua
// struttura, la progressione dell'equilibrio e un paziente in quella fase.
async function prepara(pagina: Page): Promise<void> {
  await pagina.evaluate(async () => {
    const api = window.api
    const cat = await api.categorie.create('Propriocezione')
    const esercizio = (nome: string) =>
      api.esercizi.create({
        nome,
        categoria_id: cat,
        serie_default: '3',
        cluster_default: null,
        ripetizioni_default: '30"',
        rir_default: null,
        carico_default: null,
        unita_carico: null,
        recupero_cluster_default: null,
        recupero_default: null,
        nota_tecnica: null,
        link: null
      })
    const equilibrio = await esercizio('Equilibrio monopodalico')
    await esercizio('Plank')
    const prog = await api.progressioni.create('Equilibrio', null)
    await api.progressioni.aggiungiStep(prog, equilibrio, null)
    await api.progressioni.aggiungiStep(prog, equilibrio, null)
    const pat = await api.patologie.create('LCA')
    const fase = await api.fasi.create(pat, 'Fase 2')
    const sez = await api.sezioni.create(fase, 'Propriocezione')
    await api.sezioni.setCategorie(sez, [cat])
    // una seconda sezione, d'altro tipo: le progressioni non vanno suggerite li'
    const catMobilita = await api.categorie.create('Mobilizzazione')
    const sezMobilita = await api.sezioni.create(fase, 'Mobilizzazione')
    await api.sezioni.setCategorie(sezMobilita, [catMobilita])
    await api.progressioni.impostaFase(fase, { gruppo_ids: [], progressione_ids: [prog] })
    await api.pazienti.create({
      nome: 'Marco',
      cognome: 'Varianti',
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
  await pagina.locator('main').getByText('Varianti Marco', { exact: true }).click()
  await expect(pagina.getByRole('heading', { name: 'Varianti Marco' })).toBeVisible()
}

const riga = (pagina: Page, nome: string) => pagina.locator('.righe-seduta li', { hasText: nome })
const CONTEGGIO = "con conteggio all'indietro"

test('varianti: dalla libreria alla progressione e alla seduta', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await prepara(pagina)

    // ---- le varianti si scrivono sull'esercizio
    await vaiA(pagina, 'Configurazione')
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Libreria esercizi' }).click()
    await pagina.getByPlaceholder('Cerca categoria, distretto o esercizio…').fill('Equilibrio')
    await pagina.locator('.tabella-esercizi tbody tr', { hasText: 'Equilibrio monopodalico' }).getByTitle('Modifica').click()
    const segnaposto = pagina.getByPlaceholder("es. con conteggio all'indietro")
    await expect(segnaposto).toHaveCount(0)
    await pagina.getByRole('button', { name: 'Aggiungi una variante' }).click()
    await segnaposto.nth(0).fill(CONTEGGIO)
    await pagina.getByRole('button', { name: 'Aggiungi una variante' }).click()
    await segnaposto.nth(1).fill('con luci reattive')
    await pagina.locator('.modal').screenshot({ path: join(FOTO, '30-varianti-esercizio.png') })
    await pagina.getByRole('button', { name: 'Salva', exact: true }).click()
    await pagina.screenshot({ path: join(FOTO, '33-varianti-elenco.png') })
    // l'elenco dice quali esercizi ne hanno; quelli senza restano come prima
    await expect(pagina.locator('.tabella-esercizi tbody tr', { hasText: 'Equilibrio monopodalico' })).toContainText(
      '2 varianti'
    )
    await pagina.getByPlaceholder('Cerca categoria, distretto o esercizio…').fill('Plank')
    await expect(pagina.locator('.tabella-esercizi tbody tr', { hasText: 'Plank' })).not.toContainText('variant')

    // ---- il secondo step della scala e' la variante
    await pagina.getByPlaceholder('Cerca categoria, distretto o esercizio…').fill('')
    await pagina.getByRole('button', { name: 'Progressioni', exact: true }).click()
    await pagina.locator('.elenco-prog li', { hasText: 'Equilibrio' }).click()
    const passi = pagina.locator('.step-editor li')
    await expect(passi).toHaveCount(2)
    await passi.nth(1).locator('select').selectOption({ label: CONTEGGIO })
    await expect(passi.nth(1)).toContainText(`Equilibrio monopodalico — ${CONTEGGIO}`)
    await expect(passi.nth(0).locator('select')).toHaveValue('')
    await pagina.locator('.step-editor').screenshot({ path: join(FOTO, '31-varianti-progressione.png') })

    // ---- in seduta: lo step con la variante entra con la variante
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').nth(0).click()
    const suggeriti = pagina.locator('.suggeriti-prog')
    await expect(suggeriti).toContainText(`Equilibrio monopodalico — ${CONTEGGIO}`)
    // nella sezione di mobilizzazione la progressione dell'equilibrio non si suggerisce
    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').nth(1).click()
    await expect(pagina.getByText('Scegli un esercizio da aggiungere a “Mobilizzazione”')).toBeVisible()
    await expect(suggeriti).toHaveCount(0)
    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').nth(0).click()
    await expect(suggeriti).toContainText(`Equilibrio monopodalico — ${CONTEGGIO}`)
    await suggeriti.locator('li.successivo').getByRole('button').click()
    await pagina.getByTitle('Aggiungi Plank').click()

    // il menu c'e' solo sull'esercizio che ha delle varianti
    const menu = riga(pagina, 'Equilibrio monopodalico').getByLabel('Variante di Equilibrio monopodalico')
    await expect(menu).toHaveValue(CONTEGGIO)
    await expect(riga(pagina, 'Plank').locator('select')).toHaveCount(0)
    await pagina.screenshot({ path: join(FOTO, '32-varianti-seduta.png'), fullPage: true })

    // si cambia dal menu, e "normale" vuol dire nessuna variante
    await menu.selectOption({ label: 'con luci reattive' })
    await expect(menu).toHaveValue('con luci reattive')
    await menu.selectOption({ label: 'normale' })
    await expect(menu).toHaveValue('')
    await menu.selectOption({ label: 'con luci reattive' })
    await pagina.getByRole('button', { name: /Salva seduta \(2 esercizi\)/ }).click()

    // riaperta, la variante c'e'
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Diario sedute' }).click()
    await pagina.getByTitle('Modifica la seduta').first().click()
    await expect(
      riga(pagina, 'Equilibrio monopodalico').getByLabel('Variante di Equilibrio monopodalico')
    ).toHaveValue('con luci reattive')
    await pagina.getByRole('button', { name: 'Annulla' }).first().click()

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
