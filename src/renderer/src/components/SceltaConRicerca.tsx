import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'

// Una casella in cui si sceglie scrivendo, al posto del menu a tendina.
//
// La tendina di Windows con trenta voci si apre lunga mezza schermata e non si
// puo' accorciare da dentro l'app: la disegna il sistema. Questa invece e'
// roba nostra — si scrivono due lettere, restano le voci che corrispondono, e
// l'elenco non supera mai sette righe.

export interface VoceScelta {
  id: number
  nome: string
  // Una voce che sta dentro a un'altra (un distretto nella sua categoria).
  // L'elenco allora e' a due livelli: prima si vedono solo le voci di sopra, e
  // premendone una si aprono quelle che contiene. Cercando il nome del gruppo
  // escono anche le sue voci.
  padre?: number
  gruppo?: string
}

export default function SceltaConRicerca({
  voci,
  valore,
  onCambia,
  segnaposto,
  vuoto,
  sceltaGruppo,
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
  // Nell'elenco a due livelli, se anche la voce di sopra si puo' scegliere
  // tutta intera (per filtrare: "tutto il rinforzo"). Per assegnare una
  // categoria a un esercizio invece si sceglie sempre un distretto.
  sceltaGruppo?: boolean
  autoFocus?: boolean
}): React.JSX.Element {
  const [aperto, setAperto] = useState(false)
  const [testo, setTesto] = useState('')
  // La voce di sopra di cui si stanno guardando le voci dentro; null = il
  // primo livello.
  const [dentro, setDentro] = useState<number | null>(null)
  const contenitore = useRef<HTMLDivElement>(null)

  const scelta = voci.find((v) => v.id === valore) ?? null
  const figli = (id: number): VoceScelta[] => voci.filter((v) => v.padre === id)
  const aDueLivelli = voci.some((v) => v.padre != null)

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

  // Aprendo l'elenco si parte da dove sta la voce scelta: se e' un distretto,
  // direttamente dentro alla sua categoria.
  const apri = (): void => {
    setDentro(scelta?.padre ?? null)
    setAperto(true)
  }

  const q = testo.trim().toLowerCase()
  const cercando = q !== ''
  const padreAperto = dentro == null ? null : (voci.find((v) => v.id === dentro) ?? null)
  // Cosa si vede: cercando, tutte le voci che corrispondono; altrimenti il
  // livello in cui ci si trova.
  const trovate = cercando
    ? voci.filter(
        (v) =>
          (v.nome.toLowerCase().includes(q) || (v.gruppo ?? '').toLowerCase().includes(q)) &&
          // una categoria che contiene distretti non si sceglie, salvo dove
          // e' permesso: si sceglie uno dei suoi
          (sceltaGruppo || figli(v.id).length === 0)
      )
    : !aDueLivelli
      ? voci
      : padreAperto
        ? figli(padreAperto.id)
        : voci.filter((v) => v.padre == null)

  const scegli = (id: number | ''): void => {
    onCambia(id)
    setTesto('')
    setAperto(false)
  }

  // Premere una voce: se ne contiene altre le apre, altrimenti la sceglie.
  const premi = (v: VoceScelta): void => {
    if (!cercando && aDueLivelli && figli(v.id).length > 0) setDentro(v.id)
    else scegli(v.id)
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
          onFocus={apri}
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
              premi(trovate[0])
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
            if (aperto) setAperto(false)
            else apri()
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {aperto && (
        <ul className="elenco-scelta">
          {/* Dentro a una categoria, la prima riga riporta indietro. */}
          {!cercando && padreAperto && (
            <li>
              <button
                type="button"
                className="briciola voce-indietro"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setDentro(null)}
              >
                <ChevronLeft size={16} />
                {padreAperto.nome}
              </button>
            </li>
          )}
          {!cercando && padreAperto && sceltaGruppo && (
            <li>
              <button
                type="button"
                className={padreAperto.id === valore ? 'briciola scelta-attiva' : 'briciola'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => scegli(padreAperto.id)}
              >
                Tutta la categoria
              </button>
            </li>
          )}
          {vuoto != null && !padreAperto && (
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
          {trovate.map((v) => {
            const apribile = !cercando && aDueLivelli && figli(v.id).length > 0
            return (
              <li key={v.id}>
                <button
                  type="button"
                  className={[
                    'briciola',
                    apribile && 'voce-apribile',
                    v.id === valore && 'scelta-attiva'
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => premi(v)}
                >
                  <span>{v.nome}</span>
                  {/* Cercando, un distretto porta accanto la sua categoria:
                      "Spalla" puo' stare sia nel rinforzo sia nella mobilita'. */}
                  {cercando && v.gruppo && <span className="voce-gruppo">{v.gruppo}</span>}
                  {apribile && <ChevronRight size={16} />}
                </button>
              </li>
            )
          })}
          {trovate.length === 0 && <li className="empty">Nessuna voce con questo nome.</li>}
        </ul>
      )}
    </div>
  )
}
