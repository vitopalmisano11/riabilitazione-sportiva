import { useState } from 'react'
import Modale from './Modale'

// Scegliere un giorno: i sette che vengono come piastrelle, oppure una data a
// piacere. Per spostare una seduta.
export default function SceltaGiorno({
  titolo,
  testo,
  giorni,
  origine,
  conferma,
  onScegli,
  onAnnulla
}: {
  titolo: string
  testo?: string
  giorni: { nome: string; data: string; numero: number }[]
  // il giorno in cui e' adesso: si vede ma non serve sceglierlo
  origine?: string
  conferma: string
  onScegli: (data: string) => void
  onAnnulla: () => void
}): React.JSX.Element {
  const [altra, setAltra] = useState('')
  // Invio e clic fuori valgono come il pulsante solo con una data scelta
  return (
    <Modale className="modal-sm" onConferma={() => (altra === '' ? onAnnulla() : onScegli(altra))}>
      <h3>{titolo}</h3>
      {testo && <p className="modal-testo">{testo}</p>}
      <div className="giorni-copia">
        {giorni.map((g) => (
          <button
            key={g.data}
            className={g.data === origine ? 'giorno-origine' : ''}
            onClick={() => onScegli(g.data)}
          >
            <span className="nome-giorno">{g.nome}</span>
            <span className="numero-giorno">{g.numero}</span>
          </button>
        ))}
      </div>
      <div className="riga-altra-data">
        <label className="compila-data">
          Un altro giorno
          <input type="date" value={altra} onChange={(e) => setAltra(e.target.value)} />
        </label>
        <button className="primary" disabled={altra === ''} onClick={() => onScegli(altra)}>
          {conferma}
        </button>
      </div>
      <div className="modal-actions">
        <button onClick={onAnnulla}>Annulla</button>
      </div>
    </Modale>
  )
}
