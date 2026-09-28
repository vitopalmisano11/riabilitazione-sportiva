// Scrittura di un file che non deve mai restare a meta'.
//
// Scrivere direttamente sul file vuol dire che, se il computer si spegne o il
// programma si chiude in quel momento, resta un file tagliato. Per auth.json
// significa perdere la chiave che apre l'archivio; per impostazioni.json,
// perdere il percorso della cartella dati (e sembrare di aver perso tutti i
// pazienti). Qui il contenuto nuovo si scrive prima in un file accanto, si
// aspetta che sia davvero sul disco, e solo allora prende il posto del vecchio
// con una rinomina: o c'e' il file di prima intero, o c'e' quello nuovo intero.
//
// Nessuna dipendenza da Electron: testabile con Node (vedi scripts/smoke.ts).
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'fs'

// Su Windows la rinomina puo' fallire per un istante se un antivirus o la
// sincronizzazione di OneDrive stanno guardando il file: si riprova qualche volta.
const TENTATIVI = 6
const ATTESA_MS = 40

function aspetta(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function scriviAtomico(percorso: string, contenuto: string): void {
  const provvisorio = `${percorso}.tmp`
  const fd = openSync(provvisorio, 'w')
  try {
    writeSync(fd, contenuto, 0, 'utf-8')
    fsyncSync(fd)
  } catch (e) {
    closeSync(fd)
    rmSync(provvisorio, { force: true })
    throw e
  }
  closeSync(fd)

  for (let i = 1; ; i++) {
    try {
      renameSync(provvisorio, percorso)
      return
    } catch (e) {
      const codice = (e as NodeJS.ErrnoException).code
      const passeggero = codice === 'EPERM' || codice === 'EBUSY' || codice === 'EACCES'
      if (!passeggero || i >= TENTATIVI) {
        rmSync(provvisorio, { force: true })
        throw e
      }
      aspetta(ATTESA_MS * i)
    }
  }
}

// Legge un file JSON per poi riscriverlo con qualche campo cambiato.
//
// Chi legge soltanto puo' accontentarsi di "niente" quando il file non si apre.
// Chi riscrive no: se scambiasse un file illeggibile per un file vuoto, lo
// riscriverebbe con dentro solo la modifica appena fatta, e tutto il resto
// (per esempio dove stanno i dati dei pazienti) andrebbe perso. Qui un file
// che non c'e' ancora e' un file vuoto; uno che c'e' ma non si legge e' un
// errore, e chi chiama si ferma senza toccarlo.
export function leggiJsonPerScrivere<T extends object>(percorso: string): T {
  for (let i = 1; ; i++) {
    try {
      return JSON.parse(readFileSync(percorso, 'utf-8')) as T
    } catch (e) {
      const codice = (e as NodeJS.ErrnoException).code
      if (codice === 'ENOENT') return {} as T
      const passeggero = codice === 'EPERM' || codice === 'EBUSY' || codice === 'EACCES'
      if (passeggero && i < TENTATIVI) {
        aspetta(ATTESA_MS * i)
        continue
      }
      throw new Error(
        `Non riesco a leggere il file delle impostazioni, e per non perdere quello che c'è dentro non lo modifico. ` +
          `Riprova fra un momento; se succede sempre, il file è ${percorso}.`
      )
    }
  }
}
