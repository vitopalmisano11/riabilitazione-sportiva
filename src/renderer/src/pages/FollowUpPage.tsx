import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import type { PazienteDettaglio } from '../../../shared/types'
import { toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg, formatData, oggiIso } from '../lib'

// Chi stai seguendo adesso e chi hai finito di seguire.
//
// La spunta "contattato" vuol dire "sentito, e per ora non ho altro in
// programma": rimettendo una data si toglie da sola, perche' c'e' di nuovo
// qualcosa in sospeso. La data dell'ultimo contatto resta comunque sotto al
// nome, cosi' non si perde la memoria di quando lo hai sentito.
//
// Non c'e' nessun avviso automatico: la sezione la guardi quando vuoi tu. Le
// date passate si vedono in rosso, quindi basta scorrere l'elenco per capire
// chi e' in ritardo.

// Fra un mese da oggi: la proposta piu' comune quando si chiude un ciclo.
function fraUnMese(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function FollowUpPage({
  onApriPaziente,
  ricarica
}: {
  // Porta alla scheda del paziente, nella sezione "Pazienti e sedute".
  onApriPaziente: (id: number) => void
  // Cambia quando si ripreme "Follow-up" nel menu: qui non c'e' niente da
  // chiudere, quindi si rilegge l'elenco.
  ricarica: number
}): React.JSX.Element {
  const [trattamento, setTrattamento] = useState<PazienteDettaglio[]>([])
  const [concluso, setConcluso] = useState<PazienteDettaglio[]>([])

  const carica = useCallback(async (): Promise<void> => {
    try {
      const { trattamento: t, concluso: c } = await window.api.followUp.list()
      setTrattamento(t)
      setConcluso(c)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [])

  useEffect(() => {
    void carica()
  }, [carica, ricarica])

  const esegui = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const concludi = async (p: PazienteDettaglio): Promise<void> => {
    if (
      !(await chiedi(
        `Il trattamento di ${p.nome} ${p.cognome} è finito?\n\n` +
          'Passerà nell’elenco del follow-up, con il primo contatto proposto fra un mese. ' +
          'Le sue sedute e la sua cartella restano dove sono.'
      ))
    ) {
      return
    }
    void esegui(() => window.api.followUp.setStato(p.id, 'concluso', fraUnMese()))
  }

  const riprendi = async (p: PazienteDettaglio): Promise<void> => {
    if (
      !(await chiedi(
        `${p.nome} ${p.cognome} ha ripreso il trattamento?

` +
          'Torna nell’elenco di chi stai seguendo. La data del prossimo contatto viene tolta, ' +
          'la recensione e la data dell’ultimo contatto restano.'
      ))
    ) {
      return
    }
    void esegui(() => window.api.followUp.setStato(p.id, 'trattamento', null))
  }

  const oggi = oggiIso()

  return (
    <div className="page">
      <header className="page-header">
        <h2>Follow-up</h2>
      </header>

      <div className="scheda">
        <section className="card">
          <div className="card-header-row">
            <h3>In trattamento</h3>
            <span className="hint">
              {trattamento.length === 1 ? '1 paziente' : `${trattamento.length} pazienti`}
            </span>
          </div>
          {trattamento.length === 0 ? (
            <p className="hint">Nessun paziente in trattamento.</p>
          ) : (
            <ul className="sedute-list elenco-followup">
              {trattamento.map((p) => (
                // Nome a sinistra, patologia a destra e il pulsante in fondo:
                // tutto su una riga sola. L'ultima seduta resta perché è quella
                // che dice chi non si fa vivo da settimane.
                <li key={p.id} className="riga-trattamento">
                  <button
                    className="nome-cliccabile"
                    title="Apri la scheda del paziente"
                    onClick={() => onApriPaziente(p.id)}
                  >
                    {p.cognome} {p.nome}
                  </button>
                  <span className="colonna-patologia">{p.patologia_nome ?? '—'}</span>
                  <span className="colonna-ultima">
                    {p.ultima_seduta
                      ? `ultima seduta ${formatData(p.ultima_seduta)}`
                      : 'nessuna seduta ancora'}
                  </span>
                  <button title="Il ciclo è finito" onClick={() => void concludi(p)}>
                    <CheckCircle2 size={18} /> Concludi
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-header-row">
            <h3>Follow-up</h3>
            <span className="hint">
              {concluso.filter((p) => p.follow_up_il != null && p.follow_up_il <= oggi).length > 0
                ? `${
                    concluso.filter((p) => p.follow_up_il != null && p.follow_up_il <= oggi).length
                  } da sentire`
                : 'nessuno in scadenza'}
            </span>
          </div>
          {concluso.length === 0 ? (
            <p className="hint">
              Nessun paziente ha ancora concluso il trattamento. Quando ne concludi uno finisce qui.
            </p>
          ) : (
            <div className="tabella-scorre tabella-followup-scorre">
              <table className="data-table tabella-followup">
                <thead>
                  <tr>
                    <th className="col-nome">Paziente</th>
                    <th>Da sentire il</th>
                    <th>Contattato</th>
                    <th>Recensione</th>
                    <th>Se torna</th>
                  </tr>
                </thead>
                <tbody>
                  {concluso.map((p) => {
                    const scaduto = p.follow_up_il != null && p.follow_up_il <= oggi
                    return (
                      <tr key={p.id}>
                        <td className="col-nome">
                          <button
                            className="nome-cliccabile"
                            title="Apri la scheda del paziente"
                            onClick={() => onApriPaziente(p.id)}
                          >
                            {p.cognome} {p.nome}
                          </button>
                          {p.contattato_il && (
                            <span className="sotto-riga">
                              ultimo contatto {formatData(p.contattato_il)}
                            </span>
                          )}
                        </td>
                        <td>
                          <input
                            type="date"
                            className={scaduto ? 'data-scaduta' : ''}
                            value={p.follow_up_il ?? ''}
                            onChange={(e) =>
                              void esegui(() =>
                                window.api.followUp.setFollowUp(p.id, e.target.value || null)
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            title="L’ho sentito e non ho altro in programma"
                            checked={p.contattato_il != null && p.follow_up_il == null}
                            onChange={(e) =>
                              void esegui(() =>
                                window.api.followUp.segnaContattato(p.id, e.target.checked)
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            title="Ha lasciato la recensione"
                            checked={p.recensione === 1}
                            onChange={(e) =>
                              void esegui(() =>
                                window.api.followUp.setRecensione(p.id, e.target.checked)
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            title="Riportalo fra i pazienti in trattamento"
                            onClick={() => void riprendi(p)}
                          >
                            <RotateCcw size={16} /> Riprendi
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
