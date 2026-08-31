import { useRef } from 'react'
import type { PuntoAndamento, SintomoAnamnesi, TipoGrafico } from '../../../shared/types'

// Andamento del dolore nel tempo. Una linea per sintomo, come la legenda della
// cartella cartacea: si vede se peggiorano insieme o uno per volta.
//
// Nel grafico del giorno l'asse orizzontale sono le 24 ore, a ore equidistanti.
// In quello dall'esordio i punti si susseguono a distanza uguale in ordine di
// data: un paziente puo' dire "cinque anni fa", e in scala reale i punti recenti
// finirebbero ammassati in pochi millimetri.

export const COLORI = ['#2563eb', '#d64545', '#1f9d61', '#b45309', '#7c3aed']

const L = 640
const A = 280
// margine inferiore generoso: sotto le etichette ci va il nome dell'asse
const M = { su: 14, giu: 56, sx: 34, dx: 16 }
const LARGO = L - M.sx - M.dx
const ALTO = A - M.su - M.giu

const GIORNO_MINUTI = 24 * 60
const ORE = [0, 4, 8, 12, 16, 20, 24]

export interface Selezione {
  sintomo: number
  punto: number
}

// Le date presenti nei punti, in ordine: ognuna occupa una posizione fissa.
export function scalettaDate(sintomi: SintomoAnamnesi[]): string[] {
  const date = new Set<string>()
  for (const s of sintomi) {
    for (const p of s.punti) if (p.grafico === 'esordio' && p.data) date.add(p.data)
  }
  return [...date].sort()
}

function formattaData(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
}

export default function GraficoAndamento({
  tipo,
  sintomi,
  sintomoAttivo,
  selezione,
  onSeleziona,
  onAggiungi,
  onSposta
}: {
  tipo: TipoGrafico
  sintomi: SintomoAnamnesi[]
  sintomoAttivo: number
  selezione: Selezione | null
  onSeleziona: (s: Selezione | null) => void
  onAggiungi: (indiceSintomo: number, punto: Omit<PuntoAndamento, 'id'>) => void
  onSposta: (s: Selezione, patch: Partial<PuntoAndamento>) => void
}): React.JSX.Element {
  const date = tipo === 'esordio' ? scalettaDate(sintomi) : []
  const trascina = useRef<Selezione | null>(null)

  const px = (p: PuntoAndamento): number => {
    if (tipo === 'giorno') return M.sx + ((p.minuti ?? 0) / GIORNO_MINUTI) * LARGO
    const i = date.indexOf(p.data ?? '')
    if (i < 0) return M.sx
    return date.length === 1 ? M.sx + LARGO / 2 : M.sx + (i / (date.length - 1)) * LARGO
  }
  const py = (dolore: number): number => M.su + (1 - dolore / 10) * ALTO

  // Dal punto cliccato ai valori del grafico.
  const daEvento = (e: { clientX: number; clientY: number }, svg: SVGSVGElement) => {
    const r = svg.getBoundingClientRect()
    const fx = ((e.clientX - r.left) / r.width) * L
    const fy = ((e.clientY - r.top) / r.height) * A
    const dolore = Math.min(10, Math.max(0, Math.round((1 - (fy - M.su) / ALTO) * 10)))
    // ore piene: il dato che serve e' grossolano, non i quarti d'ora
    const minuti = Math.min(
      GIORNO_MINUTI,
      Math.max(0, Math.round(((fx - M.sx) / LARGO) * 24) * 60)
    )
    return { dolore, minuti, dentro: fx >= M.sx - 8 && fx <= L - M.dx + 8 && fy >= 0 && fy <= A - M.giu }
  }

  const clic = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (sintomi.length === 0) return
    const v = daEvento(e, e.currentTarget)
    if (!v.dentro) return
    // Dall'esordio la data non la puo' indovinare l'app: chi ha in mano il
    // colloquio la scrive, e il punto si colloca da solo. Cosi' due punti non
    // possono nemmeno finire impilati sulla stessa data.
    onAggiungi(sintomoAttivo, {
      grafico: tipo,
      minuti: tipo === 'giorno' ? v.minuti : null,
      data: null,
      dolore: v.dolore
    })
  }

  const muovi = (e: React.PointerEvent<SVGSVGElement>): void => {
    const t = trascina.current
    if (!t) return
    const v = daEvento(e, e.currentTarget)
    // dall'esordio la posizione orizzontale la decide la data, non il mouse
    onSposta(t, tipo === 'giorno' ? { dolore: v.dolore, minuti: v.minuti } : { dolore: v.dolore })
  }

  return (
    <svg
      className="grafico"
      viewBox={`0 0 ${L} ${A}`}
      onClick={clic}
      onPointerMove={muovi}
      onPointerUp={() => {
        trascina.current = null
      }}
      onPointerLeave={() => {
        trascina.current = null
      }}
    >
      {/* dolore: tutti i valori da 0 a 10 */}
      {Array.from({ length: 11 }, (_, d) => (
        <g key={d}>
          <line className="grafico-griglia" x1={M.sx} y1={py(d)} x2={L - M.dx} y2={py(d)} />
          <text className="grafico-etichetta" x={M.sx - 8} y={py(d) + 4} textAnchor="end">
            {d}
          </text>
        </g>
      ))}

      {tipo === 'giorno'
        ? ORE.map((h) => (
            <text
              key={h}
              className="grafico-etichetta"
              x={M.sx + (h / 24) * LARGO}
              y={A - M.giu + 20}
              textAnchor="middle"
            >
              {h}
            </text>
          ))
        : date.map((d, i) => (
            <text
              key={d}
              className="grafico-etichetta"
              x={date.length === 1 ? M.sx + LARGO / 2 : M.sx + (i / (date.length - 1)) * LARGO}
              y={A - M.giu + 20}
              textAnchor="middle"
            >
              {formattaData(d)}
            </text>
          ))}

      <text className="grafico-etichetta" x={L / 2} y={A - 10} textAnchor="middle">
        {tipo === 'giorno' ? 'ora del giorno' : 'data'}
      </text>

      {sintomi.map((s, i) => {
        const indicizzati = s.punti
          .map((p, j) => ({ p, j }))
          .filter((q) => q.p.grafico === tipo)
          .map((q) => ({ ...q, x: px(q.p), y: py(q.p.dolore) }))
          .sort((a, b) => a.x - b.x)
        if (indicizzati.length === 0) return null
        const colore = COLORI[i % COLORI.length]
        return (
          <g key={s.id ?? i}>
            {indicizzati.length > 1 && (
              <polyline
                className="grafico-linea"
                stroke={colore}
                points={indicizzati.map((q) => `${q.x},${q.y}`).join(' ')}
              />
            )}
            {indicizzati.map((q) => {
              const scelto = selezione?.sintomo === i && selezione?.punto === q.j
              return (
                <circle
                  key={q.j}
                  className={['grafico-punto', scelto ? 'scelto' : ''].filter(Boolean).join(' ')}
                  fill={colore}
                  cx={q.x}
                  cy={q.y}
                  r={scelto ? 8 : 6}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onSeleziona({ sintomo: i, punto: q.j })
                    trascina.current = { sintomo: i, punto: q.j }
                    e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId)
                  }}
                >
                  <title>{`Sintomo ${i + 1} — dolore ${q.p.dolore}/10`}</title>
                </circle>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
