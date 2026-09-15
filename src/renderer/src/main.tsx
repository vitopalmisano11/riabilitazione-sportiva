import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import App from './App'
import SchedaPaziente from './SchedaPaziente'
import BarraFinestra from './components/BarraFinestra'
import { installaSalvataggioAllaChiusura } from './modificheInCorso'
import './styles.css'

// La finestra aperta con #scheda=<id> mostra solo il programma di quel
// paziente: niente archivio, niente password da rifare (il database e' gia'
// aperto nell'app che l'ha lanciata).
const scheda = /^#scheda=(\d+)$/.exec(window.location.hash)

// Chiudendo il programma con modifiche ancora da salvare, prima si salvano.
if (!scheda) installaSalvataggioAllaChiusura()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {scheda ? (
      <SchedaPaziente sedutaId={Number(scheda[1])} />
    ) : (
      <>
        <BarraFinestra />
        <App />
      </>
    )}
  </React.StrictMode>
)
