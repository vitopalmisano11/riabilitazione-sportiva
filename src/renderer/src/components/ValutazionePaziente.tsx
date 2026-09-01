import { useCallback, useEffect, useState } from 'react'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import type {
  Andamento,
  Distretto,
  MovimentoDistretto,
  DistrettoCompleto,
  Grado,
  PazienteDettaglio,
  RilievoMovimento,
  RilievoTest,
  ValutazioneCompleta,
  ValutazioneRiepilogo
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg, formatData, oggiIso } from '../lib'
import { GRUPPI } from '../pages/DistrettiPage'

const GRADI: { valore: Grado; etichetta: string }[] = [
  { valore: 0, etichetta: '—' },
  { valore: 1, etichetta: 'lieve' },
  { valore: 2, etichetta: 'moder.' },
  { valore: 3, etichetta: 'severa' }
]

const ANDAMENTI: { valore: Andamento; etichetta: string }[] = [
  { valore: 'aumentato', etichetta: 'Aumentato' },
  { valore: 'invariato', etichetta: 'Invariato' },
  { valore: 'diminuito', etichetta: 'Diminuito' }
]

// Storico delle valutazioni obiettive: si aggiunge, si rivede e si modifica,
// come la body chart.
export default function ValutazionePaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [elenco, setElenco] = useState<ValutazioneRiepilogo[]>([])
  const [distretti, setDistretti] = useState<Distretto[]>([])
  const [aperta, setAperta] = useState<{ id: number; soloLettura: boolean } | null>(null)
  const [scelta, setScelta] = useState<number[] | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      setElenco(await window.api.valutazioni.list(paziente.id))
      setDistretti(await window.api.distretti.list())
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void load()
  }, [load])

  // All'apertura si preselezionano i distretti abituali della patologia.
  const apriScelta = async (): Promise<void> => {
    try {
      const suggeriti =
        paziente.patologia_id != null
          ? await window.api.patologie.distretti(paziente.patologia_id)
          : []
      setScelta(suggeriti)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const crea = async (): Promise<void> => {
    if (!scelta) return
    try {
      const id = await window.api.valutazioni.create(paziente.id, oggiIso(), scelta)
      setScelta(null)
      await load()
      setAperta({ id, soloLettura: false })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (v: ValutazioneRiepilogo): Promise<void> => {
    if (!confirm(`Eliminare la valutazione del ${formatData(v.data)}?`)) return
    try {
      await window.api.valutazioni.remove(v.id)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>Valutazione obiettiva</h3>
        <span className="row-actions">
          <button
            className="primary"
            title="Nuova valutazione"
            disabled={distretti.length === 0}
            onClick={() => void apriScelta()}
          >
            <Plus size={18} />
          </button>
        </span>
      </div>

      {distretti.length === 0 ? (
        <p className="hint">
          Nessun distretto configurato: creane uno in Configurazione, &ldquo;Distretti&rdquo;, con i
          suoi movimenti e test.
        </p>
      ) : elenco.length === 0 ? (
        <p className="hint">Nessuna valutazione per questo paziente.</p>
      ) : (
        <ul className="sedute-list">
          {elenco.map((v) => (
            <li key={v.id}>
              <div className="seduta-info">
                <span className="seduta-data">{formatData(v.data)}</span>
                <span className="seduta-meta">
                  {v.num_distretti === 1 ? '1 distretto' : `${v.num_distretti} distretti`}
                </span>
                {v.note && <span className="seduta-obiettivi">{v.note}</span>}
              </div>
              <span className="row-actions">
                <button title="Anteprima" onClick={() => setAperta({ id: v.id, soloLettura: true })}>
                  <Eye size={18} />
                </button>
                <button title="Modifica" onClick={() => setAperta({ id: v.id, soloLettura: false })}>
                  <Pencil size={18} />
                </button>
                <button className="danger" title="Elimina" onClick={() => void elimina(v)}>
                  <Trash2 size={18} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {scelta != null && (
        <div className="modal-overlay" onClick={() => setScelta(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>Quali distretti valuti?</h3>
            <p className="modal-testo">
              Quelli abituali della patologia sono già scelti. Cliccane altri se il paziente ha
              più problemi, o riclicca per toglierli.
            </p>
            <ul className="scelte-questionari">
              {distretti.map((d) => (
                <li key={d.id}>
                  <button
                    className={scelta.includes(d.id) ? 'scelta-attiva' : ''}
                    onClick={() =>
                      setScelta(
                        scelta.includes(d.id)
                          ? scelta.filter((x) => x !== d.id)
                          : [...scelta, d.id]
                      )
                    }
                  >
                    {d.nome}
                  </button>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button onClick={() => setScelta(null)}>Annulla</button>
              <button className="primary" disabled={scelta.length === 0} onClick={() => void crea()}>
                Apri la valutazione
              </button>
            </div>
          </div>
        </div>
      )}

      {aperta && (
        <SchedaValutazione
          key={aperta.id}
          id={aperta.id}
          soloLettura={aperta.soloLettura}
          onChiudi={(salvata) => {
            setAperta(null)
            if (salvata) void load()
          }}
        />
      )}
    </section>
  )
}

function SchedaValutazione({
  id,
  soloLettura,
  onChiudi
}: {
  id: number
  soloLettura: boolean
  onChiudi: (salvata: boolean) => void
}): React.JSX.Element {
  const [dati, setDati] = useState<ValutazioneCompleta | null>(null)
  const [librerie, setLibrerie] = useState<DistrettoCompleto[]>([])
  const [modificato, setModificato] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const v = await window.api.valutazioni.get(id)
        setDati(v)
        setLibrerie(await Promise.all(v.distretto_ids.map((d) => window.api.distretti.get(d))))
      } catch (e) {
        toastErrore(errMsg(e))
      }
    })()
  }, [id])

  if (!dati) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <p className="hint">Caricamento…</p>
        </div>
      </div>
    )
  }

  const aggiorna = (patch: Partial<ValutazioneCompleta>): void => {
    setDati({ ...dati, ...patch })
    setModificato(true)
  }

  const campoValutazione = (patch: Partial<ValutazioneCompleta['valutazione']>): void =>
    aggiorna({ valutazione: { ...dati.valutazione, ...patch } })

  const rilievo = (movimentoId: number): RilievoMovimento =>
    dati.movimenti.find((m) => m.movimento_id === movimentoId) ?? {
      movimento_id: movimentoId,
      attivo_restrizione: null,
      attivo_dolore: null,
      attivo_gradi: null,
      passivo_restrizione: null,
      passivo_dolore: null,
      passivo_gradi: null,
      nota: null
    }

  const cambiaMovimento = (movimentoId: number, patch: Partial<RilievoMovimento>): void => {
    const attuale = rilievo(movimentoId)
    const nuovo = { ...attuale, ...patch }
    aggiorna({
      movimenti: [...dati.movimenti.filter((m) => m.movimento_id !== movimentoId), nuovo]
    })
  }

  const rispostaTest = (testId: number): RilievoTest =>
    dati.test.find((t) => t.test_id === testId) ?? { test_id: testId, valore: null, nota: null }

  const cambiaTest = (testId: number, patch: Partial<RilievoTest>): void => {
    const nuovo = { ...rispostaTest(testId), ...patch }
    aggiorna({ test: [...dati.test.filter((t) => t.test_id !== testId), nuovo] })
  }

  const salva = async (): Promise<void> => {
    try {
      await window.api.valutazioni.salva(dati)
      toast('Valutazione salvata.')
      onChiudi(true)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={() => onChiudi(false)}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="card-header-row">
          <h3>{soloLettura ? 'Valutazione obiettiva' : 'Valutazione obiettiva — modifica'}</h3>
          <label className="compila-data">
            Data
            <input
              type="date"
              disabled={soloLettura}
              value={dati.valutazione.data}
              onChange={(e) => campoValutazione({ data: e.target.value })}
            />
          </label>
        </div>

        <label>
          Ispezione, osservazione e palpazione
          <textarea
            rows={2}
            disabled={soloLettura}
            value={dati.valutazione.ispezione ?? ''}
            onChange={(e) => campoValutazione({ ispezione: e.target.value || null })}
          />
        </label>

        {librerie.map((lib) => (
          <div key={lib.distretto.id} className="lista-domande">
            <div className="sotto-titolo">{lib.distretto.nome}</div>

            {lib.movimenti.length > 0 && (
              <TabellaMovimenti
                movimenti={lib.movimenti}
                soloLettura={soloLettura}
                rilievo={rilievo}
                onCambia={cambiaMovimento}
              />
            )}

            {GRUPPI.map((g) => {
              const test = lib.test.filter((t) => t.gruppo === g.valore)
              if (test.length === 0) return null
              return (
                <div key={g.valore}>
                  <div className="sotto-titolo">{g.etichetta}</div>
                  {test.map((t) => {
                    const r = rispostaTest(t.id as number)
                    return (
                      <div key={t.id} className="riga-parametro">
                        <span className="item-nome">{t.nome}</span>
                        {t.risposta === 'posneg' ? (
                          <span className="scelta-coppia">
                            {['positivo', 'negativo'].map((v) => (
                              <button
                                key={v}
                                disabled={soloLettura}
                                className={r.valore === v ? 'scelta-attiva' : ''}
                                onClick={() =>
                                  cambiaTest(t.id as number, { valore: r.valore === v ? null : v })
                                }
                              >
                                {v}
                              </button>
                            ))}
                          </span>
                        ) : t.risposta === 'scala5' ? (
                          <select
                            className="campo-stretto"
                            disabled={soloLettura}
                            value={r.valore ?? ''}
                            onChange={(e) =>
                              cambiaTest(t.id as number, { valore: e.target.value || null })
                            }
                          >
                            <option value="">—</option>
                            {['0', '1', '2', '3', '4', '5'].map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            disabled={soloLettura}
                            placeholder="Esito"
                            value={r.valore ?? ''}
                            onChange={(e) =>
                              cambiaTest(t.id as number, { valore: e.target.value || null })
                            }
                          />
                        )}
                        <input
                          className="campo-nota-test"
                          disabled={soloLettura}
                          placeholder="Nota"
                          value={r.nota ?? ''}
                          onChange={(e) =>
                            cambiaTest(t.id as number, { nota: e.target.value || null })
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}

        <div className="sotto-titolo">Carico e capacità di carico</div>
        <div className="griglia-carico">
          {(
            [
              ['carico_locale', 'Carico locale'],
              ['carico_generale', 'Carico generale'],
              ['capacita_locale', 'Capacità di carico locale'],
              ['capacita_generale', 'Capacità di carico generale']
            ] as const
          ).map(([chiave, etichetta]) => (
            <div key={chiave} className="riga-sino">
              <span>{etichetta}</span>
              <select
                className="campo-andamento"
                disabled={soloLettura}
                value={dati.valutazione[chiave] ?? ''}
                onChange={(e) =>
                  campoValutazione({ [chiave]: (e.target.value || null) as Andamento | null })
                }
              >
                <option value="">—</option>
                {ANDAMENTI.map((a) => (
                  <option key={a.valore} value={a.valore}>
                    {a.etichetta}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <label>
          Note
          <textarea
            rows={2}
            disabled={soloLettura}
            value={dati.valutazione.note ?? ''}
            onChange={(e) => campoValutazione({ note: e.target.value || null })}
          />
        </label>

        <div className="modal-actions">
          <button onClick={() => onChiudi(false)}>{soloLettura ? 'Chiudi' : 'Annulla'}</button>
          {!soloLettura && (
            <button className="primary" disabled={!modificato} onClick={() => void salva()}>
              Salva
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Le colonne dei gradi compaiono solo se almeno un movimento del distretto e'
// segnato come misurabile: altrove la tabella resta a cinque colonne.
function TabellaMovimenti({
  movimenti,
  soloLettura,
  rilievo,
  onCambia
}: {
  movimenti: MovimentoDistretto[]
  soloLettura: boolean
  rilievo: (id: number) => RilievoMovimento
  onCambia: (id: number, patch: Partial<RilievoMovimento>) => void
}): React.JSX.Element {
  const conGradi = movimenti.some((m) => m.gradi === 1)

  const cella = (id: number, campo: keyof RilievoMovimento, valore: Grado): React.JSX.Element => (
    <select
      disabled={soloLettura}
      value={valore ?? ''}
      onChange={(e) =>
        onCambia(id, {
          [campo]: e.target.value === '' ? null : (Number(e.target.value) as Grado)
        })
      }
    >
      <option value="">—</option>
      {GRADI.filter((g) => g.valore !== 0).map((g) => (
        <option key={g.valore} value={g.valore as number}>
          {g.etichetta}
        </option>
      ))}
    </select>
  )

  const gradi = (
    id: number,
    campo: 'attivo_gradi' | 'passivo_gradi',
    valore: number | null,
    misurabile: boolean
  ): React.JSX.Element =>
    misurabile ? (
      <input
        type="number"
        className="campo-gradi"
        disabled={soloLettura}
        value={valore ?? ''}
        onChange={(e) => onCambia(id, { [campo]: e.target.value === '' ? null : Number(e.target.value) })}
      />
    ) : (
      <span className="hint">—</span>
    )

  return (
    <table className="data-table tabella-movimenti">
      <thead>
        <tr>
          <th className="col-nome">Movimento</th>
          <th>Attivo — restrizione</th>
          <th>Attivo — dolore</th>
          {conGradi && <th className="col-gradi">Attivo °</th>}
          <th>Passivo — restrizione</th>
          <th>Passivo — dolore</th>
          {conGradi && <th className="col-gradi">Passivo °</th>}
        </tr>
      </thead>
      <tbody>
        {movimenti.map((m) => {
          const id = m.id as number
          const r = rilievo(id)
          return (
            <tr key={id}>
              <td className="col-nome">{m.nome}</td>
              <td>{cella(id, 'attivo_restrizione', r.attivo_restrizione)}</td>
              <td>{cella(id, 'attivo_dolore', r.attivo_dolore)}</td>
              {conGradi && (
                <td className="col-gradi">
                  {gradi(id, 'attivo_gradi', r.attivo_gradi, m.gradi === 1)}
                </td>
              )}
              <td>{cella(id, 'passivo_restrizione', r.passivo_restrizione)}</td>
              <td>{cella(id, 'passivo_dolore', r.passivo_dolore)}</td>
              {conGradi && (
                <td className="col-gradi">
                  {gradi(id, 'passivo_gradi', r.passivo_gradi, m.gradi === 1)}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
