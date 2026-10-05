import type { LatoRilievo, RilievoTest, TestDistretto } from '../../../../shared/types'
import ScalaPallini from '../ScalaPallini'

// I test di un gruppo, in una tabella come i movimenti: una riga per test, con
// destra e sinistra affiancate sotto alla fascia del loro lato, e in fondo alla
// riga una nota sola per il test. Prima ogni test erano due righe, con "Dx" e
// "Sx" e una nota per lato, e il nome scritto solo sulla prima.
export function TabellaTest({
  test,
  lati,
  latoInteressato,
  soloLettura,
  risposta,
  onCambia,
  nota,
  onNota
}: {
  test: TestDistretto[]
  lati: LatoRilievo[]
  latoInteressato: 'dx' | 'sx' | null
  soloLettura: boolean
  risposta: (id: number, lato: LatoRilievo) => RilievoTest
  onCambia: (id: number, lato: LatoRilievo, patch: Partial<RilievoTest>) => void
  nota: (id: number) => string
  onNota: (id: number, nota: string | null) => void
}): React.JSX.Element {
  const dueLati = lati.length > 1

  const esito = (t: TestDistretto, lato: LatoRilievo): React.JSX.Element => {
    const id = t.id as number
    const r = risposta(id, lato)
    if (t.risposta === 'posneg') {
      return (
        <span className="scelta-coppia segmentata esito-test">
          {['positivo', 'negativo'].map((v) => (
            <button
              key={v}
              type="button"
              disabled={soloLettura}
              className={r.valore === v ? 'scelta-attiva' : ''}
              onClick={() => onCambia(id, lato, { valore: r.valore === v ? null : v })}
            >
              {v === 'positivo' ? 'Positivo' : 'Negativo'}
            </button>
          ))}
        </span>
      )
    }
    if (t.risposta === 'scala5') {
      // La stessa fascia di pallini dei questionari: e' una scala, e come
      // scala si legge.
      return (
        <ScalaPallini
          min={0}
          max={5}
          valore={r.valore == null || r.valore === '' ? null : Number(r.valore)}
          soloLettura={soloLettura}
          onCambia={(v) => onCambia(id, lato, { valore: r.valore === String(v) ? null : String(v) })}
        />
      )
    }
    return (
      <input
        disabled={soloLettura}
        placeholder="Esito"
        value={r.valore ?? ''}
        onChange={(e) => onCambia(id, lato, { valore: e.target.value || null })}
      />
    )
  }

  return (
    <div className={dueLati ? 'griglia-test due-lati' : 'griglia-test'}>
      {dueLati ? (
        <>
          <div className="gm-titolo">Test</div>
          {lati.map((lato) => (
            <div
              key={lato}
              className={lato === latoInteressato ? 'gm-lato interessato' : 'gm-lato'}
            >
              {lato === 'dx' ? 'Destra' : 'Sinistra'}
              {lato === latoInteressato && <span className="nota-lato">lato interessato</span>}
            </div>
          ))}
          <div className="gm-titolo">Nota</div>
        </>
      ) : (
        <>
          <div className="gm-titolo">Test</div>
          <div className="gm-titolo gt-centro">Esito</div>
          <div className="gm-titolo">Nota</div>
        </>
      )}

      {test.map((t, i) => (
        <div key={t.id} className={i % 2 === 1 ? 'gm-riga pari' : 'gm-riga'}>
          <div className="gm-nome">{t.nome}</div>
          {lati.map((lato) => (
            <div
              key={lato}
              className={lato === 'dx' && dueLati ? 'gt-esito secondo-lato' : 'gt-esito'}
            >
              {esito(t, lato)}
            </div>
          ))}
          <div className="gt-nota">
            <input
              disabled={soloLettura}
              placeholder="Nota"
              value={nota(t.id as number)}
              onChange={(e) => onNota(t.id as number, e.target.value || null)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
