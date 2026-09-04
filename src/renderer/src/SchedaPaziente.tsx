import { useCallback, useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { SchedaPaziente as Dati } from '../../shared/types'
import { errMsg, formatData } from './lib'
import { recuperoEsteso, volumeTesto } from '../../shared/dosaggio'

// Quello che vede il paziente mentre si allena: solo il suo programma, nella
// stessa forma del documento che si esporta — una tabella per sezione — ma con
// caratteri piu' grandi, perche' si legge in piedi e da lontano. Ne stanno
// aperte piu' d'una insieme, una per paziente.
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

  // Dettagli di un esercizio su una riga sola: "3 × 10 · 20 kg · rec. 1'", e
  // "4 × (3 × 2) · rec. 15" tra i cluster, 2' tra le serie" dove si va a cluster.
  const dettagli = (e: Dati['sezioni'][number]['esercizi'][number]): string =>
    [volumeTesto(e), e.carico, recuperoEsteso(e)].filter(Boolean).join(' · ')

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
            {/* Elenco puntato: una tabella per sezione allungava la scheda e la
                riempiva di caselle vuote. La categoria non si scrive, perche'
                spesso ripete il nome della sezione. */}
            <ul className="elenco-esercizi">
              {sez.esercizi.map((e, j) => (
                <li key={j}>
                  <span className="nome">{e.nome}</span>
                  {dettagli(e) && <span className="dettagli"> — {dettagli(e)}</span>}
                  {e.nota && <span className="nota-es">{e.nota}</span>}
                </li>
              ))}
            </ul>
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
