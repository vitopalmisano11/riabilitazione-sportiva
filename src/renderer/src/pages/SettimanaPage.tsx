import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  UserRound,
  Plus,
  Presentation,
  Trash2
} from 'lucide-react'
import AggiungiAlGiorno from '../components/AggiungiAlGiorno'
import type { PazienteDettaglio, SedutaSettimana } from '../../../shared/types'
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

// Quello che si legge accanto al nome: la fase, e se la seduta e' ancora da
// fare. Il numero degli esercizi non c'e': qui non serviva.
const accanto = (s: SedutaSettimana, oggi: string): string =>
  [
    s.fase_campo === 1 ? 'al campo' : null,
    s.fase_nome,
    s.data > oggi ? 'programmata' : null
  ]
    .filter(Boolean)
    .join(' · ')

export default function SettimanaPage({
  onApriPaziente,
  onApriSeduta,
  onCopiaSeduta,
  onNuovaSeduta,
  tornaAllElenco
}: {
  onApriPaziente: (id: number) => void
  onApriSeduta: (pazienteId: number, sedutaId: number) => void
  // una seduta nuova copiata da questa, nel giorno scelto
  onCopiaSeduta: (pazienteId: number, sedutaId: number, data: string) => void
  // una seduta nuova da zero, per quel paziente in quel giorno
  onNuovaSeduta: (pazienteId: number, data: string) => void
  tornaAllElenco: number
}): React.JSX.Element {
  const [lunedi, setLunedi] = useState<Date>(() => lunediDi(new Date()))
  const [sedute, setSedute] = useState<SedutaSettimana[]>([])
  // Il giorno a cui si sta aggiungendo una seduta, se la finestrella e' aperta.
  const [giornoAperto, setGiornoAperto] = useState<string | null>(null)
  // La seduta che si sta copiando, mentre si sceglie il giorno.
  const [daCopiare, setDaCopiare] = useState<SedutaSettimana | null>(null)
  const [altraData, setAltraData] = useState('')
  // La ricerca del paziente in cima: si apre la sua scheda o gli si aggiunge
  // una seduta scegliendo il giorno.
  const [pazienti, setPazienti] = useState<PazienteDettaglio[]>([])
  const [cerca, setCerca] = useState('')
  const [elencoAperto, setElencoAperto] = useState(false)
  const [perSeduta, setPerSeduta] = useState<PazienteDettaglio | null>(null)
  const [pazienteDelGiorno, setPazienteDelGiorno] = useState<PazienteDettaglio | null>(null)

  useEffect(() => {
    window.api.pazienti
      .list()
      .then(setPazienti)
      .catch(() => undefined)
  }, [])

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

  // I giorni da scegliere quando si copia una seduta o se ne aggiunge una:
  // sette, a partire da oggi. Se si sta guardando una settimana che deve ancora
  // venire, dal suo lunedi'.
  const inizioScelta = new Date(Math.max(lunediDi(new Date()).getTime(), lunedi.getTime()))
  if (iso(inizioScelta) < oggi) {
    const [a, m, g] = oggi.split('-').map(Number)
    inizioScelta.setFullYear(a, m - 1, g)
  }
  const giorniScelta = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inizioScelta)
    d.setDate(inizioScelta.getDate() + i)
    return {
      nome: i === 0 && iso(d) === oggi ? 'oggi' : GIORNI[(d.getDay() + 6) % 7],
      data: iso(d),
      numero: d.getDate()
    }
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
        <div className="ricerca-settimana">
          <input
            type="search"
            placeholder="Cerca paziente…"
            value={cerca}
            onChange={(e) => {
              setCerca(e.target.value)
              setElencoAperto(true)
            }}
            onFocus={() => setElencoAperto(true)}
            // si chiude poco dopo: il clic su un risultato deve fare in tempo
            onBlur={() => setTimeout(() => setElencoAperto(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setCerca('')
                setElencoAperto(false)
              }
            }}
          />
          {elencoAperto && cerca.trim() !== '' && (
            <ul className="elenco-scelta risultati-settimana">
              {pazienti
                .filter((p) =>
                  `${p.cognome} ${p.nome} ${p.nome} ${p.cognome}`
                    .toLowerCase()
                    .includes(cerca.trim().toLowerCase())
                )
                .slice(0, 8)
                .map((p) => (
                  <li key={p.id}>
                    <span className="nome-risultato">
                      {p.cognome} {p.nome}
                    </span>
                    <button
                      type="button"
                      className="btn-icona"
                      title="Apri la scheda"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onApriPaziente(p.id)}
                    >
                      <UserRound size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-icona primary"
                      title="Aggiungi una seduta: scegli il giorno"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPerSeduta(p)
                        setAltraData('')
                        setCerca('')
                        setElencoAperto(false)
                      }}
                    >
                      <Plus size={16} />
                    </button>
                  </li>
                ))}
              {pazienti.every(
                (p) =>
                  !`${p.cognome} ${p.nome} ${p.nome} ${p.cognome}`
                    .toLowerCase()
                    .includes(cerca.trim().toLowerCase())
              ) && <li className="empty">Nessun paziente con questo nome.</li>}
            </ul>
          )}
        </div>
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
                onClick={() => {
                  setPazienteDelGiorno(null)
                  setGiornoAperto(g.data)
                }}
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
                      {/* Il focus della seduta si legge nella scheda del
                          paziente, non qui: qui serve sapere chi viene. */}
                      {accanto(s, oggi) && <span className="seduta-meta">{accanto(s, oggi)}</span>}
                    </div>
                    {/* Il nome porta alla scheda, questi alla seduta: appena
                        preparata la si vuole mostrare o ritoccare, non cercarla
                        nel diario del paziente. */}
                    <span className="row-actions">
                      <button
                        title="Mostra la scheda al paziente (si apre in una finestra a parte)"
                        onClick={() =>
                          void window.api.scheda.apri(s.id).catch((e) => toastErrore(errMsg(e)))
                        }
                      >
                        <Presentation size={16} />
                      </button>
                      <button
                        title="Apri la seduta"
                        onClick={() => onApriSeduta(s.paziente_id, s.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      {/* Copiarla in un altro giorno, per ritoccarla: la seduta
                          di lunedi' che il venerdi' si ripete con qualche
                          cambiamento. */}
                      <button
                        title="Copia la seduta in un altro giorno"
                        onClick={() => {
                          setAltraData('')
                          setDaCopiare(s)
                        }}
                      >
                        <Copy size={16} />
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

      {/* Il giorno della seduta nuova, per il paziente trovato con la ricerca. */}
      {perSeduta && (
        <div className="modal-overlay" onClick={() => setPerSeduta(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>
              Seduta di {perSeduta.cognome} {perSeduta.nome}: in che giorno?
            </h3>
            <div className="giorni-copia">
              {giorniScelta.map((g) => (
                <button
                  key={g.data}
                  onClick={() => {
                    setPazienteDelGiorno(perSeduta)
                    setPerSeduta(null)
                    setGiornoAperto(g.data)
                  }}
                >
                  <span className="nome-giorno">{g.nome}</span>
                  <span className="numero-giorno">{g.numero}</span>
                </button>
              ))}
            </div>
            <div className="riga-altra-data">
              <label className="compila-data">
                Un altro giorno
                <input type="date" value={altraData} onChange={(e) => setAltraData(e.target.value)} />
              </label>
              <button
                className="primary"
                disabled={altraData === ''}
                onClick={() => {
                  setPazienteDelGiorno(perSeduta)
                  setPerSeduta(null)
                  setGiornoAperto(altraData)
                }}
              >
                Avanti
              </button>
            </div>
            <div className="modal-actions">
              <button onClick={() => setPerSeduta(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {daCopiare && (
        <div className="modal-overlay" onClick={() => setDaCopiare(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>In che giorno la copi?</h3>
            <p className="modal-testo">
              La seduta di {daCopiare.paziente} del {formatData(daCopiare.data)}: si apre una seduta
              nuova con gli stessi esercizi, da ritoccare prima di salvarla.
            </p>
            <div className="giorni-copia">
              {giorniScelta.map((g) => (
                <button
                  key={g.data}
                  className={g.data === daCopiare.data ? 'giorno-origine' : ''}
                  onClick={() => {
                    const s = daCopiare
                    setDaCopiare(null)
                    onCopiaSeduta(s.paziente_id, s.id, g.data)
                  }}
                >
                  <span className="nome-giorno">{g.nome}</span>
                  <span className="numero-giorno">{g.numero}</span>
                </button>
              ))}
            </div>
            <div className="riga-altra-data">
              <label className="compila-data">
                Un altro giorno
                <input type="date" value={altraData} onChange={(e) => setAltraData(e.target.value)} />
              </label>
              <button
                className="primary"
                disabled={altraData === ''}
                onClick={() => {
                  const s = daCopiare
                  setDaCopiare(null)
                  onCopiaSeduta(s.paziente_id, s.id, altraData)
                }}
              >
                Copia
              </button>
            </div>
            <div className="modal-actions">
              <button onClick={() => setDaCopiare(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {giornoAperto && (
        <AggiungiAlGiorno
          data={giornoAperto}
          pazienteIniziale={pazienteDelGiorno}
          onApriPaziente={onApriPaziente}
          onNuovaSeduta={onNuovaSeduta}
          onChiudi={(creata) => {
            setGiornoAperto(null)
            setPazienteDelGiorno(null)
            if (creata) carica()
          }}
        />
      )}
    </div>
  )
}
