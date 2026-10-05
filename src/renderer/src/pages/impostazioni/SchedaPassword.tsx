import { useState } from 'react'
import Aiuto from '../../components/Aiuto'
import ConsiglioPassword from '../../components/ConsiglioPassword'
import { controllaPassword } from '../../../../shared/password'
import { toast } from '../../components/Toast'
import { errMsg } from '../../lib'

export function SchedaPassword(): React.JSX.Element {
  const [vecchia, setVecchia] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState('')

  const salva = async (): Promise<void> => {
    setErrore('')
    const debole = controllaPassword(nuova)
    if (debole) {
      setErrore(debole)
      return
    }
    if (nuova !== conferma) {
      setErrore('Le nuove password non coincidono.')
      return
    }
    try {
      await window.api.auth.cambiaPassword(vecchia, nuova)
      toast('Password aggiornata. La chiave di recupero e la domanda restano valide.')
      setVecchia('')
      setNuova('')
      setConferma('')
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  return (
    <section className="card single-col">
      <div className="sotto-titolo">
        Cambia password
        <Aiuto testo="La chiave di recupero non cambia: quella che hai messo da parte al primo avvio resta valida. Anche la domanda di recupero, se l'hai impostata, resta com'è." />
      </div>
      <label>
        Password attuale
        <input type="password" value={vecchia} onChange={(e) => setVecchia(e.target.value)} />
      </label>
      <label>
        Nuova password (almeno 10 caratteri: meglio una frase di qualche parola)
        <input type="password" value={nuova} onChange={(e) => setNuova(e.target.value)} />
        <ConsiglioPassword password={nuova} />
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
