import type { PuntoAndamentoDolore } from '../../../shared/types'
import { formatData } from '../lib'

// Andamento del dolore nel tempo, per la linguetta "Quadro": a differenza del
// grafico dell'anamnesi (GraficoAndamento) qui non si scrive niente, si legge
// solo. I punti stanno a distanza uguale in ordine di data, non in scala
// reale: un punto segnato mesi fa non deve schiacciare le sedute vicine fra
// loro verso il bordo del grafico.

const L = 640
const A = 220
const M = { su: 14, giu: 40, sx: 34, dx: 16 }
const LARGO = L - M.sx - M.dx
const ALTO = A - M.su - M.giu

// gg/mm, e l'anno solo quando cambia rispetto all'etichetta precedente: sulla
// carta non serve ripeterlo a ogni punto se il percorso e' durato pochi mesi.
function etichette(punti: PuntoAndamentoDolore[]): string[] {
  let annoPrecedente: string | null = null
  return punti.map((p) => {
    const d = new Date(p.data + 'T00:00:00')
    if (Number.isNaN(d.getTime())) return p.data
    const gg = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const anno = String(d.getFullYear())
    const testo = anno === annoPrecedente ? `${gg}/${mm}` : `${gg}/${mm}/${anno.slice(2)}`
    annoPrecedente = anno
    return testo
  })
}

export default function GraficoDolore({
  punti
}: {
  punti: PuntoAndamentoDolore[]
}): React.JSX.Element {
  const px = (i: number): number =>
    punti.length === 1 ? M.sx + LARGO / 2 : M.sx + (i / (punti.length - 1)) * LARGO
  const py = (dolore: number): number => M.su + (1 - dolore / 10) * ALTO
  const labels = etichette(punti)

  return (
    <svg className="grafico" viewBox={`0 0 ${L} ${A}`} style={{ cursor: 'default' }}>
      {[0, 2, 4, 6, 8, 10].map((d) => (
        <g key={d}>
          <line className="grafico-griglia" x1={M.sx} y1={py(d)} x2={L - M.dx} y2={py(d)} />
          <text className="grafico-etichetta" x={M.sx - 8} y={py(d) + 4} textAnchor="end">
            {d}
          </text>
        </g>
      ))}

      {punti.length > 1 && (
        <polyline
          className="grafico-linea"
          stroke="var(--accent)"
          points={punti.map((p, i) => `${px(i)},${py(p.dolore)}`).join(' ')}
        />
      )}

      {punti.map((p, i) => (
        <g key={`${p.origine}-${p.data}-${i}`}>
          <circle
            className="grafico-punto"
            fill={p.origine === 'anamnesi' ? 'var(--text-dim)' : 'var(--accent)'}
            cx={px(i)}
            cy={py(p.dolore)}
            r={5}
          >
            <title>
              {(p.origine === 'anamnesi' ? 'Prima dell’inizio' : 'Seduta') +
                ` del ${formatData(p.data)} — dolore ${p.dolore}/10`}
            </title>
          </circle>
          <text className="grafico-etichetta" x={px(i)} y={A - M.giu + 20} textAnchor="middle">
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}
