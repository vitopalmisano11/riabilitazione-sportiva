import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, HeartPulse, RotateCcw } from 'lucide-react'
import StatoVuoto from '../components/StatoVuoto'
import type { PazienteDettaglio, Promemoria } from '../../../shared/types'
import { toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import Modale from '../components/Modale'
import { errMsg, etichettaPromemoria, formatData, oggiIso } from '../lib'

// Chi stai seguendo adesso e chi hai finito di seguire.
//
// La spunta "contattato" vuol dire "sentito, e per ora non ho altro in
// programma": rimettendo una data si toglie da sola, perche' c'e' di nuovo
// qualcosa in sospeso. La data dell'ultimo contatto resta comunque sotto al
// nome, cosi' non si perde la memoria di quando lo hai sentito.
//
// Non c'e' nessun avviso che interrompe: solo un numerino accanto a
// "Follow-up" nel menu, con quanti sono da sentire. Le date passate si vedono in
// rosso, quindi basta scorrere l'elenco per capire chi e' in ritardo.

// Fra tante settimane da oggi: le proposte quando si chiude un ciclo.
function fraSettimane(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n * 7)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function FollowUpPage({
  onApriPaziente,
  ricarica,
  onCambiato
}: {
  // Porta alla scheda del paziente, nella sezione "Pazienti".
  onApriPaziente: (id: number) => void
  // Cambia quando si ripreme "Follow-up" nel menu: qui non c'e' niente da
  // chiudere, quindi si rilegge l'elenco.
  ricarica: number
  // Dopo ogni cambiamento: il menu rilegge quanti sono da sentire.
  onCambiato?: () => void
}): React.JSX.Element {
  const [trattamento, setTrattamento] = useState<PazienteDettaglio[]>([])
  const [concluso, setConcluso] = useState<PazienteDettaglio[]>([])
  const [promemoria, setPromemoria] = useState<Promemoria[]>([])

  const carica = useCallback(async (): Promise<void> => {
    try {
      const { trattamento: t, concluso: c } = await window.api.followUp.list()
      setTrattamento(t)
      setConcluso(c)
      setPromemoria(await window.api.promemoria.list(null))
      onCambiato?.()
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

  // Il paziente di cui si sta chiudendo il ciclo: la finestra chiede se vuole
  // un follow-up e fra quanto. Senza follow-up resta fra i "Conclusi".
  const [inChiusura, setInChiusura] = useState<PazienteDettaglio | null>(null)

  const concludi = (p: PazienteDettaglio, settimane: number | null): void => {
    setInChiusura(null)
    void esegui(() =>
      window.api.followUp.setStato(
        p.id,
        'concluso',
        settimane == null ? null : fraSettimane(settimane)
      )
    )
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
  // Chi ha concluso senza follow-up (nessuna data e mai contattato) sta nei
  // conclusi, sotto; tutti gli altri restano nel follow-up come sempre, anche
  // quando li hai già sentiti.
  const conclusi = concluso.filter((p) => p.follow_up_il == null && p.contattato_il == null)
  const inFollowUp = concluso.filter((p) => !conclusi.includes(p))

  return (
    <div className="page">
      <header className="page-header">
        <h2>Follow-up</h2>
      </header>

      <div className="scheda">
        {/* I questionari, gli screening e i test da rifare, di tutti i pazienti: in
            cima, perche' hanno una data e sono i primi da guardare. */}
        {promemoria.length > 0 && (
          <section className="card">
            <div className="card-header-row">
              <h3>Da rifare</h3>
              <span className="hint">
                {promemoria.filter((m) => m.scadenza <= oggi).length > 0
                  ? `${promemoria.filter((m) => m.scadenza <= oggi).length} in scadenza`
                  : 'Nessuno in scadenza'}
              </span>
            </div>
            <ul className="sedute-list elenco-promemoria">
              {promemoria.map((m) => (
                <li key={m.id}>
                  <input
                    type="checkbox"
                    title="Fatto"
                    checked={false}
                    onChange={() => void esegui(() => window.api.promemoria.setFatto(m.id, true))}
                  />
                  <button
                    className="nome-cliccabile"
                    title="Apri la scheda del paziente"
                    onClick={() => onApriPaziente(m.paziente_id)}
                  >
                    {m.paziente_cognome} {m.paziente_nome}
                  </button>
                  <span className="promemoria-cosa">
                    {etichettaPromemoria(m.tipo)}: {m.riferimento_nome}
                    {m.nota && <span className="sotto-riga">{m.nota}</span>}
                  </span>
                  <span className={m.scadenza <= oggi ? 'data-scaduta promemoria-data' : 'promemoria-data'}>
                    entro il {formatData(m.scadenza)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <div className="card-header-row">
            <h3>In trattamento</h3>
            <span className="hint">
              {trattamento.length === 1 ? '1 paziente' : `${trattamento.length} pazienti`}
            </span>
          </div>
          {trattamento.length === 0 ? (
            <StatoVuoto
              icona={HeartPulse}
              titolo="Nessun paziente in trattamento"
              testo="Qui compaiono i pazienti che stai seguendo, con la data dell'ultima seduta: chi non si fa vivo da settimane si vede subito."
            />
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
                      ? `Ultima seduta ${formatData(p.ultima_seduta)}`
                      : 'Nessuna seduta ancora'}
                  </span>
                  <button
                    className="btn-stato"
                    title="Il ciclo è finito"
                    onClick={() => setInChiusura(p)}
                  >
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
              {inFollowUp.filter((p) => p.follow_up_il != null && p.follow_up_il <= oggi).length > 0
                ? `${
                    inFollowUp.filter((p) => p.follow_up_il != null && p.follow_up_il <= oggi)
                      .length
                  } da sentire`
                : 'Nessuno in scadenza'}
            </span>
          </div>
          {inFollowUp.length === 0 ? (
            <StatoVuoto
              icona={CalendarClock}
              titolo="Nessun paziente in follow-up"
              testo="Quando concludi un paziente e scegli un follow-up, finisce qui con la data in cui risentirlo."
            />
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
                  {inFollowUp.map((p) => {
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
                              Ultimo contatto {formatData(p.contattato_il)}
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
                            className="btn-stato"
                            title="Riportalo fra i pazienti in trattamento"
                            onClick={() => void riprendi(p)}
                          >
                            <RotateCcw size={18} /> Riprendi
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

        <section className="card">
          <div className="card-header-row">
            <h3>Conclusi</h3>
            <span className="hint">
              {conclusi.length === 1 ? '1 paziente' : `${conclusi.length} pazienti`}
            </span>
          </div>
          {conclusi.length === 0 ? (
            <p className="hint">
              Qui finiscono i pazienti conclusi senza follow-up, o già sentiti.
            </p>
          ) : (
            <ul className="sedute-list elenco-followup">
              {conclusi.map((p) => (
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
                    {p.contattato_il
                      ? `Ultimo contatto ${formatData(p.contattato_il)}`
                      : 'Nessun follow-up'}
                  </span>
                  <span className="azioni-conclusi">
                    <input
                      type="date"
                      title="Fissa un follow-up: il paziente passa nell’elenco qui sopra"
                      value=""
                      onChange={(e) =>
                        e.target.value &&
                        void esegui(() => window.api.followUp.setFollowUp(p.id, e.target.value))
                      }
                    />
                    <button
                      className="btn-stato"
                      title="Riportalo fra i pazienti in trattamento"
                      onClick={() => void riprendi(p)}
                    >
                      <RotateCcw size={18} /> Riprendi
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {inChiusura && (
        <Modale className="modal-sm" onConferma={() => setInChiusura(null)}>
          <h3>
            Concludi {inChiusura.nome} {inChiusura.cognome}
          </h3>
          <p className="modal-testo">
            Vuoi fare un follow-up? Se sì, fra quanto? Le sedute e la cartella restano dove sono.
          </p>
          <div className="scelta-settimane">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} onClick={() => concludi(inChiusura, n)}>
                <strong>{n}</strong>
                {n === 1 ? 'settimana' : 'settimane'}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button onClick={() => setInChiusura(null)}>Annulla</button>
            <button onClick={() => concludi(inChiusura, null)}>Nessun follow-up</button>
          </div>
        </Modale>
      )}
    </div>
  )
}
