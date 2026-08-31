import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { BodyChartCompleta, SegnoBodyChart, TipoSegno } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg } from '../lib'
import FiguraUmana, { SEGNI, VISTE, type SegnoDisegnato } from './FiguraUmana'

// I segni in memoria hanno una chiave stabile: l'id del database non c'e'
// ancora per quelli appena messi, e serve poterli selezionare e trascinare.
interface SegnoLocale extends SegnoBodyChart {
  chiave: string
}

let contatore = 0
const nuovaChiave = (): string => `s${++contatore}`

export default function BodyChartEditor({
  chartId,
  soloLettura,
  onChiudi
}: {
  chartId: number
  soloLettura: boolean
  onChiudi: (salvata: boolean) => void
}): React.JSX.Element {
  const [dati, setDati] = useState<BodyChartCompleta | null>(null)
  const [segni, setSegni] = useState<SegnoLocale[]>([])
  const [note, setNote] = useState('')
  const [data, setData] = useState('')
  const [strumento, setStrumento] = useState<TipoSegno>('dolore')
  const [selezione, setSelezione] = useState<string | null>(null)
  const [modificato, setModificato] = useState(false)
  // trascinamento in corso: quale segno e su quale figura
  const trascina = useRef<{ chiave: string; riquadro: DOMRect } | null>(null)

  useEffect(() => {
    window.api.bodyChart
      .get(chartId)
      .then((d) => {
        setDati(d)
        setData(d.chart.data)
        setNote(d.chart.note ?? '')
        setSegni(d.segni.map((s) => ({ ...s, chiave: nuovaChiave() })))
      })
      .catch((e) => toastErrore(errMsg(e)))
  }, [chartId])

  if (!dati) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <p className="hint">Caricamento…</p>
        </div>
      </div>
    )
  }

  const selezionato = segni.find((s) => s.chiave === selezione) ?? null

  const cambia = (chiave: string, patch: Partial<SegnoLocale>): void => {
    setSegni(segni.map((s) => (s.chiave === chiave ? { ...s, ...patch } : s)))
    setModificato(true)
  }

  const aggiungi = (vista: SegnoLocale['vista'], x: number, y: number): void => {
    if (soloLettura) return
    const chiave = nuovaChiave()
    setSegni([
      ...segni,
      { id: null, chiave, vista, tipo: strumento, x, y, dimensione: 1, intensita: null }
    ])
    setSelezione(chiave)
    setModificato(true)
  }

  const elimina = (chiave: string): void => {
    setSegni(segni.filter((s) => s.chiave !== chiave))
    setSelezione(null)
    setModificato(true)
  }

  // Trascinamento: si segue il puntatore finche' non viene rilasciato.
  const prendi = (chiave: string, e: React.PointerEvent<SVGGElement>): void => {
    setSelezione(chiave)
    if (soloLettura) return
    e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    trascina.current = { chiave, riquadro: svg.getBoundingClientRect() }
    svg.setPointerCapture(e.pointerId)
  }

  const muovi = (e: React.PointerEvent<HTMLDivElement>): void => {
    const t = trascina.current
    if (!t) return
    const x = Math.min(1, Math.max(0, (e.clientX - t.riquadro.left) / t.riquadro.width))
    const y = Math.min(1, Math.max(0, (e.clientY - t.riquadro.top) / t.riquadro.height))
    cambia(t.chiave, { x, y })
  }

  const salva = async (): Promise<void> => {
    try {
      await window.api.bodyChart.salva({
        chart: { ...dati.chart, data, note: note.trim() || null },
        segni: segni.map(({ chiave: _c, ...resto }) => resto)
      })
      toast('Body chart salvata.')
      onChiudi(true)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const disegnati = (vista: SegnoLocale['vista']): SegnoDisegnato[] =>
    segni
      .filter((s) => s.vista === vista)
      .map((s) => ({ ...s, selezionato: !soloLettura && s.chiave === selezione }))

  return (
    <div className="modal-overlay" onClick={() => onChiudi(false)}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        onPointerMove={muovi}
        onPointerUp={() => {
          trascina.current = null
        }}
      >
        <div className="card-header-row">
          <h3>{soloLettura ? 'Body chart' : 'Body chart — modifica'}</h3>
          <label className="compila-data">
            Data
            <input
              type="date"
              value={data}
              disabled={soloLettura}
              onChange={(e) => {
                setData(e.target.value)
                setModificato(true)
              }}
            />
          </label>
        </div>

        {!soloLettura && (
          <div className="legenda-segni">
            {SEGNI.map((s) => (
              <button
                key={s.valore}
                className={strumento === s.valore ? 'scelta-attiva' : ''}
                onClick={() => setStrumento(s.valore)}
              >
                <svg className="icona-segno" viewBox="-14 -14 28 28">
                  <AnteprimaSegno tipo={s.valore} />
                </svg>
                {s.etichetta}
              </button>
            ))}
          </div>
        )}
        {!soloLettura && !selezionato && (
          <p className="hint">
            Scegli un segno qui sopra, poi clicca sul corpo per metterlo. Per ingrandirlo o dargli
            un&apos;intensità, clicca il segno già messo: qui compaiono i suoi comandi.
          </p>
        )}
        {!soloLettura && selezionato && (
          <div className="segno-strumenti">
            <span className="regola-parola">
              {SEGNI.find((s) => s.valore === selezionato.tipo)?.etichetta}
            </span>
            <label className="compila-data">
              Dimensione
              <input
                type="range"
                min={0.6}
                max={3}
                step={0.1}
                value={selezionato.dimensione}
                onChange={(e) =>
                  cambia(selezionato.chiave, { dimensione: Number(e.target.value) })
                }
              />
            </label>
            <label className="compila-data">
              Intensità
              <input
                type="number"
                className="campo-stretto"
                min={0}
                max={10}
                placeholder="0-10"
                value={selezionato.intensita ?? ''}
                onChange={(e) =>
                  cambia(selezionato.chiave, {
                    intensita: e.target.value === '' ? null : Number(e.target.value)
                  })
                }
              />
            </label>
            <button
              className="danger"
              title="Togli questo segno"
              onClick={() => elimina(selezionato.chiave)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}


        <div className="corpi">
          {VISTE.map((v) => (
            <div key={v.valore} className="corpo-riquadro">
              <FiguraUmana
                vista={v.valore}
                segni={disegnati(v.valore)}
                attivo={!soloLettura}
                onClicCorpo={soloLettura ? undefined : (x, y) => aggiungi(v.valore, x, y)}
                onPrendiSegno={prendi}
              />
              <span className="corpo-etichetta">{v.etichetta}</span>
            </div>
          ))}
        </div>

        <label>
          Note
          <textarea
            rows={1}
            disabled={soloLettura}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setModificato(true)
            }}
          />
        </label>

        <div className="modal-actions">
          <button onClick={() => onChiudi(false)}>{soloLettura ? 'Chiudi' : 'Annulla'}</button>
          {!soloLettura && (
            <button className="primary" disabled={!modificato} onClick={() => void salva()}>
              Salva
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Il segno in piccolo, per la legenda.
function AnteprimaSegno({ tipo }: { tipo: TipoSegno }): React.JSX.Element {
  if (tipo === 'dolore') return <circle className="segno-dolore" r="7" />
  if (tipo === 'parestesie') return <circle className="segno-parestesie" r="8" />
  if (tipo === 'rigidita') {
    return (
      <g className="segno-rigidita">
        <line x1="-6" y1="5" x2="-2" y2="-5" />
        <line x1="-2" y1="5" x2="2" y2="-5" />
        <line x1="2" y1="5" x2="6" y2="-5" />
      </g>
    )
  }
  return <path className="segno-scossa" d="M-2,-9 L4,-9 L0.5,-1 L5,-1 L-3,9 L0,1 L-4,1 Z" />
}
