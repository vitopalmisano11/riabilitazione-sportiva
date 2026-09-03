import { useEffect, useState } from 'react'
import {
  CalendarClock,
  ClipboardCheck,
  HeartPulse,
  Settings,
  SlidersHorizontal,
  Users
} from 'lucide-react'
import PatologiePage from './pages/PatologiePage'
import EserciziPage from './pages/EserciziPage'
import QuestionariPage from './pages/QuestionariPage'
import TestValutazionePage from './pages/TestValutazionePage'
import ProtocolliScreeningPage from './pages/ProtocolliScreeningPage'
import ScreeningRtpPage from './pages/ScreeningRtpPage'
import DistrettiPage from './pages/DistrettiPage'
import PazientiPage from './pages/PazientiPage'
import FollowUpPage from './pages/FollowUpPage'
import ImpostazioniPage from './pages/ImpostazioniPage'
import AuthGate from './components/AuthGate'
import ToastHost, { toastErrore } from './components/Toast'
import { errMsg } from './lib'
import type { Tema } from '../../shared/temi'

type Sezione = 'pazienti' | 'followup' | 'screening' | 'configurazione' | 'impostazioni'

type TabConfig =
  | 'patologie'
  | 'distretti'
  | 'esercizi'
  | 'questionari'
  | 'testValutazione'
  | 'screening'

const TAB_CONFIG: { key: TabConfig; label: string }[] = [
  { key: 'patologie', label: 'Patologie e fasi' },
  { key: 'distretti', label: 'Distretti' },
  { key: 'esercizi', label: 'Libreria esercizi' },
  { key: 'questionari', label: 'Questionari' },
  { key: 'testValutazione', label: 'Test di valutazione' },
  { key: 'screening', label: 'Screening' }
]

export default function App(): React.JSX.Element {
  const [sbloccata, setSbloccata] = useState(false)
  const [sezione, setSezione] = useState<Sezione>('pazienti')
  // Il tema scelto: si applica mettendolo sull'elemento radice, e il foglio di
  // stile ridichiara i suoi colori. Arriva dal file delle impostazioni, cosi'
  // resta anche al riavvio, e lo conoscono anche i documenti stampati.
  const [tema, setTema] = useState<Tema>('verde')
  const [scuro, setScuro] = useState(false)

  // Il ponte applica gia' i colori prima che la pagina compaia: qui si legge lo
  // stesso valore solo per sapere cosa mostrare come scelto in Impostazioni.
  useEffect(() => {
    window.api.impostazioni
      .info()
      .then((i) => {
        setTema(i.tema)
        setScuro(i.scuro)
      })
      .catch(() => undefined)
  }, [])

  const scegliTema = (t: Tema): void => {
    setTema(t)
    document.documentElement.dataset.tema = t
    window.api.impostazioni.setTema(t).catch((e) => toastErrore(errMsg(e)))
  }

  const scegliScuro = (valore: boolean): void => {
    setScuro(valore)
    if (valore) document.documentElement.dataset.scuro = 'si'
    else delete document.documentElement.dataset.scuro
    window.api.impostazioni.setScuro(valore).catch((e) => toastErrore(errMsg(e)))
  }
  // Ripremere la voce della sezione in cui si e' gia' significa "torna alla
  // prima pagina di questa sezione". Da qui non si puo' azzerare cosa c'e'
  // aperto dentro una pagina: le si manda un contatore, e a ogni scatto lei
  // torna al suo elenco. Ne basta uno per tutte: la pagina che lo riceve e'
  // sempre e solo quella visibile.
  const [tornaAllElenco, setTornaAllElenco] = useState(0)

  const vaiA = (s: Sezione): void => {
    if (sezione === s) setTornaAllElenco((n) => n + 1)
    else setSezione(s)
  }
  // Richiesta di aprire la scheda di un paziente da un'altra sezione. Il numero
  // progressivo serve a far scattare l'apertura anche se si richiede due volte
  // lo stesso paziente.
  const [apriPaziente, setApriPaziente] = useState<{ id: number; seq: number } | null>(null)

  const vaiAlPaziente = (id: number): void => {
    setSezione('pazienti')
    setApriPaziente((p) => ({ id, seq: (p?.seq ?? 0) + 1 }))
  }

  if (!sbloccata) {
    return <AuthGate onUnlocked={() => setSbloccata(true)} />
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>
          <span className="logo-badge">
            <HeartPulse size={20} />
          </span>
          Riabilitazione
        </h1>
        <div className="nav-group-label">Diario pazienti</div>
        <nav>
          <button
            className={sezione === 'pazienti' ? 'active' : ''}
            onClick={() => vaiA('pazienti')}
          >
            <Users size={18} />
            Pazienti e sedute
          </button>
          <button
            className={sezione === 'followup' ? 'active' : ''}
            onClick={() => vaiA('followup')}
          >
            <CalendarClock size={18} />
            Follow-up
          </button>
          <button
            className={sezione === 'screening' ? 'active' : ''}
            onClick={() => vaiA('screening')}
          >
            <ClipboardCheck size={18} />
            Screening e RTP
          </button>
        </nav>
        <div className="sidebar-footer">
          <button
            className={sezione === 'configurazione' ? 'active' : ''}
            onClick={() => vaiA('configurazione')}
          >
            <Settings size={17} />
            Configurazione
          </button>
          {/* Dati e backup, password e colore stanno insieme qui: si toccano di
              rado, e prima erano finestrine appese al menu. */}
          <button
            className={sezione === 'impostazioni' ? 'active' : ''}
            onClick={() => vaiA('impostazioni')}
          >
            <SlidersHorizontal size={17} />
            Impostazioni
          </button>
        </div>
      </aside>
      <main className="content">
        {sezione === 'pazienti' && (
          <PazientiPage tornaAllElenco={tornaAllElenco} apriPaziente={apriPaziente} />
        )}
        {sezione === 'followup' && (
          <FollowUpPage onApriPaziente={vaiAlPaziente} ricarica={tornaAllElenco} />
        )}
        {sezione === 'screening' && <ScreeningRtpPage tornaAllElenco={tornaAllElenco} />}
        {sezione === 'configurazione' && <ConfigurazionePage tornaAllInizio={tornaAllElenco} />}
        {sezione === 'impostazioni' && (
          <ImpostazioniPage
            tornaAllInizio={tornaAllElenco}
            tema={tema}
            onTema={scegliTema}
            scuro={scuro}
            onScuro={scegliScuro}
          />
        )}
      </main>
      <ToastHost />
    </div>
  )
}

function ConfigurazionePage({
  tornaAllInizio
}: {
  // Cambia quando si ripreme "Configurazione" nel menu: si torna alla prima
  // scheda, che e' la sua prima pagina.
  tornaAllInizio: number
}): React.JSX.Element {
  const [tab, setTab] = useState<TabConfig>('patologie')

  useEffect(() => {
    if (tornaAllInizio === 0) return
    setTab('patologie')
  }, [tornaAllInizio])

  return (
    <div className="config-wrapper">
      <div className="config-tabs config-tabs-top">
        {TAB_CONFIG.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'patologie' && <PatologiePage />}
      {tab === 'distretti' && <DistrettiPage />}
      {tab === 'esercizi' && <EserciziPage />}
      {tab === 'questionari' && <QuestionariPage />}
      {tab === 'testValutazione' && <TestValutazionePage />}
      {tab === 'screening' && <ProtocolliScreeningPage tornaAllElenco={tornaAllInizio} />}
    </div>
  )
}
