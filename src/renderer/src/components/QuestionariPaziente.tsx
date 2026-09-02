import { useCallback, useEffect, useState } from 'react'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import type {
  CategoriaQuestionario,
  CompilazioneRiepilogo,
  PazienteDettaglio,
  Questionario
} from '../../../shared/types'
import { toastErrore } from './Toast'
import { errMsg, formatData } from '../lib'
import CompilaQuestionario from './CompilaQuestionario'

// Storico dei questionari compilati per il paziente, più la nuova compilazione.
export default function QuestionariPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [storico, setStorico] = useState<CompilazioneRiepilogo[]>([])
  const [disponibili, setDisponibili] = useState<Questionario[]>([])
  const [categorie, setCategorie] = useState<CategoriaQuestionario[]>([])
  // Cosa c'e' aperto: un questionario nuovo da compilare, oppure uno gia'
  // compilato aperto in lettura o in modifica.
  const [aperto, setAperto] = useState<
    | { modo: 'nuovo'; questionarioId: number }
    | { modo: 'vedi' | 'modifica'; compilazione: CompilazioneRiepilogo }
    | null
  >(null)
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
      <div className="card-header-row">
        <h3>Questionari</h3>
        <span className="row-actions">
          <button
            className="primary"
            title="Compila un questionario"
            disabled={disponibili.length === 0}
            onClick={() => setScelta(true)}
          >
            <Plus size={18} />
          </button>
        </span>
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
                <button
                  title="Vedi le risposte"
                  onClick={() => setAperto({ modo: 'vedi', compilazione: c })}
                >
                  <Eye size={18} />
                </button>
                <button
                  title="Modifica le risposte"
                  onClick={() => setAperto({ modo: 'modifica', compilazione: c })}
                >
                  <Pencil size={18} />
                </button>
                <button className="danger" title="Elimina" onClick={() => void elimina(c)}>
                  <Trash2 size={18} />
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
                            setAperto({ modo: 'nuovo', questionarioId: q.id })
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
              {catScelta != null && <button onClick={() => setCatScelta(null)}>Indietro</button>}
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

      {aperto && (
        <CompilaQuestionario
          key={aperto.modo === 'nuovo' ? `n${aperto.questionarioId}` : `c${aperto.compilazione.id}`}
          pazienteId={paziente.id}
          questionarioId={
            aperto.modo === 'nuovo'
              ? aperto.questionarioId
              : aperto.compilazione.questionario_id
          }
          compilazione={aperto.modo === 'nuovo' ? null : aperto.compilazione}
          soloLettura={aperto.modo === 'vedi'}
          onChiudi={(compilazioneId) => {
            setAperto(null)
            if (compilazioneId != null) void load()
          }}
        />
      )}
    </section>
  )
}
