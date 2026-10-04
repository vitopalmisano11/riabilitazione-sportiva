import { useCallback, useEffect, useRef, useState } from 'react'
import { useSalvaUscendo } from './salvaUscendo'
import { ascoltaErrori, toastErrore } from './components/Toast'
import { errMsg } from './lib'

// Il salvataggio, con una regola sola per tutte le schede.
//
// Quello che si scrive si salva da solo quando si esce dalla scheda o si chiude
// il programma; "Salva" (o Ctrl+S) lo fa subito. Accanto al pulsante c'e'
// sempre lo stesso indicatore (components/IndicatoreSalvataggio.tsx), che dice
// a che punto si e': modifiche non salvate, salvataggio in corso, salvato, o
// non salvato e perche'. Un errore resta scritto li' finche' un salvataggio
// non riesce: un avviso che sparisce dopo qualche secondo, magari quando si e'
// gia' cambiata pagina, non basta a sapere che qualcosa non e' stato salvato.
//
// Si usa cosi', in cima all'editor (prima di qualunque return):
//   const salvataggio = useSalvataggio(modificato)
// dopo aver scritto la funzione che salva (spesso dopo il "Caricamento..."):
//   salvataggio.funzione.current = salva
// e poi `salvataggio.salva` per il pulsante e Ctrl+S, e
// `<IndicatoreSalvataggio stato={salvataggio.stato} errore={salvataggio.errore} />`
// accanto al pulsante. La funzione dell'editor risponde false (o lancia) se non
// e' riuscita, e dice cosa non va con toastErrore, come sempre: quel messaggio
// diventa anche quello dell'indicatore.

export type StatoSalvataggio = 'pulito' | 'modificato' | 'salvo' | 'salvato' | 'errore'

export interface Salvataggio {
  stato: StatoSalvataggio
  errore: string | null
  salva: () => Promise<boolean>
  // la funzione dell'editor che salva davvero
  funzione: React.MutableRefObject<(() => Promise<boolean | void>) | null>
}

export function useSalvataggio(
  modificato: boolean,
  opzioni: {
    // false per chi si occupa da se' dell'uscita (la seduta: uscendo da una
    // seduta nuova si chiede se tenerla in bozza)
    uscendo?: boolean
  } = {}
): Salvataggio {
  const funzione = useRef<(() => Promise<boolean | void>) | null>(null)
  const inCorso = useRef<Promise<boolean> | null>(null)
  const montato = useRef(true)
  useEffect(() => {
    montato.current = true
    return () => {
      montato.current = false
    }
  }, [])
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [salvatoUnaVolta, setSalvatoUnaVolta] = useState(false)

  // Un salvataggio alla volta: Ctrl+S premuto due volte, un doppio clic o
  // l'uscita che salva mentre un salvataggio e' gia' partito aspettano quello,
  // invece di farne un altro.
  const salvaOra = useCallback((): Promise<boolean> => {
    if (inCorso.current) return inCorso.current
    if (montato.current) setSalvando(true)
    let messaggio: string | null = null
    const smetti = ascoltaErrori((testo) => {
      messaggio = testo
    })
    const corrente = (async (): Promise<boolean> => {
      try {
        return funzione.current ? (await funzione.current()) !== false : true
      } catch (e) {
        toastErrore(errMsg(e))
        return false
      }
    })().then((ok) => {
      smetti()
      inCorso.current = null
      if (montato.current) {
        setSalvando(false)
        setErrore(ok ? null : (messaggio ?? 'Non è stato salvato.'))
        if (ok) setSalvatoUnaVolta(true)
      }
      return ok
    })
    inCorso.current = corrente
    return corrente
  }, [])

  const uscendo = useSalvaUscendo(opzioni.uscendo !== false && modificato)
  uscendo.current = salvaOra

  const stato: StatoSalvataggio = salvando
    ? 'salvo'
    : errore != null && modificato
      ? 'errore'
      : modificato
        ? 'modificato'
        : salvatoUnaVolta
          ? 'salvato'
          : 'pulito'
  return { stato, errore: stato === 'errore' ? errore : null, salva: salvaOra, funzione }
}
