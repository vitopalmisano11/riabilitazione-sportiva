// Riquadro della body chart del corpo intero.
//
// Sta qui, e non nel componente, perche' serve a due mondi: l'app che mostra
// la figura sullo schermo e l'esportazione in PDF, che la reincolla nel
// documento. Il disegno del corpo e' una foto fornita dall'utente (vedi
// resources/bodychart/), non piu' vettoriale: restano solo le misure del
// riquadro, che servono a piazzare l'immagine e a convertire i segni in
// frazioni 0..1 della figura.
//
// Proporzioni della foto: otto teste su un riquadro di 260 x 660.

export const LARGHEZZA = 260
export const ALTEZZA = 660
