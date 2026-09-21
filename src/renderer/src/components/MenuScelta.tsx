import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Un menu a tendina disegnato dal programma, non quello del sistema.
//
// Il pallone di scelte di un <select> nativo lo disegna Windows: colori e
// bordi non si possono cambiare, e se sotto alla casella non c'e' abbastanza
// spazio si apre verso l'alto invece che verso il basso. Questo menu invece
// e' html vero e proprio, quindi ha l'aspetto del resto del programma e sta
// sempre sotto alla casella, scorrendo dentro di se' se le voci sono tante.
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
  const rif = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aperto) return
    const chiudiFuori = (e: MouseEvent): void => {
      if (rif.current && !rif.current.contains(e.target as Node)) setAperto(false)
    }
    const chiudiEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAperto(false)
    }
    document.addEventListener('mousedown', chiudiFuori)
    document.addEventListener('keydown', chiudiEsc)
    return () => {
      document.removeEventListener('mousedown', chiudiFuori)
      document.removeEventListener('keydown', chiudiEsc)
    }
  }, [aperto])

  const scelta = opzioni.find((o) => o.valore === valore)

  return (
    <div className="menu-scelta" ref={rif}>
      <button
        type="button"
        id={id}
        className="menu-scelta-bottone"
        onClick={() => setAperto((a) => !a)}
      >
        <span className={scelta ? '' : 'menu-scelta-placeholder'}>
          {scelta ? scelta.etichetta : (placeholder ?? '')}
        </span>
        <ChevronDown size={16} />
      </button>
      {aperto && (
        <ul className="menu-scelta-lista" role="listbox">
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
        </ul>
      )}
    </div>
  )
}
