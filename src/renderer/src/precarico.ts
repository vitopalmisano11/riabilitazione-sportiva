// Gli elenchi delle pagine di configurazione, tenuti da parte.
//
// Premendo una linguetta (Patologie, Distretti, Libreria esercizi...) la pagina
// si monta da capo e legge i suoi elenchi: senza questo, per un istante si
// vedeva la pagina vuota e le schede comparivano dopo. Qui si tiene l'ultimo
// elenco letto: la pagina parte da quello e lo rilegge in silenzio, cosi' le
// schede ci sono gia' al primo disegno. `precaricaConfigurazione` li legge tutti
// appena il programma e' sbloccato, e di nuovo ogni volta che si entra in
// Configurazione, cosi' anche la prima visita trova gli elenchi pronti.
const elenchi = new Map<string, unknown>()

// L'ultimo elenco letto con questo nome, o `vuoto` se non ce n'e' ancora.
export const daPrecarico = <T,>(chiave: string, vuoto: T): T =>
  elenchi.has(chiave) ? (elenchi.get(chiave) as T) : vuoto

// Da mettere nella catena della lettura: tiene da parte l'elenco e lo lascia passare.
export const ricorda =
  <T,>(chiave: string) =>
  (valore: T): T => {
    elenchi.set(chiave, valore)
    return valore
  }

export async function precaricaConfigurazione(): Promise<void> {
  const api = window.api
  const leggi = <T,>(chiave: string, lettura: Promise<T>): Promise<unknown> =>
    lettura.then(ricorda<T>(chiave)).catch(() => undefined)
  await Promise.all([
    leggi('patologie', api.patologie.list()),
    leggi('gruppi', api.gruppi.list()),
    leggi('distretti', api.distretti.list()),
    leggi('categorie', api.categorie.list()),
    leggi('esercizi', api.esercizi.list(false)),
    leggi('questionariCategorie', api.questionariCategorie.list()),
    leggi('questionari', api.questionari.list(false)),
    leggi('testCategorie', api.testCategorie.list()),
    leggi('test', api.testValutazione.list(false)),
    leggi('protocolli', api.screening.list(null))
  ])
}
