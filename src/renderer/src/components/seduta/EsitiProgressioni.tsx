import type { EsitoProgressione, StatoProgressione } from '../../../../shared/types'

interface Props {
  // le progressioni che hanno un esercizio in questa seduta
  stati: StatoProgressione[]
  esiti: Record<number, EsitoProgressione>
  onCambia: (esiti: Record<number, EsitoProgressione>) => void
}

// Come e' andato l'esercizio di una progressione, in fondo alla seduta accanto
// a dolore e sforzo. Sono tre scelte e quella di partenza e' "continua": si
// tocca solo quando c'e' da avanzare o da tornare indietro, e niente di tutto
// questo finisce nei referti.
export default function EsitiProgressioni({ stati, esiti, onCambia }: Props): React.JSX.Element | null {
  if (stati.length === 0) return null

  const scegli = (id: number, esito: EsitoProgressione | null): void => {
    const { [id]: _tolto, ...resto } = esiti
    void _tolto
    onCambia(esito == null ? resto : { ...resto, [id]: esito })
  }

  return (
    <div className="esiti-prog">
      <div className="nome-percepito">Progressioni</div>
      {stati.map((p) => {
        const scelto = esiti[p.id] ?? null
        const attuale = p.step[p.posizione]
        return (
          <div className="esito-riga" key={p.id}>
            <span className="esito-nome">
              {p.nome}
              <small>
                {p.completata
                  ? 'scala completata'
                  : `step ${p.posizione + 1} di ${p.step.length}${attuale ? ` · ${attuale.esercizio_nome}` : ''}`}
              </small>
            </span>
            <span className="esito-scelte" role="group" aria-label={`Esito di ${p.nome}`}>
              <button className={scelto === 'avanza' ? 'attivo' : ''} onClick={() => scegli(p.id, 'avanza')}>
                ↑ Avanza
              </button>
              <button className={scelto == null ? 'attivo' : ''} onClick={() => scegli(p.id, null)}>
                → Continua
              </button>
              <button
                className={scelto === 'indietro' ? 'attivo indietro' : ''}
                onClick={() => scegli(p.id, 'indietro')}
              >
                ↓ Torna indietro
              </button>
            </span>
          </div>
        )
      })}
    </div>
  )
}
