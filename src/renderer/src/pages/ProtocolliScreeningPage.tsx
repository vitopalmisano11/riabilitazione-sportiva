import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronLeft, Copy, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import type {
  CategoriaQuestionario,
  CategoriaTest,
  ProtocolloScreening,
  ProtocolloScreeningCompleto,
  Questionario,
  SezioneScreening,
  TestValutazione,
  VoceScreening
} from '../../../shared/types'
import { toast, toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg } from '../lib'

// Protocolli di screening, uno per sport: qui si programmano, non si eseguono.
// L'esecuzione su un paziente sta nella sezione "Screening e RTP".
//
// Qui non si scrivono test: si scelgono quelli che stanno gia' nella libreria
// ("Test di valutazione") e i questionari, si mettono in ordine e si dividono
// in sezioni. Un test descritto una volta sola vale per tutti i protocolli, e
// i risultati restano confrontabili.
//
// Le sezioni nascono come "In ambulatorio" e "In campo" perche' e' la divisione
// piu' comune, ma sono nomi come gli altri. Stanno su due colonne, cosi' le due
// meta' dello screening si guardano insieme: per questo non c'e' il
// trascinamento, l'ordine lo da' la posizione sullo schermo.

// Gli id negativi sono di sezioni e voci non ancora salvate: negativi e stabili
// per tutta la sessione, come nei questionari.
let prossimoIdTemporaneo = -1
const idTemporaneo = (): number => prossimoIdTemporaneo--

