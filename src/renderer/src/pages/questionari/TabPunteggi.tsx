import Tendina from '../../components/Tendina'
import { Plus, X } from 'lucide-react'
import type {
  DomandaQuestionario,
  PunteggioQuestionario,
  TipoPunteggio
} from '../../../../shared/types'
import { TIPI_PUNTEGGIO } from '../../../../shared/punteggi-questionario'
import { idTemporaneo } from './modello'

export function TabPunteggi({
  domande,
  punteggi,
  onChange
}: {
  domande: DomandaQuestionario[]
  punteggi: PunteggioQuestionario[]
  onChange: (p: PunteggioQuestionario[]) => void
}): React.JSX.Element {
  const modifica = (i: number, patch: Partial<PunteggioQuestionario>): void =>
    onChange(punteggi.map((p, j) => (i === j ? { ...p, ...patch } : p)))

  return (
    <div className="lista-domande">
      <p className="modal-testo">
        Un punteggio si calcola da alcune domande: di solito è la somma, ma molte scale validate
        si esprimono in percentuale del massimo (l&apos;ODI, l&apos;IKDC) o in percentuale inversa
        (il KOOS, dove 100 vuol dire nessun problema). Spesso ne basta uno (&ldquo;Totale&rdquo;,
        tutte le domande); se il questionario lo richiede se ne aggiungono altri, per esempio le
        sottoscale.
      </p>

      {punteggi.map((p, i) => (
        <div key={i} className="domanda-card">
          <div className="domanda-testata">
            <input
              className="domanda-testo"
              placeholder="Nome del punteggio (es. Totale)"
              value={p.nome}
              onChange={(e) => modifica(i, { nome: e.target.value })}
            />
            <span className="item-actions-static">
              <button
                title="Elimina punteggio"
                className="danger"
                onClick={() => onChange(punteggi.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </button>
            </span>
          </div>
          <label className="field">
            Come si calcola
            <Tendina
              value={p.tipo}
              onChange={(e) => modifica(i, { tipo: e.target.value as TipoPunteggio })}
            >
              {TIPI_PUNTEGGIO.map((t) => (
                <option key={t.valore} value={t.valore}>
                  {t.etichetta}
                </option>
              ))}
            </Tendina>
            <span className="hint">{TIPI_PUNTEGGIO.find((t) => t.valore === p.tipo)?.spiegazione}</span>
          </label>
          <ul className="checkbox-list">
            {domande.map((d, k) => {
              const rif = d.id ?? 0
              const dentro = p.domanda_ids.includes(rif)
              return (
                <li key={k}>
                  <label>
                    <input
                      type="checkbox"
                      checked={dentro}
                      onChange={() =>
                        modifica(i, {
                          domanda_ids: dentro
                            ? p.domanda_ids.filter((x) => x !== rif)
                            : [...p.domanda_ids, rif]
                        })
                      }
                    />
                    {k + 1}.{' '}
                    {d.intestazione ? <span className="hint">{d.intestazione} — </span> : null}
                    {d.testo || <span className="hint">domanda senza testo</span>}
                  </label>
                </li>
              )
            })}
            {domande.length === 0 && <li className="empty">Aggiungi prima le domande.</li>}
          </ul>
        </div>
      ))}

      <button
        onClick={() =>
          onChange([...punteggi, { id: idTemporaneo(), nome: '', tipo: 'somma', domanda_ids: [] }])
        }
      >
        <Plus size={16} /> Aggiungi punteggio
      </button>
    </div>
  )
}
