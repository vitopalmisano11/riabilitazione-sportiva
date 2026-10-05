import { Copy, Plus, X } from 'lucide-react'
import type { DomandaQuestionario, TipoDomanda } from '../../../../shared/types'
import { sposta, useRiordino } from '../../riordino'
import { TIPI, nuovaChiave } from './modello'

export function TabDomande({
  domande,
  onChange
}: {
  domande: DomandaQuestionario[]
  onChange: (d: DomandaQuestionario[]) => void
}): React.JSX.Element {
  const { contenitore, presa } = useRiordino<number>((da, a) =>
    onChange(sposta(domande, da, a))
  )

  const modifica = (i: number, patch: Partial<DomandaQuestionario>): void =>
    onChange(domande.map((d, j) => (i === j ? { ...d, ...patch } : d)))

  // Una copia subito sotto l'originale: per le domande che si somigliano
  // (le stesse risposte a punteggio, cambia solo il testo) si riparte da una
  // gia' fatta invece di riscriverla.
  const duplica = (i: number): void => {
    const copia: DomandaQuestionario = {
      ...domande[i],
      id: nuovaChiave(),
      opzioni: domande[i].opzioni.map((o) => ({ ...o, id: null }))
    }
    onChange([...domande.slice(0, i + 1), copia, ...domande.slice(i + 1)])
  }

  return (
    <div className="lista-domande">
      <p className="modal-testo">
        Ogni domanda vale un punteggio. <b>Sì / No</b> vale 0 o 1. <b>Scala numerica</b> vale il
        numero scelto. <b>Scelta con punteggi</b> ti lascia scrivere le risposte e quanto vale
        ciascuna — serve per domande come &ldquo;per niente / un poco / moderatamente&rdquo;.
      </p>

      {domande.map((d, i) => {
        const dnd = contenitore(i)
        return (
          <div key={d.id ?? i} {...dnd} {...presa(i)} className={['domanda-card', dnd.className].filter(Boolean).join(' ')}>
            <div className="domanda-testata">
              <span className="domanda-numero">{i + 1}</span>
              <input
                className="domanda-testo"
                placeholder="Testo della domanda"
                value={d.testo}
                onChange={(e) => modifica(i, { testo: e.target.value })}
              />
              <select
                value={d.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoDomanda
                  modifica(i, {
                    tipo,
                    scala_min: tipo === 'scala' ? (d.scala_min ?? 0) : null,
                    scala_max: tipo === 'scala' ? (d.scala_max ?? 10) : null,
                    opzioni: tipo === 'scelta' && d.opzioni.length === 0 ? [] : d.opzioni
                  })
                }}
              >
                {TIPI.map((t) => (
                  <option key={t.valore} value={t.valore}>
                    {t.etichetta}
                  </option>
                ))}
              </select>
              <span className="item-actions-static">
                <button title="Copia domanda" onClick={() => duplica(i)}>
                  <Copy size={16} />
                </button>
                <button
                  title="Elimina domanda"
                  className="danger"
                  onClick={() => onChange(domande.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </span>
            </div>

            {d.tipo === 'scala' && (
              <>
                <div className="form-row-2">
                  <label>
                    Da
                    <input
                      type="number"
                      value={d.scala_min ?? 0}
                      onChange={(e) => modifica(i, { scala_min: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    A
                    <input
                      type="number"
                      value={d.scala_max ?? 10}
                      onChange={(e) => modifica(i, { scala_max: Number(e.target.value) })}
                    />
                  </label>
                </div>
                {/* Un numero da solo non dice da che parte sta il male: chi
                    risponde legge questi due nomi sotto agli estremi. */}
                <div className="form-row-2">
                  <label>
                    Cosa vuol dire {d.scala_min ?? 0}
                    <input
                      placeholder="es. nessun dolore"
                      value={d.etichetta_min ?? ''}
                      onChange={(e) => modifica(i, { etichetta_min: e.target.value || null })}
                    />
                  </label>
                  <label>
                    Cosa vuol dire {d.scala_max ?? 10}
                    <input
                      placeholder="es. il peggiore che si possa immaginare"
                      value={d.etichetta_max ?? ''}
                      onChange={(e) => modifica(i, { etichetta_max: e.target.value || null })}
                    />
                  </label>
                </div>
              </>
            )}

            {d.tipo === 'scelta' && (
              <div className="opzioni-domanda">
                {d.opzioni.map((o, k) => (
                  <div key={k} className="opzione-riga">
                    <input
                      placeholder="Testo della risposta"
                      value={o.etichetta}
                      onChange={(e) =>
                        modifica(i, {
                          opzioni: d.opzioni.map((x, j) =>
                            j === k ? { ...x, etichetta: e.target.value } : x
                          )
                        })
                      }
                    />
                    <input
                      type="number"
                      className="opzione-punteggio"
                      title="Quanto vale questa risposta"
                      value={o.punteggio}
                      onChange={(e) =>
                        modifica(i, {
                          opzioni: d.opzioni.map((x, j) =>
                            j === k ? { ...x, punteggio: Number(e.target.value) } : x
                          )
                        })
                      }
                    />
                    <button
                      className="danger"
                      title="Togli questa risposta"
                      onClick={() =>
                        modifica(i, { opzioni: d.opzioni.filter((_, j) => j !== k) })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    modifica(i, {
                      opzioni: [...d.opzioni, { id: null, etichetta: '', punteggio: 0 }]
                    })
                  }
                >
                  <Plus size={16} /> Aggiungi risposta
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={() =>
          onChange([
            ...domande,
            {
              id: nuovaChiave(),
              testo: '',
              tipo: 'si_no',
              scala_min: null,
              scala_max: null,
              etichetta_min: null,
              etichetta_max: null,
              opzioni: []
            }
          ])
        }
      >
        <Plus size={16} /> Aggiungi domanda
      </button>
    </div>
  )
}
