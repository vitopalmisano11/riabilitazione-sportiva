import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

// Una casella in cui si sceglie scrivendo, al posto del menu a tendina.
//
// La tendina di Windows con trenta voci si apre lunga mezza schermata e non si
// puo' accorciare da dentro l'app: la disegna il sistema. Questa invece e'
// roba nostra — si scrivono due lettere, restano le voci che corrispondono, e
// l'elenco non supera mai sette righe.

export interface VoceScelta {
  id: number
  nome: string
}

export default function SceltaConRicerca({
  voci,
  valore,
  onCambia,
  segnaposto,
  vuoto,
  autoFocus
}: {
  voci: VoceScelta[]
  // '' = niente scelto.
  valore: number | ''
  onCambia: (id: number | '') => void
  segnaposto?: string
  // L'etichetta della voce che azzera la scelta ("tutte", "nessuna"). Se non
  // c'e', la scelta e' obbligatoria e quella voce non compare.
  vuoto?: string
  autoFocus?: boolean
}): React.JSX.Element {
  const [aperto, setAperto] = useState(false)
  const [testo, setTesto] = useState('')
  const contenitore = useRef<HTMLDivElement>(null)

  const scelta = voci.find((v) => v.id === valore) ?? null

  // Premendo fuori si chiude e si dimentica quello che si stava scrivendo: la
  // casella torna a mostrare la voce scelta, non un testo a meta'.
  useEffect(() => {
    if (!aperto) return
    const fuori = (e: MouseEvent): void => {
      if (!contenitore.current?.contains(e.target as Node)) {
        setAperto(false)
        setTesto('')
      }
    }
    document.addEventListener('mousedown', fuori)
    return () => document.removeEventListener('mousedown', fuori)
  }, [aperto])

  const q = testo.trim().toLowerCase()
  const trovate = q === '' ? voci : voci.filter((v) => v.nome.toLowerCase().includes(q))

  const scegli = (id: number | ''): void => {
    onCambia(id)
    setTesto('')
    setAperto(false)
  }

  return (
    <div
      className="scelta-cerca"
      ref={contenitore}
      // L'etichetta che avvolge la casella, premuta, rimanda il clic dentro
      // all'input: qui il clic si ferma, cosi' scegliere una voce sceglie
      // quella voce e basta.
      onClick={(e) => e.stopPropagation()}
    >
      <div className="riga-scelta-cerca">
        <input
          type="text"
          autoFocus={autoFocus}
          // Aperta si scrive per cercare; chiusa mostra la voce scelta.
          value={aperto ? testo : (scelta?.nome ?? '')}
          // Aperta e vuota si legge comunque cosa c'e' scelto adesso, cosi' non
          // sembra di aver perso la scelta mentre si cerca.
          placeholder={scelta ? scelta.nome : (segnaposto ?? '— seleziona —')}
          onFocus={() => setAperto(true)}
          onChange={(e) => {
            setTesto(e.target.value)
            setAperto(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setAperto(false)
              setTesto('')
            }
            // Invio prende la prima voce rimasta: con due lettere di solito ne
            // resta una sola.
            if (e.key === 'Enter' && aperto && trovate.length > 0) {
              e.preventDefault()
              scegli(trovate[0].id)
            }
          }}
        />
        {vuoto != null && scelta != null && (
          <button
            type="button"
            className="btn-icona azzera-scelta"
            title={vuoto}
            onClick={() => scegli('')}
          >
            <X size={15} />
          </button>
        )}
        <button
          type="button"
          className="btn-icona apri-scelta"
          title="Vedi l'elenco"
          onClick={() => {
            setTesto('')
            setAperto(!aperto)
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {aperto && (
        <ul className="elenco-scelta">
          {vuoto != null && (
            <li>
              <button
                type="button"
                className="briciola"
                // Senza questo l'input perde il fuoco prima che il clic arrivi,
                // e su certe combinazioni il clic va perso.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => scegli('')}
              >
                {vuoto}
              </button>
            </li>
          )}
          {trovate.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                className={v.id === valore ? 'briciola scelta-attiva' : 'briciola'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => scegli(v.id)}
              >
                {v.nome}
              </button>
            </li>
          ))}
          {trovate.length === 0 && <li className="empty">Nessuna voce con questo nome.</li>}
        </ul>
      )}
    </div>
  )
}
