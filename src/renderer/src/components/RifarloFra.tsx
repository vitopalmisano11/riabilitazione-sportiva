import { useEffect, useState } from 'react'
import Modale from './Modale'
import { toast, toastErrore } from './Toast'
import { errMsg, etichettaPromemoria, fraSettimane } from '../lib'

// Dopo aver compilato un questionario o fatto uno screening: "rifarlo fra
// quanto?". Il promemoria nasce con un clic invece che andando a cercarlo in
// Clinica, ed e' li' che si perdeva la rivalutazione periodica. Non chiede nulla
// se per quello stesso questionario o screening ce n'e' gia' uno aperto.
const SCELTE = [4, 6, 12]

export default function RifarloFra({
  pazienteId,
  tipo,
  riferimentoId,
  nome,
  onChiudi
}: {
  pazienteId: number
  tipo: 'questionario' | 'screening'
  riferimentoId: number
  nome: string
  onChiudi: () => void
}): React.JSX.Element | null {
  // null = sto controllando; true = c'e' gia' un promemoria aperto
  const [gia, setGia] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.promemoria
      .list(pazienteId)
      .then((elenco) => {
        const esiste = elenco.some(
          (p) =>
            p.fatto_il == null &&
            p.tipo === tipo &&
            (tipo === 'questionario' ? p.questionario_id : p.protocollo_id) === riferimentoId
        )
        setGia(esiste)
        if (esiste) onChiudi()
      })
      .catch(() => onChiudi())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (gia !== false) return null

  const crea = async (settimane: number): Promise<void> => {
    try {
      await window.api.promemoria.create({
        paziente_id: pazienteId,
        tipo,
        riferimento_id: riferimentoId,
        scadenza: fraSettimane(settimane),
        nota: null
      })
      toast(`Promemoria fra ${settimane} settimane: ${etichettaPromemoria(tipo).toLowerCase()} ${nome}.`)
    } catch (e) {
      toastErrore(errMsg(e))
    }
    onChiudi()
  }

  return (
    <Modale className="modal-sm" onConferma={onChiudi}>
      <h3>Rifarlo fra quanto?</h3>
      <p className="modal-testo">
        {etichettaPromemoria(tipo)} «{nome}»: ti ricordo di rifarlo e lo trovi in Follow-up.
      </p>
      <div className="scelta-settimane">
        {SCELTE.map((n) => (
          <button key={n} onClick={() => void crea(n)}>
            <strong>{n}</strong>
            settimane
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button onClick={onChiudi}>Non serve</button>
      </div>
    </Modale>
  )
}
