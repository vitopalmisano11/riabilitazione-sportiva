import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type {
  Andamento,
  MovimentoDistretto,
  NoteMovimenti,
  DistrettoCompleto,
  LatoRilievo,
  RilievoMovimento,
  RilievoTest,
  ValutazioneCompleta
} from '../../../../shared/types'
import { toast, toastErrore } from '../Toast'
import { useClicSulFondo } from '../../clicSulFondo'
import { errMsg } from '../../lib'
import { useScorciatoie } from '../../scorciatoie'
import { useSalvataggio } from '../../salvataggio'
import IndicatoreSalvataggio from '../IndicatoreSalvataggio'
import { GRUPPI } from '../../pages/DistrettiPage'
import { TipoMovimento, TabellaMovimenti } from './TabellaMovimenti'
import { TabellaTest } from './TabellaTest'

const ANDAMENTI: { valore: Andamento; etichetta: string; icona: React.JSX.Element }[] = [
  // Sui pulsanti una freccia; la parola resta nel suggerimento e nei documenti.
  // Le etichette concordano con "capacita' di carico", che e' femminile. Il
  // valore salvato resta quello di prima: le valutazioni gia' fatte non cambiano.
  { valore: 'aumentato', etichetta: 'Aumentata', icona: <ArrowUp size={16} /> },
  { valore: 'invariato', etichetta: 'Invariata', icona: <Minus size={16} /> },
  { valore: 'diminuito', etichetta: 'Diminuita', icona: <ArrowDown size={16} /> }
]

export function SchedaValutazione({
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
  const salvataggio = useSalvataggio(!soloLettura && modificato)

  useScorciatoie([
    { tasto: 'Escape', azione: () => void chiudi() },
    { tasto: 's', ctrl: true, azione: () => void salvataggio.salva(), attiva: !soloLettura && modificato }
  ])

  // Un clic fuori dalla finestra la chiude: quello che c'era di non salvato
  // si salva da solo (vedi useSalvataggio sopra).
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

  salvataggio.funzione.current = () => salva()
  const salva = async (): Promise<boolean> => {
    try {
      await window.api.valutazioni.salva(dati)
      toast('Valutazione salvata.')
      // gia' salvata: chiudendosi non deve salvarla una seconda volta
      salvataggio.funzione.current = null
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
          {!soloLettura && <IndicatoreSalvataggio stato={salvataggio.stato} errore={salvataggio.errore} />}
          <button onClick={() => void chiudi()}>{soloLettura ? 'Chiudi' : 'Annulla'}</button>
          {!soloLettura && (
            <button
              className="primary"
              disabled={!modificato || salvataggio.stato === 'salvo'}
              onClick={() => void salvataggio.salva()}
            >
              Salva
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
