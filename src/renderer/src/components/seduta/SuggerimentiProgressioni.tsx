import { Lock, Plus } from 'lucide-react'
import type { EsercizioConCategoria } from '../../../../shared/types'
import type { GruppoSuggerito } from './modello'

interface Props {
  gruppi: GruppoSuggerito[]
  libreria: EsercizioConCategoria[]
  // gli esercizi gia' messi in questa seduta, in qualunque sezione
  inSeduta: Set<number>
  onAggiungi: (e: EsercizioConCategoria) => void
  onSpecchietto: () => void
}

// In cima alla ricerca di "+ Esercizio": per ogni progressione della fase lo
// step a cui e' il paziente, da aggiungere con un clic, e subito dopo solo lo
// step successivo, col lucchetto e quello che serve per arrivarci (si puo'
// scegliere lo stesso: e' un suggerimento, non un vincolo). Gli step prima di
// quello attuale non si propongono mai, e nemmeno quelli piu' avanti del
// successivo: la scala intera si vede in "Vedi dove siamo".
//
// Il nome della progressione sta una volta sola, sopra ai suoi esercizi, invece
// di essere ripetuto su ogni riga: cosi' lo stesso esercizio (lo squat) in due
// scale diverse si distingue a colpo d'occhio e lo schermo resta pulito. Il
// calcolo di cosa mostrare sta in modello.ts (suggerimentiProgressioni).
export default function SuggerimentiProgressioni({
  gruppi,
  libreria,
  inSeduta,
  onAggiungi,
  onSpecchietto
}: Props): React.JSX.Element | null {
  if (gruppi.length === 0) return null

  return (
    <div className="suggeriti-prog">
      <div className="suggeriti-testata">
        Suggeriti dalle progressioni
        <button onClick={onSpecchietto}>Vedi dove siamo</button>
      </div>
      {gruppi.map(({ progressione: p, base, righe }) => (
        <div className="suggeriti-scala" key={p.id}>
          <div className="suggeriti-scala-nome">
            {p.nome}
            <span>
              {' '}
              · step {base + 1} di {p.step.length}
            </span>
          </div>
          <ul className="esercizi-proposti">
            {righe.map(({ step: s, indice }) => {
              const e = libreria.find((x) => x.id === s.esercizio_id)
              const giaQui = inSeduta.has(s.esercizio_id)
              return (
                <li key={s.id} className={indice === 0 ? undefined : 'successivo'}>
                  <button
                    className="btn-aggiungi-riga"
                    title={e ? `Aggiungi ${s.esercizio_nome} (${p.nome})` : 'Esercizio archiviato: non si può aggiungere'}
                    disabled={!e || giaQui}
                    onClick={() => e && onAggiungi(e)}
                  >
                    {indice === 0 ? <Plus size={16} /> : <Lock size={14} />}
                  </button>
                  <span className="item-nome">{s.esercizio_nome}</span>
                  <span className="default-hint">{giaQui ? 'già in seduta' : indice === 0 ? '' : s.requisito}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
