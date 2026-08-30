// Azzera i dati dell'ambiente di SVILUPPO per ripartire dalla schermata di setup.
// Non cancella niente: archivia le cartelle aggiungendo un suffisso data/ora.
// I dati dell'app installata (senza il suffisso "(dev)") non vengono mai toccati.
// Uso: npm run dev:reset            -> mostra soltanto cosa farebbe
//      npm run dev:reset -- --conferma
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const SUFFISSO_DEV = '(dev)'

const userDataDev = join(
  process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
  `riabilitazione-sportiva ${SUFFISSO_DEV}`
)

// La cartella dati può essere stata spostata dall'app: il percorso scelto sta in
// impostazioni.json, dentro userData. Altrimenti vale il default di sviluppo.
function cartellaDatiDev(): string {
  try {
    const file = JSON.parse(readFileSync(join(userDataDev, 'impostazioni.json'), 'utf-8')) as {
      cartellaDati?: string
    }
    if (file.cartellaDati) return file.cartellaDati
  } catch {
    // nessuna impostazione salvata: si usa il default
  }
  return join(homedir(), 'Documents', `Riabilitazione ${SUFFISSO_DEV}`)
}

const conferma = process.argv.includes('--conferma')
const marcaTemporale = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

let trovate = 0
for (const dir of [cartellaDatiDev(), userDataDev]) {
  // Rete di sicurezza: mai toccare una cartella che non sia quella di sviluppo.
  if (!dir.includes(SUFFISSO_DEV)) {
    console.error(`Salto "${dir}": non è una cartella di sviluppo.`)
    continue
  }
  if (!existsSync(dir)) continue
  trovate++
  const archivio = `${dir} archiviata ${marcaTemporale}`
  if (conferma) {
    renameSync(dir, archivio)
    console.log(`Archiviata: ${dir}\n        ->  ${archivio}`)
  } else {
    console.log(`Da archiviare: ${dir}`)
  }
}

if (trovate === 0) {
  console.log('Niente da azzerare: l’ambiente di sviluppo è già vuoto.')
} else if (conferma) {
  console.log('\nFatto. Il prossimo `npm run dev` riparte dalla schermata di setup.')
} else {
  console.log('\nNessuna modifica. Per procedere: npm run dev:reset -- --conferma')
}
