import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronRight,
  Filter,
  CalendarPlus,
  Copy,
  Download,
  FileText,
  Images,
  Pencil,
  Plus,
  Presentation,
  Trash2
} from 'lucide-react'
import type {
  AnteprimaScheda,
  Fase,
  Gruppo,
  Patologia,
  PazienteDettaglio,
  SedutaRiepilogo,
  TestValore
} from '../../../shared/types'
import SedutaBuilder from '../components/SedutaBuilder'
import ProgrammaSettimana from '../components/ProgrammaSettimana'
import QuestionariPaziente from '../components/QuestionariPaziente'
import AnagraficaPaziente, { ModaleDatiPaziente } from '../components/AnagraficaPaziente'
import SceltaConRicerca from '../components/SceltaConRicerca'
import SegniPaziente from '../components/SegniPaziente'
import IndicazioniCasa from '../components/IndicazioniCasa'
import MisurePaziente from '../components/MisurePaziente'
import AnamnesiPaziente from '../components/AnamnesiPaziente'
import ValutazionePaziente from '../components/ValutazionePaziente'
import ObiettiviFase from '../components/ObiettiviFase'
import QuadroPaziente from '../components/QuadroPaziente'
import { toast, toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import Modale from '../components/Modale'
import { errMsg, formatData, oggiIso } from '../lib'
import { useScorciatoie } from '../scorciatoie'

// Da quanto non viene: "oggi", "ieri", "5 giorni fa", "3 settimane fa".
function quantoFa(data: string | null): string {
  if (!data) return 'mai'
  const [a, m, g] = data.split('-').map(Number)
  const giorno = new Date(a, m - 1, g)
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const giorni = Math.round((oggi.getTime() - giorno.getTime()) / 86400000)
  if (giorni <= 0) return 'oggi'
  if (giorni === 1) return 'ieri'
  if (giorni < 14) return `${giorni} giorni fa`
  if (giorni < 60) return `${Math.floor(giorni / 7)} settimane fa`
  const mesi = Math.floor(giorni / 30)
  return mesi < 12 ? `${mesi} mesi fa` : mesi < 24 ? 'più di un anno fa' : `${Math.floor(mesi / 12)} anni fa`
}

export default function PazientiPage({
  tornaAllElenco,
  apriPaziente,
  onEsciDallaSeduta
}: {
  // Cambia ogni volta che si ripreme "Pazienti" nel menu a sinistra.
  tornaAllElenco: number
  // Scheda da aprire, richiesta da un'altra sezione (il follow-up, la
  // settimana). Con sedutaId si apre direttamente quella seduta.
  // Con duplicaDa si apre una seduta nuova copiata da quella, nel giorno data.
  apriPaziente: {
    id: number
    sedutaId?: number
    duplicaDa?: number
    nuova?: boolean
    data?: string
    seq: number
  } | null
  // Chiudendo una seduta aperta da un'altra sezione si torna da dove si e'
  // arrivati, non nella scheda del paziente: chi stava preparando la settimana
  // vuole tornare alla settimana.
  onEsciDallaSeduta?: () => void
}): React.JSX.Element {
  const [pazienti, setPazienti] = useState<PazienteDettaglio[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [ricerca, setRicerca] = useState('')
  // Filtri: nascosti finche' non servono, cosi' con pochi pazienti la barra
  // resta quella di prima.
  const [filtriAperti, setFiltriAperti] = useState(false)
  const [filtroPatologia, setFiltroPatologia] = useState<number | ''>('')
  const [filtroStato, setFiltroStato] = useState<'' | 'trattamento' | 'concluso'>('')
  const [patologie, setPatologie] = useState<Patologia[]>([])
  const [gruppi, setGruppi] = useState<Gruppo[]>([])
  const [nuovo, setNuovo] = useState(false)
  // Quale linguetta e' aperta nella scheda del paziente: vive qui e non dentro
  // SchedaPaziente perche' aprire una seduta smonta quel componente (la pagina
  // passa a mostrare SedutaBuilder al suo posto). Se stesse li' dentro, tornando
  // dalla seduta la scheda ripartirebbe sempre dal quadro invece di restare sul
  // diario da cui si era partiti.
  const [scheda, setScheda] = useState<SchedaAperta>('quadro')
  const [builder, setBuilder] = useState<{
    sedutaId: number | null
    duplicaDa?: number
    dataIniziale?: string
    // La seduta e' stata aperta da un'altra sezione: chiudendola si torna li'.
    daFuori?: boolean
  } | null>(null)

  const load = async (): Promise<void> => setPazienti(await window.api.pazienti.list())

  useEffect(() => {
    void load()
    void window.api.patologie.list().then(setPatologie)
    void window.api.gruppi.list().then(setGruppi)
  }, [])

  // Lo stato del builder letto dentro l'effetto senza farlo scattare: se fosse
  // fra le dipendenze, chiudere una seduta chiuderebbe anche la scheda.
  const builderAperto = useRef(builder)
  builderAperto.current = builder

  // Premendo "Pazienti" nel menu si torna all'elenco da qualunque
  // punto, anche dalla costruzione di una seduta. Per una seduta nuova non si
  // perde niente: la bozza e' gia' messa da parte e viene riproposta. Per una
  // seduta gia' salvata che si stava modificando, invece, si chiede prima.
  useEffect(() => {
    if (tornaAllElenco === 0) return
    const aperto = builderAperto.current
    const esci = (): void => {
      setBuilder(null)
      setSelId(null)
      void load()
    }
    if (aperto?.sedutaId != null) {
      void chiedi('Stai modificando una seduta. Esci senza salvare?').then((ok) => {
        if (ok) esci()
      })
    } else {
      esci()
    }
  }, [tornaAllElenco])

  // Arrivando da un'altra sezione si apre la scheda chiesta. Se era rimasta
  // aperta la costruzione di una seduta la si chiude: mostrerebbe il programma
  // di un paziente sotto il nome di un altro.
  useEffect(() => {
    if (apriPaziente == null) return
    setScheda('quadro')
    setBuilder(
      apriPaziente.nuova
        ? { sedutaId: null, dataIniziale: apriPaziente.data, daFuori: true }
        : apriPaziente.duplicaDa != null
        ? {
            sedutaId: null,
            duplicaDa: apriPaziente.duplicaDa,
            dataIniziale: apriPaziente.data,
            daFuori: true
          }
        : apriPaziente.sedutaId == null
          ? null
          : { sedutaId: apriPaziente.sedutaId, daFuori: true }
    )
    setSelId(apriPaziente.id)
  }, [apriPaziente])

  const q = ricerca.trim().toLowerCase()
  const filtriAttivi = filtroPatologia !== '' || filtroStato !== ''
  const trovati = pazienti.filter(
    (p) =>
      (q === '' || `${p.cognome} ${p.nome} ${p.nome} ${p.cognome}`.toLowerCase().includes(q)) &&
      (filtroPatologia === '' || p.patologia_id === filtroPatologia) &&
      (filtroStato === '' || p.stato === filtroStato)
  )
  // L'elenco arriva gia' ordinato per seduta piu' recente e si vede tutto: e'
  // il riquadro a scorrere. Prima se ne mostravano dieci e il resto stava in un
  // blocco chiuso a parte, che voleva dire due posti in cui cercare.
  const sel = pazienti.find((p) => p.id === selId) ?? null

  // Diviso in sezioni per gruppo solo se il fisioterapista ne ha creato
  // almeno uno: chi non usa i gruppi non vede alcun cambiamento nell'elenco.
  // Dentro a ogni sezione l'ordine di "trovati" (per ultima seduta) resta quello di prima.
  const sezioniGruppo: { nome: string; pazienti: PazienteDettaglio[] }[] =
    gruppi.length === 0
      ? []
      : [
          ...[...gruppi]
            .sort((a, b) => a.ordine - b.ordine)
            .map((g) => ({ nome: g.nome, pazienti: trovati.filter((p) => p.gruppo_id === g.id) })),
          { nome: 'Senza gruppo', pazienti: trovati.filter((p) => p.gruppo_id == null) }
        ].filter((s) => s.pazienti.length > 0)

  // La riga di un paziente nell'elenco: la stessa sia con i gruppi sia senza.
  const rigaPaziente = (p: PazienteDettaglio): React.JSX.Element => (
    <div
      key={p.id}
      className="riga-paziente"
      onClick={() => {
        setSelId(p.id)
        setScheda('quadro')
      }}
    >
      <span className="nome-paziente-riga">
        {p.cognome} {p.nome}
      </span>
      <span className="dettaglio-riga">
        {[p.patologia_nome, p.fase_nome, p.sport].filter(Boolean).join(' · ') || '—'}
      </span>
      <span
        className="dettaglio-riga"
        title={p.ultima_seduta ? formatData(p.ultima_seduta) : undefined}
      >
        {quantoFa(p.ultima_seduta)}
      </span>
      <span>
        <span className={p.stato === 'concluso' ? 'badge-stato follow' : 'badge-stato'}>
          {p.stato === 'concluso' ? 'Follow-up' : 'In trattamento'}
        </span>
      </span>
      <button
        className="primary btn-icona"
        title="Nuova seduta per questo paziente"
        onClick={(e) => {
          e.stopPropagation()
          nuovaSedutaPer(p.id)
        }}
      >
        <Plus size={17} />
      </button>
    </div>
  )

  // Il nome del paziente aperto finisce nel titolo della finestra: con piu'
  // finestre aperte, sulla barra di Windows si distinguono.
  useEffect(() => {
    document.title = sel
      ? `Fisioterapia — ${sel.cognome} ${sel.nome}`
      : 'Fisioterapia'
    return () => {
      document.title = 'Fisioterapia'
    }
  }, [sel])

  // Il paziente arriva, si apre l'elenco e si comincia: senza passare dalla sua
  // scheda. E' il gesto piu' ripetuto della giornata.
  const nuovaSedutaPer = (pazienteId: number): void => {
    setSelId(pazienteId)
    setScheda('diario')
    setBuilder({ sedutaId: null })
  }

  // Ctrl+N crea (un paziente nell'elenco, una seduta dentro alla scheda) e
  // Ctrl+F porta il cursore nella ricerca: sono i due gesti che si ripetono
  // decine di volte in una giornata.
  const ricercaRef = useRef<HTMLInputElement>(null)
  useScorciatoie([
    {
      tasto: 'n',
      ctrl: true,
      azione: () => (sel ? setBuilder({ sedutaId: null }) : setNuovo(true)),
      attiva: builder == null
    },
    {
      tasto: 'f',
      ctrl: true,
      azione: () => ricercaRef.current?.focus(),
      attiva: sel == null && builder == null
    }
  ])

  if (builder && sel) {
    return (
      <SedutaBuilder
        paziente={sel}
        sedutaId={builder.sedutaId}
        duplicaDa={builder.duplicaDa}
        dataIniziale={builder.dataIniziale}
        onClose={(salvata) => {
          const tornaIndietro = builder.daFuori === true
          setBuilder(null)
          if (salvata) void load()
          if (tornaIndietro) onEsciDallaSeduta?.()
        }}
      />
    )
  }

  return (
    // Senza un paziente aperto la pagina e' la lista, larga quanto la
    // finestra; con la scheda aperta resta la colonna di lettura di prima.
    <div className={sel ? 'page step-flow' : 'page lista-larga'}>
      <header className="page-header">
        <h2>Pazienti</h2>
      </header>

      {sel && (
        <div className="briciole">
          {/* Tornando all'elenco lo si rilegge: l'ordine e' per ultima seduta,
              e nel frattempo puo' essere cambiato. */}
          <button
            className="briciola"
            onClick={() => {
              setSelId(null)
              void load()
            }}
          >
            Pazienti
          </button>
          <ChevronRight size={16} />
          <span className="briciola corrente">
            {sel.cognome} {sel.nome}
          </span>
        </div>
      )}

      {sel ? (
        <SchedaPaziente
          key={sel.id}
          paziente={sel}
          patologie={patologie}
          scheda={scheda}
          onSchedaChange={setScheda}
          onChanged={load}
          onDeleted={() => {
            setSelId(null)
            void load()
          }}
          onNuovaSeduta={() => {
            setScheda('diario')
            setBuilder({ sedutaId: null })
          }}
          onApriSeduta={(id) => {
            setScheda('diario')
            setBuilder({ sedutaId: id })
          }}
          onDuplicaSeduta={(id) => {
            setScheda('diario')
            setBuilder({ sedutaId: null, duplicaDa: id })
          }}
        />
      ) : (
        <section className="card step-card elenco-pazienti">
          <div className="ricerca-sopra">
            <input
              ref={ricercaRef}
              type="search"
              placeholder="Cerca paziente…"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
            />
            <button
              className={`btn-icona${filtriAttivi ? ' scelta-attiva' : ''}`}
              title="Filtra per patologia o stato"
              onClick={() => setFiltriAperti(!filtriAperti)}
            >
              <Filter size={18} />
            </button>
            {/* Con la scritta, e non solo il segno +: nelle righe qui sotto ogni
                paziente ha il suo + per la seduta, e due segni uguali uno sotto
                l'altro sembravano la stessa cosa mal allineata. */}
            <button className="primary" onClick={() => setNuovo(true)}>
              <Plus size={18} /> Nuovo paziente
            </button>
          </div>

          {(filtriAperti || filtriAttivi) && (
            <div className="pannello-filtri">
              <label className="compila-data">
                Patologia
                <SceltaConRicerca
                  voci={patologie}
                  valore={filtroPatologia}
                  segnaposto="tutte"
                  vuoto="tutte"
                  onCambia={setFiltroPatologia}
                />
              </label>
              <label className="compila-data">
                Stato
                <select
                  value={filtroStato}
                  onChange={(e) =>
                    setFiltroStato(e.target.value as '' | 'trattamento' | 'concluso')
                  }
                >
                  <option value="">tutti</option>
                  <option value="trattamento">in trattamento</option>
                  <option value="concluso">concluso</option>
                </select>
              </label>
              {filtriAttivi && (
                <button
                  className="btn-piccolo"
                  onClick={() => {
                    setFiltroPatologia('')
                    setFiltroStato('')
                  }}
                >
                  Togli i filtri
                </button>
              )}
              <span className="hint">
                {trovati.length === 1 ? '1 paziente' : `${trovati.length} pazienti`}
              </span>
            </div>
          )}

          {/* Un riquadro solo che scorre, come nel follow-up: prima erano dieci
              pazienti e il resto chiuso in un blocco a parte, che con
              l'archivio grande voleva dire due posti in cui cercare. */}
          {/* Una riga per paziente, a colonne: il nome, a che punto e' del
              percorso, da quanto non viene e se e' in trattamento o in
              follow-up. Si legge tutto senza aprire la scheda. */}
          <div className="riquadro-scorrevole">
            {/* l'intestazione sta dentro al riquadro che scorre, ferma in
                cima: cosi' le colonne sono larghe uguali a quelle delle righe */}
            {trovati.length > 0 && (
              <div className="riga-paziente intestazione-pazienti">
                <span>Paziente</span>
                <span>Patologia e fase</span>
                <span>Ultima seduta</span>
                <span>Stato</span>
                <span />
              </div>
            )}
            {sezioniGruppo.length === 0 ? (
              <div className="righe-pazienti">{trovati.map(rigaPaziente)}</div>
            ) : (
              // I gruppi ci sono: l'elenco si spezza in una sezione per gruppo,
              // con nome e conteggio, invece dell'unica lista di sempre.
              sezioniGruppo.map((s) => (
                <div key={s.nome} className="blocco-gruppo-pazienti">
                  <div className="sotto-titolo">
                    {s.nome} ({s.pazienti.length})
                  </div>
                  <div className="righe-pazienti">{s.pazienti.map(rigaPaziente)}</div>
                </div>
              ))
            )}
          </div>

          {trovati.length === 0 && (
            <p className="hint">
              {pazienti.length === 0
                ? 'Nessun paziente: creane uno col pulsante + qui sopra.'
                : 'Nessun risultato per la ricerca.'}
            </p>
          )}
        </section>
      )}

      {nuovo && (
        <ModaleDatiPaziente
          paziente={null}
          patologie={patologie}
          onChiudi={(salvato, nuovoId) => {
            setNuovo(false)
            if (salvato) {
              void load()
              if (nuovoId != null) setSelId(nuovoId)
            }
          }}
        />
      )}
    </div>
  )
}

type SchedaAperta = 'quadro' | 'diario' | 'clinica' | 'percorso' | 'misure'

const SCHEDE_PAZIENTE: { key: SchedaAperta; label: string }[] = [
  // Prima voce e prima cosa che si vede aprendo un paziente: e' la domanda
  // che ci si fa per prima, "sta migliorando?", prima ancora di guardare il
  // diario di oggi.
  { key: 'quadro', label: 'Quadro' },
  { key: 'diario', label: 'Diario sedute' },
  { key: 'clinica', label: 'Clinica' },
  { key: 'percorso', label: 'Percorso' },
  // I numeri dell'atleta: peso, altezza e i massimali con cui si prescrive il
  // carico. Stanno in una linguetta loro perche' si aprono di rado, e nel
  // percorso avrebbero allungato la pagina che si guarda tutti i giorni.
  { key: 'misure', label: 'Misure' }
]

function SchedaPaziente({
  paziente,
  patologie,
  scheda,
  onSchedaChange,
  onChanged,
  onDeleted,
  onNuovaSeduta,
  onApriSeduta,
  onDuplicaSeduta
}: {
  paziente: PazienteDettaglio
  patologie: Patologia[]
  // Quale linguetta e' aperta: vive nel componente sopra (PazientiPage), non
  // qui, perche' aprire una seduta smonta questo componente. Se lo stato
  // fosse qui dentro, tornando dalla seduta la scheda ripartirebbe sempre dal
  // quadro invece di restare sulla linguetta da cui si era partiti.
  scheda: SchedaAperta
  onSchedaChange: (s: SchedaAperta) => void
  onChanged: () => Promise<void> | void
  onDeleted: () => void
  onNuovaSeduta: () => void
  onApriSeduta: (id: number) => void
  onDuplicaSeduta: (id: number) => void
}): React.JSX.Element {
  const [fasi, setFasi] = useState<Fase[]>([])
  // Serve solo a sapere se c'e' una seduta da riprendere e quale.
  const [ultimaSeduta, setUltimaSeduta] = useState<number | null>(null)

  // Dipende dal paziente intero e non dal solo id: quando si salva una seduta
  // l'elenco dei pazienti si ricarica, l'oggetto cambia, e cosi' "Riprendi
  // l'ultima" punta davvero all'ultima.
  const [sedutePaziente, setSedutePaziente] = useState<SedutaRiepilogo[]>([])
  // Quante sedute aspettano il paziente: si vede sulla linguetta, senza entrare.
  const daFare = sedutePaziente.filter((s) => s.data > oggiIso()).length
  const [programma, setProgramma] = useState(false)

  const ricaricaUltima = useCallback((): void => {
    const oggi = oggiIso()
    void window.api.sedute
      .list(paziente.id)
      // le sedute programmate per i giorni a venire non sono "l'ultima": si
      // riparte da quella davvero svolta
      .then((righe) => {
        setSedutePaziente(righe)
        setUltimaSeduta(righe.find((s) => s.data <= oggi)?.id ?? null)
      })
  }, [paziente])

  useEffect(ricaricaUltima, [ricaricaUltima])

  useEffect(() => {
    if (paziente.patologia_id == null) {
      setFasi([])
      return
    }
    void window.api.fasi.list(paziente.patologia_id).then(setFasi)
  }, [paziente.patologia_id])

  const setPatologia = async (patologiaId: number | null): Promise<void> => {
    if (
      paziente.patologia_id != null &&
      patologiaId !== paziente.patologia_id &&
      !(await chiedi('Cambiare patologia? La fase corrente verrà azzerata.'))
    ) {
      return
    }
    try {
      await window.api.pazienti.setPatologiaFase(paziente.id, patologiaId, null)
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const setFase = async (faseId: number | null): Promise<void> => {
    try {
      await window.api.pazienti.setPatologiaFase(paziente.id, paziente.patologia_id, faseId)
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // L'avanzamento cammina solo sulle fasi di palestra: da Intermedia si passa
  // ad Avanzata, mai a una fase del campo, che e' un percorso parallelo.
  const fasiPalestra = fasi.filter((f) => f.campo !== 1)
  const idxFase = fasiPalestra.findIndex((f) => f.id === paziente.fase_corrente_id)
  // Se la fase corrente non e' nell'elenco (una fase del campo rimasta da prima)
  // non si sa da dove ripartire: niente "Avanza", si sceglie dall'elenco.
  const faseFuoriElenco = paziente.fase_corrente_id != null && idxFase < 0
  const prossima = faseFuoriElenco
    ? undefined
    : idxFase >= 0
      ? fasiPalestra[idxFase + 1]
      : fasiPalestra[0]

  const avanza = async (): Promise<void> => {
    if (!prossima) return
    const domanda =
      paziente.fase_corrente_id == null
        ? `Impostare "${prossima.nome}" come fase corrente di ${paziente.nome} ${paziente.cognome}?`
        : `Avanzare ${paziente.nome} ${paziente.cognome} a "${prossima.nome}"?\nLe nuove sedute useranno la struttura della nuova fase.`
    if (!(await chiedi(domanda))) return
    await setFase(prossima.id)
  }

  return (
    <div className="scheda">
      <AnagraficaPaziente paziente={paziente} onChanged={onChanged} onDeleted={onDeleted} />

      {/* I limiti da non superare, subito sotto al nome e sopra a tutto il
          resto: si scrivono nei dati del paziente e si rileggono qui senza
          doverli cercare. */}
      {paziente.precauzioni && (
        <p className="fascia-precauzioni">
          <AlertTriangle size={16} />
          {paziente.precauzioni}
        </p>
      )}

      {/* I due gesti di tutti i giorni restano sempre a portata di clic, in
          qualunque linguetta ti trovi: creare la seduta di oggi, o ripartire da
          quella di ieri invece di rifarla da zero. */}
      <div className="barra-scheda">
        <div className="config-tabs">
          {SCHEDE_PAZIENTE.map((t) => (
            <button
              key={t.key}
              className={scheda === t.key ? 'active' : ''}
              onClick={() => onSchedaChange(t.key)}
            >
              {t.label}
              {t.key === 'diario' && daFare > 0 && <span className="pallino-conta">{daFare}</span>}
            </button>
          ))}
        </div>
        <span className="row-actions">
          <button
            disabled={ultimaSeduta == null}
            title="Nuova seduta copiando l'ultima"
            onClick={() => ultimaSeduta != null && onDuplicaSeduta(ultimaSeduta)}
          >
            <Copy size={17} /> Riprendi l&apos;ultima
          </button>
          <button
            disabled={sedutePaziente.length === 0}
            title="Copia un programma su piu' giorni"
            onClick={() => setProgramma(true)}
          >
            <CalendarPlus size={17} /> Programma…
          </button>
          <button className="primary" onClick={onNuovaSeduta}>
            <Plus size={17} /> Nuova seduta
          </button>
        </span>
      </div>

      {programma && (
        <ProgrammaSettimana
          sedute={sedutePaziente}
          onChiudi={(create) => {
            setProgramma(false)
            if (create > 0) {
              ricaricaUltima()
              void onChanged()
            }
          }}
        />
      )}

      {scheda === 'quadro' && <QuadroPaziente paziente={paziente} />}

      {scheda === 'diario' && (
        <DiarioCard
          paziente={paziente}
          onNuova={onNuovaSeduta}
          onApri={onApriSeduta}
          onDuplica={onDuplicaSeduta}
        />
      )}

      {scheda === 'clinica' && (
        <>
          <AnamnesiPaziente paziente={paziente} />

          <ValutazionePaziente paziente={paziente} />

          <QuestionariPaziente paziente={paziente} />
        </>
      )}

      {scheda === 'percorso' && (
        <>
      <section className="card">
        <h3>Percorso riabilitativo</h3>
        {/* Patologia, fase e il pulsante che fa avanzare stanno su una riga
            sola: sono la stessa decisione, presa in tre passi. */}
        <div className="riga-percorso">
          <label className="field">
            Patologia
            <SceltaConRicerca
              voci={patologie}
              valore={paziente.patologia_id ?? ''}
              segnaposto="— nessuna —"
              vuoto="— nessuna —"
              onCambia={(id) => void setPatologia(id === '' ? null : id)}
            />
          </label>
          <label className="field campo-fase">
            Fase corrente
            <SceltaConRicerca
              voci={fasi
                .filter((f) => f.campo !== 1 || f.id === paziente.fase_corrente_id)
                .map((f) => ({ id: f.id, nome: f.nome }))}
              valore={paziente.fase_corrente_id ?? ''}
              disabled={paziente.patologia_id == null}
              segnaposto="— non impostata —"
              vuoto="— non impostata —"
              onCambia={(id) => void setFase(id === '' ? null : id)}
            />
          </label>
          {paziente.patologia_id != null && fasiPalestra.length > 0 && (
            <label className="field campo-avanza">
              {idxFase >= 0
                ? `Fase ${idxFase + 1} di ${fasiPalestra.length}`
                : faseFuoriElenco
                  ? 'Fase fuori dal percorso'
                  : 'Nessuna fase impostata'}
              <button disabled={!prossima} onClick={() => void avanza()}>
                {paziente.fase_corrente_id == null
                  ? 'Imposta prima fase'
                  : faseFuoriElenco
                    ? 'Scegli una fase di palestra'
                    : prossima
                      ? `Avanza a "${prossima.nome}" →`
                      : 'Ultima fase raggiunta'}
              </button>
            </label>
          )}
        </div>
        {paziente.patologia_id == null ? (
          <p className="hint">Assegna una patologia per impostare le fasi.</p>
        ) : fasi.length === 0 ? (
          <p className="hint">
            Questa patologia non ha fasi: definiscile in &ldquo;Patologie e fasi&rdquo;.
          </p>
        ) : null}
      </section>

      <ObiettiviCard paziente={paziente} />

      {/* Sta nel percorso perche' e' parte del programma: cosa deve fare a
          casa, ogni quanto, e come regolarsi. Finisce sul foglio che si porta
          via. */}
      <IndicazioniCasa paziente={paziente} onChanged={onChanged} />
        </>
      )}

      {scheda === 'misure' && (
        <>
          <MisurePaziente paziente={paziente} onChanged={onChanged} />
          {/* I segni stanno in fondo, chiusi: chi non li usa non li vede, e
              tante cose (il gonfiore, per dirne una) si scrivono meglio nelle
              note della seduta. */}
          <SegniPaziente paziente={paziente} />
        </>
      )}
    </div>
  )
}

// Obiettivi della fase corrente con stato "raggiunto" persistente sul paziente,
// più la checklist informativa dei test di avanzamento.
function ObiettiviCard({ paziente }: { paziente: PazienteDettaglio }): React.JSX.Element {
  const [test, setTest] = useState<TestValore[]>([])
  const [testAperti, setTestAperti] = useState(false)

  const faseId = paziente.fase_corrente_id

  const loadTest = async (): Promise<void> => {
    if (faseId == null) {
      setTest([])
      return
    }
    setTest(await window.api.pazienti.testValori(paziente.id, faseId))
  }

  useEffect(() => {
    void loadTest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paziente.id, faseId])

  const eseguiti = test.filter((t) => t.eseguito).length

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>Obiettivi della fase corrente</h3>
        {test.length > 0 && (
          <button onClick={() => setTestAperti(true)}>
            Test di avanzamento ({eseguiti}/{test.length})
          </button>
        )}
      </div>
      <ObiettiviFase pazienteId={paziente.id} faseId={faseId} />

      {testAperti && (
        <TestModal
          paziente={paziente}
          test={test}
          onClose={() => {
            setTestAperti(false)
            void loadTest()
          }}
        />
      )}
    </section>
  )
}

function TestModal({
  paziente,
  test,
  onClose
}: {
  paziente: PazienteDettaglio
  test: TestValore[]
  onClose: () => void
}): React.JSX.Element {
  const [righe, setRighe] = useState<TestValore[]>(test)

  const salva = async (riga: TestValore): Promise<void> => {
    try {
      await window.api.pazienti.setTestValore(
        paziente.id,
        riga.test_id,
        riga.eseguito === 1,
        riga.valore?.trim() || null
      )
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const aggiorna = (testId: number, patch: Partial<TestValore>, salvaSubito: boolean): void => {
    setRighe((prev) => {
      const next = prev.map((r) => (r.test_id === testId ? { ...r, ...patch } : r))
      if (salvaSubito) {
        const riga = next.find((r) => r.test_id === testId)
        if (riga) void salva(riga)
      }
      return next
    })
  }

  return (
    <Modale onConferma={onClose}>
        <h3>Test di avanzamento — {paziente.nome} {paziente.cognome}</h3>
        <p className="modal-testo">
          Checklist di supporto per valutare il passaggio di fase: spunta i test eseguiti e
          registra il valore. Non blocca l&apos;avanzamento, che resta una tua decisione.
        </p>
        <ul className="test-list">
          {righe.map((t) => (
            <li key={t.test_id}>
              <label className="test-check">
                <input
                  type="checkbox"
                  checked={t.eseguito === 1}
                  onChange={(e) =>
                    aggiorna(t.test_id, { eseguito: e.target.checked ? 1 : 0 }, true)
                  }
                />
                <span className={t.eseguito === 1 ? 'obiettivo-raggiunto' : ''}>{t.nome}</span>
              </label>
              <input
                className="test-valore"
                placeholder="valore…"
                value={t.valore ?? ''}
                onChange={(e) => aggiorna(t.test_id, { valore: e.target.value }, false)}
                onBlur={() => {
                  const riga = righe.find((r) => r.test_id === t.test_id)
                  if (riga) void salva(riga)
                }}
              />
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Chiudi
          </button>
        </div>
    </Modale>
  )
}

function DiarioCard({
  paziente,
  onNuova,
  onApri,
  onDuplica
}: {
  paziente: PazienteDettaglio
  onNuova: () => void
  onApri: (id: number) => void
  onDuplica: (id: number) => void
}): React.JSX.Element {
  const [sedute, setSedute] = useState<SedutaRiepilogo[]>([])
  const [periodo, setPeriodo] = useState<{ dal: string; al: string } | null>(null)
  const [menuScarica, setMenuScarica] = useState<number | null>(null)
  const [anteprima, setAnteprima] = useState<number | null>(null)

  const load = async (): Promise<void> => setSedute(await window.api.sedute.list(paziente.id))

  // Una seduta e' "programmata" se la sua data deve ancora arrivare: nessuno
  // stato da mettere a mano, la data basta. Le programmate si leggono dalla piu'
  // vicina, le svolte dalla piu' recente.
  const oggi = oggiIso()
  // Il lavoro al campo va in parallelo a quello in palestra: sta in un elenco
  // suo, che compare solo per chi ce l'ha. Dentro a ognuno dei due, le
  // programmate stanno sopra alle svolte.
  const inPalestra = sedute.filter((s) => s.fase_campo !== 1)
  const alCampo = sedute.filter((s) => s.fase_campo === 1)
  const programmate = inPalestra
    .filter((s) => s.data > oggi)
    .sort((a, b) => a.data.localeCompare(b.data))
  const fatte = inPalestra.filter((s) => s.data <= oggi)
  const campoProgrammate = alCampo
    .filter((s) => s.data > oggi)
    .sort((a, b) => a.data.localeCompare(b.data))
  const campoFatte = alCampo.filter((s) => s.data <= oggi)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paziente.id])

  const elimina = async (s: SedutaRiepilogo): Promise<void> => {
    if (!(await chiedi(`Eliminare la seduta del ${formatData(s.data)}?`))) return
    try {
      await window.api.sedute.remove(s.id)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const esportaSingola = async (
    id: number,
    formato: 'pdf' | 'docx',
    illustrata = false
  ): Promise<void> => {
    try {
      const path = await window.api.esporta.seduta(id, formato, illustrata)
      if (path) toast(`Seduta esportata${formato === 'pdf' ? ' in PDF' : ' in Word'}.`)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const esportaPeriodo = async (formato: 'pdf' | 'docx'): Promise<void> => {
    if (!periodo) return
    if (periodo.dal > periodo.al) {
      toastErrore('Intervallo non valido: la data "dal" è successiva ad "al".')
      return
    }
    try {
      const path = await window.api.esporta.storico(paziente.id, periodo.dal, periodo.al, formato)
      if (path) {
        setPeriodo(null)
        toast('Storico esportato.')
      }
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // La riga di una seduta si disegna una volta sola: la usano l'elenco delle
  // svolte e quello delle programmate.
  const riga = (s: SedutaRiepilogo): React.JSX.Element => (
          <li key={s.id}>
            <div className="seduta-info">
              <span className="seduta-data">{formatData(s.data)}</span>
              {/* Fase e focus sulla stessa riga: il focus in evidenza, perche'
                  e' quello che distingue due sedute della stessa fase. */}
              <span className="seduta-meta">
                {s.fase_nome ?? 'senza fase'}
                {s.focus && <span className="seduta-focus">{s.focus}</span>}
                {s.dolore != null && ` · dolore ${s.dolore}/10`}
              </span>
              {/* Sotto alla data, il trattamento fatto. */}
              {(s.tecniche_nomi || s.trattamento) && (
                <span className="riga-diario-elenco">
                  <span className="etichetta-diario">Trattamento</span>
                  {[s.tecniche_nomi, s.trattamento].filter(Boolean).join(' — ')}
                </span>
              )}
            </div>
            <span className="row-actions">
              <button
                title="Mostra la scheda al paziente (si apre in una finestra a parte)"
                onClick={() => void window.api.scheda.apri(s.id).catch((e) => toastErrore(errMsg(e)))}
              >
                <Presentation size={18} />
              </button>
              <button
                title="Scheda illustrata per il paziente (foto e spiegazioni)"
                onClick={() => setAnteprima(s.id)}
              >
                <Images size={18} />
              </button>
              <button title="Modifica la seduta" onClick={() => onApri(s.id)}>
                <Pencil size={18} />
              </button>
              <button title="Nuova seduta partendo da questa" onClick={() => onDuplica(s.id)}>
                <Copy size={18} />
              </button>
              <span className="menu-wrapper">
                <button
                  title="Scarica la seduta"
                  onClick={() => setMenuScarica(menuScarica === s.id ? null : s.id)}
                >
                  <Download size={18} />
                </button>
                {menuScarica === s.id && (
                  <>
                    <div className="menu-chiudi" onClick={() => setMenuScarica(null)} />
                    <div className="menu-tendina">
                      <button
                        onClick={() => {
                          setMenuScarica(null)
                          void esportaSingola(s.id, 'pdf')
                        }}
                      >
                        <FileText size={18} /> Scarica PDF
                      </button>
                      <button
                        onClick={() => {
                          setMenuScarica(null)
                          void esportaSingola(s.id, 'docx')
                        }}
                      >
                        <FileText size={18} /> Scarica Word
                      </button>
                    </div>
                  </>
                )}
              </span>
              <button className="danger" title="Elimina" onClick={() => void elimina(s)}>
                <Trash2 size={18} />
              </button>
            </span>
          </li>
  )

  return (
    <section className="card">
      <div className="card-header-row">
        {/* Il titolo e il pulsante "Nuova seduta" stanno gia' nella barra qui
            sopra: ripeterli dentro al riquadro era solo rumore. */}
        <h3>Sedute</h3>
        <span className="row-actions">
          {sedute.length > 0 && (
            <button
              onClick={() =>
                setPeriodo({ dal: sedute[sedute.length - 1].data, al: sedute[0].data })
              }
            >
              Esporta sedute
            </button>
          )}
        </span>
      </div>
      {/* Le sedute con la data di domani in poi sono quelle che hai preparato:
          stanno sopra, in ordine di quando toccano, cosi' si vede a colpo
          d'occhio cosa aspetta il paziente. */}
      {programmate.length > 0 && (
        <div className="blocco-programmate">
          <div className="sotto-titolo">Programmate</div>
          <ul className="sedute-list">{programmate.map(riga)}</ul>
        </div>
      )}
      {fatte.length === 0 ? (
        <p className="hint">
          {programmate.length > 0
            ? 'Nessuna seduta svolta finora: quelle qui sopra sono programmate.'
            : 'Nessuna seduta ancora: creane una — si aprirà già sulla fase corrente del paziente.'}
        </p>
      ) : (
        <ul className="sedute-list">{fatte.map(riga)}</ul>
      )}

      {/* Il campo: un riquadro a parte, che c'e' solo per chi ha quel percorso
          (in pratica i crociati). Per tutti gli altri la scheda resta identica. */}
      {alCampo.length > 0 && (
        <div className="blocco-campo">
          <div className="sotto-titolo">Al campo</div>
          {campoProgrammate.length > 0 && (
            <ul className="sedute-list">{campoProgrammate.map(riga)}</ul>
          )}
          {campoFatte.length > 0 && <ul className="sedute-list">{campoFatte.map(riga)}</ul>}
        </div>
      )}

      {periodo && (
        // Invio e clic fuori valgono come il pulsante "primary" (Esporta
        // PDF): non c'e' nulla da perdere, e' solo l'esportazione di un file.
        <Modale className="modal-sm" onConferma={() => void esportaPeriodo('pdf')}>
            <h3>Esporta storico sedute</h3>
            <div className="form-row-2">
              <label>
                Dal
                <input
                  type="date"
                  value={periodo.dal}
                  onChange={(e) => setPeriodo({ ...periodo, dal: e.target.value })}
                />
              </label>
              <label>
                Al
                <input
                  type="date"
                  value={periodo.al}
                  onChange={(e) => setPeriodo({ ...periodo, al: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setPeriodo(null)}>Annulla</button>
              <button onClick={() => void esportaPeriodo('docx')}>Esporta Word</button>
              <button className="primary" onClick={() => void esportaPeriodo('pdf')}>
                Esporta PDF
              </button>
            </div>
        </Modale>
      )}

      {anteprima != null && (
        <SchedaIllustrata
          sedutaId={anteprima}
          onClose={() => setAnteprima(null)}
          onScarica={() => void esportaSingola(anteprima, 'pdf', true)}
        />
      )}
    </section>
  )
}

// La scheda illustrata per il paziente: foto, spiegazione e link al video. Si
// guarda com'e' venuta e da qui si scarica in PDF. E' lo stesso HTML del file,
// cosi' l'anteprima non puo' discostarsi da quello che consegni.
// Va in un iframe con sandbox vuota: nessuno script puo' girare li' dentro.
function SchedaIllustrata({
  sedutaId,
  onClose,
  onScarica
}: {
  sedutaId: number
  onClose: () => void
  onScarica: () => void
}): React.JSX.Element {
  const [dati, setDati] = useState<AnteprimaScheda | null>(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    let annullato = false
    window.api.esporta
      .schedaIllustrata(sedutaId)
      .then((d) => {
        if (!annullato) setDati(d)
      })
      .catch((e) => {
        if (!annullato) setErrore(errMsg(e))
      })
    return () => {
      annullato = true
    }
  }, [sedutaId])

  // Foto e spiegazione si impostano una volta per esercizio, in Configurazione:
  // qui si dice solo quali mancano, senza sporcare la scheda.
  const manca = (etichetta: string, nomi: string[]): React.JSX.Element | null =>
    nomi.length === 0 ? null : (
      <p className="avviso-scheda">
        <AlertTriangle size={15} />
        <span>
          {etichetta}: {[...new Set(nomi)].join(', ')}. Puoi aggiungerla in Configurazione →
          Esercizi.
        </span>
      </p>
    )

  return (
    <Modale className="modal-lg" onConferma={onClose}>
        <h3>Scheda illustrata per il paziente</h3>
        {errore ? (
          <p className="auth-error">{errore}</p>
        ) : dati == null ? (
          <p className="hint">Caricamento…</p>
        ) : (
          <>
            {manca('Senza foto', dati.senzaFoto)}
            {manca('Senza spiegazione', dati.senzaSpiegazione)}
            <iframe
              className="anteprima-frame"
              title="Scheda illustrata"
              sandbox=""
              srcDoc={dati.html}
            />
          </>
        )}
        <div className="modal-actions">
          <button onClick={onScarica}>
            <Download size={16} /> Scarica PDF
          </button>
          <button className="primary" onClick={onClose}>
            Chiudi
          </button>
        </div>
    </Modale>
  )
}
