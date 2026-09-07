import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import type { AndamentoSegno, PazienteDettaglio } from '../../../shared/types'
import Aiuto from './Aiuto'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg, formatData } from '../lib'

// I segni di riferimento: le due o tre cose che di questo paziente si
// ricontrollano a ogni seduta.
//
// La valutazione completa non si rifa' tutte le volte, e senza qualcosa di
// misurato "va meglio" resta un'impressione. Qui si scelgono i segni (il
// dolore in un movimento, un grado di mobilita', quello che conta per lui) e
// si legge da dove sono partiti e dove sono arrivati. I numeri si scrivono
// mentre si compone la seduta, in fondo, accanto a dolore e sforzo.
export default function SegniPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [segni, setSegni] = useState<AndamentoSegno[]>([])
  const [nuovo, setNuovo] = useState(false)
  const [nome, setNome] = useState('')
  const [unita, setUnita] = useState('')

  const carica = useCallback((): void => {
    window.api.segni
      .andamento(paziente.id)
      .then(setSegni)
      .catch((e) => toastErrore(errMsg(e)))
  }, [paziente.id])

  useEffect(carica, [carica])

  const aggiungi = async (): Promise<void> => {
    if (nome.trim() === '') return
    try {
      await window.api.segni.create(paziente.id, nome, unita.trim() || null)
      setNome('')
      setUnita('')
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (s: AndamentoSegno): Promise<void> => {
    const misure =
      s.misure === 0
        ? ''
        : `\nSi perdono anche le ${s.misure} misure che hai preso: senza il segno non dicono più niente.`
    if (!(await chiedi(`Togliere "${s.nome}" dai segni di riferimento?${misure}`))) return
    try {
      await window.api.segni.remove(s.id)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // L'unita' sta accanto al nome, non ripetuta su tutti e due i numeri: qui si
  // legge "da 7 a 3", non "da 7 0-10 a 3 0-10".
  const val = (n: number | null): string => (n == null ? '—' : String(n))

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>
          Segni di riferimento
          <Aiuto testo="le due o tre cose che di questo paziente ricontrolli tutte le volte: il dolore in un movimento, un grado di mobilità, un test veloce. il numero si scrive in fondo alla seduta, accanto a dolore e sforzo, e qui si vede da dove sei partito e dove sei arrivato." />
        </h3>
        {!nuovo && (
          <button className="btn-aggiungi-lista" title="Aggiungi un segno" onClick={() => setNuovo(true)}>
            <Plus size={16} /> Aggiungi segno
          </button>
        )}
      </div>

      {nuovo && (
        <div className="riga-nuovo-segno">
          <input
            autoFocus
            placeholder="es. dolore nello squat"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void aggiungi()
              if (e.key === 'Escape') setNuovo(false)
            }}
          />
          <input
            className="campo-unita"
            placeholder="unità (0-10, °, cm)"
            value={unita}
            onChange={(e) => setUnita(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void aggiungi()
              if (e.key === 'Escape') setNuovo(false)
            }}
          />
          <button className="primary" title="Aggiungi" onClick={() => void aggiungi()}>
            <Check size={16} />
          </button>
          <button title="Chiudi" onClick={() => setNuovo(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      {segni.length === 0 ? (
        <p className="hint">
          Nessun segno scelto. Scegline due o tre e li ritrovi in fondo a ogni seduta.
        </p>
      ) : (
        <ul className="lista-segni">
          {segni.map((s) => (
            <li key={s.id}>
              <span className="segno-nome">
                {s.nome}
                {s.unita && <span className="unita-segno">{s.unita}</span>}
              </span>
              {s.misure === 0 ? (
                <span className="hint">mai misurato</span>
              ) : (
                <span className="segno-andamento">
                  {s.misure > 1 && (
                    <>
                      <span className="segno-prima">{val(s.prima_valore)}</span>
                      <span className="segno-freccia">→</span>
                    </>
                  )}
                  <span className="segno-ultima">{val(s.ultima_valore)}</span>
                  <span className="hint">
                    {s.misure === 1
                      ? `il ${formatData(s.ultima_data)}`
                      : `${s.misure} misure, l'ultima il ${formatData(s.ultima_data)}`}
                  </span>
                </span>
              )}
              <span className="row-actions">
                <button className="danger" title="Togli il segno" onClick={() => void elimina(s)}>
                  <Trash2 size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
