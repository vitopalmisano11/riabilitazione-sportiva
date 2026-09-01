import type { TipoSegno, VistaCorpo } from '../../../shared/types'
import {
  ALTEZZA,
  BRACCIO,
  DETTAGLI_FRONTE,
  DETTAGLI_PROFILO,
  DETTAGLI_RETRO,
  GAMBA,
  LARGHEZZA,
  PIEDE,
  PROFILO_BRACCIO,
  PROFILO_GAMBA,
  PROFILO_PIEDE,
  PROFILO_TRONCO,
  TESTA_FRONTE,
  TESTA_PROFILO,
  TRONCO,
  type Forma,
  type Linea
} from '../../../shared/figure'

// Figure disegnate in vettoriale sul modello della body chart di riferimento:
// contorno sottile su fondo bianco, corpo maschile atletico, con le linee
// anatomiche interne che servono a orientarsi (clavicole, pettorali, ombelico,
// pieghe inguinali davanti; colonna, scapole, piega glutea, cavo popliteo
// dietro).
//
// Proporzioni: otto teste. Mento a una testa, ombelico al 38%, inguine a meta'
// altezza, ginocchio al 72%, caviglia al 95%.
//
// Di fronte e di spalle il corpo e' simmetrico: si disegna la meta' destra e la
// si specchia. Il contorno e' aperto sull'asse centrale, quindi tracciandolo non
// compare nessuna linea in mezzo al corpo, e il riempimento chiude da solo.

export { ALTEZZA, LARGHEZZA }

export const VISTE: { valore: VistaCorpo; etichetta: string }[] = [
  { valore: 'fronte', etichetta: 'Davanti' },
  { valore: 'retro', etichetta: 'Dietro' },
  { valore: 'destra', etichetta: 'Lato destro' },
  { valore: 'sinistra', etichetta: 'Lato sinistro' }
]

export const SEGNI: { valore: TipoSegno; etichetta: string }[] = [
  { valore: 'rigidita', etichetta: 'Rigidità percepita' },
  { valore: 'dolore', etichetta: 'Area dolorosa' },
  { valore: 'scossa', etichetta: 'Scossa elettrica' },
  { valore: 'parestesie', etichetta: 'Parestesie' }
]

// Il corpo e' composto di parti (testa, collo, tronco, braccia, gambe, piedi)
// che si sovrappongono. Disegnandole prima tutte con un tratto spesso del
// colore del contorno e poi tutte riempite di bianco, resta il solo contorno
// esterno dell'unione: fra le parti non compaiono giunzioni, e dove il braccio
// si stacca dal tronco il suo profilo si vede da solo.
//
// Misure antropometriche di un uomo di 180 cm riportate in scala su un'altezza
// di 638 punti: spalle 40 cm, torace 30, vita 27, fianchi 33, coscia 17,
// ginocchio 11, polpaccio 12, caviglia 7.

function Forme({ forme }: { forme: Forma[] }): React.JSX.Element {
  return (
    <>
      {forme.map((f, i) =>
        f.tipo === 'ellisse' ? (
          <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} />
        ) : (
          <path key={i} d={f.d} />
        )
      )}
    </>
  )
}

function TestaCollo({ profilo }: { profilo: boolean }): React.JSX.Element {
  return <Forme forme={profilo ? TESTA_PROFILO : TESTA_FRONTE} />
}

function Parti({ profilo }: { profilo: boolean }): React.JSX.Element {
  const specchiaX = `translate(${LARGHEZZA} 0) scale(-1 1)`
  if (profilo) {
    return (
      <>
        <TestaCollo profilo />
        <path d={PROFILO_TRONCO} />
        <path d={PROFILO_BRACCIO} />
        <path d={PROFILO_GAMBA} />
        <path d={PROFILO_PIEDE} />
      </>
    )
  }
  return (
    <>
      <TestaCollo profilo={false} />
      <path d={TRONCO} />
      <path d={GAMBA} />
      <path d={GAMBA} transform={specchiaX} />
      <path d={PIEDE} />
      <path d={PIEDE} transform={specchiaX} />
      <path d={BRACCIO} />
      <path d={BRACCIO} transform={specchiaX} />
    </>
  )
}

// Linee anatomiche interne, una per vista.
function Dettagli({ linee }: { linee: Linea[] }): React.JSX.Element {
  return (
    <g className="corpo-riferimento">
      {linee.map((l, i) => (
        <path key={i} d={l.d} strokeDasharray={l.tratteggio} />
      ))}
    </g>
  )
}

