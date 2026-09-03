// Geometria della body chart del piede e della caviglia.
//
// Sta qui, accanto a quella del corpo intero (figure.ts), perche' serve a due
// mondi: l'app che la disegna sullo schermo e la cartella stampata, che la
// ridisegna nel documento.
//
// Ogni vista contiene tutti e due i piedi: il disegno e' uno solo, il secondo e'
// lo stesso specchiato. Cosi' si segna il lato malato accanto al sano e il
// confronto si vede da solo. Il piede e' disegnato guardando il destro; per il
// sinistro basta lo specchio.
//
// Riquadro della vista: 320 x 290. Le posizioni dei segni sono frazioni di
// questo riquadro, quindi tutte le viste devono avere la stessa misura.

export const PIEDE_LARGHEZZA = 320
export const PIEDE_ALTEZZA = 290

export interface Ellisse {
  cx: number
  cy: number
  rx: number
  ry: number
  rotazione?: number
}

// --- visto da sopra (dorso) e da sotto (pianta): riquadro di 140 x 290 ---

export const DORSO = `M46,6 L42,104 C32,140 20,178 19,212 C18,232 27,244 46,246 L96,246
  C114,244 123,232 122,212 C121,178 110,140 100,104 L96,6 Z`

export const PIANTA = `M52,54 C36,60 28,82 27,106 C26,132 32,150 30,172
  C28,196 21,206 20,222 C20,238 31,247 47,248 L96,248 C114,247 124,238 124,218
  C124,188 118,158 114,128 C110,98 104,68 90,56 C79,46 63,46 52,54 Z`

// Le dita: cinque ovali che sporgono dall'avampiede e si fondono con il
// contorno, dal primo (piu' grande) al quinto.
export const DITA_DORSO: Ellisse[] = [
  { cx: 108, cy: 252, rx: 16, ry: 21, rotazione: 8 },
  { cx: 80, cy: 258, rx: 11, ry: 17 },
  { cx: 60, cy: 259, rx: 10, ry: 16 },
  { cx: 41, cy: 256, rx: 9, ry: 14 },
  { cx: 24, cy: 250, rx: 8, ry: 12, rotazione: -10 }
]

export const DITA_PIANTA: Ellisse[] = [
  { cx: 108, cy: 254, rx: 15, ry: 19, rotazione: 8 },
  { cx: 81, cy: 259, rx: 11, ry: 16 },
  { cx: 61, cy: 260, rx: 10, ry: 15 },
  { cx: 43, cy: 257, rx: 9, ry: 13 },
  { cx: 27, cy: 250, rx: 8, ry: 11, rotazione: -10 }
]

// Riferimenti interni: la linea delle teste metatarsali e i malleoli davanti,
// l'arco plantare sotto. Servono a orientarsi, non sono il contorno.
export const RIFERIMENTI_DORSO = [
  'M22,224 C50,238 92,238 118,220',
  'M60,110 C64,150 70,190 74,214'
]

export const MALLEOLI_DORSO: Ellisse[] = [
  { cx: 34, cy: 108, rx: 9, ry: 12 },
  { cx: 106, cy: 104, rx: 7, ry: 10 }
]

export const RIFERIMENTI_PIANTA = [
  'M104,132 C80,158 72,196 82,230',
  'M30,232 C56,242 92,242 116,228'
]

// --- visto di lato: riquadro di 210 x 280, punta a sinistra e tallone a destra ---

export const PROFILO = `M112,6 L118,126 C121,148 110,160 96,172
  C76,192 52,210 34,226 C26,232 22,240 26,245 C30,249 36,249 44,249
  L168,249 C182,249 191,241 190,226 C189,208 179,198 175,180
  C171,158 169,138 168,120 L168,6 Z`

export const MALLEOLO_PROFILO: Ellisse = { cx: 150, cy: 152, rx: 11, ry: 13 }

export const RIFERIMENTI_PROFILO = [
  'M60,238 C90,228 130,226 168,232',
  'M120,150 C110,168 96,180 78,190'
]

// L'arco plantare si vede solo dal lato interno: e' la linea che dice se il
// piede e' piatto o cavo, e dal lato esterno non c'e'.
export const ARCO_PROFILO = 'M56,244 C86,222 118,214 158,220'
