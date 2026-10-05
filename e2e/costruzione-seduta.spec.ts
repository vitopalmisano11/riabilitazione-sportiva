// La costruzione di una seduta, gesto per gesto: e' la schermata piu' usata, e
// queste prove ne fissano il comportamento (esercizi dalla struttura della
// fase, dosaggi, esercizio al volo, Ctrl+Z, sezioni, l'ultima volta, la bozza,
// il salvataggio chiudendo il programma).
import { test, expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import { accedi, avvia, creaArchivio, FOTO, spegniDiColpo, vaiA } from './app'

// Libreria, patologia con una fase e la sua struttura, un paziente in quella
// fase: preparati dai canali, come li preparerebbe la configurazione.
async function prepara(pagina: Page): Promise<void> {
  await pagina.evaluate(async () => {
    const api = window.api
    const cat = await api.categorie.create('Rinforzo')
    const esercizio = (nome: string, serie: string, rip: string, carico: string | null) =>
      api.esercizi.create({
        nome,
        categoria_id: cat,
        serie_default: serie,
        cluster_default: null,
        ripetizioni_default: rip,
        rir_default: null,
        carico_default: carico,
        unita_carico: carico ? 'kg' : null,
        recupero_cluster_default: null,
        recupero_default: null,
        nota_tecnica: null,
        link: null
      })
    await esercizio('Squat bulgaro', '3', '10', '20')
    await esercizio('Ponte glutei', '3', '12', null)
    await esercizio('Plank', '3', '30"', null)
    const pat = await api.patologie.create('LCA')
    const fase = await api.fasi.create(pat, 'Fase 2')
    const sez = await api.sezioni.create(fase, 'Rinforzo')
    await api.sezioni.setCategorie(sez, [cat])
    await api.pazienti.create({
      nome: 'Marco',
      cognome: 'Costruzione',
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
  await pagina.locator('main').getByText('Costruzione Marco', { exact: true }).click()
  await expect(pagina.getByRole('heading', { name: 'Costruzione Marco' })).toBeVisible()
}

const riga = (pagina: Page, nome: string) => pagina.locator('.righe-seduta li', { hasText: nome })

test('costruzione: esercizi, dosaggi, al volo, Ctrl+Z, sezioni, salvataggio e ultima volta', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await prepara(pagina)
    await apriPaziente(pagina)

    await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
    // la struttura della fase: la sezione c'e' gia', vuota
    await expect(pagina.getByRole('heading', { name: 'Rinforzo', exact: true })).toBeVisible()
    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').click()
    await pagina.getByTitle('Aggiungi Squat bulgaro').click()
    await pagina.getByTitle('Aggiungi Ponte glutei').click()
    // i dosaggi di partenza arrivano dalla libreria
    await expect(riga(pagina, 'Squat bulgaro').getByPlaceholder('serie')).toHaveValue('3')
    await expect(riga(pagina, 'Squat bulgaro').getByPlaceholder('carico')).toHaveValue('20')
    await riga(pagina, 'Squat bulgaro').getByPlaceholder('carico').fill('25')
    await riga(pagina, 'Ponte glutei').getByPlaceholder('nota…').fill('lento in discesa')

    // un esercizio che non e' in libreria, solo per questa seduta
    await pagina.getByPlaceholder('Filtra i proposti o cerca in tutta la libreria…').fill('Affondo laterale')
    await pagina.getByRole('button', { name: /Aggiungi «Affondo laterale»/ }).click()
    await expect(riga(pagina, 'Affondo laterale')).toBeVisible()

    // tolto e rimesso con Ctrl+Z (fuori dalle caselle)
    await riga(pagina, 'Ponte glutei').getByTitle('Rimuovi').click()
    await expect(riga(pagina, 'Ponte glutei')).toHaveCount(0)
    await pagina.locator('.titolo-esercizi').click()
    await pagina.keyboard.press('Control+z')
    await expect(riga(pagina, 'Ponte glutei')).toBeVisible()
    await expect(riga(pagina, 'Ponte glutei').getByPlaceholder('nota…')).toHaveValue('lento in discesa')

    // la sezione si rinomina, e se ne aggiunge un'altra
    await pagina.getByTitle('Rinomina').click()
    await pagina.locator('.sezione-testata input').fill('Forza')
    await pagina.locator('.sezione-testata input').press('Enter')
    await expect(pagina.getByRole('heading', { name: 'Forza', exact: true })).toBeVisible()
    const nuovaSezione = pagina.getByPlaceholder('Aggiungi una sezione a questa seduta… (es. Defaticamento)')
    await nuovaSezione.fill('Defaticamento')
    await nuovaSezione.press('Enter')
    await expect(pagina.getByRole('heading', { name: 'Defaticamento', exact: true })).toBeVisible()

    await pagina.locator('.campo-percepito', { hasText: 'Dolore' }).locator('select').selectOption('3')
    await pagina.getByPlaceholder('Osservazioni generali, cose da riprendere la prossima volta…').fill('Bene')
    await pagina.screenshot({ path: join(FOTO, '11-costruzione.png'), fullPage: true })
    await pagina.getByRole('button', { name: /Salva seduta \(3 esercizi\)/ }).click()

    // riaperta, e' com'era
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Diario sedute' }).click()
    await pagina.getByTitle('Modifica la seduta').first().click()
    await expect(pagina.getByText('Modifica seduta')).toBeVisible()
    await expect(pagina.getByRole('heading', { name: 'Forza', exact: true })).toBeVisible()
    await expect(pagina.getByRole('heading', { name: 'Defaticamento', exact: true })).toBeVisible()
    await expect(riga(pagina, 'Squat bulgaro').getByPlaceholder('carico')).toHaveValue('25')
    await expect(riga(pagina, 'Ponte glutei').getByPlaceholder('nota…')).toHaveValue('lento in discesa')
    await expect(riga(pagina, 'Affondo laterale')).toBeVisible()
    await expect(pagina.locator('.campo-percepito', { hasText: 'Dolore' }).locator('select')).toHaveValue('3')
    // uscire senza cambiare niente non chiede e non salva una seconda volta
    await pagina.getByRole('button', { name: 'Annulla' }).first().click()

    // la seduta dopo: l'ultima volta dello squat si legge e si ricopia
    await apriPaziente(pagina)
    await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
    await pagina.getByTitle('Aggiungi un esercizio a questa sezione').click()
    await pagina.getByTitle('Aggiungi Squat bulgaro').click()
    const ultima = riga(pagina, 'Squat bulgaro').locator('.ultima-volta')
    await expect(ultima).toContainText('25')
    await expect(riga(pagina, 'Squat bulgaro').getByPlaceholder('carico')).toHaveValue('20')
    await ultima.getByRole('button', { name: 'Ricopia' }).click()
    await expect(riga(pagina, 'Squat bulgaro').getByPlaceholder('carico')).toHaveValue('25')
    await expect(riga(pagina, 'Squat bulgaro').locator('.ultima-volta')).toHaveCount(0)

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})

test('bozza: il programma si chiude di colpo e la seduta a meta\' si ritrova', async () => {
  const prova = await avvia()
  const { pagina, cartella } = prova
  await creaArchivio(pagina)
  await prepara(pagina)
  await apriPaziente(pagina)
  await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
  await pagina.getByTitle('Aggiungi un esercizio a questa sezione').click()
  await pagina.getByTitle('Aggiungi Plank').click()
  await pagina.getByPlaceholder('Osservazioni generali, cose da riprendere la prossima volta…').fill('Lasciata a metà')
  // la bozza si scrive un secondo dopo l'ultima modifica
  await pagina.waitForTimeout(2000)
  // via di colpo, come un computer che si spegne: niente salvataggio in uscita
  await spegniDiColpo(prova.app)

  const di_nuovo = await avvia(cartella)
  try {
    const p2 = di_nuovo.pagina
    await accedi(p2)
    await apriPaziente(p2)
    await p2.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
    const domanda = p2.locator('.modal-domanda')
    await expect(domanda).toContainText('lasciata a metà')
    await domanda.getByRole('button', { name: 'Conferma' }).click()
    await expect(p2.getByPlaceholder('Osservazioni generali, cose da riprendere la prossima volta…')).toHaveValue(
      'Lasciata a metà'
    )
    await expect(riga(p2, 'Plank')).toBeVisible()
    expect(di_nuovo.errori, 'errori nella console').toEqual([])
  } finally {
    await di_nuovo.chiudi()
  }
})

test('chiudendo il programma a meta\' di una seduta nuova, la seduta si salva', async () => {
  const prova = await avvia()
  const { pagina, cartella } = prova
  await creaArchivio(pagina)
  await prepara(pagina)
  await apriPaziente(pagina)
  await pagina.getByRole('button', { name: 'Nuova seduta', exact: true }).click()
  await pagina.getByPlaceholder('Osservazioni generali, cose da riprendere la prossima volta…').fill('Salvata uscendo')
  await prova.app.close()

  const di_nuovo = await avvia(cartella)
  try {
    const p2 = di_nuovo.pagina
    await accedi(p2)
    await apriPaziente(p2)
    await p2.getByRole('button', { name: 'Diario sedute' }).click()
    await p2.getByTitle('Modifica la seduta').first().click()
    await expect(p2.getByPlaceholder('Osservazioni generali, cose da riprendere la prossima volta…')).toHaveValue(
      'Salvata uscendo'
    )
    expect(di_nuovo.errori, 'errori nella console').toEqual([])
  } finally {
    await di_nuovo.chiudi()
  }
})
