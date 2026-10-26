import { ArrowDown, ArrowUp, Info } from 'lucide-react'
import type { EsitoProgressione, StatoProgressione } from '../../../../shared/types'
import { nomeConVariante } from '../../../../shared/varianti'

interface Props {
  // le progressioni che hanno un esercizio in questa seduta
  stati: StatoProgressione[]
  esiti: Record<number, EsitoProgressione>
  onCambia: (esiti: Record<number, EsitoProgressione>) => void
  // la seduta e' nel futuro: l'esito si segna quando la si svolge
  rimandato?: boolean
}

type Scelta = 'avanza' | 'rimani' | 'indietro'

const SCELTE: { chiave: Scelta; etichetta: string; Icona: typeof ArrowUp | null }[] = [
  { chiave: 'avanza', etichetta: 'Avanza', Icona: ArrowUp },
  { chiave: 'rimani', etichetta: 'Rimani', Icona: null },
  { chiave: 'indietro', etichetta: 'Regredisci', Icona: ArrowDown }
]

// Dove porta una scelta, detto in parole: "Step 3 di 4 · Nome dell'esercizio".
// Cosi' si vede cosa succede prima di toccare, senza dover ricordare cosa
// vuol dire ogni pulsante.
function destinazione(p: StatoProgressione, scelta: Scelta): string {
  const n = p.step.length
  const descrivi = (indice: number): string =>
    `step ${indice + 1} di ${n} · ${nomeConVariante(p.step[indice].esercizio_nome, p.step[indice].variante)}`
  if (scelta === 'avanza') {
    return p.posizione + 1 >= n ? 'scala completata' : `si passa allo ${descrivi(p.posizione + 1)}`
  }
  if (scelta === 'indietro') {
    return p.posizione === 0 ? 'resta al primo step' : `si torna allo ${descrivi(p.posizione - 1)}`
  }
  return p.completata ? 'scala completata' : `si resta allo ${descrivi(p.posizione)}`
}

// Come e' andato l'esercizio di una progressione, in fondo alla seduta accanto
// a dolore e sforzo. Tre scelte e quella di partenza e' "Rimani": si tocca solo
// quando c'e' da avanzare o da tornare indietro. Niente di tutto questo finisce
// nei referti.
export default function EsitiProgressioni({
  stati,
  esiti,
  onCambia,
  rimandato = false
}: Props): React.JSX.Element | null {
  if (stati.length === 0) {
    return rimandato ? <EsitoRimandato /> : null
  }

  const scegli = (id: number, scelta: Scelta): void => {
    const { [id]: _tolto, ...resto } = esiti
    void _tolto
    // "Rimani" e' il non segnato: conta l'ultima decisione, e rimanere non cambia niente
    onCambia(scelta === 'rimani' ? resto : { ...resto, [id]: scelta })
  }

  return (
    <div className="esiti-prog">
      <div className="nome-percepito">Progressioni: come è andata?</div>
      {rimandato && <EsitoRimandato />}
      {!rimandato &&
        stati.map((p) => {
          const scelta: Scelta = esiti[p.id] ?? 'rimani'
          return (
            <div className="esito-card" key={p.id}>
              <span className="esito-scelte" role="group" aria-label={`Esito di ${p.nome}`}>
                {SCELTE.map(({ chiave, etichetta, Icona }) => (
                  <button
                    key={chiave}
                    type="button"
                    className={`esito-${chiave}${scelta === chiave ? ' attivo' : ''}`}
                    aria-pressed={scelta === chiave}
                    onClick={() => scegli(p.id, chiave)}
                  >
                    {Icona && <Icona size={14} />}
                    {etichetta}
                  </button>
                ))}
              </span>
              <span className={`esito-effetto esito-effetto-${scelta}`}>
                {destinazione(p, scelta)}
              </span>
            </div>
          )
        })}
    </div>
  )
}

function EsitoRimandato(): React.JSX.Element {
  return (
    <p className="esito-rimandato">
      <Info size={16} /> In questa seduta c&apos;è un esercizio di progressione. Quando la svolgerai
      potrai segnare qui se il paziente avanza, resta allo stesso step o regredisce.
    </p>
  )
}
