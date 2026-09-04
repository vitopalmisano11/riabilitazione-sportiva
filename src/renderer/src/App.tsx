import { useEffect, useState } from 'react'
import {
  CalendarDays,
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
import SettimanaPage from './pages/SettimanaPage'
import ImpostazioniPage from './pages/ImpostazioniPage'
import AuthGate from './components/AuthGate'
import SchermoBloccato from './components/SchermoBloccato'
import ToastHost, { toastErrore } from './components/Toast'
import ConfermaHost from './components/Conferma'
import { errMsg } from './lib'
import type { Tema } from '../../shared/temi'

type Sezione =
  | 'settimana'
  | 'pazienti'
  | 'followup'
  | 'screening'
  | 'configurazione'
  | 'impostazioni'

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
  const [barraScura, setBarraScura] = useState(false)
  const [ingrandimento, setIngrandimento] = useState(1)

  // Il ponte applica gia' i colori prima che la pagina compaia: qui si legge lo
  // stesso valore solo per sapere cosa mostrare come scelto in Impostazioni.
  useEffect(() => {
    window.api.impostazioni
      .info()
      .then((i) => {
        setTema(i.tema)
        setScuro(i.scuro)
        setBarraScura(i.barraScura)
        setIngrandimento(i.ingrandimento)
      })
      .catch(() => undefined)
  }, [])

  const scegliTema = (t: Tema): void => {
    setTema(t)
    document.documentElement.dataset.tema = t
    window.api.impostazioni.setTema(t).catch((e) => toastErrore(errMsg(e)))
  }

  // La barra laterale chiara o scura: era una caratteristica del colore (il blu
  // ce l'aveva scura), adesso e' una scelta a se' che vale con tutti i colori.
  // L'ingrandimento lo applica il ponte alla finestra: qui si tiene solo il
  // numero da mostrare nelle impostazioni.
  const scegliIngrandimento = (valore: number): void => {
    setIngrandimento(valore)
    window.api.impostazioni.setIngrandimento(valore).catch((e) => toastErrore(errMsg(e)))
  }

  const scegliBarraScura = (valore: boolean): void => {
    setBarraScura(valore)
    document.documentElement.dataset.barra = valore ? 'scura' : 'chiara'
    window.api.impostazioni.setBarraScura(valore).catch((e) => toastErrore(errMsg(e)))
  }

  // Blocco automatico: dopo i minuti impostati senza toccare niente, l'app
  // torna alla schermata della password. Il database resta aperto — si chiede
  // solo di riconoscersi — cosi' rientrare e' immediato e non si perde niente.
  const [bloccata, setBloccata] = useState(false)

  useEffect(() => {
    if (!sbloccata || bloccata) return
    let scadenza: NodeJS.Timeout | null = null
    let minuti = 0
    const riparti = (): void => {
      if (scadenza) clearTimeout(scadenza)
      if (minuti > 0) scadenza = setTimeout(() => setBloccata(true), minuti * 60 * 1000)
    }
    const eventi = ['mousedown', 'keydown', 'wheel', 'mousemove'] as const
    void window.api.sicurezza.blocco().then((b) => {
      if (!b.attivo) return
      minuti = b.minuti
      riparti()
      for (const e of eventi) window.addEventListener(e, riparti)
    })
    return () => {
      if (scadenza) clearTimeout(scadenza)
      for (const e of eventi) window.removeEventListener(e, riparti)
    }
  }, [sbloccata, bloccata])

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

  // Premere una voce del menu riporta sempre alla prima pagina di quella
  // sezione, anche arrivando da un'altra: se stavi dentro a una scheda o a una
  // seduta, esci. Prima il segnale partiva solo ripremendo la voce in cui gia'
  // eri, e cambiando sezione ci si ritrovava dentro a quello che si era lasciato
  // aperto la volta prima.
  const vaiA = (s: Sezione): void => {
    setSezione(s)
    setTornaAllElenco((n) => n + 1)
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

  if (bloccata) {
    return <SchermoBloccato onSbloccato={() => setBloccata(false)} />
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
          {/* Per prima: e' la schermata del lunedi' mattina, quella che
              risponde a "oggi chi viene". */}
          <button
            className={sezione === 'settimana' ? 'active' : ''}
            onClick={() => vaiA('settimana')}
          >
            <CalendarDays size={18} />
            La settimana
          </button>
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
        {sezione === 'settimana' && (
          <SettimanaPage onApriPaziente={vaiAlPaziente} tornaAllElenco={tornaAllElenco} />
        )}
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
            barraScura={barraScura}
            onBarraScura={scegliBarraScura}
            ingrandimento={ingrandimento}
            onIngrandimento={scegliIngrandimento}
          />
        )}
      </main>
      <ConfermaHost />
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
