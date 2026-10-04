// Controllo delle soglie e delle fasce di un punteggio.
//
// Le soglie si leggono dall'alto e vale la prima che si avvera, con i limiti
// compresi. Un valore che non rientra in nessuna non da' zero punti: e' "fuori
// dalle soglie" (vedi puntiPer), e il totale resta parziale. Meglio accorgersene
// quando si scrivono le soglie che davanti al paziente. Qui si cercano i tre
// errori tipici: un buco fra due soglie (0–89 e 90–100 lasciano fuori l'89,5),
// una soglia che non si avvera mai perche' quelle sopra comprendono gia' tutto,
// una soglia scritta al contrario (da 10 a 5).
//
// Un buco si conta solo se fra i due limiti ci sta un valore che si puo'
// davvero scrivere: i valori si giudicano arrotondati (misure e punteggi con due
// decimali, percentuali con uno), quindi 9,99 e 10 non lasciano nessun buco.
import { arrotonda } from './misure'

export interface Intervallo {
  minimo: number | null
  massimo: number | null
}

export interface EsitoControllo {
  // "i valori sotto 90", "i valori da 89,01 a 89,99"
  buchi: string[]
  // posizioni (da 0) delle soglie che non si avverano mai
  maiAvverate: number[]
  // posizioni (da 0) delle soglie con il minimo piu' grande del massimo
  invertite: number[]
}

const virgola = (n: number): string => String(n).replace('.', ',')

// `limiti`: i valori che possono davvero uscire. Un totale di punti non e' mai
// sotto zero ne' sopra il massimo possibile: lasciare fuori quei valori non e'
// un buco.
export interface Limiti {
  da?: number
  a?: number
}

export function controllaIntervalli(
  intervalli: Intervallo[],
  decimali: number,
  limiti: Limiti = {}
): EsitoControllo {
  const passo = 10 ** -decimali
  const esito: EsitoControllo = { buchi: [], maiAvverate: [], invertite: [] }
  const arr = (n: number): number => arrotonda(n, decimali)

  const validi: { lo: number; hi: number; i: number }[] = []
  intervalli.forEach((v, i) => {
    const lo = v.minimo ?? -Infinity
    const hi = v.massimo ?? Infinity
    if (lo > hi) esito.invertite.push(i)
    else validi.push({ lo, hi, i })
  })

  // Le zone coperte, unendo quelle che si toccano o si sovrappongono. Due
  // limiti che distano meno di un valore scrivibile si toccano.
  const unisci = (lista: { lo: number; hi: number }[]): { lo: number; hi: number }[] => {
    const blocchi: { lo: number; hi: number }[] = []
    for (const v of [...lista].sort((a, b) => a.lo - b.lo)) {
      const ultimo = blocchi[blocchi.length - 1]
      if (ultimo && v.lo - ultimo.hi < passo * 1.5) ultimo.hi = Math.max(ultimo.hi, v.hi)
      else blocchi.push({ lo: v.lo, hi: v.hi })
    }
    return blocchi
  }

  // una soglia che le precedenti comprendono per intero non si avvera mai
  validi.forEach((v, k) => {
    const prima = unisci(validi.slice(0, k))
    if (prima.some((b) => b.lo <= v.lo && b.hi >= v.hi)) esito.maiAvverate.push(v.i)
  })

  const coperte = unisci(validi)
  if (coperte.length === 0) {
    if (intervalli.length === 0 || validi.length === 0) esito.buchi.push('tutti i valori')
    return esito
  }
  const primo = coperte[0]
  if (Number.isFinite(primo.lo) && !(limiti.da != null && primo.lo <= limiti.da)) {
    esito.buchi.push(`i valori sotto ${virgola(arr(primo.lo))}`)
  }
  for (let k = 1; k < coperte.length; k++) {
    const da = arr(coperte[k - 1].hi + passo)
    const a = arr(coperte[k].lo - passo)
    esito.buchi.push(da === a ? `il valore ${virgola(da)}` : `i valori da ${virgola(da)} a ${virgola(a)}`)
  }
  const ultimo = coperte[coperte.length - 1]
  if (Number.isFinite(ultimo.hi) && !(limiti.a != null && ultimo.hi >= limiti.a)) {
    esito.buchi.push(`i valori sopra ${virgola(arr(ultimo.hi))}`)
  }
  return esito
}

// Le frasi da mostrare accanto all'elenco controllato; vuoto se e' tutto a posto.
// `conseguenza` dice cosa succede a un valore senza soglia: "non dà punti",
// "non ha una fascia".
export function frasiControllo(esito: EsitoControllo, conseguenza: string): string[] {
  const frasi: string[] = []
  if (esito.invertite.length > 0) {
    frasi.push(
      `${nomiPosizioni(esito.invertite)} ha il «da» più grande dell'«a»: non si avvera mai.`
    )
  }
  if (esito.maiAvverate.length > 0) {
    frasi.push(
      `${nomiPosizioni(esito.maiAvverate)} non si avvera mai: quelle sopra comprendono già tutti i suoi valori.`
    )
  }
  if (esito.buchi.length > 0) {
    frasi.push(`Nessuna riga comprende ${esito.buchi.join('; ')}: ${conseguenza}.`)
  }
  return frasi
}

function nomiPosizioni(posizioni: number[]): string {
  const numeri = posizioni.map((p) => p + 1)
  return numeri.length === 1 ? `La riga ${numeri[0]}` : `Le righe ${numeri.join(', ')}`
}

// Una misura in secondi o minuti e' quasi sempre un tempo: meno e' meglio.
export function unitaDiTempo(unita: string | null | undefined): boolean {
  return /^\s*(s|sec|secondi?|ms|millisecondi?|min|minuti?)\s*$/i.test(unita ?? '')
}
