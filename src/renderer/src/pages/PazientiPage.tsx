import { useEffect, useState } from 'react'
import type {
  Fase,
  Obiettivo,
  Patologia,
  PazienteDettaglio,
  SedutaRiepilogo,
  TestValore
} from '../../../shared/types'
import SedutaBuilder from '../components/SedutaBuilder'
import { errMsg, formatData } from '../lib'

interface NuovoForm {
  nome: string
  cognome: string
  tipo_intervento: string
  data_intervento: string
  patologia_id: number | ''
  fase_corrente_id: number | ''
}

const NUOVO_VUOTO: NuovoForm = {
  nome: '',
  cognome: '',
  tipo_intervento: '',
  data_intervento: '',
  patologia_id: '',
  fase_corrente_id: ''
}

export default function PazientiPage(): React.JSX.Element {
  const [pazienti, setPazienti] = useState<PazienteDettaglio[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [ricerca, setRicerca] = useState('')
  const [patologie, setPatologie] = useState<Patologia[]>([])
  const [nuovo, setNuovo] = useState<NuovoForm | null>(null)
  const [nuovoFasi, setNuovoFasi] = useState<Fase[]>([])
  const [builder, setBuilder] = useState<{ sedutaId: number | null; duplicaDa?: number } | null>(
    null
  )

  const load = async (): Promise<void> => setPazienti(await window.api.pazienti.list())

  useEffect(() => {
    void load()
    void window.api.patologie.list().then(setPatologie)
  }, [])

  useEffect(() => {
    if (!nuovo || nuovo.patologia_id === '') {
      setNuovoFasi([])
      return
    }
    void window.api.fasi.list(nuovo.patologia_id).then(setNuovoFasi)
  }, [nuovo?.patologia_id])

  const q = ricerca.trim().toLowerCase()
  const visibili = pazienti.filter(
    (p) => q === '' || `${p.cognome} ${p.nome} ${p.nome} ${p.cognome}`.toLowerCase().includes(q)
  )
  const sel = pazienti.find((p) => p.id === selId) ?? null

  const salvaNuovo = async (): Promise<void> => {
    if (!nuovo) return
    if (!nuovo.nome.trim() || !nuovo.cognome.trim()) {
      alert('Nome e cognome sono obbligatori.')
      return
    }
    try {
      const id = await window.api.pazienti.create({
        nome: nuovo.nome,
        cognome: nuovo.cognome,
        tipo_intervento: nuovo.tipo_intervento.trim() || null,
        data_intervento: nuovo.data_intervento || null,
        patologia_id: nuovo.patologia_id === '' ? null : nuovo.patologia_id,
        fase_corrente_id: nuovo.fase_corrente_id === '' ? null : nuovo.fase_corrente_id
      })
      setNuovo(null)
      await load()
      setSelId(id)
    } catch (e) {
      alert(errMsg(e))
    }
  }

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
    <div className="page">
      <header className="page-header">
        <h2>Pazienti</h2>
        <p>
          Ogni paziente ha la sua patologia e una fase corrente che resta memorizzata: le nuove
          sedute si apriranno già nella fase giusta, e sei tu a farla avanzare quando il paziente è
          pronto.
        </p>
      </header>

      <div className="pazienti-layout">
        <section className="crud-list">
          <div className="add-row list-top">
            <input
              type="search"
              placeholder="Cerca paziente…"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
            />
            <button className="primary" onClick={() => setNuovo({ ...NUOVO_VUOTO })}>
              + Nuovo
            </button>
          </div>
          <ul>
            {visibili.map((p) => (
              <li
                key={p.id}
                className={['selectable', selId === p.id ? 'selected' : ''].join(' ')}
                onClick={() => setSelId(p.id)}
              >
                <span className="paziente-item">
                  <span className="item-nome">
                    {p.cognome} {p.nome}
                  </span>
                  <span className="paziente-sub">
                    {p.patologia_nome
                      ? `${p.patologia_nome}${p.fase_nome ? ' · ' + p.fase_nome : ''}`
                      : 'Senza patologia'}
                  </span>
                </span>
              </li>
            ))}
            {visibili.length === 0 && (
              <li className="empty">
                {pazienti.length === 0 ? 'Nessun paziente: creane uno con "+ Nuovo".' : 'Nessun risultato.'}
              </li>
            )}
          </ul>
        </section>

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
          <section className="card">
            <p className="hint">Seleziona un paziente dalla lista, o creane uno nuovo.</p>
          </section>
        )}
      </div>

      {nuovo && (
        <div className="modal-overlay" onClick={() => setNuovo(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nuovo paziente</h3>
            <div className="form-row-2">
              <label>
                Nome *
                <input
                  autoFocus
                  value={nuovo.nome}
                  onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })}
                />
              </label>
              <label>
                Cognome *
                <input
                  value={nuovo.cognome}
                  onChange={(e) => setNuovo({ ...nuovo, cognome: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row-2">
              <label>
                Tipo di intervento
                <input
                  placeholder="es. Ricostruzione LCA dx"
                  value={nuovo.tipo_intervento}
                  onChange={(e) => setNuovo({ ...nuovo, tipo_intervento: e.target.value })}
                />
              </label>
              <label>
                Data intervento
                <input
                  type="date"
                  value={nuovo.data_intervento}
                  onChange={(e) => setNuovo({ ...nuovo, data_intervento: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row-2">
              <label>
                Patologia
                <select
                  value={nuovo.patologia_id}
                  onChange={(e) =>
                    setNuovo({
                      ...nuovo,
                      patologia_id: e.target.value === '' ? '' : Number(e.target.value),
                      fase_corrente_id: ''
                    })
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
              <label>
                Fase iniziale
                <select
                  value={nuovo.fase_corrente_id}
                  disabled={nuovo.patologia_id === ''}
                  onChange={(e) =>
                    setNuovo({
                      ...nuovo,
                      fase_corrente_id: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                >
                  <option value="">— non impostata —</option>
                  {nuovoFasi.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setNuovo(null)}>Annulla</button>
              <button className="primary" onClick={() => void salvaNuovo()}>
                Crea paziente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [form, setForm] = useState({
    nome: paziente.nome,
    cognome: paziente.cognome,
    tipo_intervento: paziente.tipo_intervento ?? '',
    data_intervento: paziente.data_intervento ?? ''
  })
  const [fasi, setFasi] = useState<Fase[]>([])

  useEffect(() => {
    if (paziente.patologia_id == null) {
      setFasi([])
      return
    }
    void window.api.fasi.list(paziente.patologia_id).then(setFasi)
  }, [paziente.patologia_id])

  const dirty =
    form.nome !== paziente.nome ||
    form.cognome !== paziente.cognome ||
    form.tipo_intervento !== (paziente.tipo_intervento ?? '') ||
    form.data_intervento !== (paziente.data_intervento ?? '')

  const salva = async (): Promise<void> => {
    if (!form.nome.trim() || !form.cognome.trim()) {
      alert('Nome e cognome sono obbligatori.')
      return
    }
    try {
      await window.api.pazienti.update(paziente.id, {
        nome: form.nome,
        cognome: form.cognome,
        tipo_intervento: form.tipo_intervento.trim() || null,
        data_intervento: form.data_intervento || null
      })
      await onChanged()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  const setPatologia = async (patologiaId: number | null): Promise<void> => {
    if (
      paziente.patologia_id != null &&
      patologiaId !== paziente.patologia_id &&
      !confirm('Cambiare patologia? La fase corrente verrà azzerata.')
    ) {
      return
    }
    try {
      await window.api.pazienti.setPatologiaFase(paziente.id, patologiaId, null)
      await onChanged()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  const setFase = async (faseId: number | null): Promise<void> => {
    try {
      await window.api.pazienti.setPatologiaFase(paziente.id, paziente.patologia_id, faseId)
      await onChanged()
    } catch (e) {
      alert(errMsg(e))
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
    if (!confirm(domanda)) return
    await setFase(prossima.id)
  }

  const elimina = async (): Promise<void> => {
    if (
      !confirm(
        `Eliminare ${paziente.nome} ${paziente.cognome}?\nVerranno eliminate anche tutte le sue sedute (diario).`
      )
    ) {
      return
    }
    try {
      await window.api.pazienti.remove(paziente.id)
      onDeleted()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  return (
    <div className="scheda">
      <section className="card">
        <h3>Anagrafica</h3>
        <div className="form-row-2">
          <label className="field">
            Nome *
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="field">
            Cognome *
            <input
              value={form.cognome}
              onChange={(e) => setForm({ ...form, cognome: e.target.value })}
            />
          </label>
        </div>
        <div className="form-row-2">
          <label className="field">
            Tipo di intervento
            <input
              placeholder="es. Ricostruzione LCA dx"
              value={form.tipo_intervento}
              onChange={(e) => setForm({ ...form, tipo_intervento: e.target.value })}
            />
          </label>
          <label className="field">
            Data intervento
            <input
              type="date"
              value={form.data_intervento}
              onChange={(e) => setForm({ ...form, data_intervento: e.target.value })}
            />
          </label>
        </div>
        <div className="scheda-actions">
          <button className="danger" onClick={() => void elimina()}>
            Elimina paziente
          </button>
          <span className="spacer" />
          <button className="primary" disabled={!dirty} onClick={() => void salva()}>
            Salva modifiche
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Percorso riabilitativo</h3>
        <div className="form-row-2">
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
          <label className="field">
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
        </div>
        <div className="fase-riga">
          {paziente.patologia_id == null ? (
            <p className="hint">Assegna una patologia per impostare le fasi.</p>
          ) : fasi.length === 0 ? (
            <p className="hint">
              Questa patologia non ha fasi: definiscile in &ldquo;Patologie e fasi&rdquo;.
            </p>
          ) : (
            <>
              <span className="hint">
                {idxFase >= 0 ? `Fase ${idxFase + 1} di ${fasi.length}` : 'Nessuna fase impostata'}
              </span>
              <button disabled={!prossima} onClick={() => void avanza()}>
                {paziente.fase_corrente_id == null
                  ? 'Imposta prima fase'
                  : prossima
                    ? `Avanza a "${prossima.nome}" →`
                    : 'Ultima fase raggiunta'}
              </button>
            </>
          )}
        </div>
      </section>

      <ObiettiviCard paziente={paziente} />

      <DiarioCard
        paziente={paziente}
        onNuova={onNuovaSeduta}
        onApri={onApriSeduta}
        onDuplica={onDuplicaSeduta}
      />
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
      alert(errMsg(e))
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
      alert(errMsg(e))
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

  const load = async (): Promise<void> => setSedute(await window.api.sedute.list(paziente.id))

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paziente.id])

  const elimina = async (s: SedutaRiepilogo): Promise<void> => {
    if (!confirm(`Eliminare la seduta del ${formatData(s.data)}?`)) return
    try {
      await window.api.sedute.remove(s.id)
      await load()
    } catch (e) {
      alert(errMsg(e))
    }
  }

  const esportaSingola = async (id: number, formato: 'pdf' | 'docx'): Promise<void> => {
    try {
      const path = await window.api.esporta.seduta(id, formato)
      if (path) alert(`Seduta esportata in:\n${path}`)
    } catch (e) {
      alert(errMsg(e))
    }
  }

  const esportaPeriodo = async (formato: 'pdf' | 'docx'): Promise<void> => {
    if (!periodo) return
    if (periodo.dal > periodo.al) {
      alert('Intervallo non valido: la data "dal" è successiva ad "al".')
      return
    }
    try {
      const path = await window.api.esporta.storico(paziente.id, periodo.dal, periodo.al, formato)
      if (path) {
        setPeriodo(null)
        alert(`Storico esportato in:\n${path}`)
      }
    } catch (e) {
      alert(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>Diario sedute</h3>
        <span className="row-actions">
          {sedute.length > 0 && (
            <button
              onClick={() =>
                setPeriodo({ dal: sedute[sedute.length - 1].data, al: sedute[0].data })
              }
            >
              Esporta periodo…
            </button>
          )}
          <button className="primary" onClick={onNuova}>
            + Nuova seduta
          </button>
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
                <button onClick={() => onApri(s.id)}>Apri</button>
                <button title="Nuova seduta partendo da questa" onClick={() => onDuplica(s.id)}>
                  Duplica
                </button>
                <button title="Esporta in PDF" onClick={() => void esportaSingola(s.id, 'pdf')}>
                  PDF
                </button>
                <button title="Esporta in Word" onClick={() => void esportaSingola(s.id, 'docx')}>
                  Word
                </button>
                <button className="danger" onClick={() => void elimina(s)}>
                  Elimina
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
    </section>
  )
}
