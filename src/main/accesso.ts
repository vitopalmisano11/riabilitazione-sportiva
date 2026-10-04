// Cosa mostrare prima dell'accesso.
//
// Prima la domanda era una sola: c'e' auth.json? Se no, "Primo avvio: scegli
// la password". Ma auth.json manca anche quando l'archivio c'e' e non si trova:
// la cartella dei dati su un disco staccato, OneDrive non ancora sincronizzato
// su un computer nuovo, il file delle impostazioni rovinato (e allora si
// cercava in Documenti). In tutti questi casi il programma proponeva di creare
// un archivio nuovo, e chi lo usa pensava di aver perso tutti i pazienti. Qui
// i casi si distinguono, e ognuno ha la sua schermata.
import { existsSync } from 'fs'
import { join } from 'path'
import { isPlaintextDb } from './db'
import { doveDati, impostazioniLeggibili, percorsoImpostazioni } from './impostazioni'
import type { InfoAccesso } from '../shared/types'

export const FILE_DB = 'riabilitazione.db'
export const FILE_CHIAVI = 'auth.json'

export function statoAccesso(): InfoAccesso {
  if (!impostazioniLeggibili()) {
    return { stato: 'impostazioni-illeggibili', cartella: percorsoImpostazioni() }
  }
  const { percorso, personalizzata } = doveDati()
  if (personalizzata && !existsSync(percorso)) return { stato: 'cartella-assente', cartella: percorso }

  if (existsSync(join(percorso, FILE_CHIAVI))) return { stato: 'login', cartella: percorso }
  const db = join(percorso, FILE_DB)
  // Un archivio cifrato senza le sue chiavi non si apre, e crearne uno nuovo
  // sopra lo renderebbe irrecuperabile. Un archivio in chiaro (versioni molto
  // vecchie) invece si cifra al primo setup: e' il percorso normale.
  if (existsSync(db) && !isPlaintextDb(db)) return { stato: 'chiavi-mancanti', cartella: percorso }
  return { stato: 'setup', cartella: percorso }
}

// Mai un archivio nuovo sopra uno che c'e': le chiavi nuove non aprirebbero
// quello vecchio, e senza le sue chiavi non si aprirebbe piu'. L'interfaccia
// non ci arriva (vedi statoAccesso), ma il canale del setup e' il confine.
export function controllaSetup(cartella: string): void {
  if (existsSync(join(cartella, FILE_CHIAVI))) {
    throw new Error('In questa cartella c’è già un archivio con la sua password: accedi con quella.')
  }
  const db = join(cartella, FILE_DB)
  if (existsSync(db) && !isPlaintextDb(db)) {
    throw new Error(
      'In questa cartella c’è già un archivio, ma manca il file delle chiavi (auth.json): non ne creo uno nuovo sopra. Recupera auth.json da una copia di sicurezza.'
    )
  }
}
