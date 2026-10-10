import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import type { EsercizioConCategoria, Massimale, PazienteDettaglio } from '../../../shared/types'
import {
  RIPETIZIONI_AFFIDABILI,
  SOGLIA_PREDEFINITA,
  SOGLIE_VELOCITA,
  stimaDaSerie,
  stimaDaVelocita
} from '../../../shared/massimali'
import Aiuto from './Aiuto'
import CampoSuggerimenti from './CampoSuggerimenti'
import Tendina from './Tendina'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg, formatData, oggiIso } from '../lib'

// I massimali dell'atleta. Peso e altezza stanno nei dati del paziente.
//
// Servono a prescrivere: con il massimale scritto, "80%" diventa un numero
// invece di un ricordo. Le cose che cambiano seduta dopo seduta non stanno qui
// ma nei segni di riferimento; qui c'e' quello che si misura ogni tanto.
//
// Il modulo e' quello di sempre: esercizio, massimale, data. Il lato (per gli
// esercizi a una gamba) e' un menu piccolo sulla stessa riga; il calcolo da una
// serie o dalla velocita' resta chiuso finche' non serve. Il nome si scrive
// come prima, con i suggerimenti della libreria: se coincide con un esercizio
// della libreria il massimale gli si lega da solo, senza un campo in piu'.

// Le percentuali che si usano davvero per prescrivere la forza.
const QUOTE = [70, 75, 80, 85, 90]

