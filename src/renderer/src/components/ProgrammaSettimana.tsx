import { useState } from 'react'
import { CalendarPlus, X } from 'lucide-react'
import type { SedutaRiepilogo } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg, formatData, oggiIso } from '../lib'

// Programmare piu' sedute in una volta.
//
// Chi viene tre volte a settimana riceve quasi sempre lo stesso programma nei
// tre giorni, con due esercizi cambiati. Prima si duplicava una seduta e si
// correggeva la data, tre volte. Qui si sceglie da quale seduta partire, si
// segnano i giorni, e le sedute compaiono gia' pronte nel diario, nel blocco
// "Programmate": il giorno stesso si apre quella del giorno e si cambia quel
// che serve.

// Il lunedi' della settimana prossima, e da li' gli altri giorni.
function giorniProssimaSettimana(giorni: number[]): string[] {
  const oggi = new Date()
  const lunedi = new Date(oggi)
  // getDay(): 0 = domenica. Il lunedi' che viene, mai uno gia' passato.
  const quantiAllunedi = ((8 - oggi.getDay()) % 7) + (oggi.getDay() === 1 ? 7 : 0)
  lunedi.setDate(oggi.getDate() + (quantiAllunedi === 0 ? 7 : quantiAllunedi))
  return giorni.map((g) => {
    const d = new Date(lunedi)
    d.setDate(lunedi.getDate() + g)
    const p = (n: number): string => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  })
}

export default function ProgrammaSettimana({
  sedute,
  onChiudi
}: {
  // Le sedute del paziente, dalla piu' recente: si copia una di queste.
  sedute: SedutaRiepilogo[]
  onChiudi: (create: number) => void
}): React.JSX.Element {
  const [origine, setOrigine] = useState<number>(sedute[0]?.id ?? 0)
  const [date, setDate] = useState<string[]>([])
  const [nuova, setNuova] = useState('')

  const aggiungi = (giorni: string[]): void =>
    setDate((prec) => [...new Set([...prec, ...giorni.filter((g) => g > oggiIso())])].sort())

  const crea = async (): Promise<void> => {
    if (date.length === 0) {
      toastErrore('Scegli almeno una data.')
      return
    }
    try {
      const create = await window.api.sedute.programma(origine, date)
      toast(
        create.length === 1 ? 'Una seduta programmata.' : `${create.length} sedute programmate.`
      )
      onChiudi(create.length)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={() => onChiudi(0)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Programma più sedute</h3>

        <label>
          Copia il programma da
          <select value={origine} onChange={(e) => setOrigine(Number(e.target.value))}>
            {sedute.map((s) => (
              <option key={s.id} value={s.id}>
                {formatData(s.data)} — {s.num_esercizi}{' '}
                {s.num_esercizi === 1 ? 'esercizio' : 'esercizi'}
              </option>
            ))}
          </select>
        </label>

        <div className="sotto-titolo">In quali giorni</div>
        <div className="scelte-giorni">
          <button onClick={() => aggiungi(giorniProssimaSettimana([0, 2, 4]))}>
            Lun · mer · ven
          </button>
          <button onClick={() => aggiungi(giorniProssimaSettimana([1, 3]))}>Mar · gio</button>
          <button onClick={() => aggiungi(giorniProssimaSettimana([0, 3]))}>Lun · gio</button>
        </div>
        <div className="aggiungi-data">
          <input type="date" value={nuova} onChange={(e) => setNuova(e.target.value)} />
          <button
            disabled={nuova === ''}
            onClick={() => {
              aggiungi([nuova])
              setNuova('')
            }}
          >
            <CalendarPlus size={16} /> Aggiungi
          </button>
        </div>

        {date.length === 0 ? (
          <p className="hint">
            Nessuna data scelta. Usa i pulsanti qui sopra per la settimana prossima, o aggiungi le
            date una per una.
          </p>
        ) : (
          <ul className="date-scelte">
            {date.map((d) => (
              <li key={d}>
                {formatData(d)}
                <button
                  title="Togli questa data"
                  onClick={() => setDate((prec) => prec.filter((x) => x !== d))}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button onClick={() => onChiudi(0)}>Annulla</button>
          <button className="primary" disabled={date.length === 0} onClick={() => void crea()}>
            Crea {date.length === 1 ? 'la seduta' : `le ${date.length} sedute`}
          </button>
        </div>
      </div>
    </div>
  )
}
