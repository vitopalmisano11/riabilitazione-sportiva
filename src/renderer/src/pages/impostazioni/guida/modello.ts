// La forma dei testi della guida (Impostazioni → Guida), senza React: cosi' la
// ricerca e le prove la usano cosi' com'e'.
//
// I testi sono dati e non pagine scritte a mano per due motivi: la ricerca ci
// passa sopra con una funzione sola, e una prova puo' controllare che ogni voce
// sia fatta come le altre (vedi test/guida.test.ts).

// Un pezzo di testo: un paragrafo (stringa), un elenco numerato di passi o un
// elenco puntato. Dentro le stringhe:
//  - **cosi'** e' grassetto: per i nomi di pulsanti, campi e linguette, come li
//    legge chi ha lo schermo davanti;
//  - [[Configurazione > Libreria esercizi > Esercizi]] e' una sequenza di cose
//    da cliccare una dopo l'altra: a schermo sono tasti uniti da frecce. Si usa
//    quando i clic sono almeno due; un pulsante solo resta in grassetto.
export type ElementoGuida = string | { passi: string[] } | { punti: string[] }

export interface BloccoGuida {
  titolo: string
  elementi: ElementoGuida[]
}

export interface ArgomentoGuida {
  id: string
  titolo: string
  // Una riga sola, sotto al titolo nell'elenco: dice a cosa serve.
  breve: string
  // Altre parole con cui si cerca la stessa cosa e che nel testo non ci sono
  // (es. "monopodalico" per le varianti, "mantenimento" per la dose).
  parole: string[]
  blocchi: BloccoGuida[]
}
