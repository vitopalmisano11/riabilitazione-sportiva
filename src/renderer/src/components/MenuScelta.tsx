import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { maiuscola } from '../lib'

// Un menu a tendina disegnato dal programma, non quello del sistema.
//
// Il pallone di scelte di un <select> nativo lo disegna Windows: colori e
// bordi non si possono cambiare, e se sotto alla casella non c'e' abbastanza
// spazio si apre verso l'alto invece che verso il basso. Questo menu invece
// e' html vero e proprio, quindi ha l'aspetto del resto del programma e sta
// sempre sotto alla casella, scorrendo dentro di se' se le voci sono tante.
//
// L'elenco si disegna fuori dalla finestra che lo contiene (con un portale,
// dentro <body>, in posizione "fixed"): dentro a una finestra modale, che si
// taglia da sola quello che sfora, l'elenco restava schiacciato dentro ai
// bordi della finestra invece di aprirsi per intero sopra a tutto.
// Quanto spazio serve all'elenco aperto (sette righe e la ricerca): sotto a
// questo, si apre verso l'alto.
const ALTEZZA_ELENCO = 260

export interface OpzioneMenu<T extends string | number> {
  valore: T
  etichetta: string
}

export default function MenuScelta<T extends string | number>({
  valore,
  placeholder,
  opzioni,
  onScegli,
  id,
  cercabile,
  segnaposto,
  placeholderSceglibile = true,
  disabled,
  title
}: {
  valore: T | ''
  // Testo del bottone quando non e' ancora scelto niente, es. "— scegli —"
  // o "tutte le categorie".
  placeholder?: string
  opzioni: OpzioneMenu<T>[]
  onScegli: (v: T | '') => void
  id?: string
  // Con tante voci, scorrerle tutte e' scomodo: aggiunge una casella per
  // cercarle scrivendo, sopra all'elenco.
  cercabile?: boolean
  // Testo della casella di ricerca, se "Cerca…" da solo non basta a dire cosa.
  segnaposto?: string
  // Il placeholder e' anche una voce dell'elenco, per tornare a "niente
  // scelto" (es. "tutte le categorie", che toglie il filtro). Dove una
  // scelta ci deve sempre essere, e "scegli" non è un valore vero, si toglie
  // dall'elenco: resta solo come testo del bottone finche' non si sceglie.
  placeholderSceglibile?: boolean
  disabled?: boolean
  title?: string
}): React.JSX.Element {
  const [aperto, setAperto] = useState(false)
  const [ricerca, setRicerca] = useState('')
  const [posizione, setPosizione] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
  } | null>(null)
  const bottoneRif = useRef<HTMLButtonElement>(null)
  const popupRif = useRef<HTMLDivElement>(null)
  const ricercaRif = useRef<HTMLInputElement>(null)

  const posiziona = (): void => {
    const r = bottoneRif.current?.getBoundingClientRect()
    if (!r) return
    // Sotto al bottone se c'e' posto; se no sopra, invece di uscire dalla finestra.
    const sotto = window.innerHeight - r.bottom
    if (sotto < ALTEZZA_ELENCO && r.top > sotto) {
      setPosizione({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width })
    } else {
      setPosizione({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }

  useLayoutEffect(() => {
    if (aperto) {
      posiziona()
      setRicerca('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto])

  // Il cursore parte gia' nella ricerca: e' quasi sempre per quello che si
  // apre il menu quando c'e' da cercare, non per scorrere a mano.
  useEffect(() => {
    if (aperto && cercabile) ricercaRif.current?.focus()
  }, [aperto, cercabile])

  useEffect(() => {
    if (!aperto) return
    const chiudiFuori = (e: MouseEvent): void => {
      const t = e.target as Node
      if (bottoneRif.current?.contains(t)) return
      if (popupRif.current?.contains(t)) return
      setAperto(false)
    }
    const chiudiEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAperto(false)
    }
    // La finestra puo' scorrere o cambiare misura mentre il menu e' aperto:
    // l'elenco segue il bottone, invece di restare appeso dov'era.
    document.addEventListener('mousedown', chiudiFuori)
    document.addEventListener('keydown', chiudiEsc)
    window.addEventListener('scroll', posiziona, true)
    window.addEventListener('resize', posiziona)
    return () => {
      document.removeEventListener('mousedown', chiudiFuori)
      document.removeEventListener('keydown', chiudiEsc)
      window.removeEventListener('scroll', posiziona, true)
      window.removeEventListener('resize', posiziona)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto])

  const scelta = opzioni.find((o) => o.valore === valore)
  const q = ricerca.trim().toLowerCase()
  const filtrate =
    cercabile && q !== '' ? opzioni.filter((o) => o.etichetta.toLowerCase().includes(q)) : opzioni

  const scegli = (v: T | ''): void => {
    onScegli(v)
    setAperto(false)
  }

  return (
    <>
      <button
        type="button"
        id={id}
        ref={bottoneRif}
        className="menu-scelta-bottone"
        disabled={disabled}
        title={title}
        onClick={() => setAperto((a) => !a)}
      >
        <span className={scelta ? '' : 'menu-scelta-placeholder'}>
          {scelta ? maiuscola(scelta.etichetta) : maiuscola(placeholder ?? '')}
        </span>
        <ChevronDown size={16} />
      </button>
      {aperto &&
        posizione &&
        createPortal(
          <div
            ref={popupRif}
            className="menu-scelta-popup"
            style={{
              top: posizione.top,
              bottom: posizione.bottom,
              left: posizione.left,
              width: posizione.width
            }}
          >
            {cercabile && (
              <input
                ref={ricercaRif}
                type="search"
                className="menu-scelta-ricerca"
                placeholder={segnaposto ?? 'Cerca…'}
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtrate.length > 0) scegli(filtrate[0].valore)
                }}
              />
            )}
            <ul className="menu-scelta-lista" role="listbox">
              {placeholder != null && placeholderSceglibile && (
                <li>
                  <button
                    type="button"
                    className={valore === '' ? 'scelta-attiva' : ''}
                    onClick={() => scegli('')}
                  >
                    {maiuscola(placeholder)}
                  </button>
                </li>
              )}
              {filtrate.map((o) => (
                <li key={o.valore}>
                  <button
                    type="button"
                    className={o.valore === valore ? 'scelta-attiva' : ''}
                    onClick={() => scegli(o.valore)}
                  >
                    {maiuscola(o.etichetta)}
                  </button>
                </li>
              ))}
              {cercabile && q !== '' && filtrate.length === 0 && (
                <li className="hint">Nessun risultato.</li>
              )}
            </ul>
          </div>,
          document.body
        )}
    </>
  )
}