function Sagoma({ vista }: { vista: VistaCorpo }): React.JSX.Element {
  const profilo = vista === 'sinistra' || vista === 'destra'
  // il lato destro e' lo stesso profilo, specchiato
  const specchia = vista === 'destra' ? `translate(${LARGHEZZA} 0) scale(-1 1)` : undefined

  return (
    <g transform={specchia}>
      <g className="corpo-bordo">
        <Parti profilo={profilo} />
      </g>
      <g className="corpo-pieno">
        <Parti profilo={profilo} />
      </g>
      {vista === 'fronte' && <Dettagli linee={DETTAGLI_FRONTE} />}
      {vista === 'retro' && <Dettagli linee={DETTAGLI_RETRO} />}
      {profilo && <Dettagli linee={DETTAGLI_PROFILO} />}
    </g>
  )
}

// --- simboli ---
// Disegnati attorno all'origine e poi spostati: la posizione memorizzata resta
// il centro del segno.
function Simbolo({ tipo, r }: { tipo: TipoSegno; r: number }): React.JSX.Element {
  if (tipo === 'dolore') {
    return <circle className="segno-dolore" cx="0" cy="0" r={r} />
  }
  if (tipo === 'rigidita') {
    const passo = r / 2
    return (
      <g className="segno-rigidita">
        {[-1, 0, 1].map((i) => (
          <line
            key={i}
            x1={i * passo - r * 0.55}
            y1={r * 0.75}
            x2={i * passo + r * 0.55}
            y2={-r * 0.75}
          />
        ))}
      </g>
    )
  }
  if (tipo === 'scossa') {
    const s = r / 6
    return (
      <path
        className="segno-scossa"
        d={`M${-1.5 * s},${-6 * s} L${2.5 * s},${-6 * s} L${0.2 * s},${-0.5 * s}
            L${3 * s},${-0.5 * s} L${-2 * s},${6 * s} L${-0.2 * s},${1 * s}
            L${-2.6 * s},${1 * s} Z`}
      />
    )
  }
  return <circle className="segno-parestesie" cx="0" cy="0" r={r} />
}

// Pittogramma per il pulsante che apre la body chart: testa tonda, braccia
// aperte, gambe. Nessuna scritta, il nome compare passandoci sopra.
// Pittogramma per il pulsante che apre la body chart: la testa a parte, e il
// resto (braccia, busto, gambe) come un unico contorno chiuso — cosi' dentro
// resta tutto bianco e nessuna linea attraversa il petto.
export function SagomaIcona({ size = 26 }: { size?: number }): React.JSX.Element {
  return (
    <svg className="icona-sagoma" width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="17" r="12" />
      <path
        d="M25,37 L75,37 A6.5,6.5 0 0 1 75,50 L66,50 L66,86 A7.5,7.5 0 0 1 51,86
           L51,71 A2,2 0 0 0 47,71 L47,86 A7.5,7.5 0 0 1 32,86 L32,50
           L25,50 A6.5,6.5 0 0 1 25,37 Z"
      />
    </svg>
  )
}

export interface SegnoDisegnato {
  chiave: string
  tipo: TipoSegno
  x: number
  y: number
  dimensione: number
  intensita: number | null
  selezionato?: boolean
}

export default function FiguraUmana({
  vista,
  segni,
  attivo,
  onClicCorpo,
  onPrendiSegno
}: {
  vista: VistaCorpo
  segni: SegnoDisegnato[]
  attivo?: boolean
  onClicCorpo?: (x: number, y: number) => void
  onPrendiSegno?: (chiave: string, e: React.PointerEvent<SVGGElement>) => void
}): React.JSX.Element {
  // Dal punto cliccato alle frazioni 0..1 con cui il segno viene memorizzato.
  const posizione = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  return (
    <svg
      className={['figura-umana', attivo ? 'attiva' : ''].filter(Boolean).join(' ')}
      viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
      onPointerDown={
        onClicCorpo
          ? (e) => {
              // il clic su un segno lo prende: qui arriva solo quello sul corpo
              if ((e.target as Element).closest('.segno')) return
              const p = posizione(e)
              onClicCorpo(p.x, p.y)
            }
          : undefined
      }
    >
      <Sagoma vista={vista} />
      {segni.map((s) => (
        <g
          key={s.chiave}
          className={['segno', s.selezionato ? 'selezionato' : ''].filter(Boolean).join(' ')}
          transform={`translate(${s.x * LARGHEZZA} ${s.y * ALTEZZA})`}
          onPointerDown={onPrendiSegno ? (e) => onPrendiSegno(s.chiave, e) : undefined}
        >
          <Simbolo tipo={s.tipo} r={14 * s.dimensione} />
          {/* area invisibile piu' generosa: il segno si afferra senza mirare */}
          <circle className="segno-presa" cx="0" cy="0" r={Math.max(18, 16 * s.dimensione)} />
          <title>
            {SEGNI.find((x) => x.valore === s.tipo)?.etichetta}
            {s.intensita != null ? ` — intensità ${s.intensita}/10` : ''}
          </title>
        </g>
      ))}
    </svg>
  )
}
