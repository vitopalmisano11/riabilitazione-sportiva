// I referti: si caricano (foto e PDF), si aprono con il programma del computer,
// e quello che esce e' identico a quello che era entrato. La finestra di scelta
// del file e l'apertura con un altro programma sono di Windows: nella prova le
// si sostituisce dal processo principale, e si guarda il file che il programma
// avrebbe passato.
import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { avvia, creaArchivio, FOTO, nuovoPaziente } from './app'

test('referti: si caricano e si riaprono identici', async () => {
  const prova = await avvia()
  try {
    const { app, pagina, cartella } = prova
    await creaArchivio(pagina)
    await nuovoPaziente(pagina, { nome: 'Rita', cognome: 'Referti' })

    // un PDF finto ma con byte di ogni valore, che il base64 di prima avrebbe gonfiato
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 256))])
    const percorsoPdf = join(cartella, 'RM ginocchio.pdf')
    writeFileSync(percorsoPdf, pdf)

    await app.evaluate(({ dialog, shell }, file) => {
      const g = globalThis as { __aperti?: string[] }
      g.__aperti = []
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as typeof dialog.showOpenDialog
      shell.openPath = (async (p: string) => {
        g.__aperti!.push(p)
        return ''
      }) as typeof shell.openPath
    }, percorsoPdf)

    await pagina.getByRole('button', { name: 'Clinica', exact: true }).click()
    await pagina.getByTitle('Anamnesi remota').click()
    await pagina.getByRole('button', { name: 'Carica referto (foto o PDF)' }).click()
    await expect(pagina.getByText('RM ginocchio.pdf')).toBeVisible()
    await pagina.screenshot({ path: join(FOTO, '10-referti.png') })

    await pagina.getByRole('button', { name: 'Apri', exact: true }).click()
    await expect
      .poll(() => app.evaluate(() => (globalThis as { __aperti?: string[] }).__aperti!.length))
      .toBe(1)
    const aperto = await app.evaluate(() => (globalThis as { __aperti?: string[] }).__aperti![0])
    expect(aperto.endsWith('.pdf')).toBe(true)
    expect(readFileSync(aperto).equals(pdf)).toBe(true)

    expect(prova.errori, 'errori nella console').toEqual([])
  } finally {
    await prova.chiudi()
  }
})
