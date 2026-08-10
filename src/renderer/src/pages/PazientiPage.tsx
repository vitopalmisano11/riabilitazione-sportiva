import { useEffect, useState } from 'react'
import type { Fase, Patologia, PazienteDettaglio } from '../../../shared/types'
import { errMsg } from '../lib'

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
  onDeleted
}: {
  paziente: PazienteDettaglio
  patologie: Patologia[]
  onChanged: () => Promise<void> | void
  onDeleted: () => void
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

      <section className="card">
        <h3>Diario sedute</h3>
        <p className="hint">
          In arrivo nel prossimo step: da qui creerai le sedute partendo dagli obiettivi della fase
          corrente, e rivedrai lo storico giorno per giorno.
        </p>
      </section>
    </div>
  )
}
