import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronRight,
  Filter,
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
  Obiettivo,
  Patologia,
  PazienteDettaglio,
  SedutaRiepilogo,
  TestValore
} from '../../../shared/types'
import SedutaBuilder from '../components/SedutaBuilder'
import QuestionariPaziente from '../components/QuestionariPaziente'
import AnagraficaPaziente, { ModaleDatiPaziente } from '../components/AnagraficaPaziente'
import AnamnesiPaziente from '../components/AnamnesiPaziente'
import ValutazionePaziente from '../components/ValutazionePaziente'
import { toast, toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg, formatData } from '../lib'
import { useScorciatoie } from '../scorciatoie'

export default function PazientiPage({
  tornaAllElenco,
  apriPaziente
}: {
  // Cambia ogni volta che si ripreme "Pazienti e sedute" nel menu a sinistra.
  tornaAllElenco: number
  // Scheda da aprire, richiesta da un'altra sezione (il follow-up).
  apriPaziente: { id: number; seq: number } | null
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
  const [nuovo, setNuovo] = useState(false)
  const [builder, setBuilder] = useState<{ sedutaId: number | null; duplicaDa?: number } | null>(
    null
  )

  const load = async (): Promise<void> => setPazienti(await window.api.pazienti.list())

  useEffect(() => {
    void load()
    void window.api.patologie.list().then(setPatologie)
  }, [])

  // Lo stato del builder letto dentro l'effetto senza farlo scattare: se fosse
  // fra le dipendenze, chiudere una seduta chiuderebbe anche la scheda.
  const builderAperto = useRef(builder)
  builderAperto.current = builder

  // Torna all'elenco solo dalla scheda del paziente. Mentre si costruisce una
  // seduta non si esce da qui: il lavoro non salvato si perderebbe senza che
  // nessuno lo abbia chiesto, e per uscire c'e' gia' "Annulla".
  useEffect(() => {
    if (tornaAllElenco === 0) return
    if (builderAperto.current == null) setSelId(null)
  }, [tornaAllElenco])

  // Arrivando da un'altra sezione si apre la scheda chiesta. Se era rimasta
  // aperta la costruzione di una seduta la si chiude: mostrerebbe il programma
  // di un paziente sotto il nome di un altro.
  useEffect(() => {
    if (apriPaziente == null) return
    setBuilder(null)
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
  // L'elenco arriva gia' ordinato per seduta piu' recente. Se ne mostrano dieci
  // e il resto va sotto, richiudibile: cercando invece si vede tutto, cosi'
  // nessun paziente diventa difficile da raggiungere.
  const IN_VISTA = 10
  const tutti = q !== '' || filtriAttivi
  const inVista = tutti ? trovati : trovati.slice(0, IN_VISTA)
  const altri = tutti ? [] : trovati.slice(IN_VISTA)
  const sel = pazienti.find((p) => p.id === selId) ?? null

  // Il nome del paziente aperto finisce nel titolo della finestra: con piu'
  // finestre aperte, sulla barra di Windows si distinguono.
  useEffect(() => {
    document.title = sel
      ? `Riabilitazione — ${sel.cognome} ${sel.nome}`
      : 'Riabilitazione Sportiva'
    return () => {
      document.title = 'Riabilitazione Sportiva'
    }
  }, [sel])

  // Il paziente arriva, si apre l'elenco e si comincia: senza passare dalla sua
  // scheda. E' il gesto piu' ripetuto della giornata.
  const nuovaSedutaPer = (pazienteId: number): void => {
    setSelId(pazienteId)
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
        onClose={(salvata) => {
          setBuilder(null)
          if (salvata) void load()
        }}
      />
    )
  }

  return (
    <div className="page step-flow">
      <header className="page-header">
        <h2>Pazienti</h2>
        <p>
          Ogni paziente ha la sua patologia e una fase corrente che resta memorizzata: le nuove
          sedute si apriranno già nella fase giusta, e sei tu a farla avanzare quando il paziente è
          pronto.
        </p>
      </header>

      {sel && (
        <div className="briciole">
          <button className="briciola" onClick={() => setSelId(null)}>
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
          onChanged={load}
          onDeleted={() => {
            setSelId(null)
            void load()
          }}
          onNuovaSeduta={() => setBuilder({ sedutaId: null })}
          onApriSeduta={(id) => setBuilder({ sedutaId: id })}
          onDuplicaSeduta={(id) => setBuilder({ sedutaId: null, duplicaDa: id })}
        />
      ) : (
        <section className="card step-card colonna-centrata">
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
            <button
              className="primary btn-icona"
              title="Nuovo paziente"
              onClick={() => setNuovo(true)}
            >
              <Plus size={18} />
            </button>
          </div>

          {(filtriAperti || filtriAttivi) && (
            <div className="pannello-filtri">
              <label className="compila-data">
                Patologia
                <select
                  value={filtroPatologia}
                  onChange={(e) =>
                    setFiltroPatologia(e.target.value === '' ? '' : Number(e.target.value))
                  }
                >
                  <option value="">tutte</option>
                  {patologie.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
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

          <div className="elenco-verticale">
            {inVista.map((p) => (
              <div key={p.id} className="scelta-tile" onClick={() => setSelId(p.id)}>
                <span className="scelta-tile-nome">
                  {p.cognome} {p.nome}
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
            ))}
          </div>

          {altri.length > 0 && (
            <details className="blocco-apribile blocco-archivio">
              <summary>Meno recenti ({altri.length})</summary>
              <div className="contenuto-apribile">
                <div className="elenco-verticale">
                  {altri.map((p) => (
                    <div key={p.id} className="scelta-tile" onClick={() => setSelId(p.id)}>
                      <span className="scelta-tile-nome">
                        {p.cognome} {p.nome}
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
                  ))}
                </div>
              </div>
            </details>
          )}

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

type SchedaAperta = 'diario' | 'clinica' | 'percorso'

const SCHEDE_PAZIENTE: { key: SchedaAperta; label: string }[] = [
  { key: 'diario', label: 'Diario sedute' },
  { key: 'clinica', label: 'Clinica' },
  { key: 'percorso', label: 'Percorso' }
]

function SchedaPaziente({
  paziente,
  patologie,
  onChanged,
  onDeleted,
  onNuovaSeduta,
  onApriSeduta,
  onDuplicaSeduta
}: {
  paziente: PazienteDettaglio
  patologie: Patologia[]
  onChanged: () => Promise<void> | void
  onDeleted: () => void
  onNuovaSeduta: () => void
  onApriSeduta: (id: number) => void
  onDuplicaSeduta: (id: number) => void
}): React.JSX.Element {
  const [fasi, setFasi] = useState<Fase[]>([])
  // La scheda si apre sul diario: e' quello che si guarda tutti i giorni.
  // L'anamnesi e la valutazione si riempiono alla prima visita e poi si
  // consultano di rado, quindi stanno dietro alla loro linguetta invece di
  // allungare la pagina.
  const [scheda, setScheda] = useState<SchedaAperta>('diario')
  // Serve solo a sapere se c'e' una seduta da riprendere e quale.
  const [ultimaSeduta, setUltimaSeduta] = useState<number | null>(null)

  // Dipende dal paziente intero e non dal solo id: quando si salva una seduta
  // l'elenco dei pazienti si ricarica, l'oggetto cambia, e cosi' "Riprendi
  // l'ultima" punta davvero all'ultima.
  const ricaricaUltima = useCallback((): void => {
    void window.api.sedute
      .list(paziente.id)
      .then((righe) => setUltimaSeduta(righe[0]?.id ?? null))
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

  const idxFase = fasi.findIndex((f) => f.id === paziente.fase_corrente_id)
  const prossima = idxFase >= 0 ? fasi[idxFase + 1] : fasi[0]

  const avanza = async (): Promise<void> => {
    if (!prossima) return
    const domanda =
      paziente.fase_corrente_id == null
        ? `Impostare "${prossima.nome}" come fase corrente di ${paziente.nome} ${paziente.cognome}?`
        : `Avanzare ${paziente.nome} ${paziente.cognome} a "${prossima.nome}"?\nLe nuove sedute useranno la struttura della nuova fase.`
    if (!(await chiedi(domanda))) return
    await setFase(prossima.id)
  }

  const elimina = async (): Promise<void> => {
    if (
      !(await chiedi(
        `Eliminare ${paziente.nome} ${paziente.cognome}?\nVerranno eliminate anche tutte le sue sedute (diario).`
      ))
    ) {
      return
    }
    try {
      await window.api.pazienti.remove(paziente.id)
      onDeleted()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="scheda">
      <AnagraficaPaziente paziente={paziente} onChanged={onChanged} onDeleted={onDeleted} />

      {/* I due gesti di tutti i giorni restano sempre a portata di clic, in
          qualunque linguetta ti trovi: creare la seduta di oggi, o ripartire da
          quella di ieri invece di rifarla da zero. */}
      <div className="barra-scheda">
        <div className="config-tabs">
          {SCHEDE_PAZIENTE.map((t) => (
            <button
              key={t.key}
              className={scheda === t.key ? 'active' : ''}
              onClick={() => setScheda(t.key)}
            >
              {t.label}
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
          <button className="primary" onClick={onNuovaSeduta}>
            <Plus size={17} /> Nuova seduta
          </button>
        </span>
      </div>

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
            <select
              value={paziente.patologia_id ?? ''}
              onChange={(e) =>
                void setPatologia(e.target.value === '' ? null : Number(e.target.value))
              }
            >
              <option value="">— nessuna —</option>
              {patologie.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field campo-fase">
            Fase corrente
            <select
              value={paziente.fase_corrente_id ?? ''}
              disabled={paziente.patologia_id == null}
              onChange={(e) => void setFase(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">— non impostata —</option>
              {fasi.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          {paziente.patologia_id != null && fasi.length > 0 && (
            <label className="field campo-avanza">
              {idxFase >= 0 ? `Fase ${idxFase + 1} di ${fasi.length}` : 'Nessuna fase impostata'}
              <button disabled={!prossima} onClick={() => void avanza()}>
                {paziente.fase_corrente_id == null
                  ? 'Imposta prima fase'
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
        </>
      )}
    </div>
  )
}

// Obiettivi della fase corrente con stato "raggiunto" persistente sul paziente,
// più la checklist informativa dei test di avanzamento.
function ObiettiviCard({ paziente }: { paziente: PazienteDettaglio }): React.JSX.Element {
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([])
  const [raggiunti, setRaggiunti] = useState<number[]>([])
  const [test, setTest] = useState<TestValore[]>([])
  const [testAperti, setTestAperti] = useState(false)

  const faseId = paziente.fase_corrente_id

  const load = async (): Promise<void> => {
    if (faseId == null) {
      setObiettivi([])
      setRaggiunti([])
      setTest([])
      return
    }
    const [obs, ragg, tst] = await Promise.all([
      window.api.obiettivi.list(faseId),
      window.api.pazienti.obiettiviRaggiunti(paziente.id),
      window.api.pazienti.testValori(paziente.id, faseId)
    ])
    setObiettivi(obs)
    setRaggiunti(ragg)
    setTest(tst)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paziente.id, faseId])

  const toggle = async (obiettivoId: number, raggiunto: boolean): Promise<void> => {
    try {
      await window.api.pazienti.setObiettivoRaggiunto(paziente.id, obiettivoId, raggiunto)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

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
      {faseId == null ? (
        <p className="hint">Imposta la fase corrente per vedere gli obiettivi.</p>
      ) : obiettivi.length === 0 ? (
        <p className="hint">
          Questa fase non ha obiettivi: definiscili in configurazione, &ldquo;Patologie e
          fasi&rdquo;.
        </p>
      ) : (
        <ul className="checkbox-list">
          {obiettivi.map((o) => {
            const fatto = raggiunti.includes(o.id)
            return (
              <li key={o.id}>
                <label className={fatto ? 'obiettivo-raggiunto' : ''}>
                  <input
                    type="checkbox"
                    checked={fatto}
                    onChange={(e) => void toggle(o.id, e.target.checked)}
                  />
                  {o.nome}
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {testAperti && (
        <TestModal
          paziente={paziente}
          test={test}
          onClose={() => {
            setTestAperti(false)
            void load()
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
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
      {sedute.length === 0 ? (
        <p className="hint">
          Nessuna seduta ancora: creane una — si aprirà già sulla fase corrente del paziente.
        </p>
      ) : (
        <ul className="sedute-list">
          {sedute.map((s) => (
            <li key={s.id}>
              <div className="seduta-info">
                <span className="seduta-data">{formatData(s.data)}</span>
                <span className="seduta-meta">
                  {s.fase_nome ?? 'senza fase'} · {s.num_esercizi}{' '}
                  {s.num_esercizi === 1 ? 'esercizio' : 'esercizi'}
                </span>
                {s.obiettivi_nomi && <span className="seduta-obiettivi">{s.obiettivi_nomi}</span>}
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
          ))}
        </ul>
      )}

      {periodo && (
        <div className="modal-overlay" onClick={() => setPeriodo(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  )
}
