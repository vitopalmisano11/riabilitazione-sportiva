import type { Fase, PazienteDettaglio } from '../../../../shared/types'
import type { StatoSalvataggio } from '../../salvataggio'
import IndicatoreSalvataggio from '../IndicatoreSalvataggio'
import type { CampiSeduta } from './modello'

interface Props {
  paziente: PazienteDettaglio
  nuova: boolean
  copiata: boolean
  campi: CampiSeduta
  onCambia: (p: Partial<CampiSeduta>) => void
  // le fasi del percorso al campo, se la patologia ce l'ha
  fasiCampo: Fase[]
  alCampo: boolean
  onCambiaFase: (fase: number | null) => void
  focusUsati: string[]
  salvataggio: { stato: StatoSalvataggio; errore: string | null }
  onAnnulla: () => void
  onSalva: () => void
}

// In cima alla seduta: di chi e', che fase, il giorno e l'ora, il focus, e i
// pulsanti per salvare o uscire.
export default function TestataSeduta({
  paziente,
  nuova,
  copiata,
  campi,
  onCambia,
  fasiCampo,
  alCampo,
  onCambiaFase,
  focusUsati,
  salvataggio,
  onAnnulla,
  onSalva
}: Props): React.JSX.Element {
  return (
    <header className="page-header builder-header">
      <div>
        {/* Il nome del paziente riporta alla sua scheda: da qui ci si torna di
            continuo, e prima l'unica strada era "Annulla", che sembra buttare
            via il lavoro. Se c'e' qualcosa di non salvato chiede, come
            "Annulla". */}
        <h2>
          {nuova ? 'Nuova seduta' : 'Modifica seduta'} —{' '}
          <button className="briciola nome-nel-titolo" title="Torna alla scheda del paziente" onClick={onAnnulla}>
            {paziente.nome} {paziente.cognome}
          </button>
        </h2>
        <p>
          {campi.faseNome ? (
            <>
              Fase: <strong>{campi.faseNome}</strong>
            </>
          ) : (
            'Nessuna fase impostata sul paziente'
          )}
          {copiata && ' · contenuti copiati da una seduta precedente'}
        </p>
        {/* I due binari: in palestra si parte dalla fase corrente del paziente,
            al campo da una delle fasi del percorso parallelo. La fase corrente
            del paziente non si tocca mai. Compare solo per le patologie che il
            campo ce l'hanno. */}
        {fasiCampo.length > 0 && (
          <div className="scelta-binario">
            <button
              className={alCampo ? '' : 'scelta-attiva'}
              onClick={() => onCambiaFase(paziente.fase_corrente_id)}
            >
              In palestra
            </button>
            <button className={alCampo ? 'scelta-attiva' : ''} onClick={() => onCambiaFase(fasiCampo[0].id)}>
              Al campo
            </button>
            {alCampo && fasiCampo.length > 1 && (
              <select
                value={campi.faseId ?? 0}
                title="Quale programma da campo"
                onChange={(e) => onCambiaFase(Number(e.target.value))}
              >
                {fasiCampo.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
      <div className="builder-header-actions">
        <label className="field data-field">
          Data
          <input type="date" value={campi.data} onChange={(e) => onCambia({ data: e.target.value })} />
        </label>
        {/* Facoltativo: serve a sapere a che ora viene, e a ordinare la
            settimana per appuntamento invece che per cognome. */}
        <label className="field ora-field">
          Ora
          <input type="time" value={campi.ora} onChange={(e) => onCambia({ ora: e.target.value })} />
        </label>
        {/* Il focus della giornata: due sedute della stessa fase possono essere
            due cose diverse, e nell'elenco si distinguono da qui. Si scrive a
            mano, ma quelli gia' usati si ripropongono. */}
        <label className="field focus-field">
          Focus
          <input
            type="text"
            list="focus-usati"
            placeholder="es. preparazione corsa"
            value={campi.focus}
            onChange={(e) => onCambia({ focus: e.target.value })}
          />
          <datalist id="focus-usati">
            {focusUsati.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
        <IndicatoreSalvataggio stato={salvataggio.stato} errore={salvataggio.errore} />
        <button onClick={onAnnulla}>Annulla</button>
        <button className="primary" disabled={salvataggio.stato === 'salvo'} onClick={onSalva}>
          Salva seduta
        </button>
      </div>
    </header>
  )
}
