import { useCallback, useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { SchedaPaziente as Dati } from '../../shared/types'
import { errMsg, formatData } from './lib'
import { caricoTesto, recuperoTesto, volumeTesto } from '../../shared/dosaggio'

// Quello che vede il paziente mentre si allena: solo il suo programma. Ne
// stanno aperte piu' d'una insieme, una per paziente.
//
// E' una tabella, non un elenco: si legge in piedi, spesso da un metro di
// distanza, e quello che serve sapere sono quattro cose sempre nello stesso
// posto — cosa fare, quanto, con che carico, quanto riposare. Incolonnate si
// trovano con un colpo d'occhio; di seguito sulla stessa riga, no.
export default function SchedaPaziente({ sedutaId }: { sedutaId: number }): React.JSX.Element {
  const [dati, setDati] = useState<Dati | null>(null)
  const [errore, setErrore] = useState('')

  // Se durante la seduta cambi il programma, il paziente lo rivede premendo
  // "Aggiorna": la finestra non si accorge da sola delle modifiche.
  const carica = useCallback((): void => {
    window.api.scheda
      .dati(sedutaId)
      .then(setDati)
      .catch((e) => setErrore(errMsg(e)))
  }, [sedutaId])

  useEffect(carica, [carica])

  if (errore) return <p className="auth-error">{errore}</p>
  if (!dati) return <p className="hint">Caricamento…</p>

  const unita = dati.unita_carico

  return (
    <div className="scheda-paziente">
      <header>
        <div>
          <h1>{dati.paziente}</h1>
          <p>
            {formatData(dati.data)}
            {dati.fase_nome && ` · ${dati.fase_nome}`}
          </p>
        </div>
        <button title="Ricarica il programma" onClick={carica}>
          <RotateCw size={18} /> Aggiorna
        </button>
      </header>

      {dati.sezioni.length === 0 ? (
        <p className="hint">Questa seduta non ha ancora esercizi.</p>
      ) : (
        dati.sezioni.map((sez, i) => (
          <section key={i}>
            <h2>{sez.nome}</h2>
            <table className="tabella-scheda">
              {/* Le intestazioni si ripetono a ogni sezione: sono corte e
                  chiare, e cosi' una sezione si legge anche se l'altra e'
                  scorsa fuori dallo schermo. */}
              <thead>
                <tr>
                  <th>Esercizio</th>
                  <th>Serie × rip.</th>
                  <th>Carico</th>
                  <th>Recupero</th>
                </tr>
              </thead>
              <tbody>
                {sez.esercizi.map((e, j) => (
                  <tr key={j}>
                    <td className="col-esercizio">
                      <span className="nome">{e.nome}</span>
                      {/* La nota sta sotto al nome, non in una riga sua: e'
                          quella l'unica colonna che puo' allungarsi. */}
                      {e.nota && <span className="nota-es">{e.nota}</span>}
                    </td>
                    <td className="col-dose">{volumeTesto(e) ?? '—'}</td>
                    <td className="col-dose">{caricoTesto(e.carico, unita) ?? '—'}</td>
                    <td className="col-dose">{recuperoTesto(e) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      {dati.note && (
        <section>
          <h2>Note</h2>
          <p className="nota-seduta">{dati.note}</p>
        </section>
      )}
    </div>
  )
}
