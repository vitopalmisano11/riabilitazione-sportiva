import type { Segno } from '../../../../shared/types'
import type { StatoSalvataggio } from '../../salvataggio'
import IndicatoreSalvataggio from '../IndicatoreSalvataggio'
import Aiuto from '../Aiuto'
import type { CampiSeduta } from './modello'

// Da 0 a 10: la scala che si usa a voce con il paziente.
const VOTI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface Props {
  campi: CampiSeduta
  onCambia: (p: Partial<CampiSeduta>) => void
  segni: Segno[]
  totaleEsercizi: number
  salvataggio: { stato: StatoSalvataggio; errore: string | null }
  onAnnulla: () => void
  onSalva: () => void
}

// In fondo alla seduta: come e' andata (dolore, sforzo, i segni di
// riferimento), le note, e di nuovo i pulsanti per salvare.
export default function ChiusuraSeduta({
  campi,
  onCambia,
  segni,
  totaleEsercizi,
  salvataggio,
  onAnnulla,
  onSalva
}: Props): React.JSX.Element {
  return (
    <section className="card">
      {/* Come e' andata, prima delle note: due numeri da 0 a 10 che si possono
          confrontare seduta dopo seduta. Restano vuoti se non li si chiede:
          non tutte le sedute vanno misurate. */}
      <div className="riga-percepito">
        <label className="field campo-percepito">
          <span className="nome-percepito">
            Dolore
            <Aiuto testo="Quanto ha fatto male oggi, da 0 (niente) a 10 (il massimo). È quello che dice il paziente, non quello che vedi tu: serve a confrontare le sedute fra loro." />
          </span>
          <select value={campi.dolore} onChange={(e) => onCambia({ dolore: e.target.value })}>
            <option value="">—</option>
            {VOTI.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field campo-percepito">
          <span className="nome-percepito">
            Sforzo
            <Aiuto testo="Quanto è stata dura la seduta per lui, da 0 (niente) a 10 (massimo sforzo). Due sedute con gli stessi carichi possono costare molto diverso, e questo numero te lo dice." />
          </span>
          <select value={campi.sforzo} onChange={(e) => onCambia({ sforzo: e.target.value })}>
            <option value="">—</option>
            {VOTI.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {/* I segni di riferimento di questo paziente, nella stessa riga: si
            ricontrollano qui, seduta dopo seduta, ed e' da questi numeri che si
            vede se la strada e' giusta. Compaiono solo se ne hai scelti, dalla
            scheda Clinica. */}
        {segni.map((g) => (
          <label key={g.id} className="field campo-percepito">
            <span className="nome-percepito">
              {g.nome}
              {g.unita && <span className="unita-segno">{g.unita}</span>}
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="—"
              value={campi.misure[g.id] ?? ''}
              onChange={(e) => onCambia({ misure: { ...campi.misure, [g.id]: e.target.value } })}
            />
          </label>
        ))}
      </div>
      <label className="field note-seduta">
        Note della seduta
        <textarea
          rows={3}
          value={campi.note}
          placeholder="Osservazioni generali, cose da riprendere la prossima volta…"
          onChange={(e) => onCambia({ note: e.target.value })}
        />
      </label>
      <div className="modal-actions">
        <IndicatoreSalvataggio stato={salvataggio.stato} errore={salvataggio.errore} />
        <button onClick={onAnnulla}>Annulla</button>
        <button className="primary" disabled={salvataggio.stato === 'salvo'} onClick={onSalva}>
          Salva seduta ({totaleEsercizi} esercizi)
        </button>
      </div>
    </section>
  )
}
