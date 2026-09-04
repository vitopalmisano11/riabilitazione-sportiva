import { useEffect, useMemo, useState } from 'react'
import type {
  Categoria,
  EsercizioConCategoria,
  Obiettivo,
  PazienteDettaglio,
  SedutaEsercizioDettaglio,
  SedutaInput
} from '../../../shared/types'
import { GripVertical, ImageIcon, Pencil, Plus, Video, X } from 'lucide-react'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import ImmagineEsercizio from './ImmagineEsercizio'
import { errMsg, oggiIso } from '../lib'
import { useScorciatoie } from '../scorciatoie'
import { sposta, useRiordino } from '../riordino'

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

// Quello che si sta componendo, messo da parte cosi' com'e'.
interface BozzaSeduta {
  data: string
  faseId: number | null
  note: string
  sezioni: SezioneBuilder[]
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
  // Quale sezione ha la ricerca aperta. Una per volta: prima ogni sezione
  // teneva sempre in vista la sua casella di ricerca e fino a otto esercizi
  // proposti, e con tre o quattro sezioni lo schermo era pieno di strumenti
  // invece che della seduta.
  const [sezioneApertaPerAggiungere, setApriAggiungi] = useState<number | null>(null)
  const [immagineAperta, setImmagineAperta] = useState<{ id: number; nome: string } | null>(null)

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

