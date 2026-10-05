import { useEffect, useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import type { AnteprimaScheda } from '../../../../shared/types'
import Modale from '../../components/Modale'
import { errMsg } from '../../lib'

// La scheda illustrata per il paziente: foto, spiegazione e link al video. Si
// guarda com'e' venuta e da qui si scarica in PDF. E' lo stesso HTML del file,
// cosi' l'anteprima non puo' discostarsi da quello che consegni.
// Va in un iframe con sandbox vuota: nessuno script puo' girare li' dentro.
export function SchedaIllustrata({
  sedutaId,
  onClose,
  onScarica
}: {
  sedutaId: number
  onClose: () => void
  onScarica: () => void
}): React.JSX.Element {
  const [dati, setDati] = useState<AnteprimaScheda | null>(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    let annullato = false
    window.api.esporta
      .schedaIllustrata(sedutaId)
      .then((d) => {
        if (!annullato) setDati(d)
      })
      .catch((e) => {
        if (!annullato) setErrore(errMsg(e))
      })
    return () => {
      annullato = true
    }
  }, [sedutaId])

  // Foto e spiegazione si impostano una volta per esercizio, in Configurazione:
  // qui si dice solo quali mancano, senza sporcare la scheda.
  const manca = (etichetta: string, nomi: string[]): React.JSX.Element | null =>
    nomi.length === 0 ? null : (
      <p className="avviso-scheda">
        <AlertTriangle size={15} />
        <span>
          {etichetta}: {[...new Set(nomi)].join(', ')}. Puoi aggiungerla in Configurazione →
          Esercizi.
        </span>
      </p>
    )

  return (
    <Modale className="modal-lg" onConferma={onClose}>
        <h3>Scheda illustrata per il paziente</h3>
        {errore ? (
          <p className="auth-error">{errore}</p>
        ) : dati == null ? (
          <p className="hint">Caricamento…</p>
        ) : (
          <>
            {manca('Senza foto', dati.senzaFoto)}
            {manca('Senza spiegazione', dati.senzaSpiegazione)}
            <iframe
              className="anteprima-frame"
              title="Scheda illustrata"
              sandbox=""
              srcDoc={dati.html}
            />
          </>
        )}
        <div className="modal-actions">
          <button onClick={onScarica}>
            <Download size={16} /> Scarica PDF
          </button>
          <button className="primary" onClick={onClose}>
            Chiudi
          </button>
        </div>
    </Modale>
  )
}
