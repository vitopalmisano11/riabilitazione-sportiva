import { useState } from 'react'
import { Lock } from 'lucide-react'
import { errMsg } from '../lib'

// Schermata di blocco: l'app resta dov'era, davanti c'e' la richiesta della
// password. L'archivio non viene chiuso — nessun lavoro si perde, e rientrare e'
// immediato: si verifica solo che davanti allo schermo ci sia ancora tu.
export default function SchermoBloccato({
  onSbloccato
}: {
  onSbloccato: () => void
}): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')

  const prova = async (): Promise<void> => {
    try {
      if (await window.api.sicurezza.verificaPassword(password)) {
        onSbloccato()
      } else {
        setErrore('Password errata.')
        setPassword('')
      }
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <Lock size={28} />
        </div>
        <h1>Schermo bloccato</h1>
        <p>L&apos;app si è bloccata da sola. Scrivi la password per riprendere da dove eri.</p>
        <label>
          Password
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void prova()
            }}
          />
        </label>
        {errore && <p className="auth-error">{errore}</p>}
        <button className="primary" onClick={() => void prova()}>
          Riprendi
        </button>
      </div>
    </div>
  )
}
