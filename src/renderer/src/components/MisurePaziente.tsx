import { useCallback, useEffect, useState } from 'react'
import { Calculator, Check, Plus, Trash2, X } from 'lucide-react'
import type { Massimale, PazienteDettaglio } from '../../../shared/types'
import Aiuto from './Aiuto'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg, formatData, oggiIso } from '../lib'

// I numeri dell'atleta: peso, altezza e i massimali.
//
// Servono a prescrivere: con il massimale scritto, "80%" diventa un numero
// invece di un ricordo. Le cose che cambiano seduta dopo seduta non stanno qui
// ma nei segni di riferimento; qui c'e' quello che si misura ogni tanto.

// Le percentuali che si usano davvero per prescrivere la forza.
const QUOTE = [70, 75, 80, 85, 90]

// Massimale stimato con la formula di Epley: carico × (1 + ripetizioni / 30).
// Con una ripetizione sola torna il carico stesso, che infatti e' il massimale.
function stima(carico: number, ripetizioni: number): number {
  return Math.round(carico * (1 + ripetizioni / 30) * 10) / 10
}

const num = (v: string): number | null => {
  const t = v.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const arrotonda = (n: number): string => (Math.round(n * 10) / 10).toString().replace('.', ',')

export default function MisurePaziente({
  paziente,
  onChanged
}: {
  paziente: PazienteDettaglio
  onChanged: () => void
}): React.JSX.Element {
  const [peso, setPeso] = useState(paziente.peso == null ? '' : String(paziente.peso))
  const [altezza, setAltezza] = useState(paziente.altezza == null ? '' : String(paziente.altezza))
  const [misureSalvate, setMisureSalvate] = useState(true)
  const [massimali, setMassimali] = useState<Massimale[]>([])
  const [aperto, setAperto] = useState<number | null>(null)
  const [nuovo, setNuovo] = useState(false)
  const [esercizio, setEsercizio] = useState('')
  const [valore, setValore] = useState('')
  const [carico, setCarico] = useState('')
  const [ripetizioni, setRipetizioni] = useState('')
  const [data, setData] = useState(oggiIso())

  const carica = useCallback((): void => {
    window.api.massimali
      .list(paziente.id)
      .then(setMassimali)
      .catch((e) => toastErrore(errMsg(e)))
  }, [paziente.id])

  useEffect(carica, [carica])
  useEffect(() => {
    setPeso(paziente.peso == null ? '' : String(paziente.peso))
    setAltezza(paziente.altezza == null ? '' : String(paziente.altezza))
    setMisureSalvate(true)
  }, [paziente.id, paziente.peso, paziente.altezza])

  const salvaMisure = async (): Promise<void> => {
    try {
      await window.api.massimali.setMisure(paziente.id, num(peso), num(altezza))
      setMisureSalvate(true)
      onChanged()
      toast('Misure salvate.')
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Se il massimale vero non l'hai misurato: quanto ha sollevato e per quante
  // ripetizioni, e il numero esce da solo.
  const stimato = ((): number | null => {
    const c = num(carico)
    const r = num(ripetizioni)
    return c != null && r != null && c > 0 && r > 0 ? stima(c, r) : null
  })()

  const aggiungi = async (): Promise<void> => {
    const v = num(valore) ?? stimato
    if (esercizio.trim() === '' || v == null || v <= 0) {
      toastErrore("Servono il nome dell'esercizio e il valore.")
      return
    }
    try {
      await window.api.massimali.create(paziente.id, esercizio, v, 'kg', data)
      setEsercizio('')
      setValore('')
      setCarico('')
      setRipetizioni('')
      setNuovo(false)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (m: Massimale): Promise<void> => {
    if (!(await chiedi(`Eliminare il massimale di ${m.esercizio} del ${formatData(m.data)}?`))) {
      return
    }
    try {
      await window.api.massimali.remove(m.id)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <>
      <section className="card">
        <h3>
          Peso e altezza
          <Aiuto testo="servono a leggere i carichi in rapporto al paziente. sono numeri che cambiano di rado: quello che ricontrolli tutte le volte va nei segni di riferimento, qui sotto, oppure nelle note della seduta." />
        </h3>
        <div className="riga-misure">
          <label className="field campo-misura">
            Peso (kg)
            <input
              type="text"
              inputMode="decimal"
              value={peso}
              onChange={(e) => {
                setPeso(e.target.value)
                setMisureSalvate(false)
              }}
            />
          </label>
          <label className="field campo-misura">
            Altezza (cm)
            <input
              type="text"
              inputMode="decimal"
              value={altezza}
              onChange={(e) => {
                setAltezza(e.target.value)
                setMisureSalvate(false)
              }}
            />
          </label>
          <button className="primary" disabled={misureSalvate} onClick={() => void salvaMisure()}>
            {misureSalvate ? 'Salvato' : 'Salva'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header-row">
          <h3>
            Massimali
            <Aiuto testo="scrivi il massimale di un esercizio e premendo sul numero vedi quanto sono il 70, il 75, l'80, l'85 e il 90 per cento: il carico della fase di forza si prescrive così. se non l'hai misurato davvero, puoi farlo stimare dal carico e dalle ripetizioni di una serie." />
          </h3>
          {!nuovo && (
            <button className="btn-aggiungi-lista" onClick={() => setNuovo(true)}>
              <Plus size={16} /> Aggiungi massimale
            </button>
          )}
        </div>

        {nuovo && (
          <div className="nuovo-massimale">
            <div className="riga-misure">
              <label className="field campo-esercizio-max">
                Esercizio
                <input
                  autoFocus
                  placeholder="es. Squat"
                  value={esercizio}
                  onChange={(e) => setEsercizio(e.target.value)}
                />
              </label>
              <label className="field campo-misura">
                Massimale (kg)
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={stimato == null ? '' : arrotonda(stimato)}
                  value={valore}
                  onChange={(e) => setValore(e.target.value)}
                />
              </label>
              <label className="field campo-misura">
                Data
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </label>
            </div>
            <div className="riga-misure riga-stima">
              <Calculator size={16} />
              <span className="hint">oppure calcolalo da una serie:</span>
              <input
                className="campo-stima"
                type="text"
                inputMode="decimal"
                placeholder="carico"
                value={carico}
                onChange={(e) => setCarico(e.target.value)}
              />
              <span className="hint">kg &times;</span>
              <input
                className="campo-stima"
                type="text"
                inputMode="decimal"
                placeholder="rip."
                value={ripetizioni}
                onChange={(e) => setRipetizioni(e.target.value)}
              />
              <span className="hint">
                {stimato == null ? 'ripetizioni' : `ripetizioni → circa ${arrotonda(stimato)} kg`}
              </span>
            </div>
            <div className="modal-actions">
              <button onClick={() => setNuovo(false)}>
                <X size={16} /> Annulla
              </button>
              <button className="primary" onClick={() => void aggiungi()}>
                <Check size={16} /> Aggiungi
              </button>
            </div>
          </div>
        )}

        {massimali.length === 0 ? (
          <p className="hint">Nessun massimale scritto.</p>
        ) : (
          <ul className="lista-massimali">
            {massimali.map((m) => (
              <li key={m.id}>
                <div className="riga-massimale">
                  <span className="max-esercizio">{m.esercizio}</span>
                  {/* Le percentuali si aprono premendo sul numero: sono la cosa
                      che serve, ma non tutte insieme per ogni riga. */}
                  <button
                    className="briciola max-valore"
                    title="Vedi le percentuali"
                    onClick={() => setAperto(aperto === m.id ? null : m.id)}
                  >
                    {arrotonda(m.valore)} {m.unita ?? 'kg'}
                  </button>
                  <span className="hint">{formatData(m.data)}</span>
                  <span className="row-actions">
                    <button className="danger" title="Elimina" onClick={() => void elimina(m)}>
                      <Trash2 size={15} />
                    </button>
                  </span>
                </div>
                {aperto === m.id && (
                  <div className="quote-massimale">
                    {QUOTE.map((q) => (
                      <span key={q} className="quota">
                        <span className="quota-et">{q}%</span>
                        <span className="quota-val">{arrotonda((m.valore * q) / 100)} kg</span>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
