// Il carico settimana per settimana nel Percorso: sei settimane di sedute (una
// vuota in mezzo), la dose della fase, il dolore che sale con il carico. Si
// vedono la tabella, i due grafici, la lettura sotto il mouse e l'avviso.
import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, vaiA } from './app'

test('carico: le settimane con la dose, i grafici e l\'avviso', async () => {
  const prova = await avvia()
  try {
    const { pagina } = prova
    await creaArchivio(pagina)
    await pagina.evaluate(async () => {
      const api = window.api
      const rinforzo = await api.categorie.create('Rinforzo')
      await api.categorie.setContaCome(rinforzo, 'forza')
      const quad = await api.categorie.create('Quadricipite')
      await api.categorie.setPadre(quad, rinforzo)
      const plio = await api.categorie.create('Pliometria')
      await api.categorie.setContaCome(plio, 'plio_est')
      const esercizio = (nome: string, categoria_id: number, gambe: 'due' | 'una') =>
        api.esercizi.create({
          nome,
          categoria_id,
          serie_default: null,
          cluster_default: null,
          ripetizioni_default: null,
          rir_default: null,
          carico_default: null,
          unita_carico: null,
          recupero_cluster_default: null,
          recupero_default: null,
          nota_tecnica: null,
          link: null,
          gambe
        })
      const legExt = await esercizio('Leg extension', quad, 'due')
      const hop = await esercizio('Single leg hop', plio, 'una')
      const pat = await api.patologie.create('LCA')
      const fase = await api.fasi.create(pat, 'RTP 1')
      await api.dose.impostaFase(fase, [
        { chiave: 'plio_est', minimo: 80, massimo: 120 },
        { chiave: `forza:${quad}`, minimo: 3, massimo: null }
      ])
      const pz = await api.pazienti.create({
        nome: 'Luca',
        cognome: 'Carico',
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
      await api.pazienti.setSeduteSettimana(pz, 2)

      const riga = (esercizio_id: number, serie: string) => ({
        esercizio_id,
        nome_libero: null,
        serie,
        cluster: null,
        ripetizioni: '10',
        rir: null,
        carico: null,
        recupero_cluster: null,
        recupero: null,
        nota: null,
        monopodalico: 0 as const,
        sezioneIndex: 0
      })
      const iso = (d: Date): string =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const oggi = new Date()
      const lunedi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - ((oggi.getDay() + 6) % 7))
      // settimane fa → [serie di hop lunedi', mercoledi'], dolore, serie di leg extension
      const piano: [number, [number, number], number, number][] = [
        [6, [2, 2], 3, 3],
        [5, [3, 3], 2, 3],
        // 4 settimane fa: nessuna seduta
        [3, [3, 3], 2, 2],
        [2, [4, 5], 3, 3],
        [1, [6, 6], 4, 3]
      ]
      for (const [fa, hopSerie, dolore, legSerie] of piano) {
        for (const [i, giorno] of [0, 2].entries()) {
          const d = new Date(lunedi)
          d.setDate(lunedi.getDate() - 7 * fa + giorno)
          await api.sedute.create({
            paziente_id: pz,
            data: iso(d),
            ora: null,
            fase_id: fase,
            focus: null,
            dolore,
            sforzo: 5 + (i === 0 ? 0 : 1),
            segni: [],
            riferito_andamento: null,
            riferito: null,
            tecnica_ids: [],
            trattamento: null,
            note: null,
            sezioni: [{ sezione_id: null, nome: 'Esercizi' }],
            esercizi: [riga(hop, String(hopSerie[i])), riga(legExt, String(legSerie))]
          })
        }
      }
    })

    await vaiA(pagina, 'Pazienti')
    await pagina.locator('main').getByText('Carico Luca', { exact: true }).click()
    await pagina.getByRole('button', { name: 'Percorso', exact: true }).click()

    const card = pagina.locator('.carico-settimane')
    await expect(card.getByRole('heading', { name: /Carico settimana per settimana/ })).toBeVisible()
    // l'avviso: dolore 2 → 3 → 4 mentre la pliometria passa da 120 a 240
    await expect(card.locator('.avviso-carico')).toContainText('(2 → 3 → 4)')
    await expect(card.locator('.avviso-carico')).toContainText('120 → 180 → 240 contatti')

    // sei settimane nella tabella, dalla piu' recente; quella vuota c'e'
    const righe = card.locator('.tabella-carico tbody tr')
    await expect(righe).toHaveCount(6)
    await expect(righe.nth(3)).toContainText('Nessuna seduta')
    // la piu' recente: 240 contatti su 160-240, forza 6 su almeno 6
    await expect(righe.nth(0).locator('.voce-dose').first()).toHaveText('240')
    await expect(righe.nth(0).locator('.voce-dose').first()).toHaveClass(/ok/)
    await expect(righe.nth(0)).toContainText('/ 160–240')
    // tre settimane fa: 2 serie di forza a seduta, sotto la dose
    await expect(righe.nth(2).locator('.voce-dose').nth(1)).toHaveClass(/poco/)

    // sotto il mouse, i numeri della settimana
    const grafico = card.locator('.grafico-carico')
    await grafico.scrollIntoViewIfNeeded()
    const box = (await grafico.boundingBox())!
    await grafico.hover({ position: { x: box.width - 30, y: box.height / 2 } })
    await expect(card.locator('.carico-lettura')).toContainText('Pliometria est. 240 contatti (dose 160–240)')
    await expect(card.locator('.carico-lettura')).toContainText('dolore 4')
    await pagina.screenshot({ path: join(FOTO, '43-carico-settimane.png'), fullPage: true })

    await card.locator('.tabella-carico').scrollIntoViewIfNeeded()
    await pagina.screenshot({ path: join(FOTO, '44-carico-tabella.png') })

    // la voce del grafico si cambia (la tendina la disegna il programma)
    await card.locator('.carico-testata .menu-scelta-bottone').click()
    await pagina.locator('.menu-scelta-lista').getByText('Quadricipite', { exact: true }).click()
    await grafico.hover({ position: { x: box.width - 30, y: box.height / 2 } })
    await expect(card.locator('.carico-lettura')).toContainText('Quadricipite 6 serie')

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
