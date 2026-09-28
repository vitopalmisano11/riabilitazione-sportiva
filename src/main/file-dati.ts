// Spostamento dei file dati tra cartelle. Nessuna dipendenza da Electron:
// testabile con Node (vedi scripts/smoke.ts).
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, unlinkSync } from 'fs'
import { join } from 'path'

export const NOMI_FILE_DATI = [
  'riabilitazione.db',
  'riabilitazione.db-wal',
  'riabilitazione.db-shm',
  'auth.json'
] as const

// rename fallisce tra volumi diversi (EXDEV): fallback copia+elimina.
// Se la copia non si completa, o l'originale non si riesce a togliere, la copia
// appena fatta si butta: meglio un file solo, dov'era, che due versioni.
function sposta(da: string, a: string): void {
  try {
    renameSync(da, a)
  } catch {
    try {
      copyFileSync(da, a)
      unlinkSync(da)
    } catch (e) {
      rmSync(a, { force: true })
      throw e
    }
  }
}

// `muovi` si puo' cambiare solo per provare cosa succede quando un file si
// rifiuta di spostarsi.
export function spostaFileDati(daDir: string, aDir: string, muovi = sposta): void {
  mkdirSync(aDir, { recursive: true })

  // Un archivio e' un insieme: il database, il suo giornale e le chiavi che lo
  // aprono. Se nella destinazione c'e' gia' anche uno solo di questi file, quello
  // che si sposta ci si mescolerebbe: un database con le chiavi di un altro
  // archivio non si apre piu', e un giornale che non e' il suo lo rovina. Meglio
  // fermarsi prima di toccare qualunque cosa.
  const giaLi = NOMI_FILE_DATI.filter((nome) => existsSync(join(aDir, nome)))
  if (giaLi.includes('riabilitazione.db')) {
    throw new Error("La cartella di destinazione contiene già i dati dell'app.")
  }
  if (giaLi.length > 0) {
    throw new Error(
      `La cartella di destinazione contiene già dei file di un archivio (${giaLi.join(', ')}). ` +
        'Scegline una vuota: altrimenti i due archivi si mescolerebbero e nessuno dei due si aprirebbe più.'
    )
  }

  // Se uno dei file non si sposta, quelli gia' spostati tornano dov'erano: non
  // resta un archivio diviso a meta' fra due cartelle.
  const spostati: [string, string][] = []
  try {
    for (const nome of NOMI_FILE_DATI) {
      const da = join(daDir, nome)
      const a = join(aDir, nome)
      if (!existsSync(da)) continue
      muovi(da, a)
      spostati.push([da, a])
    }
  } catch (e) {
    for (const [da, a] of spostati.reverse()) {
      try {
        muovi(a, da)
      } catch {
        // meglio provare con gli altri che fermarsi al primo
      }
    }
    throw e
  }
}
