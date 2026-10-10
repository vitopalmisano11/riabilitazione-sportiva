import { useRef, useState } from 'react'
import type { TipoChart, TipoSegno, Vista, VistaCorpo, VistaPiede } from '../../../shared/types'
import {
  PUNTI_MASSIMI,
  eTratto,
  percorsoTratto,
  spessoreTratto,
  stratiTratto,
  type Punto
} from '../../../shared/tratti'
import { PIEDE_ALTEZZA, PIEDE_LARGHEZZA } from '../../../shared/figure-piede'
import SagomaPiede, { VISTE_PIEDE } from './FiguraPiede'
import { ALTEZZA, LARGHEZZA } from '../../../shared/figure'
import immagineDavanti from '../../../../resources/bodychart/davanti.png'
import immagineDietro from '../../../../resources/bodychart/dietro.png'
import immagineLatoDestro from '../../../../resources/bodychart/lato-destro.png'
import immagineLatoSinistro from '../../../../resources/bodychart/lato-sinistro.png'

// Il corpo intero e' una foto/illustrazione fornita dall'utente (una per
// vista, ritagliata dall'immagine unica che ha mandato), non piu' un disegno
// vettoriale: si vede com'era nella foto, e le posizioni dei segni restano
// giuste perche' si registrano come frazioni 0..1 del riquadro della figura,
// non come punti assoluti. Il piede resta disegnato in vettoriale (nessuna
// foto e' stata fornita per quello).
const IMMAGINE_CORPO: Record<VistaCorpo, string> = {
  fronte: immagineDavanti,
  retro: immagineDietro,
  destra: immagineLatoDestro,
  sinistra: immagineLatoSinistro
}

export { ALTEZZA, LARGHEZZA }

export const VISTE_CORPO: { valore: VistaCorpo; etichetta: string }[] = [
  { valore: 'fronte', etichetta: 'Davanti' },
  { valore: 'retro', etichetta: 'Dietro' },
  { valore: 'destra', etichetta: 'Lato destro' },
  { valore: 'sinistra', etichetta: 'Lato sinistro' }
]

// Le viste di una body chart dipendono dal tipo: il corpo intero si guarda da
// quattro lati, il piede da sopra, da sotto e dai due profili.
export function viste(tipo: TipoChart): { valore: Vista; etichetta: string }[] {
  return tipo === 'piede' ? VISTE_PIEDE : VISTE_CORPO
}

function misure(vista: Vista): { larghezza: number; altezza: number } {
  return VISTE_PIEDE.some((v) => v.valore === vista)
    ? { larghezza: PIEDE_LARGHEZZA, altezza: PIEDE_ALTEZZA }
    : { larghezza: LARGHEZZA, altezza: ALTEZZA }
}

// I due pennelli stanno in testa: sono la funzione di base, quella che si usa
// premendo e trascinando sulla figura.
export const SEGNI: { valore: TipoSegno; etichetta: string }[] = [
  { valore: 'tratto', etichetta: 'Pennello' },
  { valore: 'sfumato', etichetta: 'Pennello tenue' },
  { valore: 'rigidita', etichetta: 'Rigidità percepita' },
  { valore: 'dolore', etichetta: 'Area dolorosa' },
  { valore: 'scossa', etichetta: 'Scossa elettrica' },
  { valore: 'parestesie', etichetta: 'Parestesie' }
]

