import { useEffect } from 'react'

// Scorciatoie da tastiera.
//
// Con dieci pazienti al giorno le stesse tre o quattro azioni si ripetono
// centinaia di volte: farle senza staccare le mani dalla tastiera fa risparmiare
// piu' tempo di qualunque altra cosa. Le scorciatoie non scattano mentre si
// scrive dentro una casella, tranne quelle con Ctrl, che li' servono davvero
// (Ctrl+S mentre si compila e' il caso tipico).

function dentroACasella(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable === true
}

export interface Scorciatoia {
  // 'Escape', 's', 'n', 'f'…
  tasto: string
  ctrl?: boolean
  azione: () => void
  // false = la scorciatoia non e' attiva ora (finestra in sola lettura, ecc.)
  attiva?: boolean
}

// Con lo schermo bloccato l'app resta montata sotto alla richiesta della
// password (cosi' non si perde niente), ma le scorciatoie ascoltano tutta la
// finestra: un Esc o un Ctrl+S battuto davanti al blocco avrebbe chiuso o salvato
// l'editor che c'e' sotto, senza che chi e' li' possa vederlo. Finche' e' vero,
// nessuna scorciatoia scatta.
let bloccato = false

export function bloccaScorciatoie(valore: boolean): void {
  bloccato = valore
}

export function scorciatoieBloccate(): boolean {
  return bloccato
}

// L'effetto non ha elenco di dipendenze apposta: le azioni sono funzioni nuove a
// ogni disegno, e vanno ricollegate ogni volta per vedere lo stato di adesso.
// Ascoltare l'evento costa quasi niente; una scorciatoia che salva i dati di
// ieri sarebbe molto peggio.
export function useScorciatoie(scorciatoie: Scorciatoia[]): void {
  useEffect(() => {
    const gestisci = (e: KeyboardEvent): void => {
      if (bloccato) return
      for (const s of scorciatoie) {
        if (s.attiva === false) continue
        if (s.tasto.toLowerCase() !== e.key.toLowerCase()) continue
        if (Boolean(s.ctrl) !== (e.ctrlKey || e.metaKey)) continue
        // senza Ctrl la scorciatoia non deve rubare le lettere a chi scrive
        if (!s.ctrl && dentroACasella(e)) continue
        e.preventDefault()
        s.azione()
        return
      }
    }
    window.addEventListener('keydown', gestisci)
    return () => window.removeEventListener('keydown', gestisci)
  })
}
