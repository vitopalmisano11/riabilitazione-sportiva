import { useCallback, useEffect, useState } from 'react'
import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import type {
  Andamento,
  Distretto,
  MovimentoDistretto,
  NoteMovimenti,
  DistrettoCompleto,
  Grado,
  PazienteDettaglio,
  RilievoMovimento,
  RilievoTest,
  ValutazioneCompleta,
  ValutazioneRiepilogo
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import ScalaPallini from './ScalaPallini'
import { errMsg, formatData, oggiIso } from '../lib'
import { useScorciatoie } from '../scorciatoie'
import { GRUPPI } from '../pages/DistrettiPage'

const GRADI: { valore: Grado; etichetta: string }[] = [
  { valore: 0, etichetta: '—' },
  { valore: 1, etichetta: 'lieve' },
  { valore: 2, etichetta: 'moder.' },
  { valore: 3, etichetta: 'severa' }
]

const ANDAMENTI: { valore: Andamento; etichetta: string }[] = [
  // Le etichette concordano con "capacita' di carico", che e' femminile. Il
  // valore salvato resta quello di prima: le valutazioni gia' fatte non cambiano.
  { valore: 'aumentato', etichetta: 'Aumentata' },
  { valore: 'invariato', etichetta: 'Invariata' },
  { valore: 'diminuito', etichetta: 'Diminuita' }
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

  // Un clic sul distretto apre subito la valutazione: sceglierlo e poi premere
  // un secondo pulsante era un passaggio in piu' per la cosa che si fa sempre.
  const crea = async (distretti: number[]): Promise<void> => {
    if (distretti.length === 0) return
    try {
      const id = await window.api.valutazioni.create(paziente.id, oggiIso(), distretti)
      setScelta(null)
      await load()
      setAperta({ id, soloLettura: false })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Rivalutare vuol dire rifare gli stessi movimenti: si riparte dai valori
  // dell'altra volta e si cambiano solo quelli cambiati. I testi discorsivi
  // restano vuoti, perche' raccontano quel giorno la'.
  const duplica = async (v: ValutazioneRiepilogo): Promise<void> => {
    try {
      const id = await window.api.valutazioni.duplica(v.id, oggiIso())
      await load()
      setAperta({ id, soloLettura: false })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (v: ValutazioneRiepilogo): Promise<void> => {
    if (!(await chiedi(`Eliminare la valutazione del ${formatData(v.data)}?`))) return
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
                <button
                  title="Nuova valutazione partendo da questa"
                  onClick={() => void duplica(v)}
                >
                  <Copy size={18} />
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
            <h3>Quale distretto valuti?</h3>
            <p className="modal-testo">
              {scelta.length > 0
                ? 'Quelli abituali della patologia sono in cima. Clicca il distretto: la valutazione si apre subito.'
                : 'Clicca il distretto: la valutazione si apre subito.'}
            </p>
            <ul className="scelte-questionari">
              {/* Prima quelli abituali della patologia, poi gli altri: la scelta
                  piu' probabile sta in cima e si trova senza cercare. */}
              {[...distretti]
                .sort(
                  (a, b) =>
                    Number(scelta.includes(b.id)) - Number(scelta.includes(a.id)) ||
                    a.nome.localeCompare(b.nome)
                )
                .map((d) => (
                  <li key={d.id}>
                    <button
                      className={scelta.includes(d.id) ? 'scelta-attiva' : ''}
                      onClick={() => void crea([d.id])}
                    >
                      {d.nome}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="modal-actions">
              <button onClick={() => setScelta(null)}>Annulla</button>
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

  useScorciatoie([
    { tasto: 'Escape', azione: () => void chiudi() },
    { tasto: 's', ctrl: true, azione: () => void salva(), attiva: !soloLettura && modificato }
  ])

  // Come nella body chart: un clic fuori dalla finestra non deve buttare via
  // una valutazione appena compilata.
  const chiudi = async (): Promise<void> => {
    if (modificato && !(await chiedi('Hai modifiche non salvate. Vuoi uscire lo stesso?'))) return
    onChiudi(false)
  }

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

  const noteDi = (distrettoId: number): NoteMovimenti =>
    dati.note_movimenti.find((n) => n.distretto_id === distrettoId) ?? {
      distretto_id: distrettoId,
      attivo: null,
      passivo: null
    }

  const cambiaNote = (distrettoId: number, patch: Partial<NoteMovimenti>): void => {
    const nuovo = { ...noteDi(distrettoId), ...patch }
    aggiorna({
      note_movimenti: [
        ...dati.note_movimenti.filter((n) => n.distretto_id !== distrettoId),
        nuovo
      ]
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
    <div className="modal-overlay" onClick={() => void chiudi()}>
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

        {/* Un riquadro per distretto, e dentro un riquadro per i movimenti e
            uno per ogni gruppo di test: senza, la pagina era un seguito di
            righe in cui non si capiva dove finiva una cosa e cominciava
            l'altra. */}
        {librerie.map((lib) => (
          <div key={lib.distretto.id} className="riquadro-distretto">
            <div className="sotto-titolo titolo-distretto">{lib.distretto.nome}</div>

            {lib.movimenti.length > 0 && (
              <TabellaMovimenti
                movimenti={lib.movimenti}
                soloLettura={soloLettura}
                rilievo={rilievo}
                onCambia={cambiaMovimento}
                note={noteDi(lib.distretto.id as number)}
                onNote={(patch) => cambiaNote(lib.distretto.id as number, patch)}
              />
            )}

            {GRUPPI.map((g) => {
              const test = lib.test.filter((t) => t.gruppo === g.valore)
              if (test.length === 0) return null
              return (
                <div key={g.valore} className="riquadro-test">
                  <div className="sotto-titolo">{g.etichetta}</div>
                  {test.map((t) => {
                    const r = rispostaTest(t.id as number)
                    return (
                      <div key={t.id} className="riga-parametro riga-test">
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
                          // La stessa fascia di pallini dei questionari: e'
                          // una scala, e come scala si legge.
                          <ScalaPallini
                            min={0}
                            max={5}
                            valore={r.valore == null || r.valore === '' ? null : Number(r.valore)}
                            soloLettura={soloLettura}
                            onCambia={(v) =>
                              cambiaTest(t.id as number, {
                                valore: r.valore === String(v) ? null : String(v)
                              })
                            }
                          />
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
          <button onClick={() => void chiudi()}>{soloLettura ? 'Chiudi' : 'Annulla'}</button>
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

// Movimento attivo e passivo in due riquadri affiancati.
//
// Prima erano le colonne di un'unica tabella, con intestazioni come "Attivo —
// restrizione" che andavano a capo e si leggevano male. Separandoli, ogni
// riquadro ha le sue tre colonnine corte e il confronto fra attivo e passivo si
// fa guardando a destra e a sinistra.
//
// La restrizione si segna con +, ++ e +++ invece che con un menu: sono i segni
// che si usano a mano sul foglio e si clicca una volta sola, invece di aprire
// una tendina. Il dolore e' una spunta: c'e' o non c'e'.
const SEGNI: { valore: Grado; segno: string; titolo: string }[] = [
  { valore: 1, segno: '+', titolo: 'Restrizione lieve' },
  { valore: 2, segno: '++', titolo: 'Restrizione moderata' },
  { valore: 3, segno: '+++', titolo: 'Restrizione severa' }
]

function TabellaMovimenti({
  movimenti,
  soloLettura,
  rilievo,
  onCambia,
  note,
  onNote
}: {
  movimenti: MovimentoDistretto[]
  soloLettura: boolean
  rilievo: (id: number) => RilievoMovimento
  onCambia: (id: number, patch: Partial<RilievoMovimento>) => void
  note: NoteMovimenti
  onNote: (patch: Partial<NoteMovimenti>) => void
}): React.JSX.Element {
  const conGradi = movimenti.some((m) => m.gradi === 1)

  // Una riga per movimento: il nome, poi i rilievi dell'attivo e quelli del
  // passivo. Le due meta' si distinguono con una riga verticale.
  const celle = (
    id: number,
    m: MovimentoDistretto,
    campoRestrizione: 'attivo_restrizione' | 'passivo_restrizione',
    campoDolore: 'attivo_dolore' | 'passivo_dolore',
    campoGradi: 'attivo_gradi' | 'passivo_gradi',
    primaColonna: boolean
  ): React.JSX.Element => {
    const r = rilievo(id)
    const restrizione = r[campoRestrizione]
    const stacco = primaColonna ? ' stacco-lato' : ''
    return (
      <>
        <td className={`col-restrizione${stacco}`}>
          <span className="scala-segni">
            {SEGNI.map((g) => (
              <button
                key={g.valore}
                type="button"
                title={g.titolo}
                disabled={soloLettura}
                className={restrizione === g.valore ? 'scelta-attiva' : ''}
                // ripremendo lo stesso segno si toglie: e' il modo piu' veloce
                // per correggere un clic sbagliato
                onClick={() =>
                  onCambia(id, {
                    [campoRestrizione]: restrizione === g.valore ? null : g.valore
                  })
                }
              >
                {g.segno}
              </button>
            ))}
          </span>
        </td>
        <td className="col-dolore">
          <input
            type="checkbox"
            title="Dolore durante il movimento"
            disabled={soloLettura}
            // i rilievi vecchi avevano il dolore graduato: qualunque valore
            // diverso da zero vuol dire che il dolore c'era
            checked={(r[campoDolore] ?? 0) > 0}
            onChange={(e) => onCambia(id, { [campoDolore]: e.target.checked ? 1 : null })}
          />
        </td>
        {conGradi && (
          <td className="col-gradi">
            {m.gradi === 1 ? (
              <input
                type="number"
                className="campo-gradi"
                disabled={soloLettura}
                value={r[campoGradi] ?? ''}
                onChange={(e) =>
                  onCambia(id, {
                    [campoGradi]: e.target.value === '' ? null : Number(e.target.value)
                  })
                }
              />
            ) : (
              <span className="hint">&mdash;</span>
            )}
          </td>
        )}
      </>
    )
  }

  const intestazioneLato = (primaColonna: boolean): React.JSX.Element => (
    <>
      <th className={primaColonna ? 'col-restrizione stacco-lato' : 'col-restrizione'}>
        Intensità
      </th>
      <th className="col-dolore">Dolore</th>
      {conGradi && <th className="col-gradi">Gradi</th>}
    </>
  )

  return (
    <div className="movimenti riquadro-test">
      <table className="tabella-movimenti">
        <thead>
          <tr>
            <th className="col-nome" rowSpan={2}>
              Movimento
            </th>
            <th className="lato-attivo stacco-lato" colSpan={conGradi ? 3 : 2}>
              Attivo
            </th>
            <th className="lato-passivo stacco-lato" colSpan={conGradi ? 3 : 2}>
              Passivo
            </th>
          </tr>
          <tr>
            {intestazioneLato(true)}
            {intestazioneLato(true)}
          </tr>
        </thead>
        <tbody>
          {movimenti.map((m) => {
            const id = m.id as number
            return (
              <tr key={id}>
                <td className="col-nome">{m.nome}</td>
                {celle(id, m, 'attivo_restrizione', 'attivo_dolore', 'attivo_gradi', true)}
                {celle(id, m, 'passivo_restrizione', 'passivo_dolore', 'passivo_gradi', true)}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Una nota per lato: quello che si annota ("in inclinazione a destra
          tira a sinistra") riguarda l'insieme dei movimenti provati in quel
          modo, non il singolo movimento. */}
      <div className="note-movimenti">
        {(['attivo', 'passivo'] as const).map((lato) => (
          <label key={lato} className="nota-movimenti">
            Note del movimento {lato}
            <textarea
              rows={2}
              disabled={soloLettura}
              value={note[lato] ?? ''}
              onChange={(e) => onNote({ [lato]: e.target.value || null })}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
