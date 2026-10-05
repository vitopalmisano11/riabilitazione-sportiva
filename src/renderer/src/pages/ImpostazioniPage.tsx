import { useEffect, useState } from 'react'
import type { Tema } from '../../../shared/temi'
import type { Profilo } from '../../../shared/types'
import { SchedaDati } from './impostazioni/SchedaDati'
import { SchedaProfilo } from './impostazioni/SchedaProfilo'
import { SchedaRecupero } from './impostazioni/SchedaRecupero'
import { SchedaPassword } from './impostazioni/SchedaPassword'
import { SchedaBlocco } from './impostazioni/SchedaBlocco'
import { ModoScuro, SchedaAspetto } from './impostazioni/SchedaAspetto'

// Impostazioni dell'app: dove stanno i dati e le copie, la password, il colore.
//
// Prima erano due finestrine appese in fondo alla barra laterale, e il tema non
// c'era. Sono cose che si toccano di rado ma che vanno trovate subito, percio'
// stanno in una sezione sola, a schede, come la configurazione.

// Tre schede, divise per domanda: "chi sono io", "come si comporta l'app con
// me" e "dove stanno le mie cose e come sono al sicuro". Il cestino sta con i
// dati perche' e' l'ultima rete prima di perderli davvero; il colore sta con la
// password perche' sono tutte e due preferenze tue, non dell'archivio.
type Scheda = 'profilo' | 'app' | 'dati'

// Dall'alto in basso come si scende dal proprio nome all'archivio: prima chi
// sei, poi come si comporta l'app con te, e in fondo dove stanno le cose e
// come sono al sicuro.
const SCHEDE: { key: Scheda; label: string }[] = [
  { key: 'profilo', label: 'Profilo' },
  { key: 'app', label: 'Accesso e aspetto' },
  { key: 'dati', label: 'Dati e backup' }
]

export default function ImpostazioniPage({
  tornaAllInizio,
  tema,
  onTema,
  scuro,
  modoScuro,
  orariScuro,
  onScuro,
  barraScura,
  onBarraScura,
  ingrandimento,
  onIngrandimento
}: {
  tornaAllInizio: number
  tema: Tema
  onTema: (t: Tema) => void
  scuro: boolean
  modoScuro: ModoScuro
  orariScuro: { dalle: string; alle: string }
  onScuro: (modo: ModoScuro, orari?: { dalle: string; alle: string }) => void
  barraScura: boolean
  onBarraScura: (valore: boolean) => void
  ingrandimento: number
  onIngrandimento: (valore: number) => void
}): React.JSX.Element {
  // Aprendo Impostazioni si arriva sulla prima scheda, come in configurazione.
  const [scheda, setScheda] = useState<Scheda>('profilo')

  useEffect(() => {
    if (tornaAllInizio === 0) return
    setScheda('profilo')
  }, [tornaAllInizio])

  return (
    <div className="page">
      <header className="page-header">
        <h2>Impostazioni</h2>
      </header>
      <div className="config-tabs config-tabs-top">
        {SCHEDE.map((t) => (
          <button
            key={t.key}
            className={scheda === t.key ? 'active' : ''}
            onClick={() => setScheda(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* .scheda da' il riquadro bianco alle sezioni, come nella scheda del
          paziente: qui dentro ogni pannello e' una card. */}
      <div className="scheda">
        {scheda === 'dati' && <SchedaDati />}
        {scheda === 'profilo' && <SchedaProfilo />}
        {scheda === 'app' && (
          <>
            {/* L'aspetto a sinistra e la password a destra, alti uguale: sono
                le due cose che si vengono a cercare qui, e due riquadri
                affiancati di altezza diversa sembrano uno sbaglio. Il blocco e
                la dimensione dei caratteri stanno sotto, nella stessa griglia:
                cosi' il riquadro e' largo esattamente come gli altri due. */}
            <div className="griglia-impostazioni griglia-pari griglia-due">
              <SchedaAspetto
                tema={tema}
                onTema={onTema}
                scuro={scuro}
                modoScuro={modoScuro}
                orariScuro={orariScuro}
                onScuro={onScuro}
                barraScura={barraScura}
                onBarraScura={onBarraScura}
              />
              <SchedaPassword />
              <SchedaBlocco ingrandimento={ingrandimento} onIngrandimento={onIngrandimento} />
              <SchedaRecupero />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
