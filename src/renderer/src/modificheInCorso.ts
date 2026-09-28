import { useEffect, useRef } from 'react'
import { chiedi } from './components/Conferma'

// Le modifiche in corso, quando si chiude il programma.
//
// Chiudere la finestra con la X non smonta le schermate: un editor aperto non
// fa in tempo a salvare, e quello che c'era scritto spariva senza avviso — una
// valutazione a meta', una body chart, un distretto, l'ultimo secondo di
// scrittura nell'anamnesi. Qui ogni schermata con qualcosa da salvare si
// segna, e alla chiusura il programma salva tutto prima di chiudersi davvero.

// Un salvataggio dice com'e' andato: `false` vuol dire che non e' riuscito (e
// l'editor ha gia' mostrato perche'). Un editor che non risponde niente si
// considera riuscito.
export type Salva = () => Promise<boolean | void>

// Quando un editor si sta chiudendo e il salvataggio non e' riuscito: si puo'
// restare per riprovare, o uscire sapendo che quello che c'era si perde.
export function chiediUscita(): Promise<boolean> {
  return chiedi({
    titolo: 'Non è stato salvato',
    testo: 'Non sono riuscito a salvare quello che hai scritto. Se esci adesso, va perso.',
    conferma: 'Esci senza salvare',
    pericolo: true
  })
}

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
// Un tentativo di chiusura in corso: un secondo clic sulla X non ne avvia un altro.
let chiusuraInCorso = false

// Una volta sola, all'avvio della finestra principale.
export function installaSalvataggioAllaChiusura(): void {
  window.addEventListener('beforeunload', (evento) => {
    // Vale anche nella versione di prova, che si usa tutti i giorni. L'unico
    // caso strano e' la pagina che si ricarica da sola mentre si aggiorna il
    // programma con un editor aperto: salva e chiude invece di ricaricare.
    if (chiusuraDecisa || inCorso.size === 0) return
    evento.preventDefault()
    evento.returnValue = false
    if (chiusuraInCorso) return
    chiusuraInCorso = true
    // Le voci restano segnate finche' non hanno salvato davvero: chi non ci
    // riesce deve poter riprovare, e chiudendo dopo non si perde in silenzio.
    const daSalvare = [...inCorso.values()]
    void (async () => {
      const falliti: string[] = []
      for (const v of daSalvare) {
        try {
          if ((await v.salva.current?.()) === false) falliti.push(v.nome)
        } catch {
          falliti.push(v.nome)
        }
      }
      if (falliti.length > 0) {
        // L'editor ha gia' detto qual e' il problema. Qui si decide se restare a
        // riprovare (Annulla, Esc, un clic fuori) o chiudere perdendo quello che
        // non si e' salvato.
        const esci = await chiedi({
          titolo: 'Non tutto è stato salvato',
          testo:
            `Non sono riuscito a salvare: ${[...new Set(falliti)].join(', ')}. ` +
            'Se chiudi adesso, quello che hai scritto lì va perso.',
          conferma: 'Chiudi senza salvare',
          pericolo: true
        })
        if (!esci) {
          chiusuraInCorso = false
          return
        }
      }
      chiusuraDecisa = true
      void window.api.finestra.comando('chiudi')
    })()
  })
}
