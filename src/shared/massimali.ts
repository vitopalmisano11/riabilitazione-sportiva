// Come si stima un massimale quando non lo si e' misurato davvero.
//
// Due strade, entrambe senza portare l'atleta a cedimento: da una serie
// (carico, ripetizioni, ripetizioni di riserva) e dalla velocita' del bilanciere
// (VBT, con un'applicazione o un sensore). Sta in `shared` e senza React per
// poterlo provare: il calcolo e' la parte che non deve sbagliare.

// Massimale stimato con la formula di Epley: carico × (1 + ripetizioni / 30).
//
// Le ripetizioni che contano sono quelle che avrebbe fatto arrivando a non
// farne piu': se ne ha fatte 8 fermandosi con 2 di riserva, la serie vale 10.
// Una sola ripetizione portata fino in fondo e' il massimale stesso, quindi il
// carico: la formula da sola lo gonfierebbe del 3%.
export function stimaDaSerie(carico: number, ripetizioni: number, rir = 0): number {
  const totali = ripetizioni + rir
  const stimato = totali <= 1 ? carico : carico * (1 + totali / 30)
  return Math.round(stimato * 10) / 10
}

// Oltre queste ripetizioni totali (fatte + di riserva) Epley stima male: meglio
// una serie piu' pesante.
export const RIPETIZIONI_AFFIDABILI = 10

// La velocita' media (m/s) con cui si sale nell'ultima ripetizione possibile,
// quella del massimale. Dipende dall'esercizio: sono valori indicativi di
// letteratura, da correggere con la propria esperienza.
export const SOGLIE_VELOCITA: { nome: string; valore: number }[] = [
  { nome: 'Squat', valore: 0.3 },
  { nome: 'Panca', valore: 0.17 },
  { nome: 'Stacco', valore: 0.2 },
  { nome: 'Rematore', valore: 0.5 }
]
// Quando l'esercizio non e' fra questi: la soglia dello squat.
export const SOGLIA_PREDEFINITA = 0.3

export interface PuntoVelocita {
  carico: number
  velocita: number
}

export interface StimaVelocita {
  massimale: number
  // quanto i punti stanno su una retta, 0..1
  r2: number
  // avvisi da mostrare accanto al numero; vuoti se la stima e' solida
  avvisi: string[]
}

// Dalla relazione carico-velocita': piu' si carica, piu' si va piano, e la
// retta che passa per i punti dice a che carico la velocita' scende alla soglia
// del massimale. Si estrapola, quindi serve che i carichi provati siano
// distribuiti bene e non troppo leggeri.
export function stimaDaVelocita(punti: PuntoVelocita[], soglia: number): StimaVelocita | null {
  const validi = punti.filter(
    (p) => Number.isFinite(p.carico) && Number.isFinite(p.velocita) && p.carico > 0 && p.velocita > 0
  )
  if (validi.length < 2 || !(soglia > 0)) return null
  // con un solo carico la retta non esiste
  if (new Set(validi.map((p) => p.carico)).size < 2) return null

  const n = validi.length
  const mx = validi.reduce((s, p) => s + p.carico, 0) / n
  const my = validi.reduce((s, p) => s + p.velocita, 0) / n
  const sxx = validi.reduce((s, p) => s + (p.carico - mx) ** 2, 0)
  const sxy = validi.reduce((s, p) => s + (p.carico - mx) * (p.velocita - my), 0)
  const syy = validi.reduce((s, p) => s + (p.velocita - my) ** 2, 0)
  const pendenza = sxy / sxx
  // se piu' carico non rallenta, i dati non dicono niente sul massimale
  if (!(pendenza < 0)) return null
  const intercetta = my - pendenza * mx
  const massimale = (soglia - intercetta) / pendenza
  if (!Number.isFinite(massimale) || massimale <= 0) return null

  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  const piuPesante = Math.max(...validi.map((p) => p.carico))
  const avvisi: string[] = []
  if (n < 3) avvisi.push('con due carichi soli la stima è poco affidabile: meglio tre o quattro')
  else if (r2 < 0.9) avvisi.push('i punti non stanno bene su una retta: ripeti le misure')
  if (piuPesante < massimale * 0.6) {
    avvisi.push('il carico più pesante provato è lontano dal massimale: aggiungine uno più alto')
  }
  return { massimale: Math.round(massimale * 10) / 10, r2: Math.round(r2 * 1000) / 1000, avvisi }
}
