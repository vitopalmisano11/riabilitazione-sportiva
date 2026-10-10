import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { maiuscola } from '../lib'

// Una casella di testo libero con i suggerimenti sotto, disegnati dal programma.
//
// Al posto di <input list> + <datalist>: l'elenco di quelli lo disegna Windows,
// con i suoi colori e il suo carattere. Qui e' html come il resto
// (la stessa lista di SceltaConRicerca), ma si puo' anche scrivere una voce che
// non c'e': i suggerimenti aiutano, non obbligano.
//
// L'elenco si disegna fuori dalla pagina (portale dentro <body>, "fixed"): se
// stesse dentro, vicino al fondo allungherebbe la pagina e la barra di scorrimento
// che compare/sparisce sposterebbe tutto di lato.
const MASSIMO = 8
// Quanto spazio serve all'elenco: sotto a questo, si apre verso l'alto.
const ALTEZZA_ELENCO = 260

export default function CampoSuggerimenti({
  value,
  onChange,
  suggerimenti,
  placeholder,
  autoFocus,
  type = 'text'
}: {
  value: string
  onChange: (v: string) => void
  suggerimenti: string[]
  placeholder?: string
  autoFocus?: boolean
  type?: string
}): React.JSX.Element {
  const [aperto, setAperto] = useState(false)
  const [posizione, setPosizione] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
  } | null>(null)
  const inputRif = useRef<HTMLInputElement>(null)

  const q = value.trim().toLowerCase()
  // Quello che e' gia' scritto per intero non serve riproporlo.
  const trovati = suggerimenti
    .filter((s) => s.toLowerCase() !== q && (q === '' || s.toLowerCase().includes(q)))
    .slice(0, MASSIMO)
  const visibile = aperto && trovati.length > 0

  const posiziona = (): void => {
    const r = inputRif.current?.getBoundingClientRect()
    if (!r) return
    const sotto = window.innerHeight - r.bottom
    if (sotto < ALTEZZA_ELENCO && r.top > sotto) {
      setPosizione({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width })
    } else {
      setPosizione({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }

  useLayoutEffect(() => {
    if (visibile) posiziona()
  }, [visibile])

  // La pagina puo' scorrere o cambiare misura con l'elenco aperto: lo si segue.
  useEffect(() => {
    if (!visibile) return
    window.addEventListener('scroll', posiziona, true)
    window.addEventListener('resize', posiziona)
    return () => {
      window.removeEventListener('scroll', posiziona, true)
      window.removeEventListener('resize', posiziona)
    }
  }, [visibile])

  return (
    // Il clic si ferma qui: dentro a una etichetta rimanderebbe il fuoco alla casella.
    <span className="suggerimenti-wrap" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRif}
        type={type}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setAperto(true)
        }}
        onFocus={() => setAperto(true)}
        // Si chiude poco dopo: il clic su una voce deve fare in tempo.
        onBlur={() => setTimeout(() => setAperto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && aperto) {
            e.stopPropagation()
            setAperto(false)
          }
        }}
      />
      {visibile &&
        posizione &&
        createPortal(
          <ul
            className="elenco-scelta"
            style={{
              top: posizione.top,
              bottom: posizione.bottom,
              left: posizione.left,
              width: posizione.width
            }}
          >
            {trovati.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="briciola"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(maiuscola(s))
                    setAperto(false)
                  }}
                >
                  {maiuscola(s)}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </span>
  )
}
