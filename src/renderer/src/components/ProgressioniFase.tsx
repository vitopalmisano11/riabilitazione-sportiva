import { useCallback, useEffect, useState } from 'react'
import type { Progressione, ProgressioneGruppo, ProgressioniFase } from '../../../shared/types'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import Aiuto from './Aiuto'

// Le progressioni di una fase: quali scale di esercizi suggerisce la fase.
// Si spunta un gruppo intero (valgono anche quelle che ci aggiungerai dopo) o
// una progressione sola. Palestra e campo hanno ognuno le sue.
export default function ProgressioniFaseTab({ faseId }: { faseId: number }): React.JSX.Element {
  const [gruppi, setGruppi] = useState<ProgressioneGruppo[]>([])
  const [progressioni, setProgressioni] = useState<Progressione[]>([])
  const [scelte, setScelte] = useState<ProgressioniFase>({ gruppo_ids: [], progressione_ids: [] })

  const carica = useCallback(async (): Promise<void> => {
    try {
      const [g, p, f] = await Promise.all([
        window.api.progressioni.gruppi(),
        window.api.progressioni.list(),
        window.api.progressioni.fase(faseId)
      ])
      setGruppi(g)
      setProgressioni(p)
      setScelte(f)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [faseId])

  useEffect(() => {
    void carica()
  }, [carica])

  const salva = async (nuove: ProgressioniFase): Promise<void> => {
    setScelte(nuove)
    try {
      await window.api.progressioni.impostaFase(faseId, nuove)
    } catch (e) {
      toastErrore(errMsg(e))
      await carica()
    }
  }

  const alterna = (lista: number[], id: number): number[] =>
    lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]

  const riga = (p: Progressione, dalGruppo: boolean): React.JSX.Element => (
    <li key={p.id} className={p.gruppo_id != null ? 'dentro-gruppo' : undefined}>
      <label>
        <input
          type="checkbox"
          checked={dalGruppo || scelte.progressione_ids.includes(p.id)}
          disabled={dalGruppo}
          onChange={() => void salva({ ...scelte, progressione_ids: alterna(scelte.progressione_ids, p.id) })}
        />
        <span>
          {p.nome}
          {dalGruppo && <span className="hint"> · dal gruppo</span>}
          <span className="prog-fase-anteprima">
            {p.step.length === 0
              ? ' · nessuno step ancora'
              : ` · ${p.step.map((s) => s.esercizio_nome).join(' → ')}`}
          </span>
        </span>
      </label>
    </li>
  )

  const senzaGruppo = progressioni.filter((p) => p.gruppo_id == null)

  return (
    <div>
      <h3>
        Progressioni della fase
        <Aiuto testo="Le progressioni spuntate qui vengono suggerite quando componi una seduta di questa fase, e compaiono nello specchietto del paziente. Spuntando un gruppo valgono anche le progressioni che ci aggiungerai dopo. Le progressioni si creano in Libreria esercizi → Progressioni." />
      </h3>

      {progressioni.length === 0 ? (
        <p className="hint">
          Non c&apos;è ancora nessuna progressione: creala in &ldquo;Libreria esercizi&rdquo;, linguetta
          &ldquo;Progressioni&rdquo;.
        </p>
      ) : (
        <>
          {gruppi.map((g) => {
            const dentro = progressioni.filter((p) => p.gruppo_id === g.id)
            const intero = scelte.gruppo_ids.includes(g.id)
            return (
              <div key={g.id} className="prog-fase-gruppo">
                <ul className="checkbox-list">
                  <li>
                    <label className="gruppo-intero">
                      <input
                        type="checkbox"
                        checked={intero}
                        onChange={() => void salva({ ...scelte, gruppo_ids: alterna(scelte.gruppo_ids, g.id) })}
                      />
                      {g.nome}
                      <span className="hint">
                        {' '}
                        · tutto il gruppo ({dentro.length})
                      </span>
                    </label>
                  </li>
                  {dentro.map((p) => riga(p, intero))}
                </ul>
              </div>
            )
          })}
          {senzaGruppo.length > 0 && (
            <div className="prog-fase-gruppo">
              {gruppi.length > 0 && <div className="sotto-titolo">Senza gruppo</div>}
              <ul className="checkbox-list">{senzaGruppo.map((p) => riga(p, false))}</ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
