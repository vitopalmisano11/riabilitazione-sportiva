import { Plus, X } from 'lucide-react'
import type { FasciaQuestionario, PunteggioQuestionario } from '../../../../shared/types'
import { sposta, useRiordino } from '../../riordino'

export function TabFasce({
  punteggi,
  fasce,
  onChange
}: {
  punteggi: PunteggioQuestionario[]
  fasce: FasciaQuestionario[]
  onChange: (f: FasciaQuestionario[]) => void
}): React.JSX.Element {
  const { contenitore, presa } = useRiordino<number>((da, a) => onChange(sposta(fasce, da, a)))

  const modifica = (i: number, patch: Partial<FasciaQuestionario>): void =>
    onChange(fasce.map((f, j) => (i === j ? { ...f, ...patch } : f)))

  // Solo i punteggi che hanno un id: uno appena aggiunto ne riceve uno negativo
  // provvisorio, tradotto nel vero id al salvataggio. Prima chi non l'aveva
  // finiva in elenco con valore 0, e la fascia restava agganciata a un punteggio
  // inesistente — quindi non si avverava mai e l'esito restava vuoto.
  const opzioniPunteggio = punteggi
    .filter((p): p is typeof p & { id: number } => p.id != null)
    .map((p, k) => ({ valore: p.id, nome: p.nome || `punteggio ${k + 1}` }))

  const numero = (v: string): number | null => (v === '' ? null : Number(v))

  return (
    <div className="lista-domande">
      <p className="modal-testo">
        Le fasce si leggono <b>dall&apos;alto verso il basso</b>: vince la prima riga che si avvera.
        Lascia vuoti i limiti che non ti servono. La seconda condizione è facoltativa e serve ai
        questionari che combinano due punteggi.
      </p>

      {fasce.map((f, i) => {
        const dnd = contenitore(i)
        return (
          <div key={f.id ?? i} {...dnd} {...presa(i)} className={['domanda-card', dnd.className].filter(Boolean).join(' ')}>
            <div className="domanda-testata">
              <span className="domanda-numero">{i + 1}</span>
              <input
                className="domanda-testo"
                placeholder="Risultato (es. Rischio basso)"
                value={f.etichetta}
                onChange={(e) => modifica(i, { etichetta: e.target.value })}
              />
              <span className="item-actions-static">
                <button
                  title="Elimina fascia"
                  className="danger"
                  onClick={() => onChange(fasce.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </span>
            </div>

            <div className="regola-fascia">
              <span className="regola-parola">se</span>
              <select
                value={f.punteggio_id ?? ''}
                onChange={(e) => modifica(i, { punteggio_id: numero(e.target.value) })}
              >
                <option value="">— punteggio —</option>
                {opzioniPunteggio.map((o) => (
                  <option key={o.valore} value={o.valore}>
                    {o.nome}
                  </option>
                ))}
              </select>
              <span className="regola-parola">da</span>
              <input
                type="number"
                value={f.minimo ?? ''}
                onChange={(e) => modifica(i, { minimo: numero(e.target.value) })}
              />
              <span className="regola-parola">a</span>
              <input
                type="number"
                value={f.massimo ?? ''}
                onChange={(e) => modifica(i, { massimo: numero(e.target.value) })}
              />
            </div>

            <div className="regola-fascia">
              <span className="regola-parola">e</span>
              <select
                value={f.punteggio2_id ?? ''}
                onChange={(e) => modifica(i, { punteggio2_id: numero(e.target.value) })}
              >
                <option value="">— nessuna seconda condizione —</option>
                {opzioniPunteggio.map((o) => (
                  <option key={o.valore} value={o.valore}>
                    {o.nome}
                  </option>
                ))}
              </select>
              <span className="regola-parola">da</span>
              <input
                type="number"
                disabled={f.punteggio2_id == null}
                value={f.minimo2 ?? ''}
                onChange={(e) => modifica(i, { minimo2: numero(e.target.value) })}
              />
              <span className="regola-parola">a</span>
              <input
                type="number"
                disabled={f.punteggio2_id == null}
                value={f.massimo2 ?? ''}
                onChange={(e) => modifica(i, { massimo2: numero(e.target.value) })}
              />
            </div>
          </div>
        )
      })}

      <button
        onClick={() =>
          onChange([
            ...fasce,
            {
              id: null,
              etichetta: '',
              punteggio_id: null,
              minimo: null,
              massimo: null,
              punteggio2_id: null,
              minimo2: null,
              massimo2: null
            }
          ])
        }
      >
        <Plus size={16} /> Aggiungi fascia
      </button>
    </div>
  )
}
