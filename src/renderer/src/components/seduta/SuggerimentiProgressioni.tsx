import { Lock, Plus } from 'lucide-react'
import type { EsercizioConCategoria, StatoProgressione } from '../../../../shared/types'

interface Props {
  stati: StatoProgressione[]
  libreria: EsercizioConCategoria[]
  // gli esercizi gia' messi in questa seduta, in qualunque sezione
  inSeduta: Set<number>
  onAggiungi: (e: EsercizioConCategoria) => void
  onSpecchietto: () => void
}

// In cima alla ricerca di "+ Esercizio": per ogni progressione della fase lo
// step a cui e' il paziente, da aggiungere con un clic. Gli step dopo sono in
// grigio, con quello che serve per arrivarci, ma si possono scegliere lo
// stesso: e' un suggerimento, non un vincolo.
export default function SuggerimentiProgressioni({
  stati,
  libreria,
  inSeduta,
  onAggiungi,
  onSpecchietto
}: Props): React.JSX.Element | null {
  const aperte = stati.filter((p) => !p.completata)
  if (aperte.length === 0) return null

  return (
    <div className="suggeriti-prog">
      <div className="suggeriti-testata">
        Suggeriti dalle progressioni
        <button onClick={onSpecchietto}>Vedi dove siamo</button>
      </div>
      {aperte.map((p) => (
        <ul className="esercizi-proposti" key={p.id}>
          {p.step.slice(p.posizione).map((s, i) => {
            const e = libreria.find((x) => x.id === s.esercizio_id)
            const giaQui = inSeduta.has(s.esercizio_id)
            return (
              <li key={s.id} className={i === 0 ? undefined : 'successivo'}>
                <button
                  className="btn-aggiungi-riga"
                  title={e ? `Aggiungi ${s.esercizio_nome}` : 'Esercizio archiviato: non si può aggiungere'}
                  disabled={!e || giaQui}
                  onClick={() => e && onAggiungi(e)}
                >
                  {i === 0 ? <Plus size={16} /> : <Lock size={14} />}
                </button>
                <span className="item-nome">{s.esercizio_nome}</span>
                <span className="default-hint">
                  {giaQui
                    ? 'già in seduta'
                    : i === 0
                      ? `${p.nome} · step ${p.posizione + 1} di ${p.step.length}`
                      : [`${p.nome} · step ${p.posizione + 1 + i}`, s.requisito].filter(Boolean).join(' · ')}
                </span>
              </li>
            )
          })}
        </ul>
      ))}
    </div>
  )
}
