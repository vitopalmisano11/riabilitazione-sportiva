// I due temi di colore dell'app.
//
// Nell'interfaccia il colore vive nelle variabili del foglio di stile
// (src/renderer/src/styles.css): qui stanno solo i due colori che servono anche
// ai documenti stampati, che non hanno il foglio di stile dell'app e si
// costruiscono nel processo principale.
//
// Il tema scelto e' ricordato in impostazioni.json, cosi' l'app e i documenti
// restano d'accordo fra un avvio e l'altro.

export type Tema = 'verde' | 'blu'

export const TEMI: { valore: Tema; etichetta: string; colore: string }[] = [
  { valore: 'verde', etichetta: 'Verde salvia', colore: '#55806a' },
  { valore: 'blu', etichetta: 'Blu', colore: '#2563eb' }
]

// Colori usati nei documenti: il tratto delle intestazioni e il fondo delle
// righe dei titoli nelle tabelle.
export interface ColoriDocumento {
  accento: string
  // per il passaggio del mouse sui pulsanti e per le scritte sul fondo chiaro
  accentoScuro: string
  intestazione: string
}

export const COLORI_DOCUMENTO: Record<Tema, ColoriDocumento> = {
  verde: { accento: '#55806a', accentoScuro: '#446a57', intestazione: '#f0e9dc' },
  blu: { accento: '#2563eb', accentoScuro: '#1d4fc7', intestazione: '#eef2f8' }
}

export function temaValido(v: unknown): Tema {
  return v === 'blu' ? 'blu' : 'verde'
}

// Il tema in uso, per chi costruisce i documenti.
//
// I generatori (export-doc, export-cartella, report-screening) non dipendono da
// Electron — si provano con Node — quindi non possono leggere impostazioni.json
// da soli. Il processo principale, all'avvio e a ogni cambio, scrive qui il tema
// scelto, e loro lo leggono.
let corrente: Tema = 'verde'

export function impostaTemaCorrente(t: Tema): void {
  corrente = temaValido(t)
}

export function coloriTema(): ColoriDocumento {
  return COLORI_DOCUMENTO[corrente]
}
