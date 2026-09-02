// Colori dei sintomi nei grafici dell'andamento.
//
// Stanno qui, e non nel componente, perche' servono a due mondi: l'app che
// disegna i grafici sullo schermo e la cartella stampata, che li ridisegna nel
// documento. Con un elenco solo il sintomo 2 e' dello stesso colore in
// entrambi, e la legenda della stampa combacia con quella dello schermo.

export const COLORI_SINTOMI = ['#2563eb', '#d64545', '#1f9d61', '#b45309', '#7c3aed']
