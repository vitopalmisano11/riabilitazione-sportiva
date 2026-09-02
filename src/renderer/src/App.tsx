import { useEffect, useState } from 'react'
import {
  CalendarClock,
  ClipboardCheck,
  FolderCog,
  HeartPulse,
  KeyRound,
  Settings,
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
import AuthGate from './components/AuthGate'
import ToastHost, { toast, toastErrore } from './components/Toast'
import PannelloBackup from './components/PannelloBackup'
import { errMsg } from './lib'

type Sezione = 'pazienti' | 'followup' | 'screening' | 'configurazione'

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
  const [cambiaPw, setCambiaPw] = useState(false)
  const [impostazioni, setImpostazioni] = useState(false)
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
          <button onClick={() => setImpostazioni(true)}>
            <FolderCog size={17} />
            Dati e backup
          </button>
          <button onClick={() => setCambiaPw(true)}>
            <KeyRound size={17} />
            Cambia password
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
      </main>
      {cambiaPw && <CambiaPasswordModal onClose={() => setCambiaPw(false)} />}
      {impostazioni && <ImpostazioniModal onClose={() => setImpostazioni(false)} />}
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

function ImpostazioniModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [cartella, setCartella] = useState('')
  const [cartellaExport, setCartellaExport] = useState('')

  const ricarica = (): Promise<void> =>
    window.api.impostazioni.info().then((i) => {
      setCartella(i.cartella)
      setCartellaExport(i.cartellaExport)
    })

  useEffect(() => {
    void ricarica()
  }, [])

  const cambiaDati = async (): Promise<void> => {
    try {
      const nuova = await window.api.impostazioni.cambiaCartella()
      if (nuova) {
        setCartella(nuova)
        toast('Dati spostati nella nuova cartella.')
      }
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const cambiaExport = async (): Promise<void> => {
    try {
      const nuova = await window.api.impostazioni.cambiaCartellaExport()
      if (nuova) setCartellaExport(nuova)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Dati e backup</h3>

        <div className="blocco-impostazione">
          <div className="sotto-titolo">Cartella dei dati</div>
          <p className="modal-testo">
            Tutti i tuoi dati vivono qui: <code>riabilitazione.db</code> (il database cifrato) e{' '}
            <code>auth.json</code> (le chiavi di accesso). Servono <b>entrambi</b>: senza
            <code>auth.json</code> il database non è apribile.
          </p>
          <div className="cartella-path">{cartella}</div>
          <div className="modal-actions">
            <button onClick={() => void window.api.impostazioni.apriCartella()}>
              Apri cartella
            </button>
            <button onClick={() => void cambiaDati()}>Cambia cartella…</button>
          </div>
        </div>

        <div className="blocco-impostazione">
          <div className="sotto-titolo">Cartella per gli export</div>
          <p className="modal-testo">
            Dove l&apos;app propone di salvare quando esporti una seduta o uno storico in
            PDF/Word. Puoi comunque cambiarla di volta in volta nella finestra di salvataggio:
            l&apos;ultima cartella usata viene ricordata.
          </p>
          <div className="cartella-path">{cartellaExport}</div>
          <div className="modal-actions">
            <button onClick={() => void cambiaExport()}>Cambia cartella…</button>
          </div>
        </div>

        <PannelloBackup />

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

function CambiaPasswordModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [vecchia, setVecchia] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState('')

  const salva = async (): Promise<void> => {
    setErrore('')
    if (nuova.length < 8) {
      setErrore('La nuova password deve avere almeno 8 caratteri.')
      return
    }
    if (nuova !== conferma) {
      setErrore('Le nuove password non coincidono.')
      return
    }
    try {
      await window.api.auth.cambiaPassword(vecchia, nuova)
      toast('Password aggiornata. La chiave di recupero resta valida.')
      onClose()
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <h3>Cambia password</h3>
        <label>
          Password attuale
          <input
            type="password"
            autoFocus
            value={vecchia}
            onChange={(e) => setVecchia(e.target.value)}
          />
        </label>
        <label>
          Nuova password (min 8 caratteri)
          <input type="password" value={nuova} onChange={(e) => setNuova(e.target.value)} />
        </label>
        <label>
          Conferma nuova password
          <input type="password" value={conferma} onChange={(e) => setConferma(e.target.value)} />
        </label>
        {errore && <p className="auth-error">{errore}</p>}
        <div className="modal-actions">
          <button onClick={onClose}>Annulla</button>
          <button className="primary" onClick={() => void salva()}>
            Salva
          </button>
        </div>
      </div>
    </div>
  )
}
