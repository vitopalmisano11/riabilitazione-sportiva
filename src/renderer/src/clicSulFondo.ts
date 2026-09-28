import { useRef } from 'react'

// Il clic sullo sfondo di una finestra (fuori dalla card) conta solo se la
// pressione del mouse INIZIA sullo sfondo e finisce lì. Se comincia dentro la
// card e finisce fuori — selezionare un testo trascinando oltre il bordo,
// spostare un segno della body chart — il browser manda comunque un "click"
// sull'antenato comune, cioe' lo sfondo, e la finestra si chiuderebbe (e
// salverebbe) da sola.
export function useClicSulFondo(alClic: () => void): {
  onMouseDown: (e: React.MouseEvent<HTMLElement>) => void
  onClick: (e: React.MouseEvent<HTMLElement>) => void
} {
  const partitoDalFondo = useRef(false)
  return {
    onMouseDown: (e) => {
      partitoDalFondo.current = e.target === e.currentTarget
    },
    onClick: (e) => {
      if (e.target !== e.currentTarget || !partitoDalFondo.current) return
      alClic()
    }
  }
}
