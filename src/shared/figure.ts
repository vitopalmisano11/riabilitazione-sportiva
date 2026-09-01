// Geometria delle figure della body chart.
//
// Sta qui, e non nel componente, perche' serve a due mondi: l'app che le disegna
// sullo schermo e l'esportazione in PDF, che le ridisegna nel documento. Con i
// tracciati in un posto solo non possono divergere.
//
// Proporzioni: otto teste su un riquadro di 260 x 660. Il corpo di fronte e di
// spalle e' simmetrico: si disegna la meta' destra e la si specchia.

export const LARGHEZZA = 260
export const ALTEZZA = 660

export const TRONCO = `M110,104 C96,108 84,120 78,142 C74,162 76,178 78,196 C80,216 86,236 92,256 C96,274 84,292 78,310 C74,330 76,348 84,358 C98,368 162,368 176,358 C184,348 186,330 182,310 C176,292 164,274 168,256 C174,236 180,216 182,196 C184,178 186,162 182,142 C176,120 164,108 150,104 Z`

export const BRACCIO = `M182,126 C202,130 214,146 215,168 C214,192 211,214 208,238 C205,262 201,284 198,304 C196,320 198,332 196,342 C193,356 183,362 175,358 C169,354 168,344 170,334 C173,314 178,292 181,270 C184,244 187,214 187,186 C187,164 184,144 176,134 C177,129 179,125 182,126 Z`

export const GAMBA = `M184,334 C188,362 184,396 179,426 C176,448 172,462 170,478 C171,498 175,512 175,530 C173,562 166,596 160,624 C158,638 160,646 164,652 C154,657 142,657 136,652 C133,644 135,634 136,624 C138,596 143,562 145,530 C146,512 143,498 143,478 C142,456 140,428 140,400 C139,376 138,352 140,338 Z`

export const PIEDE = `M140,612 C152,608 166,612 172,622 C178,632 181,644 181,652 C181,659 172,661 160,661 C148,661 139,659 136,653 C132,645 133,622 140,612 Z`

export const PROFILO_TRONCO = `M114,108 C102,116 96,132 94,154 C92,176 92,192 93,208 C94,230 99,246 102,264 C104,282 100,294 102,310 C105,334 116,350 134,354 C158,358 182,350 191,332 C196,318 193,298 188,280 C183,260 180,242 181,220 C182,194 183,164 175,144 C167,122 152,108 132,106 Z`

export const PROFILO_BRACCIO = `M126,150 C140,156 145,174 145,196 C145,226 143,256 141,284 C140,304 139,320 139,334 C139,348 130,355 121,352 C113,349 110,340 111,330 C113,302 115,270 115,238 C115,210 113,182 115,168 C117,158 121,149 126,150 Z`

export const PROFILO_GAMBA = `M104,336 C100,364 104,398 108,428 C112,450 114,462 114,478 C113,498 108,510 110,528 C112,560 118,594 124,624 C126,638 124,646 120,652 C134,657 152,657 158,652 C161,644 159,634 158,624 C160,594 164,562 166,528 C167,510 168,498 168,478 C168,456 166,428 164,400 C162,376 164,352 164,338 Z`

export const PROFILO_PIEDE = `M112,612 C126,608 138,614 143,626 C147,637 147,650 143,657 C135,662 96,662 80,658 C71,655 69,646 76,640 C87,629 102,617 112,612 Z`

// Testa, collo ed eventuale naso, come dati invece che come disegno: servono
// sia all'app sia all'esportazione in PDF.
export type Forma =
  | { tipo: 'ellisse'; cx: number; cy: number; rx: number; ry: number }
  | { tipo: 'tracciato'; d: string }

export const TESTA_FRONTE: Forma[] = [
  { tipo: 'ellisse', cx: 130, cy: 54, rx: 29, ry: 40 },
  { tipo: 'tracciato', d: 'M112,78 L148,78 L152,116 L108,116 Z' }
]

export const TESTA_PROFILO: Forma[] = [
  { tipo: 'ellisse', cx: 128, cy: 54, rx: 32, ry: 40 },
  { tipo: 'tracciato', d: 'M114,78 L148,78 L152,118 L110,118 Z' },
  { tipo: 'tracciato', d: 'M100,56 C90,63 88,70 94,76 L104,76 Z' }
]

// Linee anatomiche interne: non fanno parte della sagoma, servono a orientarsi
// (clavicole, pettorali, ombelico davanti; colonna, scapole, piega glutea
// dietro).
export interface Linea {
  d: string
  tratteggio?: string
}

export const DETTAGLI_FRONTE: Linea[] = [
  { d: 'M123,118 L130,128 L137,118' },
  { d: 'M100,130 C112,139 122,142 130,142' },
  { d: 'M160,130 C148,139 138,142 130,142' },
  { d: 'M96,162 C108,190 122,198 130,184' },
  { d: 'M164,162 C152,190 138,198 130,184' },
  { d: 'M127,266 C132,266 132,274 127,274' },
  { d: 'M94,296 C108,318 120,330 130,336' },
  { d: 'M166,296 C152,318 140,330 130,336' },
  { d: 'M92,470 C99,478 106,480 112,476' },
  { d: 'M168,470 C161,478 154,480 148,476' }
]

export const DETTAGLI_RETRO: Linea[] = [
  { d: 'M130,126 L130,300', tratteggio: '9 8' },
  { d: 'M102,150 C94,174 98,198 112,210' },
  { d: 'M158,150 C166,174 162,198 148,210' },
  { d: 'M116,302 C118,306 118,312 116,314' },
  { d: 'M144,302 C142,306 142,312 144,314' },
  { d: 'M98,330 C110,344 122,348 130,346' },
  { d: 'M162,330 C150,344 138,348 130,346' },
  { d: 'M94,468 C101,476 108,478 114,474' },
  { d: 'M166,468 C159,476 152,478 146,474' },
  { d: 'M104,506 C108,528 108,548 104,564' },
  { d: 'M156,506 C152,528 152,548 156,564' }
]

export const DETTAGLI_PROFILO: Linea[] = [
  { d: 'M124,54 C132,52 134,62 126,66' },
  { d: 'M117,166 C114,200 113,250 114,300 C114,322 116,338 118,348' },
  { d: 'M162,340 C168,348 172,356 172,364' },
  { d: 'M132,474 C140,480 146,480 152,474' }
]
