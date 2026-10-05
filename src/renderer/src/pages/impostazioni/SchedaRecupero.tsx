import { useEffect, useState } from 'react'
import Aiuto from '../../components/Aiuto'
import { toast, toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'

// Come si rientra se si dimentica la password. La chiave di recupero c'e'
// sempre, dal primo avvio. In piu' si puo' impostare una domanda: e' piu' comoda
// da ricordare, ma meno sicura della chiave, quindi si aggiunge a lei e non la
// sostituisce. Per impostarla o toglierla serve la password di adesso.
export function SchedaRecupero(): React.JSX.Element {
  const [domanda, setDomanda] = useState<string | null>(null)
  const [modo, setModo] = useState<'vedi' | 'imposta' | 'togli'>('vedi')
  const [testo, setTesto] = useState('')
  const [risposta, setRisposta] = useState('')
  const [ripeti, setRipeti] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')

  const carica = (): void => {
    window.api.auth
      .domanda()
      .then(setDomanda)
      .catch((e) => toastErrore(errMsg(e)))
  }
  useEffect(carica, [])

  const chiudi = (): void => {
    setModo('vedi')
    setTesto('')
    setRisposta('')
    setRipeti('')
    setPassword('')
    setErrore('')
  }

  const salva = async (): Promise<void> => {
    setErrore('')
    if (risposta.trim().toLowerCase() !== ripeti.trim().toLowerCase()) {
      setErrore('Le due risposte non coincidono.')
      return
    }
    try {
      await window.api.auth.impostaDomanda(password, testo, risposta)
      toast('Domanda di recupero salvata.')
      chiudi()
      carica()
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  const togli = async (): Promise<void> => {
    setErrore('')
    try {
      await window.api.auth.togliDomanda(password)
      toast('Domanda di recupero tolta. Resta la chiave di recupero.')
      chiudi()
      carica()
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  return (
    <section className="card single-col">
      <div className="sotto-titolo">
        Recupero della password
        <Aiuto testo="Se dimentichi la password puoi rientrare in due modi. Con la chiave di recupero che hai salvato al primo avvio: vale sempre ed è il modo più sicuro. Oppure rispondendo a una domanda che scegli tu: è più comoda, ma una risposta si indovina più facilmente di una chiave. Scegli una domanda la cui risposta sai solo tu e non si trova online (non il nome dello studio o la tua città). Maiuscole e spazi nella risposta non contano." />
      </div>

      <div className="stato-recupero">
        <div className="riga-recupero">
          <span className="nome-recupero">Chiave di recupero</span>
          <span className="badge-stato">Attiva</span>
        </div>
        <div className="riga-recupero">
          <span className="nome-recupero">Domanda di recupero</span>
          {domanda ? (
            <span className="badge-stato">Attiva</span>
          ) : (
            <span className="badge-stato follow">Non impostata</span>
          )}
        </div>
        {domanda && <p className="hint domanda-attuale">«{domanda}»</p>}
      </div>

      {modo === 'imposta' && (
        <>
          <label>
            Domanda
            <input
              autoFocus
              placeholder="es. Come si chiamava la mia maestra delle elementari?"
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
            />
          </label>
          <label>
            Risposta (almeno 8 caratteri: meglio una frase che una parola)
            <input type="password" value={risposta} onChange={(e) => setRisposta(e.target.value)} />
          </label>
          <label>
            Ripeti la risposta
            <input type="password" value={ripeti} onChange={(e) => setRipeti(e.target.value)} />
          </label>
        </>
      )}
      {modo !== 'vedi' && (
        <label>
          Password attuale
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      )}
      {errore && <p className="auth-error">{errore}</p>}

      <div className="modal-actions">
        {modo === 'vedi' ? (
          <>
            {domanda && <button onClick={() => setModo('togli')}>Togli la domanda</button>}
            <button className="primary" onClick={() => setModo('imposta')}>
              {domanda ? 'Cambia la domanda' : 'Imposta una domanda'}
            </button>
          </>
        ) : (
          <>
            <button onClick={chiudi}>Annulla</button>
            {modo === 'imposta' ? (
              <button className="primary" onClick={() => void salva()}>
                Salva la domanda
              </button>
            ) : (
              <button className="primary" onClick={() => void togli()}>
                Togli la domanda
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
