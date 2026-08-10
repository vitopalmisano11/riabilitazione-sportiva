import { useState } from 'react'
import PatologiePage from './pages/PatologiePage'
import CategoriePage from './pages/CategoriePage'
import EserciziPage from './pages/EserciziPage'
import PazientiPage from './pages/PazientiPage'
import AuthGate from './components/AuthGate'
import { errMsg } from './lib'

type Sezione = 'patologie' | 'categorie' | 'esercizi' | 'pazienti'

const SEZIONI: { key: Sezione; label: string }[] = [
  { key: 'patologie', label: 'Patologie e fasi' },
  { key: 'categorie', label: 'Categorie esercizi' },
  { key: 'esercizi', label: 'Libreria esercizi' }
]

export default function App(): React.JSX.Element {
  const [sbloccata, setSbloccata] = useState(false)
  const [sezione, setSezione] = useState<Sezione>('pazienti')
  const [cambiaPw, setCambiaPw] = useState(false)

  if (!sbloccata) {
    return <AuthGate onUnlocked={() => setSbloccata(true)} />
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Riabilitazione</h1>
        <div className="nav-group-label">Lavoro quotidiano</div>
        <nav>
          <button
            className={sezione === 'pazienti' ? 'active' : ''}
            onClick={() => setSezione('pazienti')}
          >
            Pazienti e sedute
          </button>
        </nav>
        <div className="nav-group-label">Configurazione</div>
        <nav>
          {SEZIONI.map((s) => (
            <button
              key={s.key}
              className={sezione === s.key ? 'active' : ''}
              onClick={() => setSezione(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={() => setCambiaPw(true)}>Cambia password</button>
        </div>
      </aside>
      <main className="content">
        {sezione === 'patologie' && <PatologiePage />}
        {sezione === 'categorie' && <CategoriePage />}
        {sezione === 'esercizi' && <EserciziPage />}
        {sezione === 'pazienti' && <PazientiPage />}
      </main>
      {cambiaPw && <CambiaPasswordModal onClose={() => setCambiaPw(false)} />}
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
      alert('Password aggiornata. La chiave di recupero resta valida.')
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
