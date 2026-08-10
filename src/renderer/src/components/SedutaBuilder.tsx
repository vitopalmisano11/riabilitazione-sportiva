import { useEffect, useMemo, useState } from 'react'
import type {
  Categoria,
  EsercizioConCategoria,
  Obiettivo,
  PazienteDettaglio,
  SedutaEsercizioDettaglio,
  SedutaInput
} from '../../../shared/types'
import { errMsg, oggiIso } from '../lib'

interface Props {
  paziente: PazienteDettaglio
  sedutaId: number | null // valorizzato = modifica di una seduta esistente
  duplicaDa?: number // valorizzato (con sedutaId null) = nuova seduta prefillata
  onClose: (salvata: boolean) => void
}

type Riga = SedutaEsercizioDettaglio

export default function SedutaBuilder({
  paziente,
  sedutaId,
  duplicaDa,
  onClose
}: Props): React.JSX.Element {
  const [pronto, setPronto] = useState(false)
  const [data, setData] = useState(oggiIso())
  const [faseId, setFaseId] = useState<number | null>(paziente.fase_corrente_id)
  const [faseNome, setFaseNome] = useState<string | null>(paziente.fase_nome)
  const [note, setNote] = useState('')
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([])
  const [obCats, setObCats] = useState<Record<number, number[]>>({})
  const [selOb, setSelOb] = useState<number[]>([])
  const [righe, setRighe] = useState<Riga[]>([])
  const [libreria, setLibreria] = useState<EsercizioConCategoria[]>([])
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [ricerca, setRicerca] = useState('')
  const [fuoriSchema, setFuoriSchema] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const [lib, cats] = await Promise.all([
          window.api.esercizi.list(false),
          window.api.categorie.list()
        ])
        setLibreria(lib)
        setCategorie(cats)

        let fase = paziente.fase_corrente_id
        let faseN: string | null = paziente.fase_nome
        if (sedutaId != null) {
          const s = await window.api.sedute.get(sedutaId)
          setData(s.data)
          setNote(s.note ?? '')
          setSelOb(s.obiettivi)
          setRighe(s.esercizi)
          fase = s.fase_id
          faseN = s.fase_nome
        } else if (duplicaDa != null) {
          const s = await window.api.sedute.get(duplicaDa)
          setRighe(s.esercizi)
          setSelOb(s.obiettivi) // filtrati sotto rispetto alla fase corrente
        }
        setFaseId(fase)
        setFaseNome(faseN)

        if (fase != null) {
          const obs = await window.api.obiettivi.list(fase)
          setObiettivi(obs)
          const entries = await Promise.all(
            obs.map(async (o) => [o.id, await window.api.obiettivi.categorie(o.id)] as const)
          )
          setObCats(Object.fromEntries(entries))
          if (sedutaId == null && duplicaDa != null) {
            setSelOb((prev) => prev.filter((id) => obs.some((o) => o.id === id)))
          }
        }
        setPronto(true)
      } catch (e) {
        alert(errMsg(e))
        onClose(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const catAttive = useMemo(() => {
    const ids: number[] = []
    for (const o of obiettivi) {
      if (!selOb.includes(o.id)) continue
      for (const c of obCats[o.id] ?? []) if (!ids.includes(c)) ids.push(c)
    }
    return ids
  }, [obiettivi, selOb, obCats])

  const perCategoria = useMemo(() => {
    const q = ricerca.trim().toLowerCase()
    return catAttive.map((cid) => ({
      id: cid,
      nome: categorie.find((c) => c.id === cid)?.nome ?? '?',
      esercizi: libreria.filter(
        (e) => e.categoria_id === cid && (q === '' || e.nome.toLowerCase().includes(q))
      )
    }))
  }, [catAttive, categorie, libreria, ricerca])

  const giaAggiunti = useMemo(() => new Set(righe.map((r) => r.esercizio_id)), [righe])

  const risultatiFuori = useMemo(() => {
    const q = fuoriSchema.trim().toLowerCase()
    if (q.length < 2) return []
    return libreria
      .filter((e) => e.nome.toLowerCase().includes(q) && !giaAggiunti.has(e.id))
      .slice(0, 8)
  }, [fuoriSchema, libreria, giaAggiunti])

  const aggiungi = (e: EsercizioConCategoria): void => {
    if (giaAggiunti.has(e.id)) return
    setRighe([
      ...righe,
      {
        esercizio_id: e.id,
        nome: e.nome,
        categoria_nome: e.categoria_nome,
        serie: e.serie_default,
        ripetizioni: e.ripetizioni_default,
        carico: e.carico_default,
        nota: null
      }
    ])
  }

  const updateRiga = (
    idx: number,
    campo: 'serie' | 'ripetizioni' | 'carico' | 'nota',
    valore: string
  ): void => {
    setRighe(righe.map((r, i) => (i === idx ? { ...r, [campo]: valore } : r)))
  }

  const rimuovi = (idx: number): void => setRighe(righe.filter((_, i) => i !== idx))

  const muovi = (idx: number, dir: -1 | 1): void => {
    const j = idx + dir
    if (j < 0 || j >= righe.length) return
    const next = [...righe]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setRighe(next)
  }

  const salva = async (): Promise<void> => {
    if (!data) {
      alert('Imposta la data della seduta.')
      return
    }
    if (righe.length === 0) {
      alert('Aggiungi almeno un esercizio alla seduta.')
      return
    }
    const input: SedutaInput = {
      paziente_id: paziente.id,
      data,
      fase_id: faseId,
      note: note.trim() || null,
      obiettivi: selOb,
      esercizi: righe.map((r) => ({
        esercizio_id: r.esercizio_id,
        serie: r.serie?.trim() || null,
        ripetizioni: r.ripetizioni?.trim() || null,
        carico: r.carico?.trim() || null,
        nota: r.nota?.trim() || null
      }))
    }
    try {
      if (sedutaId == null) await window.api.sedute.create(input)
      else await window.api.sedute.update(sedutaId, input)
      onClose(true)
    } catch (e) {
      alert(errMsg(e))
    }
  }

  if (!pronto) {
    return (
      <div className="page">
        <p className="hint">Caricamento…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header builder-header">
        <div>
          <h2>
            {sedutaId == null ? 'Nuova seduta' : 'Modifica seduta'} — {paziente.nome}{' '}
            {paziente.cognome}
          </h2>
          <p>
            {faseNome ? (
              <>
                Fase: <strong>{faseNome}</strong>
              </>
            ) : (
              'Nessuna fase impostata sul paziente'
            )}
            {duplicaDa != null && ' · contenuti copiati da una seduta precedente'}
          </p>
        </div>
        <div className="builder-header-actions">
          <label className="field data-field">
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <button onClick={() => onClose(false)}>Annulla</button>
          <button className="primary" onClick={() => void salva()}>
            Salva seduta
          </button>
        </div>
      </header>

      <div className="builder-layout">
        <div className="builder-left">
          <section className="card">
            <h3>Obiettivi della fase</h3>
            {faseId == null ? (
              <p className="hint">
                Il paziente non ha una fase corrente: impostala nella sua scheda per vedere gli
                obiettivi. Puoi comunque aggiungere esercizi con la ricerca in libreria qui sotto.
              </p>
            ) : obiettivi.length === 0 ? (
              <p className="hint">
                Questa fase non ha obiettivi: definiscili in &ldquo;Patologie e fasi&rdquo;.
              </p>
            ) : (
              <ul className="checkbox-list">
                {obiettivi.map((o) => (
                  <li key={o.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selOb.includes(o.id)}
                        onChange={(e) =>
                          setSelOb(
                            e.target.checked
                              ? [...selOb, o.id]
                              : selOb.filter((id) => id !== o.id)
                          )
                        }
                      />
                      {o.nome}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {catAttive.length > 0 && (
            <section className="card">
              <h3>Esercizi proposti</h3>
              <input
                type="search"
                className="filtro-esercizi"
                placeholder="Filtra esercizi…"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
              />
              {perCategoria.map((cat) => (
                <div key={cat.id} className="cat-gruppo">
                  <h4>{cat.nome}</h4>
                  {cat.esercizi.length === 0 ? (
                    <p className="hint">Nessun esercizio in questa categoria.</p>
                  ) : (
                    <ul className="esercizi-proposti">
                      {cat.esercizi.map((e) => (
                        <li key={e.id}>
                          <span className="item-nome">{e.nome}</span>
                          <span className="default-hint">
                            {[e.serie_default, e.ripetizioni_default].filter(Boolean).join(' × ')}
                          </span>
                          <button disabled={giaAggiunti.has(e.id)} onClick={() => aggiungi(e)}>
                            {giaAggiunti.has(e.id) ? '✓' : '+ Aggiungi'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}

          <section className="card">
            <h3>Aggiungi dalla libreria</h3>
            <input
              type="search"
              className="filtro-esercizi"
              placeholder="Cerca in tutta la libreria (min 2 lettere)…"
              value={fuoriSchema}
              onChange={(e) => setFuoriSchema(e.target.value)}
            />
            {risultatiFuori.length > 0 && (
              <ul className="esercizi-proposti">
                {risultatiFuori.map((e) => (
                  <li key={e.id}>
                    <span className="item-nome">{e.nome}</span>
                    <span className="default-hint">{e.categoria_nome}</span>
                    <button onClick={() => aggiungi(e)}>+ Aggiungi</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="builder-right">
          <section className="card">
            <h3>Schema della seduta ({righe.length})</h3>
            {righe.length === 0 ? (
              <p className="hint">Seleziona gli obiettivi e aggiungi gli esercizi.</p>
            ) : (
              <ul className="righe-seduta">
                {righe.map((r, idx) => (
                  <li key={r.esercizio_id}>
                    <div className="riga-testata">
                      <span className="item-nome">{r.nome}</span>
                      <span className="default-hint">{r.categoria_nome}</span>
                      <span className="item-actions-static">
                        <button title="Sposta su" disabled={idx === 0} onClick={() => muovi(idx, -1)}>
                          ↑
                        </button>
                        <button
                          title="Sposta giù"
                          disabled={idx === righe.length - 1}
                          onClick={() => muovi(idx, 1)}
                        >
                          ↓
                        </button>
                        <button title="Rimuovi" className="danger" onClick={() => rimuovi(idx)}>
                          ✕
                        </button>
                      </span>
                    </div>
                    <div className="riga-params">
                      <label>
                        Serie
                        <input
                          value={r.serie ?? ''}
                          onChange={(e) => updateRiga(idx, 'serie', e.target.value)}
                        />
                      </label>
                      <label>
                        Ripetizioni
                        <input
                          value={r.ripetizioni ?? ''}
                          onChange={(e) => updateRiga(idx, 'ripetizioni', e.target.value)}
                        />
                      </label>
                      <label>
                        Carico
                        <input
                          value={r.carico ?? ''}
                          onChange={(e) => updateRiga(idx, 'carico', e.target.value)}
                        />
                      </label>
                    </div>
                    <input
                      className="riga-nota"
                      placeholder="Nota per questo esercizio…"
                      value={r.nota ?? ''}
                      onChange={(e) => updateRiga(idx, 'nota', e.target.value)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <label className="field note-seduta">
              Note della seduta
              <textarea
                rows={3}
                value={note}
                placeholder="Osservazioni generali, cose da riprendere la prossima volta…"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </section>
        </div>
      </div>
    </div>
  )
}
