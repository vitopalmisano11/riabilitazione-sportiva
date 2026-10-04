import { AlertCircle, Check } from 'lucide-react'
import type { StatoSalvataggio } from '../salvataggio'

// A che punto e' il salvataggio di una scheda: lo stesso in tutte (vedi
// salvataggio.ts). Prima della prima modifica non dice niente.
export default function IndicatoreSalvataggio({
  stato,
  errore
}: {
  stato: StatoSalvataggio
  errore?: string | null
}): React.JSX.Element | null {
  if (stato === 'pulito') return null
  return (
    <span className={`stato-salvataggio ${stato}`} role="status" aria-live="polite">
      {stato === 'modificato' && 'Modifiche non salvate'}
      {stato === 'salvo' && 'Salvataggio…'}
      {stato === 'salvato' && (
        <>
          <Check size={14} /> Salvato
        </>
      )}
      {stato === 'errore' && (
        <>
          <AlertCircle size={14} /> Non salvato{errore ? `: ${errore}` : ''}
        </>
      )}
    </span>
  )
}