        // Bozza rimasta da una volta in cui l'app si e' chiusa a meta': si
        // chiede prima di rimetterla, perche' potrebbe essere di giorni fa.
        if (sedutaId == null) {
          const bozza = await window.api.bozze.leggi(paziente.id)
          if (bozza) {
            const quando = new Date(bozza.aggiornata_il)
            const etichetta = `${quando.toLocaleDateString('it-IT')} alle ${quando
              .toLocaleTimeString('it-IT')
              .slice(0, 5)}`
            if (await chiedi(`C'è una seduta lasciata a metà il ${etichetta}. Vuoi riprenderla?`)) {
              const salvata = JSON.parse(bozza.contenuto) as BozzaSeduta
              setData(salvata.data)
              setNote(salvata.note)
              setSezioni(salvata.sezioni)
              if (salvata.faseId != null) fase = salvata.faseId
            } else {
              await window.api.bozze.elimina(paziente.id)
            }
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

  // L'esercizio nuovo si infila subito dopo l'ultimo della sua categoria, non in
  // fondo: cosi' l'elenco resta raggruppato da solo e ogni categoria ha una sola
  // intestazione, anche aggiungendo gli esercizi in ordine sparso.
  const aggiungi = (idx: number, e: EsercizioConCategoria): void => {
    setSezioni(
      sezioni.map((s, i) => {
        if (i !== idx || s.righe.some((r) => r.esercizio_id === e.id)) return s
        const riga = {
          esercizio_id: e.id,
          nome: e.nome,
          categoria_nome: e.categoria_nome,
          serie: e.serie_default,
          ripetizioni: e.ripetizioni_default,
          carico: e.carico_default,
          recupero: e.recupero_default,
          nota: null,
          link: e.link,
          ha_immagine: e.ha_immagine
        }
        let dopo = -1
        s.righe.forEach((r, k) => {
          if (r.categoria_nome === e.categoria_nome) dopo = k
        })
        const righe = [...s.righe]
        righe.splice(dopo + 1 === 0 ? righe.length : dopo + 1, 0, riga)
        return { ...s, righe }
      })
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

  const { contenitore: contSez, maniglia: manSez } = useRiordino<number>((da, a) =>
    setSezioni(sposta(sezioni, da, a))
  )

  // Le righe si riordinano solo dentro la propria sezione: la chiave e' "sezione:riga".
  const { contenitore: contRiga, maniglia: manRiga } = useRiordino<string>((da, a) => {
    const [sezDa, rigaDa] = da.split(':').map(Number)
    const [sezA, rigaA] = a.split(':').map(Number)
    if (sezDa !== sezA) return
    setSezioni(
      sezioni.map((s, i) => (i === sezDa ? { ...s, righe: sposta(s.righe, rigaDa, rigaA) } : s))
    )
  })

  const rimuoviSezione = async (idx: number): Promise<void> => {
    const s = sezioni[idx]
    if (
      s.righe.length > 0 &&
      !(await chiedi(`Rimuovere la sezione "${s.nome}" e i suoi ${s.righe.length} esercizi da questa seduta?`))
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

  // La bozza si mette da parte da sola mentre componi, un secondo dopo l'ultima
  // modifica: se l'app si chiude, alla riapertura la ritrovi. Vale solo per le
  // sedute nuove — quelle gia' salvate sono gia' al sicuro nel loro posto.
  useEffect(() => {
    if (!pronto || sedutaId != null) return
    if (totaleEsercizi === 0 && note.trim() === '') return
    const bozza: BozzaSeduta = { data, faseId, note, sezioni }
    const attesa = setTimeout(() => {
      void window.api.bozze.salva(paziente.id, JSON.stringify(bozza)).catch(() => undefined)
    }, 1000)
    return () => clearTimeout(attesa)
  }, [pronto, sedutaId, paziente.id, data, faseId, note, sezioni, totaleEsercizi])

  // Esc annulla, Ctrl+S salva: la seduta si compila con la tastiera, senza
  // tornare col mouse in fondo alla finestra.
  // Annullando si decide cosa farne: buttarla via subito, o tenerla per
  // riprenderla. Chiedere qui e' meglio che ritrovarsela proposta domani senza
  // averlo voluto.
  const annulla = async (): Promise<void> => {
    if (sedutaId == null && (totaleEsercizi > 0 || note.trim() !== '')) {
      if (!(await chiedi('Tengo quello che hai messo, per riprenderlo dopo?'))) {
        await window.api.bozze.elimina(paziente.id).catch(() => undefined)
      }
    }
    onClose(false)
  }

  useScorciatoie([
    { tasto: 'Escape', azione: () => void annulla() },
    { tasto: 's', ctrl: true, azione: () => void salva() }
  ])

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
          <button onClick={() => void annulla()}>Annulla</button>
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
        const dndSez = contSez(idxSez)
        return (
          <section
            key={idxSez}
            {...dndSez}
            className={['card sezione-card', dndSez.className].filter(Boolean).join(' ')}
          >
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
                <button {...manSez(idxSez)}>
                  <GripVertical size={16} />
                </button>
                <button title="Rinomina" onClick={() => setEditSez({ idx: idxSez, nome: s.nome })}>
                  <Pencil size={16} />
                </button>
                <button title="Rimuovi sezione" className="danger" onClick={() => void rimuoviSezione(idxSez)}>
                  <X size={16} />
                </button>
              </span>
            </div>

            {s.righe.length > 0 && (
              <ul className="righe-seduta">
                {s.righe.map((r, idxRiga) => {
                  const dndRiga = contRiga(`${idxSez}:${idxRiga}`)
                  // Gli esercizi della stessa categoria restano vicini perche'
                  // e' li' che vengono inseriti, ma senza scriverne il nome: con
                  // categorie fini ("Rinforzo quadricipite", "Rinforzo
                  // hamstring") le intestazioni erano piu' delle righe.
                  return (
                  <li key={r.esercizio_id} {...dndRiga} className={dndRiga.className}>
                    <span className="maniglia-riga">
                      <button {...manRiga(`${idxSez}:${idxRiga}`)}>
                        <GripVertical size={16} />
                      </button>
                    </span>
                    <div className="riga-testata">
                      <span className="item-nome">
                        {r.nome}
                        {r.link && (
                          <button
                            className="icona-esercizio"
                            title="Apri video"
                            onClick={() =>
                              window.api.apriLink(r.link!).catch((err) => toastErrore(errMsg(err)))
                            }
                          >
                            <Video size={16} />
                          </button>
                        )}
                        {r.ha_immagine === 1 && (
                          <button
                            className="icona-esercizio"
                            title="Vedi immagine"
                            onClick={() =>
                              setImmagineAperta({ id: r.esercizio_id, nome: r.nome })
                            }
                          >
                            <ImageIcon size={16} />
                          </button>
                        )}
                      </span>
                    </div>
                    {/* Parametri e nota sulla stessa riga del nome: le etichette
                        sono nei segnaposto, cosi' un esercizio occupa una riga
                        invece di tre. */}
                    <div className="riga-params">
                      <input
                        title="Serie"
                        placeholder="serie"
                        value={r.serie ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'serie', e.target.value)}
                      />
                      <input
                        title="Ripetizioni"
                        placeholder="rip."
                        value={r.ripetizioni ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'ripetizioni', e.target.value)}
                      />
                      <input
                        title="Carico"
                        placeholder="carico"
                        value={r.carico ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'carico', e.target.value)}
                      />
                      <input
                        title="Recupero"
                        placeholder="rec."
                        value={r.recupero ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'recupero', e.target.value)}
                      />
                      <input
                        className="riga-nota"
                        title="Nota"
                        placeholder="nota…"
                        value={r.nota ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'nota', e.target.value)}
                      />
                    </div>
                    <button
                      title="Rimuovi"
                      className="danger btn-togli"
                      onClick={() => rimuoviRiga(idxSez, idxRiga)}
                    >
                      <X size={16} />
                    </button>
                  </li>
                  )
                })}
              </ul>
            )}

            {sezioneApertaPerAggiungere !== idxSez ? (
              <button
                className="aggiungi-esercizio"
                onClick={() => setApriAggiungi(idxSez)}
              >
                <Plus size={16} /> Aggiungi esercizio
              </button>
            ) : (
            <div className="aggiungi-area">
              <div className="testata-aggiungi">
                <span className="hint">Scegli un esercizio da aggiungere a “{s.nome}”</span>
                <button title="Chiudi" onClick={() => setApriAggiungi(null)}>
                  <X size={16} />
                </button>
              </div>
              <input
                autoFocus
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
                            className="icona-esercizio"
                            title="Apri video"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              window.api.apriLink(e.link!).catch((err) => toastErrore(errMsg(err)))
                            }}
                          >
                            <Video size={16} />
                          </button>
                        )}
                        {e.ha_immagine === 1 && (
                          <button
                            className="icona-esercizio"
                            title="Vedi immagine"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setImmagineAperta({ id: e.id, nome: e.nome })
                            }}
                          >
                            <ImageIcon size={16} />
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
              ) : null}
            </div>
            )}
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
          <button onClick={() => void annulla()}>Annulla</button>
          <button className="primary" onClick={() => void salva()}>
            Salva seduta ({totaleEsercizi} esercizi)
          </button>
        </div>
      </section>

      {immagineAperta && (
        <ImmagineEsercizio
          esercizioId={immagineAperta.id}
          nome={immagineAperta.nome}
          onClose={() => setImmagineAperta(null)}
        />
      )}
    </div>
  )
}
