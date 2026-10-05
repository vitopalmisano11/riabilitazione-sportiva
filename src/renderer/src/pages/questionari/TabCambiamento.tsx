import type { PunteggioQuestionario, Questionario } from '../../../../shared/types'
import Aiuto from '../../components/Aiuto'

// Il cambiamento che conta (MCID): di quanto deve cambiare il punteggio perche'
// il miglioramento sia vero e non l'oscillazione di un giorno storto.
//
// Il numero non lo si inventa: lo dice lo studio che ha validato quel
// questionario, e cambia da questionario a questionario. Se non c'e', questa
// scheda si lascia vuota e nella scheda del paziente non compare niente.
export function TabCambiamento({
  questionario,
  punteggi,
  onChange
}: {
  questionario: Questionario
  punteggi: PunteggioQuestionario[]
  onChange: (q: Questionario) => void
}): React.JSX.Element {
  const numero = (v: string): number | null => {
    const t = v.trim().replace(',', '.')
    if (t === '') return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  const testo = (v: number | null): string => (v == null ? '' : String(v).replace('.', ','))

  return (
    <div className="blocco-cambiamento">
      <div className="sotto-titolo">
        Il cambiamento che conta
        <Aiuto testo="Di quanto deve cambiare il punteggio perché il miglioramento sia vero e non l'oscillazione di un giorno storto. Il numero lo dice lo studio che ha validato il questionario, e vale solo per quel questionario. Compilandolo, nella scheda del paziente ogni compilazione dice quanto è cambiata rispetto alla prima volta e se il cambiamento conta. Se il questionario non lo prevede, lascia tutto vuoto." />
      </div>

      <div className="form-row-2">
        <label>
          Su quale punteggio
          <select
            value={questionario.mcid_punteggio_id ?? ''}
            onChange={(e) =>
              onChange({
                ...questionario,
                mcid_punteggio_id: e.target.value === '' ? null : Number(e.target.value)
              })
            }
          >
            <option value="">— nessuno —</option>
            {punteggi
              .filter((p) => p.id != null)
              .map((p) => (
                <option key={p.id} value={p.id as number}>
                  {p.nome || 'senza nome'}
                </option>
              ))}
          </select>
        </label>
        <label>
          Il paziente migliora quando il punteggio
          <select
            value={questionario.mcid_migliora_calando ? 'scende' : 'sale'}
            onChange={(e) =>
              onChange({
                ...questionario,
                mcid_migliora_calando: e.target.value === 'scende' ? 1 : 0
              })
            }
          >
            <option value="scende">scende (dolore, disabilità)</option>
            <option value="sale">sale (funzione, qualità della vita)</option>
          </select>
        </label>
      </div>

      <div className="form-row-2">
        <label>
          Quanti punti
          <input
            type="text"
            inputMode="decimal"
            placeholder="es. 13"
            value={testo(questionario.mcid_punti)}
            onChange={(e) => onChange({ ...questionario, mcid_punti: numero(e.target.value) })}
          />
        </label>
        <label>
          Oppure quale percentuale
          <input
            type="text"
            inputMode="decimal"
            placeholder="es. 36"
            value={testo(questionario.mcid_percentuale)}
            onChange={(e) =>
              onChange({ ...questionario, mcid_percentuale: numero(e.target.value) })
            }
          />
        </label>
      </div>

      <label>
        Da dove viene il numero
        <textarea
          rows={1}
          placeholder="es. Bolton & Humphreys 2002: MCID 5,5 punti; miglioramento clinicamente significativo con 13 punti o 36%"
          value={questionario.mcid_nota ?? ''}
          onChange={(e) => onChange({ ...questionario, mcid_nota: e.target.value || null })}
        />
      </label>
    </div>
  )
}
