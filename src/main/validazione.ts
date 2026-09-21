// Controlli minimi sui dati che arrivano dal rinderer prima che finiscano nel
// database: l'interfaccia gia' li impedisce, ma un handler IPC e' comunque un
// confine del programma, e va difeso anche se oggi solo l'app stessa lo chiama.

export function richiedeTesto(valore: string, etichetta: string): void {
  if (!valore.trim()) throw new Error(`${etichetta} non può essere vuoto.`)
}

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/

// Vera data di calendario, non solo il formato: il costruttore di Date
// "corregge" il 30 febbraio spostandolo a marzo, quindi va verificato che i
// pezzi tornino uguali dopo il giro.
function dataValida(iso: string): boolean {
  if (!FORMATO_DATA.test(iso)) return false
  const [a, m, g] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, g))
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g
}

// Le date del paziente e delle sedute sono in ISO (AAAA-MM-GG). `null` e'
// permesso quando il campo e' facoltativo; stringa vuota no, e' un errore di
// chi chiama, non "nessuna data".
export function validaData(
  valore: string | null,
  etichetta: string,
  opzioni: { obbligatoria?: boolean } = {}
): void {
  if (valore == null) {
    if (opzioni.obbligatoria) throw new Error(`Manca la data: ${etichetta}.`)
    return
  }
  if (!dataValida(valore)) {
    throw new Error(`${etichetta} non è una data valida.`)
  }
}

// Dolore, sforzo percepito e simili: scala 0-10, oppure non chiesta (null).
export function validaScala010(valore: number | null, etichetta: string): void {
  if (valore == null) return
  if (!Number.isFinite(valore) || valore < 0 || valore > 10) {
    throw new Error(`${etichetta} deve essere un numero da 0 a 10.`)
  }
}

// Un numero misurato (peso, carico massimale...): finito, non negativo.
export function validaNumeroPositivo(valore: number, etichetta: string): void {
  if (!Number.isFinite(valore) || valore < 0) {
    throw new Error(`${etichetta} deve essere un numero valido.`)
  }
}

const FORMATO_ORA = /^([01]\d|2[0-3]):[0-5]\d$/

// L'orario di un appuntamento, "HH:MM": facoltativo, `null` vuol dire "non
// segnato", non un errore.
export function validaOra(valore: string | null, etichetta: string): void {
  if (valore == null) return
  if (!FORMATO_ORA.test(valore)) {
    throw new Error(`${etichetta} non è un orario valido.`)
  }
}
