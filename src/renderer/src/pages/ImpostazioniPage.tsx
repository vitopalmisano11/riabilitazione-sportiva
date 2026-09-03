import { useEffect, useState } from 'react'
import type { Tema } from '../../../shared/temi'
import { TEMI } from '../../../shared/temi'
import PannelloBackup from '../components/PannelloBackup'
import { toast, toastErrore } from '../components/Toast'
import { errMsg } from '../lib'

// Impostazioni dell'app: dove stanno i dati e le copie, la password, il colore.
//
// Prima erano due finestrine appese in fondo alla barra laterale, e il tema non
// c'era. Sono cose che si toccano di rado ma che vanno trovate subito, percio'
// stanno in una sezione sola, a schede, come la configurazione.

type Scheda = 'dati' | 'password' | 'aspetto'

const SCHEDE: { key: Scheda; label: string }[] = [
  { key: 'dati', label: 'Dati e backup' },
  { key: 'password', label: 'Password' },
  { key: 'aspetto', label: 'Aspetto' }
]

export default function ImpostazioniPage({
  tornaAllInizio,
  tema,
  onTema,
  scuro,
  onScuro
}: {
  tornaAllInizio: number
  tema: Tema
  onTema: (t: Tema) => void
  scuro: boolean
  onScuro: (valore: boolean) => void
}): React.JSX.Element {
  const [scheda, setScheda] = useState<Scheda>('dati')

  useEffect(() => {
    if (tornaAllInizio === 0) return
    setScheda('dati')
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
        {scheda === 'password' && <SchedaPassword />}
        {scheda === 'aspetto' && (
          <>
            <SchedaAspetto tema={tema} onTema={onTema} />
            <SchedaLuce scuro={scuro} onScuro={onScuro} />
          </>
        )}
      </div>
    </div>
  )
}

function SchedaDati(): React.JSX.Element {
  const [cartella, setCartella] = useState('')
  const [cartellaExport, setCartellaExport] = useState('')

  useEffect(() => {
    void window.api.impostazioni.info().then((i) => {
      setCartella(i.cartella)
      setCartellaExport(i.cartellaExport)
    })
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
    <section className="card">
      <div className="blocco-impostazione">
        <div className="sotto-titolo">Cartella dei dati</div>
        <p className="modal-testo">
          Tutti i tuoi dati vivono qui: <code>riabilitazione.db</code> (il database cifrato) e{' '}
          <code>auth.json</code> (le chiavi di accesso). Servono <b>entrambi</b>: senza
          <code>auth.json</code> il database non è apribile.
        </p>
        <div className="cartella-path">{cartella}</div>
        <div className="modal-actions">
          <button onClick={() => void window.api.impostazioni.apriCartella()}>Apri cartella</button>
          <button onClick={() => void cambiaDati()}>Cambia cartella…</button>
        </div>
      </div>

      <div className="blocco-impostazione">
        <div className="sotto-titolo">Cartella per gli export</div>
        <p className="modal-testo">
          Dove l&apos;app propone di salvare quando esporti una seduta o uno storico in PDF/Word.
          Puoi comunque cambiarla di volta in volta nella finestra di salvataggio: l&apos;ultima
          cartella usata viene ricordata.
        </p>
        <div className="cartella-path">{cartellaExport}</div>
        <div className="modal-actions">
          <button onClick={() => void cambiaExport()}>Cambia cartella…</button>
        </div>
      </div>

      <PannelloBackup />
    </section>
  )
}

function SchedaPassword(): React.JSX.Element {
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
      setVecchia('')
      setNuova('')
      setConferma('')
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  return (
    <section className="card single-col">
      <div className="sotto-titolo">Cambia password</div>
      <p className="modal-testo">
        La chiave di recupero non cambia: quella che hai messo da parte al primo avvio resta
        valida.
      </p>
      <label>
        Password attuale
        <input type="password" value={vecchia} onChange={(e) => setVecchia(e.target.value)} />
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
        <button className="primary" onClick={() => void salva()}>
          Salva
        </button>
      </div>
    </section>
  )
}

function SchedaAspetto({
  tema,
  onTema
}: {
  tema: Tema
  onTema: (t: Tema) => void
}): React.JSX.Element {
  return (
    <section className="card single-col">
      <div className="sotto-titolo">Colore dell&apos;app</div>
      <p className="modal-testo">
        Il colore cambia subito, e vale anche per i documenti che stampi: intestazioni delle
        sezioni e righe dei titoli nelle tabelle.
      </p>
      <div className="scelta-tema">
        {TEMI.map((t) => (
          <button
            key={t.valore}
            className={tema === t.valore ? 'scelta-attiva' : ''}
            onClick={() => onTema(t.valore)}
          >
            <span className="pallino-tema" style={{ background: t.colore }} />
            {t.etichetta}
          </button>
        ))}
      </div>

    </section>
  )
}

// La modalita' scura non e' una tavolozza a parte: si accende sopra a quella
// scelta, che resta riconoscibile dal colore dei pulsanti. Percio' e' un
// riquadro suo, con l'interruttore a destra come si fa con le impostazioni che
// si accendono e si spengono.
function SchedaLuce({
  scuro,
  onScuro
}: {
  scuro: boolean
  onScuro: (valore: boolean) => void
}): React.JSX.Element {
  return (
    <section className="card single-col">
      <label className="riga-interruttore">
        <span>
          <span className="nome-interruttore">Modalità scura</span>
          <span className="modal-testo">
            Fondi scuri e scritte chiare, con il colore della tavolozza che hai scelto. I
            documenti che stampi restano chiari: vanno sulla carta.
          </span>
        </span>
        <input type="checkbox" checked={scuro} onChange={(e) => onScuro(e.target.checked)} />
      </label>
    </section>
  )
}
