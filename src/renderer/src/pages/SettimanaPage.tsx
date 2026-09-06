import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import AggiungiAlGiorno from '../components/AggiungiAlGiorno'
import type { SedutaSettimana } from '../../../shared/types'
import { toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg, formatData, oggiIso } from '../lib'

// La settimana di tutti i pazienti in una schermata.
//
// La settimana si prepara paziente per paziente, ma la domanda del lunedi'
// mattina e' un'altra: oggi chi viene, e cosa deve fare. Qui i sette giorni
// stanno uno sotto l'altro con dentro le sedute di chiunque, e da ogni riga si
// apre la scheda di quel paziente.

const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre'
]

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Il lunedi' della settimana in cui cade una data. getDay() da' 0 alla
// domenica: qui la settimana comincia di lunedi', come l'agenda.
function lunediDi(d: Date): Date {
  const l = new Date(d)
  l.setHours(0, 0, 0, 0)
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7))
  return l
}

function intestazioneSettimana(lunedi: Date): string {
  const domenica = new Date(lunedi)
  domenica.setDate(lunedi.getDate() + 6)
  const stessoMese = lunedi.getMonth() === domenica.getMonth()
  const inizio = stessoMese ? `${lunedi.getDate()}` : `${lunedi.getDate()} ${MESI[lunedi.getMonth()]}`
  return `${inizio} – ${domenica.getDate()} ${MESI[domenica.getMonth()]} ${domenica.getFullYear()}`
}

export default function SettimanaPage({
  onApriPaziente,
  onApriSeduta,
  tornaAllElenco
}: {
  onApriPaziente: (id: number) => void
  onApriSeduta: (pazienteId: number, sedutaId: number) => void
  tornaAllElenco: number
}): React.JSX.Element {
  const [lunedi, setLunedi] = useState<Date>(() => lunediDi(new Date()))
  const [sedute, setSedute] = useState<SedutaSettimana[]>([])
  // Il giorno a cui si sta aggiungendo una seduta, se la finestrella e' aperta.
  const [giornoAperto, setGiornoAperto] = useState<string | null>(null)

  // Ripremendo la voce del menu si torna alla settimana in corso.
  useEffect(() => {
    if (tornaAllElenco === 0) return
    setLunedi(lunediDi(new Date()))
  }, [tornaAllElenco])

  const carica = useCallback((): void => {
    const domenica = new Date(lunedi)
    domenica.setDate(lunedi.getDate() + 6)
    window.api.sedute
      .settimana(iso(lunedi), iso(domenica))
      .then(setSedute)
      .catch((e) => toastErrore(errMsg(e)))
  }, [lunedi])

  useEffect(carica, [carica])

  // Si elimina anche da qui: preparare la settimana vuol dire anche disfare
  // quello che si e' messo nel giorno sbagliato. La seduta finisce nel cestino
  // come quando la si elimina dalla scheda del paziente.
  const elimina = async (s: SedutaSettimana): Promise<void> => {
    if (
      !(await chiedi(
        `Eliminare la seduta di ${s.paziente} del ${formatData(s.data)}?
Finisce nel cestino: puoi rimetterla a posto da Impostazioni entro un mese.`
      ))
    ) {
      return
    }
    try {
      await window.api.sedute.remove(s.id)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const sposta = (settimane: number): void => {
    const nuovo = new Date(lunedi)
    nuovo.setDate(lunedi.getDate() + settimane * 7)
    setLunedi(nuovo)
  }

  const oggi = oggiIso()
  const giorni = GIORNI.map((nome, i) => {
    const d = new Date(lunedi)
    d.setDate(lunedi.getDate() + i)
    const data = iso(d)
    return { nome, data, numero: d.getDate(), sedute: sedute.filter((s) => s.data === data) }
  })

  return (
    <div className="page">
      <header className="page-header">
        <h2>La settimana</h2>
      </header>

      <div className="toolbar">
        <button title="Settimana precedente" onClick={() => sposta(-1)}>
          <ChevronLeft size={18} />
        </button>
        <span className="titolo-settimana">{intestazioneSettimana(lunedi)}</span>
        <button title="Settimana successiva" onClick={() => sposta(1)}>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setLunedi(lunediDi(new Date()))}>
          <CalendarDays size={16} /> Questa settimana
        </button>
        <span className="spacer" />
        <span className="hint">
          {sedute.length === 0
            ? 'Nessuna seduta'
            : sedute.length === 1
              ? '1 seduta'
              : `${sedute.length} sedute`}
        </span>
      </div>

      <section className="card settimana-card">
        {giorni.map((g) => (
          <div key={g.data} className={g.data === oggi ? 'giorno-settimana oggi' : 'giorno-settimana'}>
            <div className="sotto-titolo">
              {g.nome} {g.numero}
              {g.data === oggi && <span className="badge">oggi</span>}
              {/* Programmare partendo dal giorno: e' cosi' che si ragiona
                  quando si prepara la settimana. */}
              <button
                className="btn-aggiungi-giorno"
                title={`Aggiungi una seduta a ${g.nome} ${g.numero}`}
                onClick={() => setGiornoAperto(g.data)}
              >
                <Plus size={15} />
              </button>
            </div>
            {g.sedute.length === 0 ? (
              <p className="hint riga-vuota">—</p>
            ) : (
              <ul className="sedute-list">
                {g.sedute.map((s) => (
                  <li key={s.id}>
                    <div className="seduta-info">
                      {/* Il nome apre la scheda: da qui si passa al paziente
                          senza tornare all'elenco e cercarlo. */}
                      <button className="briciola nome-nel-titolo" onClick={() => onApriPaziente(s.paziente_id)}>
                        {s.paziente}
                      </button>
                      <span className="seduta-meta">
                        {[
                          s.fase_campo === 1 ? 'al campo' : null,
                          s.fase_nome,
                          `${s.num_esercizi} ${s.num_esercizi === 1 ? 'esercizio' : 'esercizi'}`,
                          s.data > oggi ? 'programmata' : null
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {/* Il nome porta alla scheda, questo alla seduta: appena
                        preparata la si vuole ritoccare, non cercarla nel
                        diario del paziente. */}
                    <span className="row-actions">
                      <button
                        title="Apri la seduta"
                        onClick={() => onApriSeduta(s.paziente_id, s.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="danger"
                        title="Elimina la seduta"
                        onClick={() => void elimina(s)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {giornoAperto && (
        <AggiungiAlGiorno
          data={giornoAperto}
          onApriPaziente={onApriPaziente}
          onChiudi={(creata) => {
            setGiornoAperto(null)
            if (creata) carica()
          }}
        />
      )}
    </div>
  )
}
