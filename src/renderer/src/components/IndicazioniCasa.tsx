import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import type { Indicazione, PazienteDettaglio } from '../../../shared/types'
import Aiuto from './Aiuto'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg } from '../lib'

// Le indicazioni che il paziente si porta a casa insieme al programma.
//
// Al foglio manca sempre la parte che decide se lo fara' bene: ogni quanto, e
// come regolarsi con il dolore. Le frasi si scrivono una volta sola e restano
// in un elenco comune; per ogni paziente si spunta quali valgono per lui.
export default function IndicazioniCasa({
  paziente,
  onChanged
}: {
  paziente: PazienteDettaglio
  onChanged: () => void
}): React.JSX.Element {
  const [tutte, setTutte] = useState<Indicazione[]>([])
  const [scelte, setScelte] = useState<number[]>([])
  const [frequenza, setFrequenza] = useState(paziente.frequenza_casa ?? '')
  const [nuova, setNuova] = useState(false)
  const [testo, setTesto] = useState('')
  const [salvato, setSalvato] = useState(true)

  const carica = useCallback((): void => {
    Promise.all([window.api.indicazioni.list(), window.api.indicazioni.delPaziente(paziente.id)])
      .then(([elenco, mie]) => {
        setTutte(elenco)
        setScelte(mie)
      })
      .catch((e) => toastErrore(errMsg(e)))
  }, [paziente.id])

  useEffect(carica, [carica])
  useEffect(() => {
    setFrequenza(paziente.frequenza_casa ?? '')
    setSalvato(true)
  }, [paziente.id, paziente.frequenza_casa])

  const spunta = (id: number): void => {
    setScelte(scelte.includes(id) ? scelte.filter((x) => x !== id) : [...scelte, id])
    setSalvato(false)
  }

  const salva = async (): Promise<void> => {
    try {
      await window.api.indicazioni.setDelPaziente(paziente.id, scelte, frequenza || null)
      setSalvato(true)
      onChanged()
      toast('Indicazioni salvate.')
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Una frase nuova entra nell'elenco comune e parte gia' spuntata per questo
  // paziente: e' il motivo per cui la stai scrivendo.
  const aggiungi = async (): Promise<void> => {
    if (testo.trim() === '') return
    try {
      const id = await window.api.indicazioni.create(testo)
      setTesto('')
      setNuova(false)
      const elenco = await window.api.indicazioni.list()
      setTutte(elenco)
      setScelte([...scelte, id])
      setSalvato(false)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Si toglie dall'elenco comune: sparisce anche dai pazienti che ce l'avevano.
  const elimina = async (i: Indicazione): Promise<void> => {
    if (
      !(await chiedi(
        `Togliere questa indicazione dall'elenco?\n"${i.testo}"\nSparisce anche dagli altri pazienti che ce l'hanno.`
      ))
    ) {
      return
    }
    try {
      await window.api.indicazioni.remove(i.id)
      setScelte(scelte.filter((x) => x !== i.id))
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>
          Indicazioni per casa
          <Aiuto testo="Quello che spunti qui esce sul foglio che dai al paziente, sotto al programma: ogni quanto farlo e come regolarsi con il dolore. Le frasi sono in comune, si scrivono una volta e si riusano su chi ti serve." />
        </h3>
        {!nuova && (
          <button className="btn-aggiungi-lista" onClick={() => setNuova(true)}>
            <Plus size={16} /> Aggiungi indicazione
          </button>
        )}
      </div>

      <label className="field campo-frequenza">
        Ogni quanto
        <input
          type="text"
          placeholder="es. 3 volte a settimana"
          value={frequenza}
          onChange={(e) => {
            setFrequenza(e.target.value)
            setSalvato(false)
          }}
        />
      </label>

      {nuova && (
        <div className="riga-nuovo-segno">
          <input
            autoFocus
            placeholder="es. non fare gli esercizi il giorno della partita"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void aggiungi()
              if (e.key === 'Escape') setNuova(false)
            }}
          />
          <button className="primary" title="Aggiungi" onClick={() => void aggiungi()}>
            <Check size={16} />
          </button>
          <button title="Chiudi" onClick={() => setNuova(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      {tutte.length === 0 ? (
        <p className="hint">Nessuna indicazione nell&apos;elenco.</p>
      ) : (
        <ul className="lista-indicazioni">
          {tutte.map((i) => (
            <li key={i.id}>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={scelte.includes(i.id)}
                  onChange={() => spunta(i.id)}
                />
                {i.testo}
              </label>
              <span className="row-actions">
                <button
                  className="danger"
                  title="Togli dall'elenco comune"
                  onClick={() => void elimina(i)}
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="modal-actions">
        <button className="primary" disabled={salvato} onClick={() => void salva()}>
          {salvato ? 'Salvato' : 'Salva le indicazioni'}
        </button>
      </div>
    </section>
  )
}
