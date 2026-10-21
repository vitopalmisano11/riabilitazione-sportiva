import { useState } from 'react'
import { FileText } from 'lucide-react'
import { formattaValore, type GiornoPedana, type GruppoPedana } from '../../../../shared/pedana'
import Modale from '../Modale'
import { toastErrore } from '../Toast'
import { useScorciatoie } from '../../scorciatoie'
import { errMsg } from '../../lib'
import { dataDellaRiga } from './DettaglioPedana'

export interface VocePedana {
  chiave: string
  gruppo: GruppoPedana
  giorno: GiornoPedana
}

// Il risultato di una riga in due parole: "Dx 13 kg · Sx 18,5 kg".
function risultato(g: GruppoPedana, r: GiornoPedana): string {
  const u = g.misura.unita
  if (!g.perLato) return formattaValore(r.unico, u)
  return [
    r.dx !== null && `Dx ${formattaValore(r.dx, u)}`,
    r.sx !== null && `Sx ${formattaValore(r.sx, u)}`
  ]
    .filter((x): x is string => !!x)
    .join(' · ')
}

// Quali test mettere nel report: se ne spunta uno (report singolo) o piu' di uno
// (a confronto: due date dello stesso test diventano i punti dell'andamento).
// Si apre in una finestra a parte, da cui si scarica in PDF.
export default function ReportPedana({
  pazienteId,
  voci,
  onChiudi
}: {
  pazienteId: number
  voci: VocePedana[]
  onChiudi: () => void
}): React.JSX.Element {
  const [scelti, setScelti] = useState<Set<string>>(new Set())
  useScorciatoie([{ tasto: 'Escape', azione: onChiudi, inCasella: true }])

  const cambia = (chiave: string, dentro: boolean): void =>
    setScelti((prec) => {
      const nuovo = new Set(prec)
      if (dentro) nuovo.add(chiave)
      else nuovo.delete(chiave)
      return nuovo
    })

  const apri = async (): Promise<void> => {
    const ids = voci
      .filter((v) => scelti.has(v.chiave))
      .flatMap((v) => v.giorno.test.map((t) => t.id))
    if (ids.length === 0) return
    try {
      await window.api.pedana.anteprimaReport(pazienteId, ids)
      onChiudi()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Invio e clic fuori aprono il report come il pulsante, solo se c'e' qualcosa
  // di spuntato (come il suo "disabled"); altrimenti chiudono e basta.
  const conferma = (): void | Promise<void> => (scelti.size > 0 ? apri() : onChiudi())

  return (
    <Modale onConferma={conferma}>
      <h3>Report dei test con pedana</h3>
      <p className="modal-testo">
        Spunta i test da mettere nel report. Uno solo fa un report singolo; più test dello stesso
        tipo, fatti in date diverse, vengono messi a confronto.
      </p>
      <div className="checkbox-list">
        {voci.map((v) => (
          <label key={v.chiave} className="checkbox-inline">
            <input
              type="checkbox"
              checked={scelti.has(v.chiave)}
              onChange={(e) => cambia(v.chiave, e.target.checked)}
            />
            {dataDellaRiga(v.giorno)} · {v.gruppo.nome}
            {risultato(v.gruppo, v.giorno) && ` · ${risultato(v.gruppo, v.giorno)}`}
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <span className="hint">{scelti.size > 0 ? `${scelti.size} spuntati` : ''}</span>
        <span className="spacer" />
        <button onClick={onChiudi}>Annulla</button>
        <button className="primary" disabled={scelti.size === 0} onClick={() => void apri()}>
          <FileText size={16} /> Apri il report
        </button>
      </div>
    </Modale>
  )
}
