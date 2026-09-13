// Colori dei sintomi nei grafici dell'andamento.
//
// Stanno qui, e non nel componente, perche' servono a due mondi: l'app che
// disegna i grafici sullo schermo e la cartella stampata, che li ridisegna nel
// documento. Con un elenco solo il sintomo 2 e' dello stesso colore in
// entrambi, e la legenda della stampa combacia con quella dello schermo.

export const COLORI_SINTOMI = ['#2563eb', '#d64545', '#1f9d61', '#b45309', '#7c3aed']

// Da quanto dura un sintomo, detto con un numero e un'unita'.
export type UnitaDurata = 'giorni' | 'settimane' | 'mesi' | 'anni'

export const UNITA_DURATA: { valore: UnitaDurata; uno: string; tanti: string }[] = [
  { valore: 'giorni', uno: 'giorno', tanti: 'giorni' },
  { valore: 'settimane', uno: 'settimana', tanti: 'settimane' },
  { valore: 'mesi', uno: 'mese', tanti: 'mesi' },
  { valore: 'anni', uno: 'anno', tanti: 'anni' }
]

// "3 settimane", "1 mese": il numero con l'unita' al singolare o al plurale.
export function durataTesto(numero: number | null, unita: UnitaDurata | null): string | null {
  if (numero == null || unita == null) return null
  const u = UNITA_DURATA.find((x) => x.valore === unita)
  if (!u) return null
  const n = String(numero).replace('.', ',')
  return `${n} ${numero === 1 ? u.uno : u.tanti}`
}

// La fase del disturbo secondo la durata: fino a 6 settimane acuta, da 6 a 12
// subacuta, oltre le 12 cronica. Sono le soglie piu' usate nelle linee guida
// del dolore muscoloscheletrico.
export function faseDurata(
  numero: number | null,
  unita: UnitaDurata | null
): 'acuta' | 'subacuta' | 'cronica' | null {
  if (numero == null || unita == null || numero < 0) return null
  const settimane =
    unita === 'giorni' ? numero / 7 : unita === 'settimane' ? numero : unita === 'mesi' ? numero * 4.35 : numero * 52
  if (settimane < 6) return 'acuta'
  if (settimane <= 12) return 'subacuta'
  return 'cronica'
}
