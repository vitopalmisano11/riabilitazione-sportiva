// L'eta' non si memorizza mai: si calcola, altrimenti dopo un anno e' sbagliata.
//
// La data di nascita e' un giorno di calendario ("AAAA-MM-GG"), non un istante:
// si legge come mezzanotte LOCALE. Con `new Date("1990-05-10")` diventerebbe la
// mezzanotte UTC, e in un fuso indietro rispetto a Greenwich il giorno sarebbe
// quello prima. Vale per l'app e per i fogli stampati, che devono dire lo
// stesso numero.
export function etaInAnni(dataNascita: string | null, oggi: Date = new Date()): number | null {
  if (!dataNascita) return null
  const nato = new Date(`${dataNascita.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(nato.getTime())) return null
  let anni = oggi.getFullYear() - nato.getFullYear()
  const compiuto =
    oggi.getMonth() > nato.getMonth() ||
    (oggi.getMonth() === nato.getMonth() && oggi.getDate() >= nato.getDate())
  if (!compiuto) anni -= 1
  return anni >= 0 ? anni : null
}
