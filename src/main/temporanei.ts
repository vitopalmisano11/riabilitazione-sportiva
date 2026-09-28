// File temporanei con dentro dati dei pazienti.
//
// Per aprire un referto in un altro programma, o per mostrare l'anteprima di una
// cartella, i dati escono per un momento dal database cifrato e finiscono in un
// file in chiaro. Prima quel file stava in %TEMP% con un nome prevedibile e non
// veniva cancellato mai (l'anteprima ci provava, ma se l'antivirus teneva il file
// aperto in quell'istante l'errore si perdeva). Qui stanno tutti in una cartella
// loro, con nomi casuali, si cancellano appena possibile e, se qualcuno resta
// (il programma che mostra il referto lo tiene aperto), si toglie alla chiusura
// e al prossimo avvio.
//
// Nessuna dipendenza da Electron: la cartella arriva da fuori (vedi index.ts) e
// si prova con Node (scripts/smoke.ts).
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'

let cartella: string | null = null

// Se un file e' aperto da un altro programma non si cancella: si riprova ogni
// minuto per mezz'ora, poi ci pensano la chiusura e il prossimo avvio.
const RIPROVA_MS = 60_000
const RIPROVE_MAX = 30

export function usaCartellaTemporanei(dir: string): void {
  cartella = dir
}

function dove(): string {
  if (!cartella) throw new Error('Cartella dei file temporanei non impostata.')
  mkdirSync(cartella, { recursive: true })
  return cartella
}

// Nome casuale: non si indovina, e non racconta di quale paziente e'.
export async function scriviTemporaneo(estensione: string, dati: string | Buffer): Promise<string> {
  const percorso = join(dove(), `${randomUUID()}${estensione}`)
  await writeFile(percorso, dati, typeof dati === 'string' ? 'utf-8' : undefined)
  return percorso
}

// Vero se il file non c'e' piu'.
export function eliminaTemporaneo(percorso: string): boolean {
  try {
    rmSync(percorso, { force: true })
    return !existsSync(percorso)
  } catch {
    return false
  }
}

// Per i file che un altro programma puo' avere ancora aperto: si prova e poi si
// riprova ogni tanto, finche' non se ne va. `dopoMs` e' l'attesa prima del primo
// tentativo: per un file appena passato a un altro programma serve, perche'
// cancellarlo prima che l'abbia aperto vorrebbe dire "file non trovato".
export function eliminaTemporaneoPresto(percorso: string, dopoMs = 0): void {
  if (dopoMs === 0 && eliminaTemporaneo(percorso)) return
  let prove = 0
  const riprova = (): void => {
    prove++
    if (eliminaTemporaneo(percorso) || prove >= RIPROVE_MAX) return
    // non deve tenere in vita il programma
    setTimeout(riprova, RIPROVA_MS).unref()
  }
  setTimeout(riprova, dopoMs > 0 ? dopoMs : RIPROVA_MS).unref()
}

// Toglie tutto quello che c'e' nella cartella: all'avvio (resti di una chiusura
// andata male) e alla chiusura. Quello che e' ancora aperto altrove resta, e
// verra' tolto alla prossima volta.
export function ripulisciTemporanei(): void {
  if (!cartella || !existsSync(cartella)) return
  try {
    for (const nome of readdirSync(cartella)) {
      try {
        rmSync(join(cartella, nome), { recursive: true, force: true })
      } catch {
        // aperto da un altro programma: si riprova al prossimo giro
      }
    }
  } catch {
    // la cartella non si legge: niente da fare, e non e' il caso di fermare il programma
  }
}
