import type { TipoDomanda } from '../../../../shared/types'

export const TIPI: { valore: TipoDomanda; etichetta: string }[] = [
  { valore: 'si_no', etichetta: 'Sì / No' },
  { valore: 'scala', etichetta: 'Scala numerica' },
  { valore: 'scelta', etichetta: 'Scelta con punteggi' }
]

// Id provvisori per quello che non e' ancora salvato: negativi e stabili per
// tutta la sessione, cosi' una fascia puo' citare un punteggio appena creato.
let prossimoIdTemporaneo = -1

export const idTemporaneo = (): number => prossimoIdTemporaneo--

export type Tab = 'domande' | 'punteggi' | 'fasce' | 'mcid'

export const TABS: { key: Tab; label: string }[] = [
  { key: 'domande', label: 'Domande' },
  { key: 'punteggi', label: 'Punteggi' },
  { key: 'fasce', label: 'Fasce' },
  // Il cambiamento che conta: si compila solo per i questionari che lo hanno.
  { key: 'mcid', label: 'Cambiamento' }
]

// Ogni domanda e ogni punteggio ha un id anche prima di essere salvato: un
// numero negativo assegnato qui, stabile per tutta la sessione, che il processo
// principale traduce nel vero id al salvataggio. Serve perche' i riferimenti
// non si rompano riordinando o inserendo elementi.
let ultimaChiave = 0

export const nuovaChiave = (): number => --ultimaChiave
