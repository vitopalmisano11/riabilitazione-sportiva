import type { TipoSegno, VistaCorpo } from '../../../shared/types'

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

export const LARGHEZZA = 260
export const ALTEZZA = 660

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

const TRONCO = `M110,104
  C96,108 84,120 78,142
  C74,162 76,178 78,196
  C80,216 86,236 92,256
  C96,274 84,292 78,310
  C74,330 76,348 84,358
  C98,368 162,368 176,358
  C184,348 186,330 182,310
  C176,292 164,274 168,256
  C174,236 180,216 182,196
  C184,178 186,162 182,142
  C176,120 164,108 150,104
  Z`

const BRACCIO = `M182,126
  C202,130 214,146 215,168
  C214,192 211,214 208,238
  C205,262 201,284 198,304
  C196,320 198,332 196,342
  C193,356 183,362 175,358
  C169,354 168,344 170,334
  C173,314 178,292 181,270
  C184,244 187,214 187,186
  C187,164 184,144 176,134
  C177,129 179,125 182,126 Z`

const GAMBA = `M184,334
  C188,362 184,396 179,426
  C176,448 172,462 170,478
  C171,498 175,512 175,530
  C173,562 166,596 160,624
  C158,638 160,646 164,652
  C154,657 142,657 136,652
  C133,644 135,634 136,624
  C138,596 143,562 145,530
  C146,512 143,498 143,478
  C142,456 140,428 140,400
  C139,376 138,352 140,338 Z`

const PIEDE = `M140,612
  C152,608 166,612 172,622
  C178,632 181,644 181,652
  C181,659 172,661 160,661
  C148,661 139,659 136,653
  C132,645 133,622 140,612 Z`

// Profilo rivolto a sinistra, stesse altezze del corpo frontale.
const PROFILO_TRONCO = `M114,108
  C102,116 96,132 94,154
  C92,176 92,192 93,208
  C94,230 99,246 102,264
  C104,282 100,294 102,310
  C105,334 116,350 134,354
  C158,358 182,350 191,332
  C196,318 193,298 188,280
  C183,260 180,242 181,220
  C182,194 183,164 175,144
  C167,122 152,108 132,106
  Z`

const PROFILO_BRACCIO = `M126,150
  C140,156 145,174 145,196
  C145,226 143,256 141,284
  C140,304 139,320 139,334
  C139,348 130,355 121,352
  C113,349 110,340 111,330
  C113,302 115,270 115,238
  C115,210 113,182 115,168
  C117,158 121,149 126,150 Z`

const PROFILO_GAMBA = `M104,336
  C100,364 104,398 108,428
  C112,450 114,462 114,478
  C113,498 108,510 110,528
  C112,560 118,594 124,624
  C126,638 124,646 120,652
  C134,657 152,657 158,652
  C161,644 159,634 158,624
  C160,594 164,562 166,528
  C167,510 168,498 168,478
  C168,456 166,428 164,400
  C162,376 164,352 164,338 Z`

const PROFILO_PIEDE = `M112,612
  C126,608 138,614 143,626
  C147,637 147,650 143,657
  C135,662 96,662 80,658
  C71,655 69,646 76,640
  C87,629 102,617 112,612 Z`

// Testa e collo, uguali per costruzione nelle quattro viste.
function TestaCollo({ profilo }: { profilo: boolean }): React.JSX.Element {
  return profilo ? (
    <>
      <ellipse cx="128" cy="54" rx="32" ry="40" />
      <path d="M114,78 L148,78 L152,118 L110,118 Z" />
      {/* naso */}
      <path d="M100,56 C90,63 88,70 94,76 L104,76 Z" />
    </>
  ) : (
    <>
      <ellipse cx="130" cy="54" rx="29" ry="40" />
      <path d="M112,78 L148,78 L152,116 L108,116 Z" />
    </>
  )
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
function DettagliFronte(): React.JSX.Element {
  return (
    <g className="corpo-riferimento">
      {/* incisura giugulare e clavicole */}
      <path d="M123,118 L130,128 L137,118" />
      <path d="M100,130 C112,139 122,142 130,142" />
      <path d="M160,130 C148,139 138,142 130,142" />
      {/* pettorali */}
      <path d="M96,162 C108,190 122,198 130,184" />
      <path d="M164,162 C152,190 138,198 130,184" />
      {/* ombelico */}
      <path d="M127,266 C132,266 132,274 127,274" />
      {/* pieghe inguinali */}
      <path d="M94,296 C108,318 120,330 130,336" />
      <path d="M166,296 C152,318 140,330 130,336" />
      {/* ginocchia */}
      <path d="M92,470 C99,478 106,480 112,476" />
      <path d="M168,470 C161,478 154,480 148,476" />
    </g>
  )
}

function DettagliRetro(): React.JSX.Element {
  return (
    <g className="corpo-riferimento">
      {/* colonna vertebrale */}
      <path d="M130,126 L130,300" strokeDasharray="9 8" />
      {/* scapole */}
      <path d="M102,150 C94,174 98,198 112,210" />
      <path d="M158,150 C166,174 162,198 148,210" />
      {/* fossette sacrali */}
      <path d="M116,302 C118,306 118,312 116,314" />
      <path d="M144,302 C142,306 142,312 144,314" />
      {/* piega glutea */}
      <path d="M98,330 C110,344 122,348 130,346" />
      <path d="M162,330 C150,344 138,348 130,346" />
      {/* cavo popliteo */}
      <path d="M94,468 C101,476 108,478 114,474" />
      <path d="M166,468 C159,476 152,478 146,474" />
      {/* polpacci */}
      <path d="M104,506 C108,528 108,548 104,564" />
      <path d="M156,506 C152,528 152,548 156,564" />
    </g>
  )
}

function DettagliProfilo(): React.JSX.Element {
  return (
    <g className="corpo-riferimento">
      {/* orecchio */}
      <path d="M124,54 C132,52 134,62 126,66" />
      {/* margine anteriore del braccio, che di lato copre il tronco */}
      <path d="M117,166 C114,200 113,250 114,300 C114,322 116,338 118,348" />
      {/* piega glutea */}
      <path d="M162,340 C168,348 172,356 172,364" />
      {/* ginocchio */}
      <path d="M132,474 C140,480 146,480 152,474" />
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
      {vista === 'fronte' && <DettagliFronte />}
      {vista === 'retro' && <DettagliRetro />}
      {profilo && <DettagliProfilo />}
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
