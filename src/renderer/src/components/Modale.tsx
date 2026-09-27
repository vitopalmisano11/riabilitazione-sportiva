// La struttura comune a tutte le finestre modali dell'app (overlay + card) e i
// due gesti che devono comportarsi allo stesso modo dappertutto:
//
//   - Invio salva e chiude,
//   - un clic sull'overlay (fuori dalla card) chiude salvando quello che c'e',
//     non lo butta via.
//
// Le due cose chiamano la STESSA funzione apposta: un clic accidentale fuori
// dalla finestra non deve mai fare qualcosa di diverso (o di piu' rischioso)
// di quello che farebbe Invio. Ogni finestra passa qui la stessa funzione che
// oggi chiama il suo pulsante "primary" (Salva, Crea, Aggiungi…): niente di
// nuovo viene inventato, si aggancia solo a due gesti in piu' quello che gia'
// esiste.
//
// Le finestre di sola lettura, o quelle i cui campi si salvano gia' da soli
// (onBlur), passano semplicemente la funzione che chiude e basta: guarda
// com'e' usato nei singoli file.
export default function Modale({
  onConferma,
  className,
  overlayClassName,
  children
}: {
  onConferma: () => void | Promise<void>
  // Classi in piu' sulla card (es. "modal-sm", "modal-lg") o sull'overlay.
  className?: string
  overlayClassName?: string
  children: React.ReactNode
}): React.JSX.Element {
  const gestisciInvio = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Enter') return
    const bersaglio = e.target as HTMLElement
    // Dentro a un campo di testo su piu' righe Invio va a capo, non salva.
    if (bersaglio.tagName === 'TEXTAREA') return
    // I pulsanti (compreso "Annulla") gestiscono il loro Invio da soli col
    // clic nativo: sommarci anche il salvataggio della finestra vorrebbe dire,
    // premendo Invio su "Annulla", salvare e annullare nello stesso istante.
    if (bersaglio.tagName === 'BUTTON' || bersaglio.tagName === 'A') return
    // I menu a tendina (MenuScelta, SceltaConRicerca) gestiscono il loro Invio
    // per scegliere la voce filtrata, e quando lo fanno segnano l'evento come
    // "gia' gestito" (preventDefault) oppure il fuoco sta nel loro elenco a
    // comparsa (un portale fuori da qui nel DOM): in questi casi non ci si
    // somma anche la chiusura della finestra.
    if (e.defaultPrevented) return
    if (bersaglio.closest('.menu-scelta-popup, .elenco-scelta')) return
    e.preventDefault()
    void onConferma()
  }

  return (
    <div
      className={['modal-overlay', overlayClassName].filter(Boolean).join(' ')}
      onClick={() => void onConferma()}
    >
      <div
        className={['modal', className].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={gestisciInvio}
      >
        {children}
      </div>
    </div>
  )
}
