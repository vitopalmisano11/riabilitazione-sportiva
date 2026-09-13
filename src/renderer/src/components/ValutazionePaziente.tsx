import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import type {
  Andamento,
  Distretto,
  MovimentoDistretto,
  NoteMovimenti,
  DistrettoCompleto,
  Grado,
  LatoRilievo,
  PazienteDettaglio,
  RilievoMovimento,
  RilievoTest,
  ValutazioneCompleta,
  ValutazioneRiepilogo
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import ScalaPallini from './ScalaPallini'
import Aiuto from './Aiuto'
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
          latoInteressato={paziente.arto_operato ?? null}
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
  latoInteressato,
  onChiudi
}: {
  id: number
  soloLettura: boolean
  // il lato operato o infortunato scritto nel paziente, se c'e'
  latoInteressato: 'dx' | 'sx' | null
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

  // Un rilievo e' di un movimento e di un lato: '' per i distretti che non
  // hanno lato, 'dx' e 'sx' per quelli che si valutano da tutte e due le parti.
  const stesso = (m: RilievoMovimento, movimentoId: number, lato: LatoRilievo): boolean =>
    m.movimento_id === movimentoId && (m.lato ?? '') === lato

  const rilievoIn = (
    lista: RilievoMovimento[],
    movimentoId: number,
    lato: LatoRilievo
  ): RilievoMovimento =>
    lista.find((m) => stesso(m, movimentoId, lato)) ?? {
      movimento_id: movimentoId,
      lato,
      attivo_restrizione: null,
      attivo_dolore: null,
      attivo_gradi: null,
      passivo_restrizione: null,
      passivo_dolore: null,
      passivo_gradi: null,
      nota: null,
      norma: null
    }

  const rilievo = (movimentoId: number, lato: LatoRilievo): RilievoMovimento =>
    rilievoIn(dati.movimenti, movimentoId, lato)

  const cambiaMovimento = (
    movimentoId: number,
    lato: LatoRilievo,
    patch: Partial<RilievoMovimento>
  ): void => {
    const nuovo = { ...rilievo(movimentoId, lato), ...patch }
    // Segnare un'intensita' o il dolore vuol dire che nella norma non e'.
    const segnato = (
      ['attivo_restrizione', 'attivo_dolore', 'passivo_restrizione', 'passivo_dolore'] as const
    ).some((k) => k in patch && patch[k] != null)
    if (segnato) nuovo.norma = null
    aggiorna({
      movimenti: [...dati.movimenti.filter((m) => !stesso(m, movimentoId, lato)), nuovo]
    })
  }

  // "Il resto nella norma": segna tutti i movimenti di quel lato che non hanno
  // ne' un'intensita' ne' il dolore. Quelli gia' segnati restano come sono.
  const restoNellaNorma = (movimenti: MovimentoDistretto[], lato: LatoRilievo): void => {
    let lista = dati.movimenti
    for (const m of movimenti) {
      const r = rilievoIn(lista, m.id as number, lato)
      const segnato =
        r.attivo_restrizione != null ||
        (r.attivo_dolore ?? 0) > 0 ||
        r.passivo_restrizione != null ||
        (r.passivo_dolore ?? 0) > 0
      if (segnato) continue
      lista = [...lista.filter((x) => !stesso(x, m.id as number, lato)), { ...r, norma: 1 }]
    }
    aggiorna({ movimenti: lista })
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

  const rispostaTest = (testId: number, lato: LatoRilievo): RilievoTest =>
    dati.test.find((t) => t.test_id === testId && (t.lato ?? '') === lato) ?? {
      test_id: testId,
      lato,
      valore: null,
      nota: null
    }

  const cambiaTest = (testId: number, lato: LatoRilievo, patch: Partial<RilievoTest>): void => {
    const nuovo = { ...rispostaTest(testId, lato), ...patch }
    aggiorna({
      test: [
        ...dati.test.filter((t) => !(t.test_id === testId && (t.lato ?? '') === lato)),
        nuovo
      ]
    })
  }

  // Da quali lati si valuta un distretto. Se nella libreria ha il lato si' — a
  // meno che questa valutazione non sia stata scritta prima, senza lati: allora
  // resta com'era, altrimenti i valori di quel giorno sparirebbero dalla vista.
  const latiDi = (lib: DistrettoCompleto): LatoRilievo[] => {
    if (lib.distretto.bilaterale !== 1) return ['']
    const movimenti = new Set(lib.movimenti.map((m) => m.id))
    const test = new Set(lib.test.map((t) => t.id))
    const scrittaSenzaLati =
      dati.movimenti.some((m) => movimenti.has(m.movimento_id) && (m.lato ?? '') === '') ||
      dati.test.some((t) => test.has(t.test_id) && (t.lato ?? '') === '')
    return scrittaSenzaLati ? [''] : ['dx', 'sx']
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
        {librerie.map((lib) => {
          const lati = latiDi(lib)
          return (
            <div key={lib.distretto.id} className="riquadro-distretto">
              <div className="sotto-titolo titolo-distretto">{lib.distretto.nome}</div>

              {lib.movimenti.length > 0 && (
                <TabellaMovimenti
                  movimenti={lib.movimenti}
                  lati={lati}
                  latoInteressato={latoInteressato}
                  soloLettura={soloLettura}
                  rilievo={rilievo}
                  onCambia={cambiaMovimento}
                  onRestoNellaNorma={(lato) => restoNellaNorma(lib.movimenti, lato)}
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
                    {test.map((t) =>
                      lati.map((lato, j) => {
                        const r = rispostaTest(t.id as number, lato)
                        return (
                          <div
                            key={`${t.id}-${lato}`}
                            className={
                              lati.length > 1 && j === 0
                                ? 'riga-parametro riga-test primo-lato'
                                : 'riga-parametro riga-test'
                            }
                          >
                            <span className="item-nome">
                              {/* con i due lati il nome si scrive una volta sola */}
                              <span className="nome-test">{j === 0 ? t.nome : ''}</span>
                              {lato !== '' && (
                                <EtichettaLato lato={lato} interessato={lato === latoInteressato} />
                              )}
                            </span>
                            {t.risposta === 'posneg' ? (
                              <span className="scelta-coppia">
                                {['positivo', 'negativo'].map((v) => (
                                  <button
                                    key={v}
                                    disabled={soloLettura}
                                    className={r.valore === v ? 'scelta-attiva' : ''}
                                    onClick={() =>
                                      cambiaTest(t.id as number, lato, {
                                        valore: r.valore === v ? null : v
                                      })
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
                                  cambiaTest(t.id as number, lato, {
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
                                  cambiaTest(t.id as number, lato, {
                                    valore: e.target.value || null
                                  })
                                }
                              />
                            )}
                            <input
                              className="campo-nota-test"
                              disabled={soloLettura}
                              placeholder="Nota"
                              value={r.nota ?? ''}
                              onChange={(e) =>
                                cambiaTest(t.id as number, lato, { nota: e.target.value || null })
                              }
                            />
                          </div>
                        )
                      })
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

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

// "Dx" o "Sx" accanto al movimento o al test; il lato interessato si
// riconosce dal colore.
function EtichettaLato({
  lato,
  interessato
}: {
  lato: 'dx' | 'sx'
  interessato: boolean
}): React.JSX.Element {
  return (
    <span
      className={interessato ? 'etichetta-lato interessato' : 'etichetta-lato'}
      title={`${lato === 'dx' ? 'Destra' : 'Sinistra'}${interessato ? ' — lato interessato' : ''}`}
    >
      {lato === 'dx' ? 'Dx' : 'Sx'}
    </span>
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
  lati,
  latoInteressato,
  soloLettura,
  rilievo,
  onCambia,
  onRestoNellaNorma,
  note,
  onNote
}: {
  movimenti: MovimentoDistretto[]
  lati: LatoRilievo[]
  latoInteressato: 'dx' | 'sx' | null
  soloLettura: boolean
  rilievo: (id: number, lato: LatoRilievo) => RilievoMovimento
  onCambia: (id: number, lato: LatoRilievo, patch: Partial<RilievoMovimento>) => void
  onRestoNellaNorma: (lato: LatoRilievo) => void
  note: NoteMovimenti
  onNote: (patch: Partial<NoteMovimenti>) => void
}): React.JSX.Element {
  const conGradi = movimenti.some((m) => m.gradi === 1)

  // Niente tabella: una griglia a tre colonne — il nome, l'attivo, il passivo.
  // Le due meta' sono larghe uguali per costruzione, dentro ognuna i rilievi si
  // dividono lo spazio in parti uguali, e le note in fondo usano la stessa
  // griglia, quindi cadono esattamente sotto alla loro meta'. Con la tabella
  // le colonne si allargavano sul contenuto: il nome si prendeva il vuoto e i
  // titoli non stavano piu' sopra ai numeri.
  const titoliLato = (): React.JSX.Element => (
    <>
      <span>Intensità</span>
      <span>Dolore</span>
      {conGradi && <span>Gradi</span>}
    </>
  )

  const rilieviLato = (
    id: number,
    lato: LatoRilievo,
    m: MovimentoDistretto,
    campoRestrizione: 'attivo_restrizione' | 'passivo_restrizione',
    campoDolore: 'attivo_dolore' | 'passivo_dolore',
    campoGradi: 'attivo_gradi' | 'passivo_gradi'
  ): React.JSX.Element => {
    const r = rilievo(id, lato)
    const restrizione = r[campoRestrizione]
    return (
      <>
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
                onCambia(id, lato, {
                  [campoRestrizione]: restrizione === g.valore ? null : g.valore
                })
              }
            >
              {g.segno}
            </button>
          ))}
        </span>
        <span className="gm-dolore">
          <input
            type="checkbox"
            title="Dolore durante il movimento"
            disabled={soloLettura}
            // i rilievi vecchi avevano il dolore graduato: qualunque valore
            // diverso da zero vuol dire che il dolore c'era
            checked={(r[campoDolore] ?? 0) > 0}
            onChange={(e) => onCambia(id, lato, { [campoDolore]: e.target.checked ? 1 : null })}
          />
        </span>
        {conGradi && (
          <span className="gm-gradi">
            {m.gradi === 1 ? (
              <input
                type="number"
                className="campo-gradi"
                disabled={soloLettura}
                value={r[campoGradi] ?? ''}
                onChange={(e) =>
                  onCambia(id, lato, {
                    [campoGradi]: e.target.value === '' ? null : Number(e.target.value)
                  })
                }
              />
            ) : (
              <span className="hint">&mdash;</span>
            )}
          </span>
        )}
      </>
    )
  }

  const nomeLato = (lato: LatoRilievo): string =>
    lato === 'dx' ? 'a destra' : lato === 'sx' ? 'a sinistra' : ''

  return (
    <div className="movimenti">
      {/* Un clic per dire che quello che non hai segnato e' nella norma: la
          relazione e la cartella lo scrivono, invece di lasciare il dubbio fra
          "normale" e "non valutato". Sul lato sano di solito basta questo. */}
      {!soloLettura && (
        <div className="azioni-norma">
          {lati.map((lato) => (
            <button
              key={lato}
              type="button"
              className="btn-piccolo"
              onClick={() => onRestoNellaNorma(lato)}
            >
              <Check size={14} /> Il resto {nomeLato(lato)} nella norma
              {lato !== '' && lato === latoInteressato ? ' (lato interessato)' : ''}
            </button>
          ))}
          <Aiuto testo="Segna nella norma tutti i movimenti di quel lato in cui non hai messo né l'intensità né il dolore. Quelli che hai già segnato restano come sono. Il segno di spunta accanto a ogni movimento fa la stessa cosa per un movimento solo; se poi segni un'intensità o il dolore, la spunta si toglie da sola." />
        </div>
      )}

      <div className={conGradi ? 'griglia-movimenti con-gradi' : 'griglia-movimenti'}>
        <span className="gm-angolo" />
        <div className="gm-lato">Attivo</div>
        <div className="gm-lato">Passivo</div>

        <div className="gm-titolo">Movimento</div>
        <div className="gm-sotto">{titoliLato()}</div>
        <div className="gm-sotto">{titoliLato()}</div>

        {movimenti.map((m, i) =>
          lati.map((lato, j) => {
            const id = m.id as number
            const r = rilievo(id, lato)
            const classi = [
              'gm-riga',
              i % 2 === 1 ? 'pari' : '',
              // con i due lati, fra un movimento e l'altro la linea e' piu'
              // marcata che fra destra e sinistra dello stesso movimento
              lati.length > 1 && j === lati.length - 1 ? 'ultimo-lato' : '',
              r.norma === 1 ? 'in-norma' : ''
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <div key={`${id}-${lato}`} className={classi}>
                <div className="gm-nome">
                  <span className="gm-mov">{j === 0 ? m.nome : ''}</span>
                  {lato !== '' && (
                    <EtichettaLato lato={lato} interessato={lato === latoInteressato} />
                  )}
                  <button
                    type="button"
                    className={r.norma === 1 ? 'btn-norma scelta-attiva' : 'btn-norma'}
                    title="Nella norma"
                    disabled={soloLettura}
                    onClick={() =>
                      onCambia(
                        id,
                        lato,
                        r.norma === 1
                          ? { norma: null }
                          : {
                              norma: 1,
                              attivo_restrizione: null,
                              attivo_dolore: null,
                              passivo_restrizione: null,
                              passivo_dolore: null
                            }
                      )
                    }
                  >
                    <Check size={14} />
                  </button>
                </div>
                <div className="gm-rilievi">
                  {rilieviLato(id, lato, m, 'attivo_restrizione', 'attivo_dolore', 'attivo_gradi')}
                </div>
                <div className="gm-rilievi">
                  {rilieviLato(id, lato, m, 'passivo_restrizione', 'passivo_dolore', 'passivo_gradi')}
                </div>
              </div>
            )
          })
        )}

        {/* Una nota per lato: quello che si annota ("in inclinazione a destra
            tira a sinistra") riguarda l'insieme dei movimenti provati in quel
            modo, non il singolo movimento. La colonna vuota tiene il posto del
            nome, cosi' ogni nota sta sotto alla sua meta'. */}
        <span className="gm-angolo" />
        {(['attivo', 'passivo'] as const).map((tipo) => (
          <label key={tipo} className="gm-nota">
            Note del movimento {tipo}
            <textarea
              rows={2}
              disabled={soloLettura}
              value={note[tipo] ?? ''}
              onChange={(e) => onNote({ [tipo]: e.target.value || null })}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
