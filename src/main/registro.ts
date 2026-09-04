// Registro degli errori.
//
// Quando qualcosa va storto, l'app mostra un messaggio rosso che dopo qualche
// secondo sparisce: se succede mentre lavori, il giorno dopo non c'e' piu' modo
// di capire cosa fosse. Qui ogni errore lascia una riga in un file di testo, con
// la data e il punto in cui e' successo.
//
// Nel registro non finiscono dati dei pazienti: solo il nome dell'operazione e
// il messaggio dell'errore. Serve a me per capire, non e' un archivio.
import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'

const PESO_MAX = 512 * 1024

function percorso(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'errori.log')
}

export function registraErrore(operazione: string, errore: unknown): void {
  try {
    const file = percorso()
    // Il file non cresce all'infinito: oltre mezzo mega si riparte, tenendo la
    // fine (gli errori recenti sono quelli che servono).
    if (existsSync(file) && statSync(file).size > PESO_MAX) {
      const testo = readFileSync(file, 'utf-8')
      writeFileSync(file, testo.slice(-PESO_MAX / 2), 'utf-8')
    }
    const messaggio = errore instanceof Error ? errore.stack || errore.message : String(errore)
    const riga = `[${new Date().toISOString()}] ${operazione}\n${messaggio}\n\n`
    appendFileSync(file, riga, 'utf-8')
  } catch {
    // se non si riesce nemmeno a scrivere il registro, non e' il caso di
    // rovinare anche l'operazione in corso
  }
}

export function percorsoRegistro(): string {
  return percorso()
}

// Le ultime righe, per mostrarle nelle impostazioni senza aprire il file.
export function ultimiErrori(quanti = 40): string {
  try {
    const file = percorso()
    if (!existsSync(file)) return ''
    return readFileSync(file, 'utf-8').split('\n').slice(-quanti).join('\n').trim()
  } catch {
    return ''
  }
}
