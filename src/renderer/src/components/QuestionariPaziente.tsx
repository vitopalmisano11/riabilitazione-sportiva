import { useCallback, useEffect, useState } from 'react'
import type {
  CategoriaQuestionario,
  CompilazioneRiepilogo,
  DomandaQuestionario,
  PazienteDettaglio,
  Questionario,
  QuestionarioCompleto
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg, formatData, oggiIso } from '../lib'

// Storico dei questionari compilati per il paziente, più la nuova compilazione.
export default function QuestionariPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [storico, setStorico] = useState<CompilazioneRiepilogo[]>([])
  const [disponibili, setDisponibili] = useState<Questionario[]>([])
  const [categorie, setCategorie] = useState<CategoriaQuestionario[]>([])
  const [compilaId, setCompilaId] = useState<number | null>(null)
  // null = finestra chiusa; altrimenti la categoria scelta, o null dentro la
  // finestra finche' non se ne sceglie una
  const [scelta, setScelta] = useState(false)
  const [catScelta, setCatScelta] = useState<number | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      setStorico(await window.api.compilazioni.list(paziente.id))
      setDisponibili(await window.api.questionari.list(false))
      setCategorie(await window.api.questionariCategorie.list())
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void load()
  }, [load])

  const elimina = async (c: CompilazioneRiepilogo): Promise<void> => {
    if (!confirm(`Eliminare la compilazione del ${formatData(c.data)}?`)) return
    try {
      await window.api.compilazioni.remove(c.id)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <h3>Questionari</h3>
      <div className="sotto-sezioni">
        <button
          className="primary"
          disabled={disponibili.length === 0}
          onClick={() => setScelta(true)}
        >
          Compila questionario
        </button>
      </div>

      {disponibili.length === 0 ? (
        <p className="hint">
          Nessun questionario configurato: creane uno in Configurazione,
          &ldquo;Questionari&rdquo;.
        </p>
      ) : storico.length === 0 ? (
        <p className="hint">Nessun questionario compilato per questo paziente.</p>
      ) : (
        <ul className="sedute-list">
          {storico.map((c) => (
            <li key={c.id}>
              <div className="seduta-info">
                <span className="seduta-data">{formatData(c.data)}</span>
                <span className="seduta-meta">
                  {c.questionario_nome}
                  {c.punteggi.length > 0 && ' · '}
                  {c.punteggi.map((p) => `${p.nome} ${p.valore}`).join(' · ')}
                </span>
                {c.note && <span className="seduta-obiettivi">{c.note}</span>}
              </div>
              <span className="row-actions">
                {c.fascia && <span className="badge-fascia">{c.fascia}</span>}
                <button className="danger" onClick={() => void elimina(c)}>
                  Elimina
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {scelta && (
        <div
          className="modal-overlay"
          onClick={() => {
            setScelta(false)
            setCatScelta(null)
          }}
        >
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            {catScelta == null ? (
              <>
                <h3>Quale categoria?</h3>
                <ul className="scelte-questionari">
                  {categorie
                    .filter((c) => disponibili.some((q) => q.categoria_id === c.id))
                    .map((c) => (
                      <li key={c.id}>
                        <button onClick={() => setCatScelta(c.id)}>{c.nome}</button>
                      </li>
                    ))}
                </ul>
                {!categorie.some((c) => disponibili.some((q) => q.categoria_id === c.id)) && (
                  <p className="hint">Nessuna categoria contiene questionari.</p>
                )}
              </>
            ) : (
              <>
                <h3>Quale questionario?</h3>
                <ul className="scelte-questionari">
                  {disponibili
                    .filter((q) => q.categoria_id === catScelta)
                    .map((q) => (
                      <li key={q.id}>
                        <button
                          onClick={() => {
                            setScelta(false)
                            setCatScelta(null)
                            setCompilaId(q.id)
                          }}
                        >
                          {q.nome}
                        </button>
                      </li>
                    ))}
                </ul>
              </>
            )}
            <div className="modal-actions">
              {catScelta != null && (
                <button onClick={() => setCatScelta(null)}>Indietro</button>
              )}
              <button
                onClick={() => {
                  setScelta(false)
                  setCatScelta(null)
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {compilaId != null && (
        <CompilaQuestionario
          pazienteId={paziente.id}
          questionarioId={compilaId}
          onChiudi={(salvato) => {
            setCompilaId(null)
            if (salvato) void load()
          }}
        />
      )}
    </section>
  )
}

// Lo schermo è girato verso il paziente, che legge le domande, ma a cliccare è
// il fisioterapista: testo grande e risposte come pulsanti larghi, non pallini
// da centrare col mouse.
function CompilaQuestionario({
  pazienteId,
  questionarioId,
  onChiudi
}: {
  pazienteId: number
  questionarioId: number
  onChiudi: (salvato: boolean) => void
}): React.JSX.Element {
  const [dati, setDati] = useState<QuestionarioCompleto | null>(null)
  const [risposte, setRisposte] = useState<Record<number, number>>({})
  const [data, setData] = useState(oggiIso())
  const [note, setNote] = useState('')

  useEffect(() => {
    window.api.questionari
      .get(questionarioId)
      .then(setDati)
      .catch((e) => toastErrore(errMsg(e)))
  }, [questionarioId])

  if (!dati) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <p className="hint">Caricamento…</p>
        </div>
      </div>
    )
  }

  const conId = dati.domande.filter((d): d is DomandaQuestionario & { id: number } => d.id != null)
  const mancanti = conId.filter((d) => risposte[d.id] === undefined).length

  const salva = async (): Promise<void> => {
    try {
      await window.api.compilazioni.create({
        paziente_id: pazienteId,
        questionario_id: questionarioId,
        data,
        note: note.trim() || null,
        risposte: conId.map((d) => ({ domanda_id: d.id, valore: risposte[d.id] ?? 0 }))
      })
      toast('Questionario salvato.')
      onChiudi(true)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={() => onChiudi(false)}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="card-header-row">
          <h3>{dati.questionario.nome}</h3>
          <label className="compila-data">
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
        </div>
        {dati.questionario.istruzioni && (
          <p className="compila-istruzioni">{dati.questionario.istruzioni}</p>
        )}

        <ol className="compila-domande">
          {conId.map((d) => (
            <li key={d.id}>
              <p className="compila-testo">{d.testo}</p>
              <div className="compila-risposte">
                {opzioniDi(d).map((o, i) => (
                  <button
                    key={i}
                    className={risposte[d.id] === o.valore ? 'scelta-attiva' : ''}
                    onClick={() => setRisposte({ ...risposte, [d.id]: o.valore })}
                  >
                    {o.etichetta}
                  </button>
                ))}
              </div>
            </li>
          ))}
          {conId.length === 0 && <li className="hint">Questo questionario non ha domande.</li>}
        </ol>

        <label>
          Note (facoltative)
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="modal-actions">
          {mancanti > 0 && (
            <span className="hint">
              {mancanti === 1 ? 'Manca 1 risposta.' : `Mancano ${mancanti} risposte.`}
            </span>
          )}
          <button onClick={() => onChiudi(false)}>Annulla</button>
          <button
            className="primary"
            disabled={conId.length === 0 || mancanti > 0}
            onClick={() => void salva()}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  )
}

// Le tre forme di domanda diventano tutte lo stesso elenco di pulsanti.
function opzioniDi(d: DomandaQuestionario): { etichetta: string; valore: number }[] {
  if (d.tipo === 'si_no') {
    return [
      { etichetta: 'No', valore: 0 },
      { etichetta: 'Sì', valore: 1 }
    ]
  }
  if (d.tipo === 'scala') {
    const min = d.scala_min ?? 0
    const max = d.scala_max ?? 10
    const passi: { etichetta: string; valore: number }[] = []
    for (let v = min; v <= max; v++) passi.push({ etichetta: String(v), valore: v })
    return passi
  }
  return d.opzioni.map((o) => ({ etichetta: o.etichetta, valore: o.punteggio }))
}
