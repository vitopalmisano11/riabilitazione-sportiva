import { useEffect, useState } from 'react'
import type {
  CompilazioneRiepilogo,
  DomandaQuestionario,
  QuestionarioCompleto
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg, formatData, oggiIso } from '../lib'

// Lo schermo è girato verso il paziente, che legge le domande, ma a cliccare è
// il fisioterapista: risposte come pulsanti larghi, non pallini da centrare col
// mouse.
//
// La stessa finestra serve per compilare, per rileggere e per correggere: le
// domande sono le stesse, cambia solo se le risposte si possono toccare.
export default function CompilaQuestionario({
  pazienteId,
  questionarioId,
  compilazione,
  soloLettura,
  onChiudi
}: {
  pazienteId: number
  questionarioId: number
  compilazione: CompilazioneRiepilogo | null
  soloLettura: boolean
  // Ritorna l'id della compilazione salvata, o null se si e' chiuso senza
  // salvare: allo screening serve per collegarla alla sessione.
  onChiudi: (compilazioneId: number | null) => void
}): React.JSX.Element {
  const [dati, setDati] = useState<QuestionarioCompleto | null>(null)
  const [risposte, setRisposte] = useState<Record<number, number>>({})
  const [data, setData] = useState(compilazione?.data ?? oggiIso())
  const [note, setNote] = useState(compilazione?.note ?? '')
  const [pronto, setPronto] = useState(compilazione == null)

  useEffect(() => {
    window.api.questionari
      .get(questionarioId)
      .then(setDati)
      .catch((e) => toastErrore(errMsg(e)))
  }, [questionarioId])

  useEffect(() => {
    if (compilazione == null) return
    window.api.compilazioni
      .risposte(compilazione.id)
      .then((r) => {
        setRisposte(Object.fromEntries(r.map((x) => [x.domanda_id, x.valore])))
        setPronto(true)
      })
      .catch((e) => toastErrore(errMsg(e)))
  }, [compilazione])

  if (!dati || !pronto) {
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
    const dset = {
      paziente_id: pazienteId,
      questionario_id: questionarioId,
      data,
      note: note.trim() || null,
      risposte: conId.map((d) => ({ domanda_id: d.id, valore: risposte[d.id] ?? 0 }))
    }
    try {
      let id = compilazione?.id ?? 0
      if (compilazione) await window.api.compilazioni.update(compilazione.id, dset)
      else id = await window.api.compilazioni.create(dset)
      toast(compilazione ? 'Questionario aggiornato.' : 'Questionario salvato.')
      onChiudi(id)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={() => onChiudi(null)}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="card-header-row">
          <h3>{dati.questionario.nome}</h3>
          {soloLettura ? (
            <span className="hint">{formatData(data)}</span>
          ) : (
            <label className="compila-data">
              Data
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
          )}
        </div>
        {dati.questionario.istruzioni && (
          <p className="compila-istruzioni">{dati.questionario.istruzioni}</p>
        )}

        {/* Domande e note scorrono insieme: le note stanno in fondo, dopo
            l'ultima domanda, invece di restare fisse sotto e distrarre fin
            dalla prima. */}
        <div className="compila-corpo">
          <ol className="compila-domande">
            {conId.map((d) => (
              <li key={d.id}>
                <p className="compila-testo">{d.testo}</p>
                <div className="compila-risposte">
                  {opzioniDi(d).map((o, i) => (
                    <button
                      key={i}
                      className={risposte[d.id] === o.valore ? 'scelta-attiva' : ''}
                      disabled={soloLettura}
                      onClick={() => setRisposte({ ...risposte, [d.id]: o.valore })}
                    >
                      {o.etichetta}
                    </button>
                  ))}
                </div>
                {/* Cosa vogliono dire i due estremi: sotto ai numeri, uno a
                    sinistra e uno a destra, come sulla scala di carta. Senza,
                    "0" e "10" non dicono da che parte sta il male. */}
                {d.tipo === 'scala' && (d.etichetta_min || d.etichetta_max) && (
                  <div className="compila-estremi">
                    <span>{d.etichetta_min}</span>
                    <span>{d.etichetta_max}</span>
                  </div>
                )}
              </li>
            ))}
            {conId.length === 0 && <li className="hint">Questo questionario non ha domande.</li>}
          </ol>

          {soloLettura ? (
            note.trim() !== '' && (
              <label>
                Note
                <p className="modal-testo">{note}</p>
              </label>
            )
          ) : (
            <label>
              Note (facoltative)
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
        </div>

        <div className="modal-actions">
          {soloLettura && compilazione?.fascia && (
            <span className="badge-fascia">{compilazione.fascia}</span>
          )}
          {!soloLettura && mancanti > 0 && (
            <span className="hint">
              {mancanti === 1 ? 'Manca 1 risposta.' : `Mancano ${mancanti} risposte.`}
            </span>
          )}
          <button onClick={() => onChiudi(null)}>{soloLettura ? 'Chiudi' : 'Annulla'}</button>
          {!soloLettura && (
            <button
              className="primary"
              disabled={conId.length === 0 || mancanti > 0}
              onClick={() => void salva()}
            >
              Salva
            </button>
          )}
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