const num = (v: string): number | null => {
  const t = v.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const arrotonda = (n: number): string => (Math.round(n * 10) / 10).toString().replace('.', ',')

const METODO: Record<string, string> = {
  serie: 'stimato da una serie',
  velocita: 'stimato dalla velocità'
}

// La velocita' del massimale per quell'esercizio, se il nome lo ricorda.
const sogliaPer = (nome: string): string => {
  const trovata = SOGLIE_VELOCITA.find((s) => nome.toLowerCase().includes(s.nome.toLowerCase()))
  return String(trovata?.valore ?? SOGLIA_PREDEFINITA).replace('.', ',')
}

const RIGHE_VUOTE = (): { carico: string; velocita: string }[] => [
  { carico: '', velocita: '' },
  { carico: '', velocita: '' },
  { carico: '', velocita: '' }
]

export default function MassimaliPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [massimali, setMassimali] = useState<Massimale[]>([])
  // La libreria serve solo ai suggerimenti del nome: si legge alla prima
  // apertura del modulo, non ogni volta che si apre la scheda.
  const [libreria, setLibreria] = useState<EsercizioConCategoria[] | null>(null)
  const [aperto, setAperto] = useState<number | null>(null)
  const [nuovo, setNuovo] = useState(false)
  const [esercizio, setEsercizio] = useState('')
  const [lato, setLato] = useState<'' | 'dx' | 'sx'>('')
  const [valore, setValore] = useState('')
  const [data, setData] = useState(oggiIso())
  // Il calcolo e' chiuso: si apre solo se il massimale non e' stato misurato.
  const [calcola, setCalcola] = useState(false)
  const [modo, setModo] = useState<'serie' | 'velocita'>('serie')
  const [carico, setCarico] = useState('')
  const [ripetizioni, setRipetizioni] = useState('')
  const [rir, setRir] = useState('')
  const [righe, setRighe] = useState(RIGHE_VUOTE)
  // La velocita' del massimale: segue l'esercizio finche' non la si scrive.
  const [sogliaScritta, setSogliaScritta] = useState<string | null>(null)

  const carica = useCallback((): void => {
    window.api.massimali
      .list(paziente.id)
      .then(setMassimali)
      .catch((e) => toastErrore(errMsg(e)))
  }, [paziente.id])

  useEffect(carica, [carica])

  useEffect(() => {
    if (!nuovo || libreria !== null) return
    window.api.esercizi
      .list(false)
      .then(setLibreria)
      .catch(() => setLibreria([]))
  }, [nuovo, libreria])

  const nome = esercizio.trim()
  const dellaLibreria = (libreria ?? []).find((e) => e.nome.toLowerCase() === nome.toLowerCase()) ?? null
  const soglia = sogliaScritta ?? sogliaPer(nome)

  // Se il massimale vero non l'hai misurato, il numero esce da solo: da una
  // serie (carico, ripetizioni, riserva) o dalla velocita' del bilanciere.
  const daSerie = ((): number | null => {
    const c = num(carico)
    const r = num(ripetizioni)
    const res = num(rir)
    return c != null && r != null && c > 0 && r > 0 ? stimaDaSerie(c, r, res ?? 0) : null
  })()
  const daVelocita = calcola && modo === 'velocita'
    ? stimaDaVelocita(
        righe.map((r) => ({ carico: num(r.carico) ?? NaN, velocita: num(r.velocita) ?? NaN })),
        num(soglia) ?? NaN
      )
    : null
  const stimato = !calcola ? null : modo === 'serie' ? daSerie : (daVelocita?.massimale ?? null)
  const avvisi: string[] = []
  if (calcola && modo === 'serie' && daSerie != null) {
    if ((num(ripetizioni) ?? 0) + (num(rir) ?? 0) > RIPETIZIONI_AFFIDABILI) {
      avvisi.push(`oltre ${RIPETIZIONI_AFFIDABILI} ripetizioni la stima è poco precisa: meglio una serie più pesante`)
    }
  }
  avvisi.push(...(daVelocita?.avvisi ?? []))

  const chiudiModulo = (): void => {
    setNuovo(false)
    setEsercizio('')
    setLato('')
    setValore('')
    setCalcola(false)
    setCarico('')
    setRipetizioni('')
    setRir('')
    setRighe(RIGHE_VUOTE())
    setSogliaScritta(null)
  }

  const aggiungi = async (): Promise<void> => {
    const misurato = num(valore)
    const v = misurato ?? stimato
    if (nome === '' || v == null || v <= 0) {
      toastErrore("Servono il nome dell'esercizio e il valore.")
      return
    }
    try {
      await window.api.massimali.create(paziente.id, nome, v, 'kg', data, {
        esercizio_id: dellaLibreria?.id ?? null,
        lato: lato === '' ? null : lato,
        // il massimale e' misurato solo se il numero l'hai scritto tu
        metodo: misurato != null ? 'misurato' : modo === 'serie' ? 'serie' : 'velocita'
      })
      chiudiModulo()
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (m: Massimale): Promise<void> => {
    const chi = `${m.esercizio}${m.lato ? ` ${m.lato === 'dx' ? 'destro' : 'sinistro'}` : ''}`
    if (!(await chiedi(`Eliminare il massimale di ${chi} del ${formatData(m.data)}?`))) {
      return
    }
    try {
      await window.api.massimali.remove(m.id)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const cambiaRiga = (i: number, campo: 'carico' | 'velocita', v: string): void =>
    setRighe(righe.map((r, j) => (j === i ? { ...r, [campo]: v } : r)))

  return (
    <>
      <section className="card">
        <div className="card-header-row">
          <h3>
            Massimali
            <Aiuto testo="Scrivi il massimale di un esercizio e premendo sul numero vedi quanto sono il 70, il 75, l'80, l'85 e il 90 per cento: il carico della fase di forza si prescrive così. Se non l'hai misurato davvero, apri «Calcolalo» e fallo stimare da una serie (carico, ripetizioni e RIR) oppure dalla velocità del bilanciere. Per gli esercizi a una gamba scegli il lato." />
          </h3>
          {!nuovo && (
            <button className="btn-aggiungi-lista" onClick={() => setNuovo(true)}>
              <Plus size={16} /> Aggiungi massimale
            </button>
          )}
        </div>

        {nuovo && (
          <div className="nuovo-massimale">
            <div className="riga-misure">
              <label className="field campo-esercizio-max">
                Esercizio
                <CampoSuggerimenti
                  autoFocus
                  placeholder="es. Squat"
                  value={esercizio}
                  onChange={setEsercizio}
                  suggerimenti={(libreria ?? []).map((e) => e.nome)}
                />
              </label>
              <label className="field campo-misura">
                Lato
                <Tendina value={lato} onChange={(e) => setLato(e.target.value as '' | 'dx' | 'sx')}>
                  <option value="">entrambi</option>
                  <option value="dx">destro</option>
                  <option value="sx">sinistro</option>
                </Tendina>
              </label>
              <label className="field campo-misura">
                Massimale (kg)
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={stimato == null ? '' : arrotonda(stimato)}
                  value={valore}
                  onChange={(e) => setValore(e.target.value)}
                />
              </label>
              <label className="field campo-misura">
                Data
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </label>
            </div>

            {/* Chiuso: chi il massimale lo ha misurato non vede niente in piu'. */}
            {!calcola ? (
              <button className="briciola" onClick={() => setCalcola(true)}>
                Non l&apos;hai misurato? Calcolalo
              </button>
            ) : (
              <div className="stima-massimale">
                <div className="riga-misure riga-stima">
                  <button
                    className={modo === 'serie' ? 'briciola scelta-attiva' : 'briciola'}
                    onClick={() => setModo('serie')}
                  >
                    Da una serie
                  </button>
                  <button
                    className={modo === 'velocita' ? 'briciola scelta-attiva' : 'briciola'}
                    onClick={() => setModo('velocita')}
                  >
                    Dalla velocità
                  </button>
                  <button
                    className="briciola"
                    title="Non calcolarlo"
                    onClick={() => setCalcola(false)}
                  >
                    <X size={14} />
                  </button>
                </div>

                {modo === 'serie' ? (
                  <div className="riga-misure riga-stima">
                    <input
                      className="campo-stima"
                      type="text"
                      inputMode="decimal"
                      placeholder="carico"
                      value={carico}
                      onChange={(e) => setCarico(e.target.value)}
                    />
                    <span className="hint">kg &times;</span>
                    <input
                      className="campo-stima"
                      type="text"
                      inputMode="decimal"
                      placeholder="rip."
                      value={ripetizioni}
                      onChange={(e) => setRipetizioni(e.target.value)}
                    />
                    {/* Le ripetizioni di riserva: si puo' lasciare vuoto, e allora
                        vale come una serie portata fino in fondo. */}
                    <span className="hint">rip. con</span>
                    <input
                      className="campo-stima"
                      type="text"
                      inputMode="decimal"
                      placeholder="RIR"
                      value={rir}
                      onChange={(e) => setRir(e.target.value)}
                    />
                    <span className="hint">
                      {daSerie == null ? 'di riserva' : `di riserva → circa ${arrotonda(daSerie)} kg`}
                    </span>
                  </div>
                ) : (
                  <>
                    {righe.map((r, i) => (
                      <div key={i} className="riga-misure riga-stima">
                        <input
                          className="campo-stima"
                          type="text"
                          inputMode="decimal"
                          placeholder="carico"
                          value={r.carico}
                          onChange={(e) => cambiaRiga(i, 'carico', e.target.value)}
                        />
                        <span className="hint">kg a</span>
                        <input
                          className="campo-stima"
                          type="text"
                          inputMode="decimal"
                          placeholder="m/s"
                          value={r.velocita}
                          onChange={(e) => cambiaRiga(i, 'velocita', e.target.value)}
                        />
                        <span className="hint">m/s</span>
                        {i === righe.length - 1 && (
                          <button
                            className="briciola"
                            title="Un altro carico"
                            onClick={() => setRighe([...righe, { carico: '', velocita: '' }])}
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="riga-misure riga-stima">
                      <span className="hint">massimale a</span>
                      <input
                        className="campo-stima"
                        type="text"
                        inputMode="decimal"
                        title="La velocità media dell'ultima ripetizione possibile. Indicativamente: squat 0,30 · panca 0,17 · rematore 0,50"
                        value={soglia}
                        onChange={(e) => setSogliaScritta(e.target.value)}
                      />
                      <span className="hint">
                        m/s
                        {daVelocita != null && ` → circa ${arrotonda(daVelocita.massimale)} kg`}
                      </span>
                    </div>
                  </>
                )}

                {avvisi.length > 0 && (
                  <ul className="avvisi-stima">
                    {avvisi.map((a) => (
                      <li key={a} className="hint">
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={chiudiModulo}>
                <X size={16} /> Annulla
              </button>
              <button className="primary" onClick={() => void aggiungi()}>
                <Check size={16} /> Aggiungi
              </button>
            </div>
          </div>
        )}

        {massimali.length === 0 ? (
          <p className="hint">Nessun massimale scritto.</p>
        ) : (
          <ul className="lista-massimali">
            {massimali.map((m) => (
              <li key={m.id}>
                <div className="riga-massimale">
                  <span className="max-esercizio">
                    {m.esercizio}
                    {/* Il lato compare solo dove c'e'. */}
                    {m.lato && <span className="badge">{m.lato === 'dx' ? 'destro' : 'sinistro'}</span>}
                  </span>
                  {/* Le percentuali si aprono premendo sul numero: sono la cosa
                      che serve, ma non tutte insieme per ogni riga. */}
                  <button
                    className="briciola max-valore"
                    title="Vedi le percentuali"
                    onClick={() => setAperto(aperto === m.id ? null : m.id)}
                  >
                    {arrotonda(m.valore)} {m.unita ?? 'kg'}
                  </button>
                  <span className="hint">
                    {formatData(m.data)}
                    {m.metodo && METODO[m.metodo] ? ` · ${METODO[m.metodo]}` : ''}
                  </span>
                  <span className="row-actions">
                    <button className="danger" title="Elimina" onClick={() => void elimina(m)}>
                      <Trash2 size={15} />
                    </button>
                  </span>
                </div>
                {aperto === m.id && (
                  <div className="quote-massimale">
                    {QUOTE.map((q) => (
                      <span key={q} className="quota">
                        <span className="quota-et">{q}%</span>
                        <span className="quota-val">{arrotonda((m.valore * q) / 100)} kg</span>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
