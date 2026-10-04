// Un lavoro alla volta: chi lo chiede mentre e' gia' in corso riceve lo stesso
// risultato di quello che sta girando, invece di farne partire un altro.
//
// Serve ai salvataggi. Ctrl+S premuto due volte, un doppio clic, o l'uscita che
// salva mentre un salvataggio e' gia' partito scrivevano la seduta due volte nel
// diario. Sta in un file suo, senza React dentro, per poterlo provare da solo
// (test/uno-alla-volta.test.ts).
export function unoAllaVolta<T>(lavoro: () => Promise<T>): () => Promise<T> {
  let inCorso: Promise<T> | null = null
  return () => {
    if (inCorso) return inCorso
    // finito (bene o male) si libera: la richiesta dopo ne fa partire uno nuovo
    const questo = lavoro().finally(() => {
      inCorso = null
    })
    inCorso = questo
    return questo
  }
}
