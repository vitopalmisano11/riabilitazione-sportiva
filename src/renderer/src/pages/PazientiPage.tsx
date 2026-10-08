import Tendina from '../components/Tendina'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Filter, Plus } from 'lucide-react'
import type { Gruppo, Patologia, PazienteDettaglio } from '../../../shared/types'
import SedutaBuilder from '../components/SedutaBuilder'
import { ModaleDatiPaziente } from '../components/AnagraficaPaziente'
import SceltaConRicerca from '../components/SceltaConRicerca'
import { formatData } from '../lib'
import { useScorciatoie } from '../scorciatoie'
import { SchedaAperta, SchedaPaziente } from './paziente/SchedaPaziente'

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
  onEsciDallaSeduta,
  onSedutaSalvata
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
  // Salvata una seduta si torna alla settimana, da qualunque parte si sia partiti.
  onSedutaSalvata?: () => void
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

  // Premendo "Pazienti" nel menu si torna all'elenco da qualunque
  // punto, anche dalla costruzione di una seduta. Per una seduta nuova non si
  // perde niente: la bozza e' gia' messa da parte e viene riproposta. Per una
  // seduta gia' salvata che si stava modificando, SedutaBuilder si salva da
  // solo smontandosi (vedi useSalvaUscendo li' dentro): non c'e' piu' niente
  // da chiedere prima di uscire.
  useEffect(() => {
    if (tornaAllElenco === 0) return
    setBuilder(null)
    setSelId(null)
    void load()
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
          if (salvata) {
            void load()
            onSedutaSalvata?.()
          } else if (tornaIndietro) {
            onEsciDallaSeduta?.()
          }
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
                <Tendina
                  value={filtroStato}
                  onChange={(e) =>
                    setFiltroStato(e.target.value as '' | 'trattamento' | 'concluso')
                  }
                >
                  <option value="">tutti</option>
                  <option value="trattamento">in trattamento</option>
                  <option value="concluso">concluso</option>
                </Tendina>
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