function Sagoma({ vista }: { vista: VistaCorpo }): React.JSX.Element {
  return <image href={IMMAGINE_CORPO[vista]} x={0} y={0} width={LARGHEZZA} height={ALTEZZA} />
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
// Icona della body chart: la testa a parte, e il resto (braccia, busto, gambe)
// come un unico contorno chiuso, cosi' dentro resta tutto bianco e nessuna linea
// attraversa il petto.
//
// Il disegno arriva quasi ai bordi del riquadro e ha il tratto della stessa
// grossezza delle icone che gli stanno accanto: piu' stretto e sottile sembrava
// piu' piccolo degli altri pulsanti, pur essendo alto uguale.
// L'omino della body chart: una figura in movimento, disegnata di tratto come
// le altre icone. Un braccio alzato e uno sul fianco — sta in piedi e si tocca
// dove gli fa male, che e' esattamente quello che si va a segnare.
export function SagomaIcona({ size = 24 }: { size?: number }): React.JSX.Element {
  // L'omino dei cartelli: in piedi, di fronte, le braccia lungo i fianchi e
  // staccate dal busto, le gambe separate. Pieno del colore del fondo con il
  // contorno del colore del testo. Sta sulla griglia di 24 delle icone lucide
  // che ha accanto, cosi' a parita' di misura e' grande come loro.
  return (
    <svg className="icona-sagoma" width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="3.9" r="2.6" />
      <path d="M10.1 8 H13.9 Q15.4 8 15.4 9.5 V22 Q15.4 22.8 14.6 22.8 H13.2 Q12.4 22.8 12.4 22 V15.6 H11.6 V22 Q11.6 22.8 10.8 22.8 H9.4 Q8.6 22.8 8.6 22 V9.5 Q8.6 8 10.1 8 Z" />
      <rect x="5.2" y="8.3" width="2.6" height="8.2" rx="1.3" />
      <rect x="16.2" y="8.3" width="2.6" height="8.2" rx="1.3" />
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
  // solo per i tratti a mano libera
  punti?: Punto[] | null
  selezionato?: boolean
}

// Un tratto a mano libera. Non prende il puntatore: si disegna anche sopra a un
// tratto vecchio, e quelli gia' fatti non si trascinano. Il tenue sono piu'
// passate sovrapposte (vedi stratiTratto), come nella cartella stampata.
function Tratto({
  tipo,
  punti,
  dimensione,
  larghezza,
  altezza
}: {
  tipo: TipoSegno
  punti: Punto[]
  dimensione: number
  larghezza: number
  altezza: number
}): React.JSX.Element {
  const d = percorsoTratto(punti, larghezza, altezza)
  return (
    <g className="tratto">
      {stratiTratto(tipo, spessoreTratto(tipo, dimensione, larghezza)).map((p, i) => (
        <path key={i} className="tratto-linea" d={d} strokeWidth={p.spessore} strokeOpacity={p.opacita} />
      ))}
    </g>
  )
}

// Quanto deve spostarsi il puntatore, in unita' della figura, perche' si
// aggiunga un punto al tratto: piu' fitto non si vede e riempie l'archivio.
const DISTANZA_PUNTI = 1.5

// La figura su cui si segna: corpo intero o piede, secondo la vista chiesta.
export default function FiguraChart({
  vista,
  segni,
  attivo,
  onClicCorpo,
  onPrendiSegno,
  pennello,
  onTratto
}: {
  vista: Vista
  segni: SegnoDisegnato[]
  attivo?: boolean
  onClicCorpo?: (x: number, y: number) => void
  onPrendiSegno?: (chiave: string, e: React.PointerEvent<SVGGElement>) => void
  // se c'e', premere e trascinare sulla figura disegna a mano libera invece di
  // mettere un simbolo
  pennello?: { tipo: 'tratto' | 'sfumato'; dimensione: number }
  onTratto?: (punti: Punto[]) => void
}): React.JSX.Element {
  const riquadro = misure(vista)
  // Il tratto che si sta tracciando: i punti stanno anche in un riferimento,
  // cosi' il rilascio vede sempre quelli piu' recenti.
  const [inCorso, setInCorso] = useState<Punto[] | null>(null)
  const punti = useRef<Punto[] | null>(null)
  const disegna = pennello != null && onTratto != null

  // Dal punto cliccato alle frazioni 0..1 con cui il segno viene memorizzato.
  const posizione = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const dentro = (n: number): number => Math.min(1, Math.max(0, n))

  const finisci = (e: React.PointerEvent<SVGSVGElement>): void => {
    const p = punti.current
    if (!p) return
    punti.current = null
    setInCorso(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (e.type !== 'pointercancel') onTratto?.(p)
  }

  return (
    <svg
      className={['figura-umana', attivo ? 'attiva' : ''].filter(Boolean).join(' ')}
      viewBox={`0 0 ${riquadro.larghezza} ${riquadro.altezza}`}
      onPointerDown={
        disegna || onClicCorpo
          ? (e) => {
              // il clic su un segno lo prende: qui arriva solo quello sul corpo
              if ((e.target as Element).closest('.segno')) return
              const p = posizione(e)
              if (disegna) {
                // solo il tasto principale: il destro non deve lasciare tratti
                if (e.button !== 0) return
                e.currentTarget.setPointerCapture(e.pointerId)
                punti.current = [[dentro(p.x), dentro(p.y)]]
                setInCorso(punti.current)
                return
              }
              onClicCorpo?.(p.x, p.y)
            }
          : undefined
      }
      onPointerMove={
        disegna
          ? (e) => {
              const corrente = punti.current
              if (!corrente) return
              const p = posizione(e)
              const x = dentro(p.x)
              const y = dentro(p.y)
              const ultimo = corrente[corrente.length - 1]
              const dx = (x - ultimo[0]) * riquadro.larghezza
              const dy = (y - ultimo[1]) * riquadro.altezza
              if (Math.hypot(dx, dy) < DISTANZA_PUNTI || corrente.length >= PUNTI_MASSIMI) return
              punti.current = [...corrente, [x, y]]
              setInCorso(punti.current)
            }
          : undefined
      }
      onPointerUp={disegna ? finisci : undefined}
      onPointerCancel={disegna ? finisci : undefined}
    >
      {VISTE_PIEDE.some((v) => v.valore === vista) ? (
        <SagomaPiede vista={vista as VistaPiede} />
      ) : (
        <Sagoma vista={vista as VistaCorpo} />
      )}
      {/* I tratti stanno sotto ai simboli, che restano sempre afferrabili. */}
      {segni
        .filter((s) => eTratto(s.tipo) && s.punti && s.punti.length > 0)
        .map((s) => (
          <Tratto
            key={s.chiave}
            tipo={s.tipo}
            punti={s.punti!}
            dimensione={s.dimensione}
            larghezza={riquadro.larghezza}
            altezza={riquadro.altezza}
          />
        ))}
      {inCorso && pennello && (
        <Tratto
          tipo={pennello.tipo}
          punti={inCorso}
          dimensione={pennello.dimensione}
          larghezza={riquadro.larghezza}
          altezza={riquadro.altezza}
        />
      )}
      {segni.filter((s) => !eTratto(s.tipo)).map((s) => (
        <g
          key={s.chiave}
          className={['segno', s.selezionato ? 'selezionato' : ''].filter(Boolean).join(' ')}
          transform={`translate(${s.x * riquadro.larghezza} ${s.y * riquadro.altezza})`}
          onPointerDown={onPrendiSegno ? (e) => onPrendiSegno(s.chiave, e) : undefined}
        >
          <Simbolo tipo={s.tipo} r={14 * s.dimensione} />
          {/* area invisibile piu' generosa: il segno si afferra senza mirare */}
          <circle className="segno-presa" cx="0" cy="0" r={Math.max(18, 16 * s.dimensione)} />
          {/* L'intensita' compare passandoci sopra: sempre visibile riempirebbe
              la figura di numeri, e il suggerimento di sistema si fa attendere
              troppo. */}
          {s.intensita != null && (
            <text
              className="segno-intensita"
              x={14 * s.dimensione + 6}
              y={-(14 * s.dimensione) + 6}
            >
              {s.intensita}
            </text>
          )}
          <title>
            {SEGNI.find((x) => x.valore === s.tipo)?.etichetta}
            {s.intensita != null ? ` — intensità ${s.intensita}/10` : ''}
          </title>
        </g>
      ))}
    </svg>
  )
}
