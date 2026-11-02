import type { ArgomentoGuida, ElementoGuida } from './modello'

// La ricerca nella guida: ogni parola scritta deve comparire nella voce, in
// qualsiasi ordine e in qualsiasi punto, come inizio di una parola («progress»
// trova «progressioni», ma «e» non trova tutto quello che ha una e dentro). Non
// conta se si scrive maiuscolo o minuscolo, con o senza accenti; l'apostrofo
// separa le parole come uno spazio («l'archivio» = «l» + «archivio»).

const APOSTROFI = /['’`]/g
const MARCHI = /[̀-ͯ]/g

// Il testo come si confronta: minuscolo, senza accenti, con una lettera
// semplificata per ogni lettera dell'originale (serve a colorare il punto giusto).
function semplifica(testo: string): string {
  return testo.replace(APOSTROFI, ' ').toLowerCase().normalize('NFD').replace(MARCHI, '')
}

export function normalizza(testo: string): string {
  return semplifica(testo).replace(/\s+/g, ' ').trim()
}

// Le parole di una lettera sola («a», «e», «l») si ignorano quando ce ne sono
// altre: in «sedute a settimana» la «a» troverebbe ogni parola che comincia con
// a e metterebbe tutte le voci alla pari. Da sola, invece, una lettera si cerca.
export function paroleCercate(ricerca: string): string[] {
  const n = normalizza(ricerca)
  if (n === '') return []
  const parole = n.split(' ')
  const lunghe = parole.filter((p) => p.length > 1)
  return lunghe.length > 0 ? lunghe : parole
}

const eLettera = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c)

// Il testo senza i segni del grassetto e delle sequenze di clic.
export function senzaSegni(testo: string): string {
  return testo
    .replace(/\*\*/g, '')
    .replace(/\[\[(.+?)\]\]/g, (_, percorso: string) => percorso.replace(/\s>\s/g, ' '))
}

// Una sequenza [[a > b > c]] come elenco di voci.
export function vociPercorso(percorso: string): string[] {
  return percorso.split(/\s>\s/).map((v) => v.trim())
}

// La parola cercata compare nel testo, all'inizio di una parola.
function contiene(testoNormalizzato: string, parola: string): boolean {
  for (let da = testoNormalizzato.indexOf(parola); da !== -1; da = testoNormalizzato.indexOf(parola, da + 1)) {
    if (!eLettera(testoNormalizzato[da - 1])) return true
  }
  return false
}

// Lo stesso testo diviso in pezzi, con `true` dove c'e' una parola cercata: la
// pagina li colora, cosi' si vede perche' la voce e' uscita. Il testo vero
// resta intatto, accenti compresi.
export function evidenzia(testo: string, parole: string[]): [string, boolean][] {
  if (parole.length === 0 || testo === '') return [[testo, false]]
  // lettera per lettera: ogni lettera dell'originale ne diventa una (o nessuna,
  // se e' un segno staccato), quindi le posizioni si corrispondono
  const posizioni: number[] = []
  let piano = ''
  for (let i = 0; i < testo.length; i++) {
    const lettere = semplifica(testo[i])
    piano += lettere
    for (let k = 0; k < lettere.length; k++) posizioni.push(i)
  }
  const dentro = new Array<boolean>(testo.length).fill(false)
  for (const p of parole) {
    for (let da = piano.indexOf(p); da !== -1; da = piano.indexOf(p, da + 1)) {
      if (eLettera(piano[da - 1])) continue
      for (let k = da; k < da + p.length; k++) dentro[posizioni[k]] = true
    }
  }
  const pezzi: [string, boolean][] = []
  for (let i = 0; i < testo.length; i++) {
    const ultimo = pezzi[pezzi.length - 1]
    if (ultimo && ultimo[1] === dentro[i]) ultimo[0] += testo[i]
    else pezzi.push([testo[i], dentro[i]])
  }
  return pezzi
}

function testoElemento(e: ElementoGuida): string[] {
  if (typeof e === 'string') return [e]
  return 'passi' in e ? e.passi : e.punti
}

function testiBlocchi(a: ArgomentoGuida): string[] {
  return a.blocchi.flatMap((b) => [b.titolo, ...b.elementi.flatMap(testoElemento)].map(senzaSegni))
}

// Quanto una voce risponde alla ricerca; 0 = non risponde. Il titolo pesa piu'
// del testo, cosi' la voce che si chiama come la parola cercata viene prima di
// quella che la nomina di sfuggita.
export function punteggio(a: ArgomentoGuida, ricerca: string): number {
  const parole = paroleCercate(ricerca)
  if (parole.length === 0) return 1
  const titolo = normalizza(a.titolo)
  const alias = normalizza(a.parole.join(' '))
  const breve = normalizza(a.breve)
  const titoliBlocchi = normalizza(a.blocchi.map((b) => senzaSegni(b.titolo)).join(' '))
  const testo = normalizza(testiBlocchi(a).join(' '))
  let totale = 0
  for (const p of parole) {
    let questa = 0
    if (contiene(titolo, p)) questa += 10
    if (contiene(alias, p)) questa += 6
    if (contiene(breve, p)) questa += 3
    if (contiene(titoliBlocchi, p)) questa += 3
    if (contiene(testo, p)) questa += 1
    if (questa === 0) return 0
    totale += questa
  }
  return totale
}

// Le voci che rispondono, dalla piu' pertinente; a parita' resta l'ordine della
// guida. Senza niente scritto, tutte nell'ordine della guida.
export function cercaArgomenti(argomenti: ArgomentoGuida[], ricerca: string): ArgomentoGuida[] {
  if (paroleCercate(ricerca).length === 0) return argomenti
  return argomenti
    .map((a, i) => ({ a, i, p: punteggio(a, ricerca) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p || x.i - y.i)
    .map((x) => x.a)
}
