import { useEffect, useState } from 'react'
import { FolderCog, HeartPulse, KeyRound, Settings, Users } from 'lucide-react'
import PatologiePage from './pages/PatologiePage'
import CategoriePage from './pages/CategoriePage'
import EserciziPage from './pages/EserciziPage'
import QuestionariPage from './pages/QuestionariPage'
import TestValutazionePage from './pages/TestValutazionePage'
import PazientiPage from './pages/PazientiPage'
import AuthGate from './components/AuthGate'
import ToastHost, { toast, toastErrore } from './components/Toast'
import { errMsg } from './lib'

type Sezione = 'pazienti' | 'configurazione'

type TabConfig =
  | 'patologie'
  | 'categorie'
  | 'esercizi'
  | 'questionari'
  | 'testValutazione'
  | 'export'

const TAB_CONFIG: { key: TabConfig; label: string }[] = [
  { key: 'patologie', label: 'Patologie e fasi' },
  { key: 'categorie', label: 'Categorie esercizi' },
  { key: 'esercizi', label: 'Libreria esercizi' },
  { key: 'questionari', label: 'Questionari' },
  { key: 'testValutazione', label: 'Test di valutazione' },
  { key: 'export', label: 'Export' }
]

export default function App(): React.JSX.Element {
  const [sbloccata, setSbloccata] = useState(false)
  const [sezione, setSezione] = useState<Sezione>('pazienti')
  const [cambiaPw, setCambiaPw] = useState(false)
  const [impostazioni, setImpostazioni] = useState(false)

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
            onClick={() => setSezione('pazienti')}
          >
            <Users size={18} />
            Pazienti e sedute
          </button>
        </nav>
        <div className="sidebar-footer">
          <button
            className={sezione === 'configurazione' ? 'active' : ''}
            onClick={() => setSezione('configurazione')}
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
        {sezione === 'pazienti' && <PazientiPage />}
        {sezione === 'configurazione' && <ConfigurazionePage />}
      </main>
      {cambiaPw && <CambiaPasswordModal onClose={() => setCambiaPw(false)} />}
      {impostazioni && <ImpostazioniModal onClose={() => setImpostazioni(false)} />}
      <ToastHost />
    </div>
  )
}

function ConfigurazionePage(): React.JSX.Element {
  const [tab, setTab] = useState<TabConfig>('patologie')

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
      {tab === 'categorie' && <CategoriePage />}
      {tab === 'esercizi' && <EserciziPage />}
      {tab === 'questionari' && <QuestionariPage />}
      {tab === 'testValutazione' && <TestValutazionePage />}
      {tab === 'export' && <ExportConfigPage />}
    </div>
  )
}

function ExportConfigPage(): React.JSX.Element {
  const [cartella, setCartella] = useState('')

  useEffect(() => {
    void window.api.impostazioni.info().then((i) => setCartella(i.cartellaExport))
  }, [])

  const cambia = async (): Promise<void> => {
    try {
      const nuova = await window.api.impostazioni.cambiaCartellaExport()
      if (nuova) setCartella(nuova)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Export</h2>
        <p>
          Cartella di destinazione proposta quando esporti una seduta o uno storico in PDF/Word.
          Puoi comunque cambiarla di volta in volta nella finestra di salvataggio: l&apos;ultima
          cartella usata viene ricordata.
        </p>
      </header>
      <div className="single-col">
        <section className="card">
          <h3>Cartella di destinazione</h3>
          <div className="cartella-path">{cartella}</div>
          <div className="modal-actions">
            <button className="primary" onClick={() => void cambia()}>
              Cambia cartella…
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function ImpostazioniModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [cartella, setCartella] = useState('')

  useEffect(() => {
    void window.api.impostazioni.info().then((i) => setCartella(i.cartella))
  }, [])

  const cambia = async (): Promise<void> => {
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <h3>Dati e backup</h3>
        <p className="modal-testo">
          Tutti i dati vivono in questa cartella: <code>riabilitazione.db</code> (database
          cifrato) e <code>auth.json</code> (chiavi di accesso). Per il backup manuale copia
          l&apos;intera cartella — senza <code>auth.json</code> il database non è apribile.
        </p>
        <div className="cartella-path">{cartella}</div>
        <div className="modal-actions">
          <button onClick={() => void window.api.impostazioni.apriCartella()}>
            Apri cartella
          </button>
          <button onClick={() => void cambia()}>Cambia cartella…</button>
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
