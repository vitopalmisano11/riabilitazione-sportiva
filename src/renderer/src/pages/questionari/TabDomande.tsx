import { Copy, Plus, X } from 'lucide-react'
import type { DomandaQuestionario, OpzioneDomanda, TipoDomanda } from '../../../../shared/types'
import { sposta, useRiordino, type PropsContenitore, type PropsPresa } from '../../riordino'
import GrigliaQuestionario from '../../components/GrigliaQuestionario'
import { raggruppaDomande } from '../../../../shared/griglie-questionario'
import { TIPI, nuovaChiave } from './modello'

export function TabDomande({
  domande,
  onChange
}: {
  domande: DomandaQuestionario[]
  onChange: (d: DomandaQuestionario[]) => void
}): React.JSX.Element {
  // Una domanda sola o una griglia e' un blocco: si trascina e si sposta intera.
  const gruppi = raggruppaDomande(domande)
  const { contenitore, presa } = useRiordino<number>((da, a) =>
    onChange(sposta(gruppi, da, a).flatMap((g) => g.righe.map((r) => r.domanda)))
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
        Una <b>domanda a tabella</b> è una domanda sola con più righe (per esempio le attività) e
        le stesse risposte in colonna, come la 9 dell&rsquo;IKDC: scrivi le colonne una volta e
        valgono per ogni riga.
      </p>

      {gruppi.map((g, gi) => {
        const dnd = contenitore(gi)
        if (g.intestazione != null) {
          const primo = g.righe[0].indice
          return (
            <SchedaGriglia
              key={g.righe[0].domanda.id ?? gi}
              righe={g.righe.map((r) => r.domanda)}
              dnd={dnd}
              presa={presa(gi)}
              onChange={(nuove) =>
                onChange([...domande.slice(0, primo), ...nuove, ...domande.slice(primo + g.righe.length)])
              }
            />
          )
        }
        const i = g.righe[0].indice
        const d = g.righe[0].domanda
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
      <button onClick={() => onChange([...domande, rigaNuova('')])}>
        <Plus size={16} /> Aggiungi domanda a tabella
      </button>
    </div>
  )
}

// Una riga nuova di griglia: domanda a risposte scritte, con l'intestazione
// della griglia a cui appartiene.
function rigaNuova(intestazione: string, opzioni: OpzioneDomanda[] = []): DomandaQuestionario {
  return {
    id: nuovaChiave(),
    testo: '',
    tipo: 'scelta',
    scala_min: null,
    scala_max: null,
    etichetta_min: null,
    etichetta_max: null,
    intestazione,
    opzioni: opzioni.map((o) => ({ ...o, id: null }))
  }
}

// Una griglia: la domanda comune, le risposte con i punti (scritte una volta
// sola e copiate su ogni riga) e le righe, cioe' le attivita'. Ogni riga resta
// una domanda vera: nei punteggi si spunta riga per riga.
function SchedaGriglia({
  righe,
  dnd,
  presa,
  onChange
}: {
  righe: DomandaQuestionario[]
  dnd: PropsContenitore
  presa: PropsPresa
  onChange: (righe: DomandaQuestionario[]) => void
}): React.JSX.Element {
  const intestazione = righe[0].intestazione ?? ''
  // le risposte sono quelle della prima riga: le altre ne sono copie
  const opzioni = righe[0].opzioni
  const { contenitore, presa: presaRiga } = useRiordino<number>((da, a) =>
    onChange(sposta(righe, da, a))
  )

  const cambiaIntestazione = (testo: string): void =>
    onChange(righe.map((r) => ({ ...r, intestazione: testo })))
  const cambiaOpzioni = (nuove: OpzioneDomanda[]): void =>
    onChange(righe.map((r) => ({ ...r, opzioni: nuove.map((o) => ({ ...o, id: null })) })))
  const cambiaOpzione = (k: number, patch: Partial<OpzioneDomanda>): void =>
    cambiaOpzioni(opzioni.map((o, j) => (j === k ? { ...o, ...patch } : o)))

  return (
    <div {...dnd} {...presa} className={['domanda-card', dnd.className].filter(Boolean).join(' ')}>
      <div className="domanda-testata">
        <span className="domanda-numero">▦</span>
        <input
          className="domanda-testo"
          placeholder="Domanda comune (es. Come influisce il ginocchio sulla capacità di:)"
          value={intestazione}
          onChange={(e) => cambiaIntestazione(e.target.value)}
        />
        <span className="item-actions-static">
          <button title="Elimina la tabella" className="danger" onClick={() => onChange([])}>
            <X size={16} />
          </button>
        </span>
      </div>

      <div className="sotto-titolo">Colonne: le risposte, uguali per tutte le righe</div>
      <div className="colonne-griglia">
        {opzioni.map((o, k) => (
          <div key={k} className="colonna-griglia">
            <input
              placeholder="es. Non difficile"
              value={o.etichetta}
              onChange={(e) => cambiaOpzione(k, { etichetta: e.target.value })}
            />
            <span className="colonna-punti">
              <input
                type="number"
                title="Quanti punti vale questa risposta"
                value={o.punteggio}
                onChange={(e) => cambiaOpzione(k, { punteggio: Number(e.target.value) })}
              />
              punti
            </span>
            <button
              className="danger"
              title="Togli questa colonna"
              onClick={() => cambiaOpzioni(opzioni.filter((_, j) => j !== k))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <button onClick={() => cambiaOpzioni([...opzioni, { id: null, etichetta: '', punteggio: 0 }])}>
          <Plus size={16} /> Aggiungi colonna
        </button>
      </div>

      <div className="sotto-titolo">Righe: le attività o le voci da valutare</div>
      <div className="opzioni-domanda">
        {righe.map((r, k) => {
          const riga = contenitore(k)
          return (
            <div
              key={r.id ?? k}
              {...riga}
              {...presaRiga(k)}
              className={['opzione-riga', riga.className].filter(Boolean).join(' ')}
            >
              <input
                placeholder="Riga (es. Salire le scale)"
                value={r.testo}
                onChange={(e) =>
                  onChange(righe.map((x, j) => (j === k ? { ...x, testo: e.target.value } : x)))
                }
              />
              <button
                className="danger"
                title="Togli questa riga"
                onClick={() => onChange(righe.filter((_, j) => j !== k))}
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
        <button onClick={() => onChange([...righe, rigaNuova(intestazione, opzioni)])}>
          <Plus size={16} /> Aggiungi riga
        </button>
      </div>

      {/* Com'e' per chi compila: serve a controllare titoli e righe senza
          aprire il questionario da un paziente. */}
      <div className="sotto-titolo">Anteprima</div>
      {intestazione.trim() && <p className="compila-testo">{intestazione}</p>}
      <GrigliaQuestionario righe={righe} risposte={{}} soloLettura />
    </div>
  )
}
