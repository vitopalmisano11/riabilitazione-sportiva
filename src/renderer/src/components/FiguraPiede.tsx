import type { VistaPiede } from '../../../shared/types'
import {
  ARCO_PROFILO,
  DITA_DORSO,
  DITA_PIANTA,
  DORSO,
  MALLEOLI_DORSO,
  MALLEOLO_PROFILO,
  PIANTA,
  PROFILO,
  RIFERIMENTI_DORSO,
  RIFERIMENTI_PIANTA,
  RIFERIMENTI_PROFILO,
  type Ellisse
} from '../../../shared/figure-piede'

// Body chart del piede e della caviglia: quattro viste, e in ognuna tutti e due
// i piedi, cosi' il lato malato si segna accanto al sano.
//
// Il disegno di base e' il piede destro; il sinistro e' lo stesso specchiato. In
// ogni vista i piedi stanno da che parte li vedresti davvero: guardando il dorso
// il destro del paziente e' alla tua sinistra, guardando la pianta e' alla tua
// destra.

export const VISTE_PIEDE: { valore: VistaPiede; etichetta: string }[] = [
  { valore: 'dorso', etichetta: 'Dorso' },
  { valore: 'pianta', etichetta: 'Pianta' },
  { valore: 'esterno', etichetta: 'Lato esterno' },
  { valore: 'interno', etichetta: 'Lato interno' }
]

function Ellissi({ forme }: { forme: Ellisse[] }): React.JSX.Element {
  return (
    <>
      {forme.map((e, i) => (
        <ellipse
          key={i}
          cx={e.cx}
          cy={e.cy}
          rx={e.rx}
          ry={e.ry}
          transform={e.rotazione ? `rotate(${e.rotazione} ${e.cx} ${e.cy})` : undefined}
        />
      ))}
    </>
  )
}

// Contorno e dita insieme: disegnati prima con un tratto spesso e poi riempiti
// di bianco, restano un contorno solo e fra dito e piede non compare giunzione.
function Sagoma({ contorno, dita }: { contorno: string; dita?: Ellisse[] }): React.JSX.Element {
  const parti = (
    <>
      <path d={contorno} />
      {dita && <Ellissi forme={dita} />}
    </>
  )
  return (
    <>
      <g className="corpo-bordo">{parti}</g>
      <g className="corpo-pieno">{parti}</g>
    </>
  )
}

function Riferimenti({
  linee,
  ellissi
}: {
  linee: string[]
  ellissi?: Ellisse[]
}): React.JSX.Element {
  return (
    <g className="corpo-riferimento">
      {linee.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {ellissi && <Ellissi forme={ellissi} />}
    </g>
  )
}

function DallAlto({ vista }: { vista: 'dorso' | 'pianta' }): React.JSX.Element {
  const dorso = vista === 'dorso'
  const piede = (
    <>
      <Sagoma contorno={dorso ? DORSO : PIANTA} dita={dorso ? DITA_DORSO : DITA_PIANTA} />
      <Riferimenti
        linee={dorso ? RIFERIMENTI_DORSO : RIFERIMENTI_PIANTA}
        ellissi={dorso ? MALLEOLI_DORSO : undefined}
      />
    </>
  )
  // Guardando la pianta i lati si scambiano: il piede destro passa a destra.
  const specchiato = <g transform="translate(150 0) scale(-1 1)">{piede}</g>
  return (
    <>
      <g transform="translate(10 0)">{dorso ? piede : specchiato}</g>
      <g transform="translate(170 0)">{dorso ? specchiato : piede}</g>
    </>
  )
}

function DiLato({ vista }: { vista: 'esterno' | 'interno' }): React.JSX.Element {
  const interno = vista === 'interno'
  const piede = (
    <>
      <Sagoma contorno={PROFILO} />
      <Riferimenti
        linee={interno ? [...RIFERIMENTI_PROFILO, ARCO_PROFILO] : RIFERIMENTI_PROFILO}
        ellissi={[MALLEOLO_PROFILO]}
      />
    </>
  )
  // Il profilo e' disegnato in un riquadro piu' largo: rimpicciolito, sta in
  // mezza vista come le altre figure.
  const scala = 'scale(0.71) translate(0 60)'
  const specchiato = <g transform="translate(210 0) scale(-1 1)">{piede}</g>
  return (
    <>
      <g transform={`translate(6 0) ${scala}`}>{interno ? specchiato : piede}</g>
      <g transform={`translate(165 0) ${scala}`}>{interno ? piede : specchiato}</g>
    </>
  )
}

export default function SagomaPiede({ vista }: { vista: VistaPiede }): React.JSX.Element {
  return vista === 'dorso' || vista === 'pianta' ? (
    <DallAlto vista={vista} />
  ) : (
    <DiLato vista={vista} />
  )
}
