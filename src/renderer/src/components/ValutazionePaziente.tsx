import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Copy, Eye, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
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
  TestDistretto,
  ValutazioneCompleta,
  ValutazioneRiepilogo
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import Modale from './Modale'
import { useClicSulFondo } from '../clicSulFondo'
import ScalaPallini from './ScalaPallini'
import Aiuto from './Aiuto'
import { errMsg, formatData, oggiIso } from '../lib'
import { useScorciatoie } from '../scorciatoie'
import { useSalvaUscendo } from '../salvaUscendo'
import { GRUPPI } from '../pages/DistrettiPage'

const ANDAMENTI: { valore: Andamento; etichetta: string; icona: React.JSX.Element }[] = [
  // Sui pulsanti una freccia; la parola resta nel suggerimento e nei documenti.
  // Le etichette concordano con "capacita' di carico", che e' femminile. Il
  // valore salvato resta quello di prima: le valutazioni gia' fatte non cambiano.
  { valore: 'aumentato', etichetta: 'Aumentata', icona: <ArrowUp size={16} /> },
  { valore: 'invariato', etichetta: 'Invariata', icona: <Minus size={16} /> },
  { valore: 'diminuito', etichetta: 'Diminuita', icona: <ArrowDown size={16} /> }
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
        // Niente pulsante "primary" da confermare qui: si sceglie cliccando
        // direttamente il distretto. Invio e clic fuori chiudono e basta.
        <Modale className="modal-sm" onConferma={() => setScelta(null)}>
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
        </Modale>
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
  // Chiudendo il programma, o uscendo da questa scheda, a valutazione non
  // salvata: si salva da sola.
  const salvaAllaChiusura = useSalvaUscendo(!soloLettura && modificato)

  useScorciatoie([
    { tasto: 'Escape', azione: () => void chiudi() },
    { tasto: 's', ctrl: true, azione: () => void salva(), attiva: !soloLettura && modificato }
  ])

  // Un clic fuori dalla finestra la chiude: quello che c'era di non salvato
  // si salva da solo (vedi useSalvaUscendo sopra).
  const chiudi = (): void => {
    onChiudi(modificato)
  }
  const sulFondo = useClicSulFondo(() => void chiudi())

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
      norma: null,
      passivo_norma: null
    }

  const rilievo = (movimentoId: number, lato: LatoRilievo): RilievoMovimento =>
    rilievoIn(dati.movimenti, movimentoId, lato)

  const cambiaMovimento = (
    movimentoId: number,
    lato: LatoRilievo,
    patch: Partial<RilievoMovimento>
  ): void => {
    const nuovo = { ...rilievo(movimentoId, lato), ...patch }
    // Segnare un'intensita' o il dolore vuol dire che nella norma non e': per
    // l'attivo o per il passivo, ognuno per conto suo.
    const segnato = (k: keyof RilievoMovimento): boolean => k in patch && patch[k] != null
    if (segnato('attivo_restrizione') || segnato('attivo_dolore')) nuovo.norma = null
    if (segnato('passivo_restrizione') || segnato('passivo_dolore')) nuovo.passivo_norma = null
    aggiorna({
      movimenti: [...dati.movimenti.filter((m) => !stesso(m, movimentoId, lato)), nuovo]
    })
  }

  // "Il resto nella norma", per l'attivo o per il passivo di un lato: segna
  // tutti i movimenti che non hanno ne' un'intensita' ne' il dolore. Quelli gia'
  // segnati restano come sono. Ripremuto quando e' gia' fatto, toglie le spunte.
  const campoNorma = (tipo: TipoMovimento): 'norma' | 'passivo_norma' =>
    tipo === 'attivo' ? 'norma' : 'passivo_norma'
  const segnatoIn = (r: RilievoMovimento, tipo: TipoMovimento): boolean =>
    r[`${tipo}_restrizione`] != null || (r[`${tipo}_dolore`] ?? 0) > 0

  const restoFatto = (movimenti: MovimentoDistretto[], lato: LatoRilievo, tipo: TipoMovimento): boolean => {
    const righe = movimenti.map((m) => rilievo(m.id as number, lato))
    return (
      righe.some((r) => r[campoNorma(tipo)] === 1) &&
      righe.every((r) => r[campoNorma(tipo)] === 1 || segnatoIn(r, tipo))
    )
  }

  const restoNellaNorma = (movimenti: MovimentoDistretto[], lato: LatoRilievo, tipo: TipoMovimento): void => {
    const togli = restoFatto(movimenti, lato, tipo)
    const campo = campoNorma(tipo)
    let lista = dati.movimenti
    for (const m of movimenti) {
      const r = rilievoIn(lista, m.id as number, lato)
      if (togli ? r[campo] !== 1 : r[campo] === 1 || segnatoIn(r, tipo)) continue
      lista = [
        ...lista.filter((x) => !stesso(x, m.id as number, lato)),
        { ...r, [campo]: togli ? null : 1 }
      ]
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

  // Con i due lati la nota e' una sola, del test: sta nella riga del primo
  // lato. Se una valutazione vecchia ne ha due, si leggono insieme e alla prima
  // modifica diventano una.
  const notaTest = (testId: number, lati: LatoRilievo[]): string =>
    [...new Set(lati.map((l) => rispostaTest(testId, l).nota).filter(Boolean))].join(' — ')

  const cambiaNotaTest = (testId: number, lati: LatoRilievo[], nota: string | null): void => {
    const [primo, ...altri] = lati
    aggiorna({
      test: [
        ...dati.test.filter((t) => !(t.test_id === testId && lati.includes((t.lato ?? '') as LatoRilievo))),
        { ...rispostaTest(testId, primo), nota },
        ...altri.map((l) => ({ ...rispostaTest(testId, l), nota: null }))
      ]
    })
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
    // In tabella la sinistra sta a sinistra e la destra a destra, come si
    // guarda il paziente di fronte: l'ordine dei due lati parte da qui.
    return scrittaSenzaLati ? [''] : ['sx', 'dx']
  }

  salvaAllaChiusura.current = () => salva()
  const salva = async (): Promise<boolean> => {
    try {
      await window.api.valutazioni.salva(dati)
      toast('Valutazione salvata.')
      onChiudi(true)
      return true
    } catch (e) {
      toastErrore(errMsg(e))
      return false
    }
  }

  return (
    <div className="modal-overlay" {...sulFondo}>
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
          {/* In anteprima la casella cresce fino a mostrare tutto il testo:
              da leggere non serve scorrerla dentro una finestra di due righe. */}
          <textarea
            rows={2}
            className={soloLettura ? 'testo-adatta' : undefined}
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
                  onRestoNellaNorma={(lato, tipo) => restoNellaNorma(lib.movimenti, lato, tipo)}
                  restoFatto={(lato, tipo) => restoFatto(lib.movimenti, lato, tipo)}
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
                    <TabellaTest
                      test={test}
                      lati={lati}
                      latoInteressato={latoInteressato}
                      soloLettura={soloLettura}
                      risposta={rispostaTest}
                      onCambia={cambiaTest}
                      nota={(id) => notaTest(id, lati)}
                      onNota={(id, nota) => cambiaNotaTest(id, lati, nota)}
                    />
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
              {/* Tre pulsanti invece della tendina: si sceglie con un clic, e
                  ripremendo quello scelto si toglie. */}
              <span className="scelta-coppia segmentata scelta-andamento">
                {ANDAMENTI.map((a) => {
                  const scelto = dati.valutazione[chiave] === a.valore
                  return (
                    <button
                      key={a.valore}
                      type="button"
                      title={a.etichetta}
                      disabled={soloLettura}
                      className={scelto ? 'scelta-attiva' : ''}
                      onClick={() => campoValutazione({ [chiave]: scelto ? null : a.valore })}
                    >
                      {a.icona}
                    </button>
                  )
                })}
              </span>
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

// I movimenti in due riquadri, uno sotto l'altro: prima l'attivo, poi il
// passivo, come si valutano. Dentro a ognuno una riga per movimento e, con i due
// lati, destra e sinistra una accanto all'altra: il confronto fra i lati si fa
// sulla stessa riga, e il nome del movimento si scrive una volta sola. Le note
// stanno in fondo al loro riquadro, larghe quanto lui: prima erano sotto a una
// meta' della tabella e non si capiva a cosa appartenessero.
//
// La restrizione si segna con +, ++ e +++ invece che con un menu: sono i segni
// che si usano a mano sul foglio e si clicca una volta sola. Il dolore e' una
// spunta: c'e' o non c'e'.
const SEGNI: { valore: Grado; segno: string; titolo: string }[] = [
  { valore: 1, segno: '+', titolo: 'Restrizione lieve' },
  { valore: 2, segno: '++', titolo: 'Restrizione moderata' },
  { valore: 3, segno: '+++', titolo: 'Restrizione severa' }
]

type TipoMovimento = 'attivo' | 'passivo'

const TIPI = [
  {
    tipo: 'attivo',
    titolo: 'Movimento attivo',
    restrizione: 'attivo_restrizione',
    dolore: 'attivo_dolore',
    gradi: 'attivo_gradi'
  },
  {
    tipo: 'passivo',
    titolo: 'Movimento passivo',
    restrizione: 'passivo_restrizione',
    dolore: 'passivo_dolore',
    gradi: 'passivo_gradi'
  }
] as const

function TabellaMovimenti({
  movimenti,
  lati,
  latoInteressato,
  soloLettura,
  rilievo,
  onCambia,
  onRestoNellaNorma,
  restoFatto,
  note,
  onNote
}: {
  movimenti: MovimentoDistretto[]
  lati: LatoRilievo[]
  latoInteressato: 'dx' | 'sx' | null
  soloLettura: boolean
  rilievo: (id: number, lato: LatoRilievo) => RilievoMovimento
  onCambia: (id: number, lato: LatoRilievo, patch: Partial<RilievoMovimento>) => void
  onRestoNellaNorma: (lato: LatoRilievo, tipo: TipoMovimento) => void
  restoFatto: (lato: LatoRilievo, tipo: TipoMovimento) => boolean
  note: NoteMovimenti
  onNote: (patch: Partial<NoteMovimenti>) => void
}): React.JSX.Element {
  const conGradi = movimenti.some((m) => m.gradi === 1)
  const dueLati = lati.length > 1

  const nomeLato = (lato: LatoRilievo): string =>
    lato === 'dx' ? 'a destra' : lato === 'sx' ? 'a sinistra' : ''

  // I rilievi di un movimento, da un lato, per l'attivo o il passivo. Titoli e
  // rilievi hanno le stesse colonnine, quindi cadono uno sotto all'altro.
  const cella = (m: MovimentoDistretto, lato: LatoRilievo, t: (typeof TIPI)[number]): React.JSX.Element => {
    const id = m.id as number
    const r = rilievo(id, lato)
    const restrizione = r[t.restrizione]
    const norma = r[t.tipo === 'attivo' ? 'norma' : 'passivo_norma'] === 1
    const campoNorma = t.tipo === 'attivo' ? 'norma' : 'passivo_norma'
    return (
      <div
        key={lato}
        className={['gm-rilievi', norma ? 'in-norma' : '', lato === 'dx' && dueLati ? 'secondo-lato' : '']
          .filter(Boolean)
          .join(' ')}
      >
        {/* La spunta "nella norma" vale solo per questo riquadro: attivo o
            passivo. Mettendola si tolgono intensita' e dolore di qui. */}
        <button
          type="button"
          className={norma ? 'btn-norma scelta-attiva' : 'btn-norma'}
          title="Nella norma"
          disabled={soloLettura}
          onClick={() =>
            onCambia(
              id,
              lato,
              norma
                ? { [campoNorma]: null }
                : { [campoNorma]: 1, [t.restrizione]: null, [t.dolore]: null }
            )
          }
        >
          <Check size={14} />
        </button>
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
                onCambia(id, lato, { [t.restrizione]: restrizione === g.valore ? null : g.valore })
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
            checked={(r[t.dolore] ?? 0) > 0}
            onChange={(e) => onCambia(id, lato, { [t.dolore]: e.target.checked ? 1 : null })}
          />
        </span>
        {conGradi &&
          (m.gradi === 1 ? (
            <input
              type="number"
              className="campo-gradi"
              title="Gradi"
              disabled={soloLettura}
              value={r[t.gradi] ?? ''}
              onChange={(e) =>
                onCambia(id, lato, {
                  [t.gradi]: e.target.value === '' ? null : Number(e.target.value)
                })
              }
            />
          ) : (
            <span className="hint">&mdash;</span>
          ))}
      </div>
    )
  }

  const classeGriglia = ['griglia-movimenti', dueLati ? 'due-lati' : '', conGradi ? 'con-gradi' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="movimenti">
      {TIPI.map((t) => (
        <div key={t.tipo} className="riquadro-test blocco-movimenti">
          <div className="sotto-titolo">{t.titolo}</div>
          {/* Un clic per dire che quello che non hai segnato e' nella norma: la
              relazione e la cartella lo scrivono, invece di lasciare il dubbio
              fra "normale" e "non valutato". Ripremuto, toglie le spunte. */}
          {!soloLettura && (
            <div className="azioni-norma">
              {lati.map((lato) => {
                const fatto = restoFatto(lato, t.tipo)
                return (
                  <button
                    key={lato}
                    type="button"
                    className={fatto ? 'btn-piccolo scelta-attiva' : 'btn-piccolo'}
                    onClick={() => onRestoNellaNorma(lato, t.tipo)}
                  >
                    <Check size={14} /> Il resto {nomeLato(lato)} nella norma
                    {lato !== '' && lato === latoInteressato ? ' (lato interessato)' : ''}
                  </button>
                )
              })}
              <Aiuto testo="Segna nella norma tutti i movimenti di questo riquadro in cui non hai messo né l'intensità né il dolore; quelli che hai già segnato restano come sono. Ripremendo il pulsante le spunte si tolgono. L'attivo e il passivo hanno le loro spunte: un movimento può essere limitato in attivo e nella norma in passivo. La spunta nella colonna Norma fa la stessa cosa per un movimento solo; se poi segni un'intensità o il dolore, si toglie da sola." />
            </div>
          )}
          <div className={classeGriglia}>
            {dueLati && (
              <>
                <span className="gm-angolo" />
                {lati.map((lato) => (
                  <div
                    key={lato}
                    className={[
                      'gm-lato',
                      lato === latoInteressato ? 'interessato' : '',
                      lato === 'dx' ? 'secondo-lato' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {lato === 'dx' ? 'Destra' : 'Sinistra'}
                    {lato === latoInteressato && <span className="nota-lato">lato interessato</span>}
                  </div>
                ))}
              </>
            )}

            <div className="gm-titolo">Movimento</div>
            {lati.map((lato) => (
              <div
                key={lato}
                className={lato === 'dx' && dueLati ? 'gm-sotto secondo-lato' : 'gm-sotto'}
              >
                <span>Norma</span>
                <span>Intensità</span>
                <span>Dolore</span>
                {conGradi && <span>Gradi</span>}
              </div>
            ))}

            {movimenti.map((m, i) => (
              <div key={m.id} className={i % 2 === 1 ? 'gm-riga pari' : 'gm-riga'}>
                <div className="gm-nome">{m.nome}</div>
                {lati.map((lato) => cella(m, lato, t))}
              </div>
            ))}
          </div>

          <label className="gm-nota">
            Note sul {t.titolo.toLowerCase()}
            <textarea
              rows={2}
              className="cresce"
              disabled={soloLettura}
              value={note[t.tipo] ?? ''}
              onChange={(e) => onNote({ [t.tipo]: e.target.value || null })}
            />
          </label>
        </div>
      ))}
    </div>
  )
}

// I test di un gruppo, in una tabella come i movimenti: una riga per test, con
// destra e sinistra affiancate sotto alla fascia del loro lato, e in fondo alla
// riga una nota sola per il test. Prima ogni test erano due righe, con "Dx" e
// "Sx" e una nota per lato, e il nome scritto solo sulla prima.
function TabellaTest({
  test,
  lati,
  latoInteressato,
  soloLettura,
  risposta,
  onCambia,
  nota,
  onNota
}: {
  test: TestDistretto[]
  lati: LatoRilievo[]
  latoInteressato: 'dx' | 'sx' | null
  soloLettura: boolean
  risposta: (id: number, lato: LatoRilievo) => RilievoTest
  onCambia: (id: number, lato: LatoRilievo, patch: Partial<RilievoTest>) => void
  nota: (id: number) => string
  onNota: (id: number, nota: string | null) => void
}): React.JSX.Element {
  const dueLati = lati.length > 1

  const esito = (t: TestDistretto, lato: LatoRilievo): React.JSX.Element => {
    const id = t.id as number
    const r = risposta(id, lato)
    if (t.risposta === 'posneg') {
      return (
        <span className="scelta-coppia segmentata esito-test">
          {['positivo', 'negativo'].map((v) => (
            <button
              key={v}
              type="button"
              disabled={soloLettura}
              className={r.valore === v ? 'scelta-attiva' : ''}
              onClick={() => onCambia(id, lato, { valore: r.valore === v ? null : v })}
            >
              {v === 'positivo' ? 'Positivo' : 'Negativo'}
            </button>
          ))}
        </span>
      )
    }
    if (t.risposta === 'scala5') {
      // La stessa fascia di pallini dei questionari: e' una scala, e come
      // scala si legge.
      return (
        <ScalaPallini
          min={0}
          max={5}
          valore={r.valore == null || r.valore === '' ? null : Number(r.valore)}
          soloLettura={soloLettura}
          onCambia={(v) => onCambia(id, lato, { valore: r.valore === String(v) ? null : String(v) })}
        />
      )
    }
    return (
      <input
        disabled={soloLettura}
        placeholder="Esito"
        value={r.valore ?? ''}
        onChange={(e) => onCambia(id, lato, { valore: e.target.value || null })}
      />
    )
  }

  return (
    <div className={dueLati ? 'griglia-test due-lati' : 'griglia-test'}>
      {dueLati ? (
        <>
          <div className="gm-titolo">Test</div>
          {lati.map((lato) => (
            <div
              key={lato}
              className={lato === latoInteressato ? 'gm-lato interessato' : 'gm-lato'}
            >
              {lato === 'dx' ? 'Destra' : 'Sinistra'}
              {lato === latoInteressato && <span className="nota-lato">lato interessato</span>}
            </div>
          ))}
          <div className="gm-titolo">Nota</div>
        </>
      ) : (
        <>
          <div className="gm-titolo">Test</div>
          <div className="gm-titolo gt-centro">Esito</div>
          <div className="gm-titolo">Nota</div>
        </>
      )}

      {test.map((t, i) => (
        <div key={t.id} className={i % 2 === 1 ? 'gm-riga pari' : 'gm-riga'}>
          <div className="gm-nome">{t.nome}</div>
          {lati.map((lato) => (
            <div
              key={lato}
              className={lato === 'dx' && dueLati ? 'gt-esito secondo-lato' : 'gt-esito'}
            >
              {esito(t, lato)}
            </div>
          ))}
          <div className="gt-nota">
            <input
              disabled={soloLettura}
              placeholder="Nota"
              value={nota(t.id as number)}
              onChange={(e) => onNota(t.id as number, e.target.value || null)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
