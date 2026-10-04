import { useEffect, useState } from 'react'
import { errMsg } from '../lib'
import LogoApp from './LogoApp'
import ConsiglioPassword from './ConsiglioPassword'
import { controllaPassword } from '../../../shared/password'
import type { InfoAccesso, StatoAccesso } from '../../../shared/types'

// Oltre ai passi dell'accesso, i casi in cui l'archivio non si trova (vedi
// main/accesso.ts): ognuno ha la sua schermata, e nessuno propone di creare un
// archivio nuovo.
type Modo = 'caricamento' | StatoAccesso | 'chiave' | 'recupero' | 'errore'

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
  // dove stanno (o dovrebbero stare) i dati: si mostra, cosi' si sa di cosa si parla
  const [cartella, setCartella] = useState('')

  const aggiorna = (info: InfoAccesso): void => {
    setCartella(info.cartella)
    setModo(info.stato)
  }

  useEffect(() => {
    window.api.auth
      .status()
      .then(aggiorna)
      .catch((e) => {
        setErrore(errMsg(e))
        setModo('errore')
      })
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
      const debole = controllaPassword(pw)
      if (debole) throw new Error(debole)
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
      const debole = controllaPassword(pw)
      if (debole) throw new Error(debole)
      if (pw !== pw2) throw new Error('Le password non coincidono.')
      if (conDomanda) await window.api.auth.recoverDomanda(risposta, pw)
      else await window.api.auth.recover(rk, pw)
      onUnlocked()
    })

  const rileggi = (): Promise<void> =>
    run(async () => {
      aggiorna(await window.api.auth.status())
    })

  const scegliCartella = (): Promise<void> =>
    run(async () => {
      const info = await window.api.auth.scegliCartellaDati()
      if (info) aggiorna(info)
    })

  const prendiChiavi = (): Promise<void> =>
    run(async () => {
      const info = await window.api.auth.prendiChiavi()
      if (info) aggiorna(info)
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
        <LogoApp className="auth-logo-app" />
        {modo === 'setup' && (
          <>
            <h1>Gestionale Fisioterapia</h1>
            <p>
              Primo avvio: scegli la password che proteggerà i dati dei pazienti. Il database
              viene cifrato con questa chiave.
            </p>
            <p className="hint">L&apos;archivio verrà creato in:</p>
            <div className="cartella-path">{cartella}</div>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault()
                void setup()
              }}
            >
              <label className="field">
                Password (almeno 10 caratteri: meglio una frase di qualche parola)
                <input
                  type="password"
                  autoFocus
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <ConsiglioPassword password={pw} />
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
            <div className="auth-links">
              <button className="link-btn" disabled={occupato} onClick={() => void scegliCartella()}>
                Hai già un archivio? Scegli la cartella dove si trova
              </button>
            </div>
          </>
        )}

        {modo === 'cartella-assente' && (
          <>
            <h1>Non trovo i tuoi dati</h1>
            <p>I dati dei pazienti stanno in una cartella che adesso non si raggiunge:</p>
            <div className="cartella-path">{cartella}</div>
            <p>
              Se è su un disco esterno o una chiavetta, collegala. Se è in OneDrive, aspetta che
              finisca di sincronizzarsi. Poi premi «Riprova». I dati non sono stati toccati.
            </p>
            {errore && <p className="auth-error">{errore}</p>}
            <button className="primary" disabled={occupato} onClick={() => void rileggi()}>
              Riprova
            </button>
            <div className="auth-links">
              <button className="link-btn" disabled={occupato} onClick={() => void scegliCartella()}>
                I dati sono in un&apos;altra cartella: sceglila
              </button>
            </div>
          </>
        )}

        {modo === 'chiavi-mancanti' && (
          <>
            <h1>Manca il file delle chiavi</h1>
            <p>
              Nella cartella dei dati c&apos;è l&apos;archivio, ma non il file{' '}
              <strong>auth.json</strong> che lo apre:
            </p>
            <div className="cartella-path">{cartella}</div>
            <p>
              Lo trovi in ogni copia di sicurezza: nella cartella «Backup» o in una copia su
              chiavetta. Prendilo da lì, poi entra con la password che usavi quando è stata fatta
              quella copia. Non creare un archivio nuovo: quello che c&apos;è non si aprirebbe più.
            </p>
            {errore && <p className="auth-error">{errore}</p>}
            <button className="primary" disabled={occupato} onClick={() => void prendiChiavi()}>
              Prendi le chiavi da una copia…
            </button>
            <div className="auth-links">
              <button className="link-btn" disabled={occupato} onClick={() => void rileggi()}>
                Riprova
              </button>
            </div>
          </>
        )}

        {modo === 'impostazioni-illeggibili' && (
          <>
            <h1>Non so dove sono i tuoi dati</h1>
            <p>
              Il file delle impostazioni del programma non si legge, e dentro c&apos;è scritto dove
              stanno i dati:
            </p>
            <div className="cartella-path">{cartella}</div>
            <p>
              Riprova fra un momento. Se non passa, indica tu la cartella dei dati (quella con
              riabilitazione.db, di solito Documenti › Riabilitazione): colori e preferenze tornano
              quelli di partenza, i dati restano.
            </p>
            {errore && <p className="auth-error">{errore}</p>}
            <button className="primary" disabled={occupato} onClick={() => void rileggi()}>
              Riprova
            </button>
            <div className="auth-links">
              <button className="link-btn" disabled={occupato} onClick={() => void scegliCartella()}>
                Scegli la cartella dei dati
              </button>
            </div>
          </>
        )}

        {modo === 'errore' && (
          <>
            <h1>Qualcosa non va all&apos;avvio</h1>
            {errore && <p className="auth-error">{errore}</p>}
            <button className="primary" disabled={occupato} onClick={() => void rileggi()}>
              Riprova
            </button>
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
                Nuova password (almeno 10 caratteri: meglio una frase di qualche parola)
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                <ConsiglioPassword password={pw} />
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
