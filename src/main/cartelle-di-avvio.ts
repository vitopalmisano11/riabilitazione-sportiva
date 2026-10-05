// Dove stanno le impostazioni e i dati, deciso prima di caricare qualunque altro
// modulo dell'app: impostazioni.ts legge il suo file gia' mentre si carica, e
// gli import si eseguono prima del corpo di index.ts. Per questo e' il primo
// import di index.ts, e non deve importare niente dell'app.
//
// In sviluppo l'app tiene dati e cache propri: le prove — comprese le
// migrazioni, che non si annullano — non toccano i dati dell'app installata.
//
// Le prove dell'interfaccia (e2e/) vanno ancora oltre: con
// RIABILITAZIONE_CARTELLA_PROVA impostata, impostazioni e cartella dei dati
// stanno tutte in quella cartella temporanea. Nel programma installato la
// variabile non conta: li' i dati stanno sempre al loro posto.
import { app } from 'electron'
import { join } from 'path'

if (!app.isPackaged) {
  const prova = process.env['RIABILITAZIONE_CARTELLA_PROVA']
  if (prova) {
    app.setPath('userData', join(prova, 'userData'))
    app.setPath('documents', join(prova, 'documenti'))
  } else {
    app.setPath('userData', `${app.getPath('userData')} (dev)`)
  }
}
