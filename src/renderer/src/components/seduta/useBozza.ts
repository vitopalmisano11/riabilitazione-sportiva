import { useCallback, useEffect, useRef } from 'react'
import { bozzaVuota, inBozza, type CampiSeduta, type SezioneBuilder } from './modello'
import { toastErrore } from '../Toast'
import { errMsg } from '../../lib'

// La bozza si mette da parte da sola mentre componi, un secondo dopo l'ultima
// modifica: se l'app si chiude, alla riapertura la ritrovi. Vale solo per le
// sedute nuove (attiva) — quelle gia' salvate sono gia' al sicuro nel loro posto.
export function useBozza(
  attiva: boolean,
  pazienteId: number,
  campi: CampiSeduta,
  sezioni: SezioneBuilder[]
): { chiudi: () => void; riapri: () => void } {
  // Vero dopo che un salvataggio della bozza e' fallito e finche' non ne riesce uno.
  const inErrore = useRef(false)
  // Vero da quando la seduta si sta salvando (o si e' scelto di buttare la
  // bozza): un salvataggio della bozza ancora in attesa non deve partire dopo
  // che la bozza e' stata tolta, o ricompare "c'e' una seduta lasciata a meta'"
  // per una seduta gia' salvata. Se il salvataggio della seduta fallisce si
  // riapre e la bozza riprende a salvarsi.
  const chiusa = useRef(false)

  useEffect(() => {
    if (!attiva || bozzaVuota(campi, sezioni)) return
    const bozza = inBozza(campi, sezioni)
    const attesa = setTimeout(() => {
      if (chiusa.current) return
      window.api.bozze
        .salva(pazienteId, JSON.stringify(bozza))
        .then(() => {
          inErrore.current = false
        })
        .catch((e) => {
          // Una volta sola finche' non torna a funzionare: un avviso a ogni
          // secondo mentre si scrive sarebbe peggio del problema.
          if (inErrore.current) return
          inErrore.current = true
          toastErrore(
            `La bozza non si sta salvando (${errMsg(e)}). Se il programma si chiude adesso, questa seduta va persa: salvala appena puoi.`
          )
        })
    }, 1000)
    return () => clearTimeout(attesa)
  }, [attiva, pazienteId, campi, sezioni])

  const chiudi = useCallback(() => {
    chiusa.current = true
  }, [])
  const riapri = useCallback(() => {
    chiusa.current = false
  }, [])
  return { chiudi, riapri }
}
