import type { DomandaQuestionario } from '../../../shared/types'

// Una domanda a tabella, come sulla carta (la 9 dell'IKDC: «Come influisce il
// ginocchio sulla capacità di…»): le attività in riga, le risposte in colonna,
// e in ogni riga si sceglie una casella sola.
//
// Le risposte sono le stesse per tutte le righe: i titoli delle colonne sono
// quelli della prima. Ogni riga e' una domanda vera, con il suo valore.
//
// Serve sia a compilare sia, senza risposte e in sola lettura, come anteprima
// nell'editor del questionario.
export default function GrigliaQuestionario({
  righe,
  risposte,
  soloLettura,
  onScegli
}: {
  righe: DomandaQuestionario[]
  // domanda_id -> valore scelto
  risposte: Record<number, number>
  soloLettura?: boolean
  onScegli?: (domandaId: number, valore: number) => void
}): React.JSX.Element {
  const colonne = righe[0]?.opzioni ?? []

  return (
    <div className="griglia-questionario-scorre">
      <table className="griglia-questionario">
        <thead>
          <tr>
            <th />
            {colonne.map((o, k) => (
              <th key={k}>{o.etichetta || <span className="hint">risposta {k + 1}</span>}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {righe.map((r, i) => (
            <tr key={r.id ?? i}>
              <th scope="row">{r.testo || <span className="hint">riga senza testo</span>}</th>
              {r.opzioni.map((o, k) => {
                const scelta = r.id != null && risposte[r.id] === o.punteggio
                return (
                  <td key={k}>
                    <button
                      type="button"
                      aria-label={`${r.testo}: ${o.etichetta}`}
                      aria-pressed={scelta}
                      disabled={soloLettura || r.id == null}
                      className={scelta ? 'cella-griglia scelta' : 'cella-griglia'}
                      onClick={() => r.id != null && onScegli?.(r.id, o.punteggio)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
