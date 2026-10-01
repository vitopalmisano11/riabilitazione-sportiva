import { useEffect, useState } from 'react'
import { errMsg } from '../lib'
import iconaApp from '../../../../resources/icon.png'

type Modo = 'caricamento' | 'setup' | 'chiave' | 'login' | 'recupero'

export default function AuthGate({ onUnlocked }: { onUnlocked: () => void }): React.JSX.Element {
  const [modo, setModo] = useState<Modo>('caricamento')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [rk, setRk] = useState('')
  // Il recupero: con la chiave, oppure rispondendo alla domanda se c'e'.
  const [domanda, setDomanda] = useState<string | null>(null)
  const [conDomanda, setConDomanda] = useState(false)
  const [risposta, setRisposta] = useState('')
  const [chiave, setChiave] = useState('')
  const [salvata, setSalvata] = useState(false)
  const [copiata, setCopiata] = useState(false)
  const [errore, setErrore] = useState('')
  const [occupato, setOccupato] = useState(false)

  useEffect(() => {
    void window.api.auth.status().then(setModo)
    void window.api.auth
      .domanda()
      .then(setDomanda)
      .catch(() => setDomanda(null))
  }, [])

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setErrore('')
    setOccupato(true)
    try {
      await fn()
    } catch (e) {
      setErrore(errMsg(e))
    } finally {
      setOccupato(false)
    }
  }

  const setup = (): Promise<void> =>
    run(async () => {
      if (pw.length < 8) throw new Error('La password deve avere almeno 8 caratteri.')
      if (pw !== pw2) throw new Error('Le password non coincidono.')
      const k = await window.api.auth.setup(pw)
      setChiave(k)
      setModo('chiave')
    })

  const login = (): Promise<void> =>
    run(async () => {
      await window.api.auth.login(pw)
      onUnlocked()
    })

  const recupera = (): Promise<void> =>
    run(async () => {
      if (pw.length < 8) throw new Error('La nuova password deve avere almeno 8 caratteri.')
      if (pw !== pw2) throw new Error('Le password non coincidono.')
      if (conDomanda) await window.api.auth.recoverDomanda(risposta, pw)
      else await window.api.auth.recover(rk, pw)
      onUnlocked()
    })

  const copia = (): void => {
    void navigator.clipboard.writeText(chiave).then(() => setCopiata(true))
  }

  if (modo === 'caricamento') {
    return <div className="auth-screen" />
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-logo-app" src={iconaApp} alt="" />
        {modo === 'setup' && (
          <>
            <h1>Gestionale Fisioterapia</h1>
            <p>
              Primo avvio: scegli la password che proteggerà i dati dei pazienti. Il database
              viene cifrato con questa chiave.
            </p>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault()
                void setup()
              }}
            >
              <label className="field">
                Password (min 8 caratteri)
                <input
                  type="password"
                  autoFocus
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              </label>
              <label className="field">
                Conferma password
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </label>
              {errore && <p className="auth-error">{errore}</p>}
              <button className="primary" type="submit" disabled={occupato}>
                {occupato ? 'Creazione in corso…' : 'Crea password e cifra i dati'}
              </button>
            </form>
          </>
        )}

        {modo === 'chiave' && (
          <>
            <h1>Chiave di recupero</h1>
            <p>
              Se dimentichi la password, questa chiave è <strong>l&apos;unico modo</strong> per
              riaccedere ai dati. Stampala o salvala in un posto sicuro (non sul pc insieme
              all&apos;app).
            </p>
            <div className="recovery-key">{chiave}</div>
            <button onClick={copia}>{copiata ? 'Copiata ✓' : 'Copia negli appunti'}</button>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={salvata}
                onChange={(e) => setSalvata(e.target.checked)}
              />
              Ho salvato la chiave in un posto sicuro
            </label>
            <button
              className="primary"
              disabled={!salvata}
              onClick={() => {
                onUnlocked()
              }}
            >
              Entra nell&apos;app
            </button>
          </>
        )}

        {modo === 'login' && (
          <>
            <h1>Gestionale Fisioterapia</h1>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault()
                void login()
              }}
            >
              <label className="field">
                Password
                <input
                  type="password"
                  autoFocus
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
              </label>
              {errore && <p className="auth-error">{errore}</p>}
              <button className="primary" type="submit" disabled={occupato}>
                {occupato ? 'Accesso…' : 'Accedi'}
              </button>
            </form>
            <div className="auth-links">
              <button
                className="link-btn"
                onClick={() => {
                  setErrore('')
                  setPw('')
                  setPw2('')
                  setModo('recupero')
                }}
              >
                Ho dimenticato la password
              </button>
            </div>
          </>
        )}

        {modo === 'recupero' && (
          <>
            <h1>Recupero accesso</h1>
            {domanda && (
              <span className="scelta-coppia segmentata scelta-recupero">
                <button
                  type="button"
                  className={conDomanda ? '' : 'scelta-attiva'}
                  onClick={() => {
                    setErrore('')
                    setConDomanda(false)
                  }}
                >
                  Chiave di recupero
                </button>
                <button
                  type="button"
                  className={conDomanda ? 'scelta-attiva' : ''}
                  onClick={() => {
                    setErrore('')
                    setConDomanda(true)
                  }}
                >
                  Domanda
                </button>
              </span>
            )}
            <p>
              {conDomanda
                ? 'Rispondi alla domanda che hai scelto e scegli una nuova password.'
                : 'Inserisci la chiave di recupero che hai salvato alla prima configurazione e scegli una nuova password.'}
            </p>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault()
                void recupera()
              }}
            >
              {conDomanda ? (
                <label className="field">
                  {domanda}
                  <input
                    key="risposta"
                    type="password"
                    autoFocus
                    placeholder="La tua risposta"
                    value={risposta}
                    onChange={(e) => setRisposta(e.target.value)}
                  />
                </label>
              ) : (
                <label className="field">
                  Chiave di recupero
                  <input
                    key="chiave"
                    autoFocus
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    value={rk}
                    onChange={(e) => setRk(e.target.value)}
                  />
                </label>
              )}
              <label className="field">
                Nuova password (min 8 caratteri)
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </label>
              <label className="field">
                Conferma nuova password
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </label>
              {errore && <p className="auth-error">{errore}</p>}
              <button className="primary" type="submit" disabled={occupato}>
                {occupato ? 'Recupero…' : 'Recupera e accedi'}
              </button>
            </form>
            <div className="auth-links">
              <button
                className="link-btn"
                onClick={() => {
                  setErrore('')
                  setPw('')
                  setPw2('')
                  setModo('login')
                }}
              >
                Torna al login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
