import type { LucideIcon } from 'lucide-react'

// Una pagina o un riquadro senza niente dentro: invece di una riga grigia dice
// cosa ci va e offre il gesto per cominciare, cosi' non resta uno spazio bianco
// senza spiegazioni.
export default function StatoVuoto({
  icona: Icona,
  titolo,
  testo,
  azione
}: {
  icona: LucideIcon
  titolo: string
  testo?: string
  azione?: { etichetta: string; icona?: LucideIcon; onClick: () => void }
}): React.JSX.Element {
  const IconaAzione = azione?.icona
  return (
    <div className="stato-vuoto">
      <Icona size={30} strokeWidth={1.6} aria-hidden="true" />
      <strong>{titolo}</strong>
      {testo && <p>{testo}</p>}
      {azione && (
        <button className="primary" onClick={azione.onClick}>
          {IconaAzione && <IconaAzione size={16} />} {azione.etichetta}
        </button>
      )}
    </div>
  )
}
