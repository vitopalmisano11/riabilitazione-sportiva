import { useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import type { Questionario } from '../../../../shared/types'
import { toastErrore } from '../../components/Toast'
import { chiedi } from '../../components/Conferma'
import Modale from '../../components/Modale'
import { errMsg } from '../../lib'
import { sposta, useRiordino } from '../../riordino'

export function ElencoQuestionari({
  categoriaId,
  questionari,
  onApri,
  onChanged
}: {
  categoriaId: number
  questionari: Questionario[]
  onApri: (id: number) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [ricerca, setRicerca] = useState('')
  const [nuovoAperto, setNuovoAperto] = useState(false)
  const [nome, setNome] = useState('')
  const [edit, setEdit] = useState<{ id: number; nome: string } | null>(null)

  const q = ricerca.trim().toLowerCase()
  const filtrati = questionari.filter((x) => q === '' || x.nome.toLowerCase().includes(q))

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const { contenitore, presa } = useRiordino<number>((da, a) => {
    const ids = sposta(questionari, da, a).map((x) => x.id)
    void run(async () => {
      await window.api.questionari.reorder(ids)
      await onChanged()
    })
  })

  const salvaRinomina = (): void => {
    if (!edit || !edit.nome.trim()) return
    void run(async () => {
      const completo = await window.api.questionari.get(edit.id)
      await window.api.questionari.salva({
        ...completo,
        questionario: { ...completo.questionario, nome: edit.nome.trim() }
      })
      setEdit(null)
      await onChanged()
    })
  }

  const crea = (): void => {
    const n = nome.trim()
    if (!n) return
    void run(async () => {
      const id = await window.api.questionari.create(n, categoriaId)
      setNome('')
      setNuovoAperto(false)
      await onChanged()
      onApri(id)
    })
  }

  return (
    <section className="card step-card">
      <div className="step-head">
        <div className="step-title">
          <span className="step-num">2</span>
          <h3>Scegli il questionario</h3>
        </div>
        <div className="ricerca-con-azione">
          <input
            type="search"
            className="ricerca-compatta"
            placeholder="Cerca questionario…"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />
          <button
            title="Aggiungi l’IKDC già pronto, in italiano"
            onClick={() =>
              void run(async () => {
                const id = await window.api.questionari.daModello('ikdc', categoriaId)
                await onChanged()
                onApri(id)
              })
            }
          >
            + IKDC pronto
          </button>
          <button
            className="primary btn-icona"
            title="Aggiungi un questionario"
            onClick={() => setNuovoAperto(true)}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="scelta-tiles">
        {filtrati.map((x, idx) => {
          const dnd = contenitore(idx)
          return (
            <div
              key={x.id}
              {...dnd}
              {...presa(idx)}
              className={['scelta-tile', dnd.className].filter(Boolean).join(' ')}
              title="Apri · trascina per spostare"
              onClick={() => onApri(x.id)}
            >
              {edit?.id === x.id ? (
                <span className="edit-row" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={edit.nome}
                    onChange={(e) => setEdit({ id: x.id, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvaRinomina()
                      if (e.key === 'Escape') setEdit(null)
                    }}
                  />
                  <button onClick={salvaRinomina}>OK</button>
                </span>
              ) : (
                <>
              <span className="scelta-tile-nome">{x.nome}</span>
              <span className="item-actions" onClick={(e) => e.stopPropagation()}>
                <button title="Rinomina" onClick={() => setEdit({ id: x.id, nome: x.nome })}>
                  <Pencil size={16} />
                </button>
                <button
                  title="Elimina"
                  className="danger"
                  onClick={async () => {
                    if (
                      await chiedi(
                        `Eliminare "${x.nome}"?\nSe qualche paziente lo ha già compilato non si può: in quel caso usa "Archivia".\nFinisce nel cestino: puoi rimetterlo a posto da Impostazioni entro un mese.`
                      )
                    ) {
                      void run(async () => {
                        await window.api.questionari.remove(x.id)
                        await onChanged()
                      })
                    }
                  }}
                >
                  <X size={16} />
                </button>
              </span>
                </>
              )}
            </div>
          )
        })}
      </div>
      {filtrati.length === 0 && (
        <p className="hint">
          {questionari.length === 0
            ? 'Nessun questionario: aggiungine uno col pulsante + qui sopra.'
            : 'Nessun risultato per la ricerca.'}
        </p>
      )}

      {nuovoAperto && (
        // Cliccando fuori (o premendo Invio) si crea il questionario; se il
        // nome e' ancora vuoto si chiude e basta, come "Annulla".
        <Modale
          className="modal-sm"
          onConferma={() => (nome.trim() ? crea() : setNuovoAperto(false))}
        >
            <h3>Nuovo questionario</h3>
            <label>
              Nome del questionario
              <input
                autoFocus
                placeholder="es. StarT Back"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    crea()
                  }
                  if (e.key === 'Escape') setNuovoAperto(false)
                }}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setNuovoAperto(false)}>Annulla</button>
              <button className="primary" disabled={!nome.trim()} onClick={crea}>
                Crea
              </button>
            </div>
        </Modale>
      )}
    </section>
  )
}
