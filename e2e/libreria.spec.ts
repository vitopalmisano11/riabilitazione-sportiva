// La libreria esercizi si apre sulle schede delle categorie: dentro una categoria
// i distretti sono pulsantini sopra i suoi esercizi, e la ricerca per nome li
// trova da fuori.
import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

const esercizio = (nome: string, categoria_id: number) => ({
  nome,
  categoria_id,
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

// Un tipo di lavoro con due distretti e un altro senza distretti.
async function prepara(pagina: Page): Promise<void> {
  await pagina.evaluate(async (def) => {
    const api = window.api
    const rinforzo = await api.categorie.create('Rinforzo')
    const quadricipite = await api.categorie.create('Quadricipite')
    const ischio = await api.categorie.create('Ischiocrurali')
    await api.categorie.setPadre(quadricipite, rinforzo)
    await api.categorie.setPadre(ischio, rinforzo)
    const mobilita = await api.categorie.create('Mobilità')
    await api.esercizi.create({ ...def, nome: 'Leg extension', categoria_id: quadricipite })
    await api.esercizi.create({ ...def, nome: 'Squat bulgaro', categoria_id: quadricipite })
    await api.esercizi.create({ ...def, nome: 'Nordic', categoria_id: ischio })
    await api.esercizi.create({ ...def, nome: 'Gatto-cammello', categoria_id: mobilita })
  }, esercizio('', 0))
}

test('libreria: schede delle categorie, esercizi dentro, ricerca da fuori', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await prepara(pagina)

    await vaiA(pagina, 'Configurazione')
    await pagina.locator('.config-tabs-top').getByRole('button', { name: 'Libreria esercizi' }).click()

    // si apre sulle schede, senza conteggi degli esercizi; niente elenco piatto
    const rinforzo = pagina.locator('.scelta-tile', { hasText: 'Rinforzo' })
    await expect(rinforzo).toContainText('2 distretti')
    await expect(rinforzo).not.toContainText('esercizi')
    await expect(pagina.locator('.tabella-esercizi')).toHaveCount(0)
    await pagina.screenshot({ path: join(FOTO, '22-libreria-categorie.png'), fullPage: true })

    // cercando un esercizio per nome si trova, senza aprire la categoria
    await pagina.getByPlaceholder('Cerca categoria, distretto o esercizio…').fill('nordic')
    await expect(pagina.locator('.tabella-esercizi').getByText('Nordic')).toBeVisible()
    await expect(pagina.locator('.tabella-esercizi tbody tr')).toHaveCount(1)
    await pagina.getByPlaceholder('Cerca categoria, distretto o esercizio…').fill('')

    // dentro la categoria: gli esercizi di tutti i suoi distretti, con la
    // colonna che dice di quale distretto sono
    await rinforzo.click()
    await expect(pagina.locator('.tabella-esercizi tbody tr')).toHaveCount(3)
    await expect(pagina.locator('.tabella-esercizi').getByText('Gatto-cammello')).toHaveCount(0)
    await expect(pagina.locator('.tabella-esercizi th.col-categoria')).toHaveCount(1)
    // i comandi dei distretti restano chiusi finche' non servono
    await expect(pagina.locator('.pannello-distretti')).toHaveCount(0)

    // un distretto restringe l'elenco (e la colonna non serve piu'), «Tutti» lo riallarga
    const pillola = (nome: string) => pagina.locator('.pillola-distretto', { hasText: nome })
    await pillola('Quadricipite').click()
    await expect(pagina.locator('.tabella-esercizi tbody tr')).toHaveCount(2)
    await expect(pagina.locator('.tabella-esercizi th.col-categoria')).toHaveCount(0)
    await pagina.screenshot({ path: join(FOTO, '23-libreria-dentro-categoria.png'), fullPage: true })
    await pillola('Tutti').click()
    await expect(pagina.locator('.tabella-esercizi tbody tr')).toHaveCount(3)

    await pagina.getByRole('button', { name: 'Gestisci distretti' }).click()
    await expect(pagina.locator('.pannello-distretti .elenco-categorie li')).toHaveCount(2)
    await pagina.screenshot({ path: join(FOTO, '24-libreria-gestisci-distretti.png'), fullPage: true })
    await pagina.getByRole('button', { name: 'Gestisci distretti' }).click()

    // un esercizio nuovo nasce gia' nel distretto scelto
    await pillola('Ischiocrurali').click()
    await pagina.getByRole('button', { name: 'Nuovo esercizio' }).click()
    await pagina.getByLabel('Nome *').fill('Ponte monopodalico')
    await pagina.getByRole('button', { name: 'Salva', exact: true }).click()
    await expect(pagina.locator('.tabella-esercizi tbody tr')).toHaveCount(2)
    await expect(pagina.locator('.tabella-esercizi').getByText('Ponte monopodalico')).toBeVisible()

    // senza distretti gli esercizi stanno direttamente nella categoria
    await pagina.getByRole('button', { name: 'Categorie', exact: true }).click()
    await pagina.locator('.scelta-tile', { hasText: 'Mobilità' }).click()
    await expect(pagina.locator('.tabella-esercizi tbody tr')).toHaveCount(1)

    // premere «Esercizi» da dentro una categoria riporta alle schede
    await pagina.locator('.config-tabs').getByRole('button', { name: 'Esercizi', exact: true }).click()
    await expect(pagina.locator('.scelta-tile')).toHaveCount(2)

    // le schede seguono l'ordine di chi usa il programma: all'inizio, quello di creazione
    const nomi = () => pagina.locator('.scelta-tile .scelta-tile-nome').allTextContents()
    await expect.poll(nomi).toEqual(['Rinforzo', 'Mobilità'])
    // trascinando una scheda sull'altra si scambiano, e l'ordine resta salvato
    await pagina.locator('.scelta-tile', { hasText: 'Mobilità' }).dragTo(
      pagina.locator('.scelta-tile', { hasText: 'Rinforzo' })
    )
    await expect.poll(nomi).toEqual(['Mobilità', 'Rinforzo'])
    await pagina.getByRole('button', { name: 'Progressioni', exact: true }).click()
    await pagina.locator('.config-tabs').getByRole('button', { name: 'Esercizi', exact: true }).click()
    await expect.poll(nomi).toEqual(['Mobilità', 'Rinforzo'])

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
