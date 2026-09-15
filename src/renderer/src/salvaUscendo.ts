import { useEffect, useRef } from 'react'
import { useModificheInCorso } from './modificheInCorso'

// Salvare uscendo, nelle schede della configurazione.
//
// Un distretto, un test, un questionario o un protocollo si costruiscono con
// calma, e prima bastava premere una linguetta in alto o tornare all'elenco per
// perdere quello che si era scritto. Adesso, se si esce con modifiche non
// salvate, si salvano da sole: il pulsante "Salva" resta per chi vuole farlo
// prima.
//
// Si usa cosi': in cima all'editor `const salvaUscendo = useSalvaUscendo(modificato)`
// (prima di qualunque return), e dopo aver scritto la funzione che salva
// `salvaUscendo.current = salva`.

const EVENTO = 'configurazione-salvata-uscendo'

export function useSalvaUscendo(
  modificato: boolean
): React.MutableRefObject<(() => Promise<void>) | null> {
  const salva = useRef<(() => Promise<void>) | null>(null)
  const daSalvare = useRef(modificato)
  daSalvare.current = modificato
  // anche chiudendo il programma
  useModificheInCorso(modificato, 'configurazione', salva)

  useEffect(
    () => () => {
      if (!daSalvare.current || !salva.current) return
      // L'elenco che compare al posto dell'editor si e' gia' caricato: quando
      // il salvataggio finisce glielo si dice, cosi' si rilegge.
      void salva.current().then(() => window.dispatchEvent(new Event(EVENTO)))
    },
    []
  )

  return salva
}

// Per gli elenchi: rileggono quando un editor appena chiuso ha finito di
// salvare.
export function useRileggiDopoSalvataggio(rileggi: () => unknown): void {
  const funzione = useRef(rileggi)
  funzione.current = rileggi
  useEffect(() => {
    const ascolta = (): void => void funzione.current()
    window.addEventListener(EVENTO, ascolta)
    return () => window.removeEventListener(EVENTO, ascolta)
  }, [])
}
