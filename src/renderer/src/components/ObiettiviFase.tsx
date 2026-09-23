import { useEffect, useState } from 'react'
import type { Obiettivo } from '../../../shared/types'
import { toastErrore } from './Toast'
import { errMsg } from '../lib'

// Gli obiettivi della fase corrente del paziente, con la spunta raggiunto/
// aperto. Serve sia nel percorso riabilitativo sia nel quadro d'insieme:
// sta in un componente suo cosi' la lettura e il salvataggio dello stato
// "raggiunto" vivono in un posto solo.
export default function ObiettiviFase({
  pazienteId,
  faseId
}: {
  pazienteId: number
  faseId: number | null
}): React.JSX.Element {
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([])
  const [raggiunti, setRaggiunti] = useState<number[]>([])

  const load = async (): Promise<void> => {
    if (faseId == null) {
      setObiettivi([])
      setRaggiunti([])
      return
    }
    const [obs, ragg] = await Promise.all([
      window.api.obiettivi.list(faseId),
      window.api.pazienti.obiettiviRaggiunti(pazienteId)
    ])
    setObiettivi(obs)
    setRaggiunti(ragg)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pazienteId, faseId])

  const toggle = async (obiettivoId: number, raggiunto: boolean): Promise<void> => {
    try {
      await window.api.pazienti.setObiettivoRaggiunto(pazienteId, obiettivoId, raggiunto)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  if (faseId == null) {
    return <p className="hint">Imposta la fase corrente per vedere gli obiettivi.</p>
  }
  if (obiettivi.length === 0) {
    return (
      <p className="hint">
        Questa fase non ha obiettivi: definiscili in configurazione, &ldquo;Patologie e
        fasi&rdquo;.
      </p>
    )
  }

  return (
    <ul className="checkbox-list">
      {obiettivi.map((o) => {
        const fatto = raggiunti.includes(o.id)
        return (
          <li key={o.id}>
            <label className={fatto ? 'obiettivo-raggiunto' : ''}>
              <input
                type="checkbox"
                checked={fatto}
                onChange={(e) => void toggle(o.id, e.target.checked)}
              />
              {o.nome}
            </label>
          </li>
        )
      })}
    </ul>
  )
}
