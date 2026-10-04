import { useEffect, useRef, useState } from 'react'
import { useSalvataggio } from '../salvataggio'
import IndicatoreSalvataggio from './IndicatoreSalvataggio'
import { Trash2 } from 'lucide-react'
import { useClicSulFondo } from '../clicSulFondo'
import { useZoomPizzico } from '../zoomPizzico'
import type { BodyChartCompleta, SegnoBodyChart, TipoSegno, Vista } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg } from '../lib'
import { scorciatoieBloccate, useScorciatoie } from '../scorciatoie'
import FiguraChart, { SEGNI, viste, type SegnoDisegnato } from './FiguraUmana'

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
  // Chiudendo il programma, o uscendo da questa scheda, con segni non
  // salvati: si salvano da soli.
  const salvataggio = useSalvataggio(!soloLettura && modificato)

  // Esc chiude, Ctrl+S salva: sono le due cose che si fanno di continuo qui
  // dentro.
  useScorciatoie([
    { tasto: 'Escape', azione: () => void chiudi() },
    { tasto: 's', ctrl: true, azione: () => void salvataggio.salva(), attiva: !soloLettura && modificato }
  ])

  // Ctrl+Z dentro a una casella di testo (Note, Intensita') annulla quello che
  // si e' scritto, come sempre; fuori dalle caselle toglie l'ultimo segno
  // messo sulla figura. Un ascoltatore a parte, non la scorciatoia qui sopra:
  // quella con Ctrl scatta anche dentro alle caselle, e qui non deve.
  // Sta sopra il controllo sul caricamento: un hook dopo un return anticipato
  // cambia il numero di hook fra un disegno e l'altro, e la pagina va in bianco.
  useEffect(() => {
    const tasto = (e: KeyboardEvent): void => {
      if (soloLettura || scorciatoieBloccate()) return
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      e.preventDefault()
      if (segni.length === 0) {
        toast('Niente da annullare.')
        return
      }
      setSegni(segni.slice(0, -1))
      setSelezione(null)
      setModificato(true)
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  })

  // Un clic fuori dalla finestra la chiude. Se c'erano segni non ancora
  // salvati si salvano da soli (vedi useSalvataggio sopra): al genitore si
  // dice se c'era qualcosa da salvare, cosi' non cancella una scheda appena
  // creata che in realta' e' stata riempita.
  const chiudi = (): void => {
    onChiudi(modificato)
  }
  const sulFondo = useClicSulFondo(() => void chiudi())
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

  salvataggio.funzione.current = () => salva()
  const salva = async (): Promise<boolean> => {
    try {
      await window.api.bodyChart.salva({
        chart: { ...dati.chart, data, note: note.trim() || null },
        segni: segni.map(({ chiave: _c, ...resto }) => resto)
      })
      toast('Body chart salvata.')
      // gia' salvata: chiudendosi non deve salvarla una seconda volta
      salvataggio.funzione.current = null
      onChiudi(true)
      return true
    } catch (e) {
      toastErrore(errMsg(e))
      return false
    }
  }

  const disegnati = (vista: SegnoLocale['vista']): SegnoDisegnato[] =>
    segni
      .filter((s) => s.vista === vista)
      .map((s) => ({ ...s, selezionato: !soloLettura && s.chiave === selezione }))

  return (
    <div className="modal-overlay" {...sulFondo}>
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


        {/* Le viste dipendono dal tipo di chart: corpo intero o piede. */}
        <div className={`corpi${dati.chart.tipo === 'piede' ? ' corpi-piede' : ''}`}>
          {viste(dati.chart.tipo).map((v) => (
            <RiquadroVista
              key={v.valore}
              vista={v.valore}
              etichetta={v.etichetta}
              segni={disegnati(v.valore)}
              attivo={!soloLettura}
              onClicCorpo={soloLettura ? undefined : (x, y) => aggiungi(v.valore, x, y)}
              onPrendiSegno={prendi}
            />
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
          {!soloLettura && <IndicatoreSalvataggio stato={salvataggio.stato} errore={salvataggio.errore} />}
          <button onClick={() => void chiudi()}>{soloLettura ? 'Chiudi' : 'Annulla'}</button>
          {!soloLettura && (
            <button
              className="primary"
              disabled={!modificato || salvataggio.stato === 'salvo'}
              onClick={() => void salvataggio.salva()}
            >
              Salva
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Un riquadro con la sua figura: lo zoom e' suo, non della finestra intera,
// cosi' si puo' ingrandire un lato senza toccare gli altri.
function RiquadroVista({
  vista,
  etichetta,
  segni,
  attivo,
  onClicCorpo,
  onPrendiSegno
}: {
  vista: Vista
  etichetta: string
  segni: SegnoDisegnato[]
  attivo: boolean
  onClicCorpo?: (x: number, y: number) => void
  onPrendiSegno: (chiave: string, e: React.PointerEvent<SVGGElement>) => void
}): React.JSX.Element {
  const { ref, scala, ingrandita } = useZoomPizzico<HTMLDivElement>()
  return (
    <div ref={ref} className={`corpo-riquadro${ingrandita ? ' zoomata' : ''}`}>
      <div className="corpo-zoom" style={{ transform: `scale(${scala})` }}>
        <FiguraChart
          vista={vista}
          segni={segni}
          attivo={attivo}
          onClicCorpo={onClicCorpo}
          onPrendiSegno={onPrendiSegno}
        />
      </div>
      <span className="corpo-etichetta">{etichetta}</span>
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
