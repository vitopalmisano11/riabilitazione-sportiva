import { useCallback, useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { SchedaPaziente as Dati } from '../../shared/types'
import { errMsg, formatData } from './lib'

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

  // Una colonna si mostra solo se almeno un esercizio della seduta la usa:
  // senza carico e senza recupero la tabella resta larga e leggibile.
  const tutti = dati.sezioni.flatMap((s) => s.esercizi)
  const colonne = {
    serie: tutti.some((e) => e.serie),
    ripetizioni: tutti.some((e) => e.ripetizioni),
    carico: tutti.some((e) => e.carico),
    recupero: tutti.some((e) => e.recupero),
    nota: tutti.some((e) => e.nota)
  }

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
              <thead>
                <tr>
                  <th>Esercizio</th>
                  {colonne.serie && <th>Serie</th>}
                  {colonne.ripetizioni && <th>Ripetizioni</th>}
                  {colonne.carico && <th>Carico</th>}
                  {colonne.recupero && <th>Recupero</th>}
                  {colonne.nota && <th>Note</th>}
                </tr>
              </thead>
              <tbody>
                {sez.esercizi.map((e, j) => (
                  <tr key={j}>
                    <td>
                      {e.nome}
                      <span className="categoria">{e.categoria_nome}</span>
                    </td>
                    {colonne.serie && <td>{e.serie ?? ''}</td>}
                    {colonne.ripetizioni && <td>{e.ripetizioni ?? ''}</td>}
                    {colonne.carico && <td>{e.carico ?? ''}</td>}
                    {colonne.recupero && <td>{e.recupero ?? ''}</td>}
                    {colonne.nota && <td>{e.nota ?? ''}</td>}
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
