import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

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
export interface OpzioneMenu<T extends string | number> {
  valore: T
  etichetta: string
}

export default function MenuScelta<T extends string | number>({
  valore,
  placeholder,
  opzioni,
  onScegli,
  id
}: {
  valore: T | ''
  // Voce in cima per "niente scelto", es. "tutte le categorie": omessa se
  // una scelta ci deve sempre essere.
  placeholder?: string
  opzioni: OpzioneMenu<T>[]
  onScegli: (v: T | '') => void
  id?: string
}): React.JSX.Element {
  const [aperto, setAperto] = useState(false)
  const [posizione, setPosizione] = useState<{ top: number; left: number; width: number } | null>(
    null
  )
  const bottoneRif = useRef<HTMLButtonElement>(null)
  const listaRif = useRef<HTMLUListElement>(null)

  const posiziona = (): void => {
    const r = bottoneRif.current?.getBoundingClientRect()
    if (r) setPosizione({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  useLayoutEffect(() => {
    if (aperto) posiziona()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto])

  useEffect(() => {
    if (!aperto) return
    const chiudiFuori = (e: MouseEvent): void => {
      const t = e.target as Node
      if (bottoneRif.current?.contains(t)) return
      if (listaRif.current?.contains(t)) return
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

  return (
    <>
      <button
        type="button"
        id={id}
        ref={bottoneRif}
        className="menu-scelta-bottone"
        onClick={() => setAperto((a) => !a)}
      >
        <span className={scelta ? '' : 'menu-scelta-placeholder'}>
          {scelta ? scelta.etichetta : (placeholder ?? '')}
        </span>
        <ChevronDown size={16} />
      </button>
      {aperto &&
        posizione &&
        createPortal(
          <ul
            ref={listaRif}
            className="menu-scelta-lista"
            role="listbox"
            style={{ top: posizione.top, left: posizione.left, width: posizione.width }}
          >
            {placeholder != null && (
              <li>
                <button
                  type="button"
                  className={valore === '' ? 'scelta-attiva' : ''}
                  onClick={() => {
                    onScegli('')
                    setAperto(false)
                  }}
                >
                  {placeholder}
                </button>
              </li>
            )}
            {opzioni.map((o) => (
              <li key={o.valore}>
                <button
                  type="button"
                  className={o.valore === valore ? 'scelta-attiva' : ''}
                  onClick={() => {
                    onScegli(o.valore)
                    setAperto(false)
                  }}
                >
                  {o.etichetta}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  )
}