export default function ProtocolliScreeningPage({
  tornaAllElenco
}: {
  // Cambia quando si ripreme "Screening" nel menu: si chiude il protocollo
  // aperto e si torna all'elenco.
  tornaAllElenco: number
}): React.JSX.Element {
  const [protocolli, setProtocolli] = useState<ProtocolloScreening[]>([])
  const [apertoId, setApertoId] = useState<number | null>(null)
  const [nuovo, setNuovo] = useState<{ nome: string; sport: string } | null>(null)
  const [sportNoti, setSportNoti] = useState<string[]>([])
  // Protocollo in rinomina: id e nome mentre lo si scrive.
  const [rinomina, setRinomina] = useState<{ id: number; nome: string } | null>(null)

  const carica = useCallback(async (): Promise<void> => {
    try {
      setProtocolli(await window.api.screening.list(null))
      setSportNoti(await window.api.screening.sport())
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [])

  useEffect(() => {
    void carica()
  }, [carica])

  useEffect(() => {
    if (tornaAllElenco === 0) return
    setApertoId(null)
  }, [tornaAllElenco])

  const crea = async (): Promise<void> => {
    if (!nuovo || nuovo.nome.trim() === '' || nuovo.sport.trim() === '') return
    try {
      const id = await window.api.screening.create(nuovo.nome, nuovo.sport)
      setNuovo(null)
      await carica()
      setApertoId(id)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const duplica = async (p: ProtocolloScreening): Promise<void> => {
    const nome = prompt('Nome della copia', `${p.nome} (copia)`)
    if (!nome?.trim()) return
    try {
      const id = await window.api.screening.duplica(p.id, nome)
      await carica()
      setApertoId(id)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const salvaNome = async (): Promise<void> => {
    if (!rinomina || rinomina.nome.trim() === '') return
    try {
      await window.api.screening.rinomina(rinomina.id, rinomina.nome)
      setRinomina(null)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (p: ProtocolloScreening): Promise<void> => {
    if (!(await chiedi(`Eliminare il protocollo "${p.nome}"?\nI test nella libreria restano.`))) return
    try {
      await window.api.screening.remove(p.id)
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Il protocollo aperto prende tutta la pagina: costruirlo e' un lavoro a se',
  // e l'elenco a fianco toglierebbe spazio alle due colonne delle sezioni.
  if (apertoId != null) {
    return (
      <Editor
        key={apertoId}
        id={apertoId}
        onIndietro={() => setApertoId(null)}
        onSalvato={carica}
      />
    )
  }

  // Un'intestazione per sport, cosi' l'elenco resta leggibile anche con dieci
  // protocolli.
  const sport = protocolli.map((p) => p.sport).filter((s, i, a) => a.indexOf(s) === i)

  return (
    <div className="page">
      <header className="page-header">
        <h2>Screening</h2>
        <p>
          Un protocollo raccoglie test e questionari che hai già in libreria, divisi in sezioni.
          I test si scrivono in Configurazione, &ldquo;Test di valutazione&rdquo;: qui si scelgono
          e si ordinano.
        </p>
      </header>

      <div className="scheda">
        <section className="card">
          <div className="card-header-row">
            <h3>Protocolli</h3>
            <span className="row-actions">
              <button
                className="primary"
                title="Nuovo protocollo"
                onClick={() => setNuovo({ nome: '', sport: '' })}
              >
                <Plus size={18} />
              </button>
            </span>
          </div>
          {protocolli.length === 0 ? (
            <p className="hint">
              Nessun protocollo. Creane uno col + qui sopra: sceglierai i test fra quelli che hai
              in libreria.
            </p>
          ) : (
            sport.map((s) => (
              // Lo sport a sinistra e i suoi protocolli sulla stessa riga: si
              // legge come un indice, non come un elenco di titoli.
              <div key={s} className="riga-sport">
                <div className="nome-sport">{s}</div>
                <ul className="protocolli-sport">
                  {protocolli
                    .filter((p) => p.sport === s)
                    .map((p) => (
                      <li key={p.id}>
                        {rinomina?.id === p.id ? (
                          <>
                            <input
                              autoFocus
                              value={rinomina.nome}
                              onChange={(e) => setRinomina({ ...rinomina, nome: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void salvaNome()
                                if (e.key === 'Escape') setRinomina(null)
                              }}
                            />
                            <span className="row-actions">
                              <button
                                className="primary"
                                title="Salva il nome"
                                disabled={rinomina.nome.trim() === ''}
                                onClick={() => void salvaNome()}
                              >
                                <Check size={18} />
                              </button>
                              <button title="Annulla" onClick={() => setRinomina(null)}>
                                <X size={18} />
                              </button>
                            </span>
                          </>
                        ) : (
                          <>
                            <button
                              className="nome-cliccabile"
                              title="Apri il protocollo"
                              onClick={() => setApertoId(p.id)}
                            >
                              {p.nome}
                            </button>
                            {p.note && <span className="seduta-meta">{p.note}</span>}
                            <span className="row-actions">
                              <button
                                title="Cambia nome"
                                onClick={() => setRinomina({ id: p.id, nome: p.nome })}
                              >
                                <Pencil size={18} />
                              </button>
                              <button title="Duplica" onClick={() => void duplica(p)}>
                                <Copy size={18} />
                              </button>
                              <button
                                className="danger"
                                title="Elimina"
                                onClick={() => void elimina(p)}
                              >
                                <Trash2 size={18} />
                              </button>
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {nuovo && (
          <section className="card">
            <h3>Nuovo protocollo</h3>
            <div className="form-row-2">
              <label>
                Sport
                <input
                  list="sport-noti"
                  placeholder="es. Calcio"
                  value={nuovo.sport}
                  onChange={(e) => setNuovo({ ...nuovo, sport: e.target.value })}
                />
                <datalist id="sport-noti">
                  {sportNoti.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label>
                Nome del protocollo
                <input
                  placeholder="es. Screening off season"
                  value={nuovo.nome}
                  onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setNuovo(null)}>Annulla</button>
              <button
                className="primary"
                disabled={nuovo.nome.trim() === '' || nuovo.sport.trim() === ''}
                onClick={() => void crea()}
              >
                Crea
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Editor({
  id,
  onIndietro,
  onSalvato
}: {
  id: number
  onIndietro: () => void
  onSalvato: () => Promise<void>
}): React.JSX.Element {
  const [dati, setDati] = useState<ProtocolloScreeningCompleto | null>(null)
  const [test, setTest] = useState<TestValutazione[]>([])
  const [questionari, setQuestionari] = useState<Questionario[]>([])
  const [catTest, setCatTest] = useState<CategoriaTest[]>([])
  const [catQuest, setCatQuest] = useState<CategoriaQuestionario[]>([])
  // Categoria scelta nelle due tendine: con molti test in libreria scorrerli
  // tutti sarebbe impraticabile.
  const [filtroTest, setFiltroTest] = useState<number | ''>('')
  const [filtroQuest, setFiltroQuest] = useState<number | ''>('')
  const [modificato, setModificato] = useState(false)
  const [aggiungiA, setAggiungiA] = useState<number | null>(null)

  useEffect(() => {
    window.api.screening
      .get(id)
      .then(setDati)
      .catch((e) => toastErrore(errMsg(e)))
    void window.api.testValutazione.list(false).then(setTest)
    void window.api.questionari.list(false).then(setQuestionari)
    void window.api.testCategorie.list().then(setCatTest)
    void window.api.questionariCategorie.list().then(setCatQuest)
  }, [id])

  if (!dati) return <p className="hint">Caricamento…</p>

  const aggiorna = (sezioni: SezioneScreening[]): void => {
    setDati({ ...dati, sezioni })
    setModificato(true)
  }

  const cambiaProtocollo = (patch: Partial<ProtocolloScreening>): void => {
    setDati({ ...dati, protocollo: { ...dati.protocollo, ...patch } })
    setModificato(true)
  }

  const cambiaSezione = (i: number, patch: Partial<SezioneScreening>): void =>
    aggiorna(dati.sezioni.map((s, k) => (k === i ? { ...s, ...patch } : s)))

  const salva = async (): Promise<void> => {
    try {
      await window.api.screening.salva(dati)
      setDati(await window.api.screening.get(id))
      setModificato(false)
      await onSalvato()
      toast('Protocollo salvato.')
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const indietro = async (): Promise<void> => {
    if (modificato && !(await chiedi('Ci sono modifiche non salvate. Uscire lo stesso?'))) return
    onIndietro()
  }

  // Un test o un questionario gia' presente non si ripropone: nello stesso
  // protocollo non ha senso eseguirlo due volte.
  const giaDentro = new Set(
    dati.sezioni.flatMap((s) =>
      s.voci.map((v) => (v.test_id != null ? `t${v.test_id}` : `q${v.questionario_id}`))
    )
  )

  // Il nome viaggia con la voce gia' prima di salvare: altrimenti la riga
  // appena aggiunta resterebbe vuota — era il trattino che vedevi.
  const aggiungiVoce = (i: number, voce: VoceScreening): void => {
    cambiaSezione(i, { voci: [...dati.sezioni[i].voci, { ...voce, id: idTemporaneo() }] })
    setAggiungiA(null)
  }

  return (
    <div className="page">
      <header className="page-header builder-header">
        <h2>
          {dati.protocollo.nome}
          {dati.protocollo.sport && (
            <span className="titolo-sport"> · {dati.protocollo.sport}</span>
          )}
        </h2>
        <span className="row-actions">
          <button onClick={() => void indietro()}>
            <ChevronLeft size={18} /> Tutti i protocolli
          </button>
          <button className="primary" disabled={!modificato} onClick={() => void salva()}>
            <Save size={16} /> Salva
          </button>
        </span>
      </header>

      <div className="testata-protocollo">
        <div className="form-row-2">
          <label>
            Sport
            <input
              value={dati.protocollo.sport}
              onChange={(e) => cambiaProtocollo({ sport: e.target.value })}
            />
          </label>
          <label>
            Nome del protocollo
            <input
              value={dati.protocollo.nome}
              onChange={(e) => cambiaProtocollo({ nome: e.target.value })}
            />
          </label>
        </div>
        <label className="campo-note">
          Note (facoltative)
          <textarea
            rows={2}
            placeholder="es. da eseguire a inizio preparazione, in due sedute distinte"
            value={dati.protocollo.note ?? ''}
            onChange={(e) => cambiaProtocollo({ note: e.target.value || null })}
          />
        </label>
      </div>

      {/* Due colonne: l'ambulatorio a sinistra e il campo a destra, cosi' le due
          meta' dello screening si leggono insieme. */}
      <div className="colonne-sezioni">
        {dati.sezioni.map((sez, i) => (
          <section key={sez.id ?? i} className="card sezione-screening">
            <div className="sezione-testata">
              <input
                value={sez.nome}
                placeholder="Nome della sezione"
                onChange={(e) => cambiaSezione(i, { nome: e.target.value })}
              />
              <span className="row-actions">
                <button
                  className="danger"
                  title="Elimina la sezione"
                  onClick={() => aggiorna(dati.sezioni.filter((_, k) => k !== i))}
                >
                  <Trash2 size={18} />
                </button>
              </span>
            </div>

            {sez.voci.length === 0 ? (
              <p className="hint">Nessun test in questa sezione.</p>
            ) : (
              <ol className="voci-screening">
                {sez.voci.map((v, j) => (
                  <li key={v.id ?? j}>
                    <span className="item-nome">{v.nome ?? '—'}</span>
                    <span className="badge">
                      {v.questionario_id != null ? 'questionario' : 'test'}
                    </span>
                    <button
                      className="danger"
                      title="Togli dalla sezione"
                      onClick={() => cambiaSezione(i, { voci: sez.voci.filter((_, k) => k !== j) })}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {aggiungiA === i ? (
              <div className="aggiungi-area">
                <div className="riga-filtro">
                  <div className="sotto-titolo">Test di valutazione</div>
                  <select
                    value={filtroTest}
                    onChange={(e) =>
                      setFiltroTest(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  >
                    <option value="">tutte le categorie</option>
                    {catTest.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <ul className="esercizi-proposti">
                  {test
                    .filter((t) => filtroTest === '' || t.categoria_id === filtroTest)
                    .filter((t) => !giaDentro.has(`t${t.id}`))
                    .map((t) => (
                      <li key={t.id}>
                        <span className="item-nome">{t.nome}</span>
                        <button
                          title="Aggiungi"
                          onClick={() =>
                            aggiungiVoce(i, {
                              id: null,
                              test_id: t.id,
                              questionario_id: null,
                              nome: t.nome
                            })
                          }
                        >
                          <Plus size={16} />
                        </button>
                      </li>
                    ))}
                  {test
                    .filter((t) => filtroTest === '' || t.categoria_id === filtroTest)
                    .every((t) => giaDentro.has(`t${t.id}`)) && (
                    <li className="hint">Nessun test da aggiungere in questa categoria.</li>
                  )}
                </ul>
                <div className="riga-filtro">
                  <div className="sotto-titolo">Questionari</div>
                  <select
                    value={filtroQuest}
                    onChange={(e) =>
                      setFiltroQuest(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  >
                    <option value="">tutte le categorie</option>
                    {catQuest.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <ul className="esercizi-proposti">
                  {questionari
                    .filter((q) => filtroQuest === '' || q.categoria_id === filtroQuest)
                    .filter((q) => !giaDentro.has(`q${q.id}`))
                    .map((q) => (
                      <li key={q.id}>
                        <span className="item-nome">{q.nome}</span>
                        <button
                          title="Aggiungi"
                          onClick={() =>
                            aggiungiVoce(i, {
                              id: null,
                              test_id: null,
                              questionario_id: q.id,
                              nome: q.nome
                            })
                          }
                        >
                          <Plus size={16} />
                        </button>
                      </li>
                    ))}
                  {questionari
                    .filter((q) => filtroQuest === '' || q.categoria_id === filtroQuest)
                    .every((q) => giaDentro.has(`q${q.id}`)) && (
                    <li className="hint">Nessun questionario da aggiungere in questa categoria.</li>
                  )}
                </ul>
                <div className="modal-actions">
                  <button onClick={() => setAggiungiA(null)}>Chiudi</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAggiungiA(i)}>
                <Plus size={16} /> Aggiungi test o questionario
              </button>
            )}
          </section>
        ))}
      </div>

      <div className="riga-nuova-sezione">
        <span className="hint">
          Un gruppo in più oltre a quelli qui sopra: per esempio &ldquo;In palestra&rdquo;, o una
          divisione per qualità (forza, salti, sprint).
        </span>
        <button
          className="btn-piccolo"
          onClick={() => aggiorna([...dati.sezioni, { id: idTemporaneo(), nome: '', voci: [] }])}
        >
          <Plus size={14} /> Nuova sezione
        </button>
      </div>
    </div>
  )
}
