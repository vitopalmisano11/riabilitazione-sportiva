import { useEffect, useRef } from 'react'

// Le modifiche in corso, quando si chiude il programma.
//
// Chiudere la finestra con la X non smonta le schermate: un editor aperto non
// fa in tempo a salvare, e quello che c'era scritto spariva senza avviso — una
// valutazione a meta', una body chart, un distretto, l'ultimo secondo di
// scrittura nell'anamnesi. Qui ogni schermata con qualcosa da salvare si
// segna, e alla chiusura il programma salva tutto prima di chiudersi davvero.

type Salva = () => Promise<void>

const inCorso = new Map<symbol, { nome: string; salva: React.MutableRefObject<Salva | null> }>()

// attive: ci sono modifiche da salvare adesso. salva: un riferimento alla
// funzione che salva, che l'editor riempie quando l'ha scritta (spesso dopo il
// suo "Caricamento...").
export function useModificheInCorso(
  attive: boolean,
  nome: string,
  salva: React.MutableRefObject<Salva | null>
): void {
  const chiave = useRef(Symbol(nome))
  useEffect(() => {
    const k = chiave.current
    if (attive) inCorso.set(k, { nome, salva })
    else inCorso.delete(k)
    return () => {
      inCorso.delete(k)
    }
  }, [attive, nome, salva])
}

let chiusuraDecisa = false

// Una volta sola, all'avvio della finestra principale.
export function installaSalvataggioAllaChiusura(): void {
  window.addEventListener('beforeunload', (evento) => {
    // Vale anche nella versione di prova, che si usa tutti i giorni. L'unico
    // caso strano e' la pagina che si ricarica da sola mentre si aggiorna il
    // programma con un editor aperto: salva e chiude invece di ricaricare.
    if (chiusuraDecisa || inCorso.size === 0) return
    evento.preventDefault()
    evento.returnValue = false
    const daSalvare = [...inCorso.values()]
    inCorso.clear()
    void (async () => {
      for (const v of daSalvare) {
        try {
          await v.salva.current?.()
        } catch {
          // un salvataggio andato male non deve impedire gli altri
        }
      }
      chiusuraDecisa = true
      void window.api.finestra.comando('chiudi')
    })()
  })
}
