import { useEffect, useMemo, useState } from 'react'
import type {
  Categoria,
  EsercizioConCategoria,
  Obiettivo,
  PazienteDettaglio,
  SedutaEsercizioDettaglio,
  SedutaInput
} from '../../../shared/types'
import { ArrowDown, ArrowUp, Pencil, Plus, Video, X } from 'lucide-react'
import { toastErrore } from './Toast'
import { errMsg, oggiIso } from '../lib'

interface Props {
  paziente: PazienteDettaglio
  sedutaId: number | null // valorizzato = modifica di una seduta esistente
  duplicaDa?: number // valorizzato (con sedutaId null) = nuova seduta prefillata
  onClose: (salvata: boolean) => void
}

interface SezioneBuilder {
  sezione_id: number | null
  nome: string
  righe: SedutaEsercizioDettaglio[]
}

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
  const [sezioni, setSezioni] = useState<SezioneBuilder[]>([])
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([])
  const [raggiunti, setRaggiunti] = useState<number[]>([])
  const [templateCats, setTemplateCats] = useState<Record<number, number[]>>({})
  const [libreria, setLibreria] = useState<EsercizioConCategoria[]>([])
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [ricerche, setRicerche] = useState<Record<number, string>>({})
  const [nuovaSezione, setNuovaSezione] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const [lib, cats, ragg] = await Promise.all([
          window.api.esercizi.list(false),
          window.api.categorie.list(),
          window.api.pazienti.obiettiviRaggiunti(paziente.id)
        ])
        setLibreria(lib)
        setCategorie(cats)
        setRaggiunti(ragg)

        let fase = paziente.fase_corrente_id
        let faseN: string | null = paziente.fase_nome
        if (sedutaId != null) {
          const s = await window.api.sedute.get(sedutaId)
          setData(s.data)
          setNote(s.note ?? '')
          setSezioni(s.sezioni.map((sz) => ({ ...sz, righe: sz.esercizi })))
          fase = s.fase_id
          faseN = s.fase_nome
        } else if (duplicaDa != null) {
          const s = await window.api.sedute.get(duplicaDa)
          setSezioni(s.sezioni.map((sz) => ({ ...sz, righe: sz.esercizi })))
        }
        setFaseId(fase)
        setFaseNome(faseN)

        if (fase != null) {
          const [obs, template] = await Promise.all([
            window.api.obiettivi.list(fase),
            window.api.sezioni.list(fase)
          ])
          setObiettivi(obs)
          setTemplateCats(Object.fromEntries(template.map((t) => [t.id, t.categoria_ids])))
          if (sedutaId == null && duplicaDa == null) {
            // nuova seduta: struttura di default dal template della fase
            setSezioni(template.map((t) => ({ sezione_id: t.id, nome: t.nome, righe: [] })))
          }
        }
        setPronto(true)
      } catch (e) {
        toastErrore(errMsg(e))
        onClose(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totaleEsercizi = useMemo(
    () => sezioni.reduce((n, s) => n + s.righe.length, 0),
    [sezioni]
  )

  const nomeCategoria = (cid: number): string => categorie.find((c) => c.id === cid)?.nome ?? '?'

  // Esercizi proposti per una sezione: quelli delle sue categorie (nell'ordine configurato)
  const proposte = (s: SezioneBuilder): EsercizioConCategoria[] => {
    if (s.sezione_id == null) return []
    const cats = templateCats[s.sezione_id] ?? []
    return cats.flatMap((cid) => libreria.filter((e) => e.categoria_id === cid))
  }

  const aggiungi = (idx: number, e: EsercizioConCategoria): void => {
    setSezioni(
      sezioni.map((s, i) =>
        i === idx && !s.righe.some((r) => r.esercizio_id === e.id)
          ? {
              ...s,
              righe: [
                ...s.righe,
                {
                  esercizio_id: e.id,
                  nome: e.nome,
                  categoria_nome: e.categoria_nome,
                  serie: e.serie_default,
                  ripetizioni: e.ripetizioni_default,
                  carico: e.carico_default,
                  recupero: e.recupero_default,
                  nota: null,
                  link: e.link
                }
              ]
            }
          : s
      )
    )
  }

  const updateRiga = (
    idxSez: number,
    idxRiga: number,
    campo: 'serie' | 'ripetizioni' | 'carico' | 'recupero' | 'nota',
    valore: string
  ): void => {
    setSezioni(
      sezioni.map((s, i) =>
        i === idxSez
          ? { ...s, righe: s.righe.map((r, j) => (j === idxRiga ? { ...r, [campo]: valore } : r)) }
          : s
      )
    )
  }

  const rimuoviRiga = (idxSez: number, idxRiga: number): void => {
    setSezioni(
      sezioni.map((s, i) =>
        i === idxSez ? { ...s, righe: s.righe.filter((_, j) => j !== idxRiga) } : s
      )
    )
  }

  const muoviRiga = (idxSez: number, idxRiga: number, dir: -1 | 1): void => {
    setSezioni(
      sezioni.map((s, i) => {
        if (i !== idxSez) return s
        const j = idxRiga + dir
        if (j < 0 || j >= s.righe.length) return s
        const righe = [...s.righe]
        ;[righe[idxRiga], righe[j]] = [righe[j], righe[idxRiga]]
        return { ...s, righe }
      })
    )
  }

  const muoviSezione = (idx: number, dir: -1 | 1): void => {
    const j = idx + dir
    if (j < 0 || j >= sezioni.length) return
    const next = [...sezioni]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setSezioni(next)
  }

  const rimuoviSezione = (idx: number): void => {
    const s = sezioni[idx]
    if (
      s.righe.length > 0 &&
      !confirm(`Rimuovere la sezione "${s.nome}" e i suoi ${s.righe.length} esercizi da questa seduta?`)
    ) {
      return
    }
    setSezioni(sezioni.filter((_, i) => i !== idx))
  }

  // window.prompt non è supportato in Electron: rename inline della sezione
  const [editSez, setEditSez] = useState<{ idx: number; nome: string } | null>(null)

  const aggiungiSezione = (): void => {
    const nome = nuovaSezione.trim()
    if (!nome) return
    setSezioni([...sezioni, { sezione_id: null, nome, righe: [] }])
    setNuovaSezione('')
  }

  const salva = async (): Promise<void> => {
    if (!data) {
      toastErrore('Imposta la data della seduta.')
      return
    }
    if (totaleEsercizi === 0) {
      toastErrore('Aggiungi almeno un esercizio alla seduta.')
      return
    }
    const input: SedutaInput = {
      paziente_id: paziente.id,
      data,
      fase_id: faseId,
      note: note.trim() || null,
      sezioni: sezioni.map((s) => ({ sezione_id: s.sezione_id, nome: s.nome })),
      esercizi: sezioni.flatMap((s, i) =>
        s.righe.map((r) => ({
          esercizio_id: r.esercizio_id,
          serie: r.serie?.trim() || null,
          ripetizioni: r.ripetizioni?.trim() || null,
          carico: r.carico?.trim() || null,
          recupero: r.recupero?.trim() || null,
          nota: r.nota?.trim() || null,
          sezioneIndex: i
        }))
      )
    }
    try {
      if (sedutaId == null) await window.api.sedute.create(input)
      else await window.api.sedute.update(sedutaId, input)
      onClose(true)
    } catch (e) {
      toastErrore(errMsg(e))
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
    <div className="page builder-col">
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

      {faseId != null && obiettivi.length > 0 && (
        <section className="card obiettivi-info">
          <h3>Obiettivi da lavorare</h3>
          <div className="chips">
            {obiettivi.map((o) => (
              <span
                key={o.id}
                className={raggiunti.includes(o.id) ? 'chip raggiunto' : 'chip'}
                title={raggiunti.includes(o.id) ? 'Obiettivo raggiunto' : 'Da lavorare'}
              >
                {o.nome}
              </span>
            ))}
          </div>
        </section>
      )}

      {sezioni.length === 0 && (
        <section className="card">
          <p className="hint">
            {faseId == null
              ? 'Il paziente non ha una fase corrente: imposta la fase nella sua scheda, oppure aggiungi sezioni manualmente qui sotto.'
              : 'Questa fase non ha una struttura di seduta configurata: definiscila in "Patologie e fasi" oppure aggiungi le sezioni manualmente qui sotto.'}
          </p>
        </section>
      )}

      {sezioni.map((s, idxSez) => {
        const ricerca = (ricerche[idxSez] ?? '').trim().toLowerCase()
        const inSezione = new Set(s.righe.map((r) => r.esercizio_id))
        const daProporre =
          ricerca.length >= 2
            ? libreria.filter((e) => e.nome.toLowerCase().includes(ricerca) && !inSezione.has(e.id)).slice(0, 8)
            : proposte(s).filter((e) => !inSezione.has(e.id))
        return (
          <section key={idxSez} className="card sezione-card">
            <div className="sezione-testata">
              {editSez?.idx === idxSez ? (
                <span className="edit-row">
                  <input
                    autoFocus
                    value={editSez.nome}
                    onChange={(e) => setEditSez({ idx: idxSez, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editSez.nome.trim()) {
                        setSezioni(
                          sezioni.map((x, i) =>
                            i === idxSez ? { ...x, nome: editSez.nome.trim() } : x
                          )
                        )
                        setEditSez(null)
                      }
                      if (e.key === 'Escape') setEditSez(null)
                    }}
                  />
                  <button
                    onClick={() => {
                      if (editSez.nome.trim()) {
                        setSezioni(
                          sezioni.map((x, i) =>
                            i === idxSez ? { ...x, nome: editSez.nome.trim() } : x
                          )
                        )
                      }
                      setEditSez(null)
                    }}
                  >
                    OK
                  </button>
                </span>
              ) : (
                <h3>{s.nome}</h3>
              )}
              <span className="item-actions-static">
                <button title="Sposta su" disabled={idxSez === 0} onClick={() => muoviSezione(idxSez, -1)}>
                  <ArrowUp size={16} />
                </button>
                <button
                  title="Sposta giù"
                  disabled={idxSez === sezioni.length - 1}
                  onClick={() => muoviSezione(idxSez, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button title="Rinomina" onClick={() => setEditSez({ idx: idxSez, nome: s.nome })}>
                  <Pencil size={16} />
                </button>
                <button title="Rimuovi sezione" className="danger" onClick={() => rimuoviSezione(idxSez)}>
                  <X size={16} />
                </button>
              </span>
            </div>

            {s.righe.length > 0 && (
              <ul className="righe-seduta">
                {s.righe.map((r, idxRiga) => (
                  <li key={r.esercizio_id}>
                    <div className="riga-testata">
                      <span className="item-nome">
                        {r.nome}
                        {r.link && (
                          <button
                            className="link-video"
                            title="Apri video"
                            onClick={() =>
                              window.api.apriLink(r.link!).catch((err) => toastErrore(errMsg(err)))
                            }
                          >
                            <Video size={16} />
                          </button>
                        )}
                      </span>
                      <span className="default-hint">{r.categoria_nome}</span>
                      <span className="item-actions-static">
                        <button
                          title="Sposta su"
                          disabled={idxRiga === 0}
                          onClick={() => muoviRiga(idxSez, idxRiga, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          title="Sposta giù"
                          disabled={idxRiga === s.righe.length - 1}
                          onClick={() => muoviRiga(idxSez, idxRiga, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          title="Rimuovi"
                          className="danger"
                          onClick={() => rimuoviRiga(idxSez, idxRiga)}
                        >
                          <X size={16} />
                        </button>
                      </span>
                    </div>
                    <div className="riga-params">
                      <label>
                        Serie
                        <input
                          value={r.serie ?? ''}
                          onChange={(e) => updateRiga(idxSez, idxRiga, 'serie', e.target.value)}
                        />
                      </label>
                      <label>
                        Ripetizioni
                        <input
                          value={r.ripetizioni ?? ''}
                          onChange={(e) =>
                            updateRiga(idxSez, idxRiga, 'ripetizioni', e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Carico
                        <input
                          value={r.carico ?? ''}
                          onChange={(e) => updateRiga(idxSez, idxRiga, 'carico', e.target.value)}
                        />
                      </label>
                      <label>
                        Recupero
                        <input
                          value={r.recupero ?? ''}
                          placeholder={'es. 1′'}
                          onChange={(e) => updateRiga(idxSez, idxRiga, 'recupero', e.target.value)}
                        />
                      </label>
                    </div>
                    <input
                      className="riga-nota"
                      placeholder="Nota per questo esercizio…"
                      value={r.nota ?? ''}
                      onChange={(e) => updateRiga(idxSez, idxRiga, 'nota', e.target.value)}
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="aggiungi-area">
              <input
                type="search"
                className="filtro-esercizi"
                placeholder={
                  s.sezione_id != null
                    ? 'Filtra i proposti o cerca in tutta la libreria…'
                    : 'Cerca un esercizio nella libreria (min 2 lettere)…'
                }
                value={ricerche[idxSez] ?? ''}
                onChange={(e) => setRicerche({ ...ricerche, [idxSez]: e.target.value })}
              />
              {daProporre.length > 0 ? (
                <ul className="esercizi-proposti">
                  {daProporre.map((e) => (
                    <li key={e.id}>
                      <span className="item-nome">
                        {e.nome}
                        {e.link && (
                          <button
                            className="link-video"
                            title="Apri video"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              window.api.apriLink(e.link!).catch((err) => toastErrore(errMsg(err)))
                            }}
                          >
                            <Video size={16} />
                          </button>
                        )}
                      </span>
                      <span className="default-hint">
                        {[nomeCategoria(e.categoria_id), [e.serie_default, e.ripetizioni_default].filter(Boolean).join(' × ')]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <button onClick={() => aggiungi(idxSez, e)}>
                        <Plus size={16} /> Aggiungi
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                s.sezione_id != null &&
                ricerca.length < 2 && (
                  <p className="hint">
                    Nessun esercizio proposto: associa categorie alla sezione in configurazione, o
                    cerca nella libreria.
                  </p>
                )
              )}
            </div>
          </section>
        )
      })}

      <section className="card">
        <div className="add-row">
          <input
            placeholder="Aggiungi una sezione a questa seduta… (es. Defaticamento)"
            value={nuovaSezione}
            onChange={(e) => setNuovaSezione(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aggiungiSezione()
            }}
          />
          <button onClick={aggiungiSezione}>Aggiungi sezione</button>
        </div>
      </section>

      <section className="card">
        <label className="field note-seduta">
          Note della seduta
          <textarea
            rows={3}
            value={note}
            placeholder="Osservazioni generali, cose da riprendere la prossima volta…"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button onClick={() => onClose(false)}>Annulla</button>
          <button className="primary" onClick={() => void salva()}>
            Salva seduta ({totaleEsercizi} esercizi)
          </button>
        </div>
      </section>
    </div>
  )
}
