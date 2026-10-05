import { useCallback, useEffect, useReducer, useRef } from 'react'
import { riduciSezioni, type AzioneSezioni, type SezioneBuilder } from './modello'
import { toast } from '../Toast'
import { scorciatoieBloccate } from '../../scorciatoie'

// Le sezioni della seduta, con la storia per Ctrl+Z. Ogni cambiamento passa da
// un'azione (vedi riduciSezioni in modello.ts): `invia` non cambia mai, quindi
// le righe possono non ridisegnarsi quando si scrive in un'altra.
export function useSezioni(): {
  sezioni: SezioneBuilder[]
  invia: (a: AzioneSezioni) => void
  annulla: () => void
} {
  const [stato, invia] = useReducer(riduciSezioni, { sezioni: [], storia: [] })
  const attuale = useRef(stato)
  attuale.current = stato

  const annulla = useCallback((): void => {
    const ultima = attuale.current.storia[attuale.current.storia.length - 1]
    if (!ultima) {
      toast('Niente da annullare.')
      return
    }
    invia({ tipo: 'annulla' })
    toast(`Annullato: ${ultima.cosa}.`)
  }, [])

  // Ctrl+Z dentro a una casella di testo annulla quello che si e' scritto,
  // come sempre; fuori dalle caselle annulla l'ultimo cambiamento della seduta.
  useEffect(() => {
    const tasto = (e: KeyboardEvent): void => {
      if (scorciatoieBloccate()) return
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      e.preventDefault()
      annulla()
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [annulla])

  return { sezioni: stato.sezioni, invia, annulla }
}
