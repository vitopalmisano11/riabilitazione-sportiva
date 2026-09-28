// Controlli minimi sui dati che arrivano dal rinderer prima che finiscano nel
// database: l'interfaccia gia' li impedisce, ma un handler IPC e' comunque un
// confine del programma, e va difeso anche se oggi solo l'app stessa lo chiama.

// Un errore che chi usa il programma legge per intero (magari con il nome di un
// file, che dice di chi e') ma che nel registro degli errori entra solo con la
// versione senza quei dati (vedi registro.ts).
export function erroreSenzaDatiNelRegistro(messaggio: string, perRegistro: string): Error {
  return Object.assign(new Error(messaggio), { perRegistro })
}

// Gli errori del sistema citano il percorso intero del file (open 'C:\Docs\Rossi.pdf'),
// e il nome di un file dice spesso di chi e'. Nel registro i percorsi tra virgolette
// (con una barra dentro) diventano "…".
function senzaPercorsi(testo: string): string {
  return testo
    .replace(/'[^'\n]*[\\/][^'\n]*'/g, "'…'")
    .replace(/"[^"\n]*[\\/][^"\n]*"/g, '"…"')
}

// Cosa scrivere nel registro per un errore: la versione senza dati se l'errore
// ne porta una, altrimenti il suo testo senza i percorsi. Le righe della
// traccia ("at ...") restano com'e': sono il codice del programma, non dati.
export function testoErrorePerRegistro(errore: unknown): string {
  const perRegistro = (errore as { perRegistro?: unknown } | null)?.perRegistro
  if (typeof perRegistro === 'string') return perRegistro
  if (!(errore instanceof Error)) return senzaPercorsi(String(errore))
  return (errore.stack || errore.message)
    .split('\n')
    .map((riga) => (/^\s+at\s/.test(riga) ? riga : senzaPercorsi(riga)))
    .join('\n')
}

// Un link che si apre nel browser: solo http e https. Un altro schema
// (javascript:, file:) finirebbe nei fogli stampati e nei link cliccabili.
export const LINK_WEB = /^https?:\/\/\S+$/i

// Il link e' facoltativo: vuoto va bene.
export function validaLink(valore: string | null | undefined, etichetta: string): void {
  if (valore == null || valore.trim() === '') return
  if (!LINK_WEB.test(valore.trim())) {
    throw new Error(`${etichetta} deve cominciare con http:// o https:// e non avere spazi.`)
  }
}

// Le foto che finiscono nel database e poi nei fogli stampati: solo immagini
// vere, come le produce il programma (data URL in base64).
const FORMATO_IMMAGINE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/

export function validaImmagine(dataUrl: string | null): void {
  if (dataUrl != null && !FORMATO_IMMAGINE.test(dataUrl)) {
    throw new Error('L’immagine non è in un formato valido.')
  }
}

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
