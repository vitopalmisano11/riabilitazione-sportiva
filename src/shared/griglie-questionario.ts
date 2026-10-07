// Le domande a griglia: una domanda comune ("In che modo il dolore influenza
// queste attivita'?") e piu' righe (camminare, salire le scale...) che hanno
// tutte le stesse risposte con i loro punti.
//
// Ogni riga e' una domanda vera, con il suo id e le sue opzioni: punteggi,
// fasce, confronti e compilazioni lavorano su domande come sempre. La griglia
// e' solo un modo di scriverle e di mostrarle: le righe consecutive che hanno
// la stessa intestazione ne fanno parte.
export interface RigaDiGriglia<T> {
  domanda: T
  // posizione della domanda nell'elenco completo (da 0)
  indice: number
}

export interface GruppoDomande<T> {
  // null = una domanda sola, fuori da ogni griglia
  intestazione: string | null
  righe: RigaDiGriglia<T>[]
}

export function raggruppaDomande<T extends { intestazione?: string | null }>(
  domande: T[]
): GruppoDomande<T>[] {
  const gruppi: GruppoDomande<T>[] = []
  domande.forEach((domanda, indice) => {
    // Anche un'intestazione ancora vuota fa parte di una griglia: chi la sta
    // scrivendo non deve vedere le righe staccarsi appena cancella il testo.
    // Nell'archivio non arriva mai vuota (il salvataggio la toglie).
    const intestazione = domanda.intestazione ?? null
    const ultimo = gruppi[gruppi.length - 1]
    if (intestazione != null && ultimo && ultimo.intestazione === intestazione) {
      ultimo.righe.push({ domanda, indice })
    } else {
      gruppi.push({ intestazione, righe: [{ domanda, indice }] })
    }
  })
  return gruppi
}
