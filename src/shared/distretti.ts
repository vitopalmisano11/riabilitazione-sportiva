// I gruppi dei test di un distretto.
//
// Stanno qui, e non nella pagina della libreria, perche' servono a due mondi:
// la valutazione sullo schermo e la relazione scritta, che li nomina nelle
// frasi. Con un elenco solo le parole sono le stesse.
import type { GruppoTest, TipoVoceNeuro } from './types'

// L'ordine e' quello in cui i gruppi compaiono nella valutazione: si scende dal
// dolore alla struttura, poi il neurologico, e in fondo quello che resta.
export const GRUPPI: { valore: GruppoTest; etichetta: string }[] = [
  { valore: 'provocazione', etichetta: 'Provocazione del dolore' },
  { valore: 'forza', etichetta: 'Forza muscolare' },
  { valore: 'legamentosa', etichetta: 'Stabilità legamentosa' },
  { valore: 'flessibilita', etichetta: 'Test di flessibilità' },
  { valore: 'neurologico', etichetta: 'Test neurodinamici' },
  { valore: 'altri', etichetta: 'Altri test' }
]

// Le tre parti dell'esame neurologico, nell'ordine in cui compaiono.
export const PARTI_NEURO: { tipo: TipoVoceNeuro; titolo: string; singolare: string }[] = [
  { tipo: 'radice', titolo: 'Sensibilità', singolare: 'radice' },
  { tipo: 'muscolo', titolo: 'Forza', singolare: 'muscolo' },
  { tipo: 'riflesso', titolo: 'Riflessi osteotendinei', singolare: 'riflesso' }
]

export const SENSIBILITA = [
  { valore: 'ridotta', etichetta: 'Ridotta' },
  { valore: 'aumentata', etichetta: 'Aumentata' }
] as const

export const RIFLESSI = [
  { valore: 'ipo', etichetta: 'Ipo' },
  { valore: 'normale', etichetta: 'Normale' },
  { valore: 'iper', etichetta: 'Iper' }
] as const

// Gli elenchi di partenza, per non scriverli a mano: si propongono accendendo
// l'esame neurologico di un distretto, e poi si cambiano come si vuole.
export const NEURO_STANDARD: Record<
  'cervicale' | 'lombare',
  { etichetta: string; voci: { tipo: TipoVoceNeuro; nome: string }[] }
> = {
  cervicale: {
    etichetta: 'Rachide cervicale',
    voci: [
      ...['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'T1'].map((nome) => ({ tipo: 'radice' as const, nome })),
      ...[
        'Deltoide (C5)',
        'Bicipite brachiale (C5-C6)',
        'Estensori del polso (C6)',
        'Tricipite brachiale (C7)',
        'Flessori del polso (C7)',
        'Estensori del pollice (C8)',
        'Flessori delle dita (C8)',
        'Interossei (T1)'
      ].map((nome) => ({ tipo: 'muscolo' as const, nome })),
      ...['Bicipitale', 'Brachioradiale', 'Tricipitale'].map((nome) => ({ tipo: 'riflesso' as const, nome }))
    ]
  },
  lombare: {
    etichetta: 'Rachide lombare',
    voci: [
      ...['L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2'].map((nome) => ({ tipo: 'radice' as const, nome })),
      ...[
        'Ileopsoas (L2)',
        'Quadricipite (L3)',
        'Tibiale anteriore (L4)',
        'Estensore lungo dell’alluce (L5)',
        'Medio gluteo (L5)',
        'Peronei (S1)',
        'Tricipite surale (S1)',
        'Ischiocrurali (S1-S2)'
      ].map((nome) => ({ tipo: 'muscolo' as const, nome })),
      ...['Rotuleo', 'Achilleo'].map((nome) => ({ tipo: 'riflesso' as const, nome }))
    ]
  }
}
