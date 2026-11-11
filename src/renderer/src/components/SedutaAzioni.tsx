import { useState } from 'react'
import { CalendarClock, Copy, Download, FileText, Images, MoreHorizontal, Presentation, Trash2 } from 'lucide-react'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'

// Le azioni sulla riga di una seduta, uguali nel diario del paziente e nella
// settimana. Il clic sulla riga apre la seduta; qui restano solo le due cose
// che si fanno di continuo (la scheda normale, quella illustrata, eliminarla)
// e un menu con il resto: la copia, lo scarico in PDF o Word e, dove ha senso,
// lo spostamento in un altro giorno.
export default function SedutaAzioni({
  sedutaId,
  titoloCopia,
  onCopia,
  onElimina,
  onIllustrata,
  onScarica,
  onSposta
}: {
  sedutaId: number
  titoloCopia: string
  onCopia: () => void
  onElimina: () => void
  // la scheda illustrata si vede in una finestra del chiamante
  onIllustrata: () => void
  onScarica: (formato: 'pdf' | 'docx') => void
  // solo nella settimana
  onSposta?: () => void
}): React.JSX.Element {
  const [aperto, setAperto] = useState(false)
  const chiudi = (fn: () => void) => (): void => {
    setAperto(false)
    fn()
  }

  return (
    // il clic qui non deve arrivare alla riga, che aprirebbe la seduta
    <span className="row-actions" onClick={(e) => e.stopPropagation()}>
      <button
        title="Mostra la scheda al paziente (si apre in una finestra a parte)"
        onClick={() => void window.api.scheda.apri(sedutaId).catch((e) => toastErrore(errMsg(e)))}
      >
        <Presentation size={18} />
      </button>
      <button title="Scheda illustrata per il paziente (foto e spiegazioni)" onClick={onIllustrata}>
        <Images size={18} />
      </button>
      <span className="menu-wrapper">
        <button
          title="Altro: copia, scarica, riprogramma"
          aria-label="Altre azioni sulla seduta"
          onClick={() => setAperto(!aperto)}
        >
          <MoreHorizontal size={18} />
        </button>
        {aperto && (
          <>
            <div className="menu-chiudi" onClick={() => setAperto(false)} />
            <div className="menu-tendina">
              <button title={titoloCopia} onClick={chiudi(onCopia)}>
                <Copy size={18} /> Copia
              </button>
              <button onClick={chiudi(() => onScarica('pdf'))}>
                <FileText size={18} /> Scarica PDF
              </button>
              <button onClick={chiudi(() => onScarica('docx'))}>
                <Download size={18} /> Scarica Word
              </button>
              {onSposta && (
                <button title="Spostala in un altro giorno" onClick={chiudi(onSposta)}>
                  <CalendarClock size={18} /> Riprogramma
                </button>
              )}
            </div>
          </>
        )}
      </span>
      <button className="danger" title="Elimina" onClick={onElimina}>
        <Trash2 size={18} />
      </button>
    </span>
  )
}
