import { useEffect, useMemo, useState } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import type { PazienteDettaglio } from '../../../shared/types'
import { TIPI_LAVORO } from '../../../shared/dose'
import type { CaricoPaziente, SettimanaCarico, VoceSettimana } from '../../../shared/carico-settimane'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import Aiuto from './Aiuto'
import Tendina from './Tendina'

// Il carico settimana per settimana, confrontato con la dose della fase: una
// tabella (dalla settimana piu' recente) e sopra due grafici piccoli sulle
// stesse settimane, il carico di una voce con la fascia della dose e, sotto,
// dolore e sforzo medi (da 0 a 10: su un asse loro, non su quello dei contatti).
// Come la dose serve SOLO a programmare: non compare in nessun documento. Senza
// dose nelle fasi ne' esercizi che si contano (una lombalgia) il riquadro non c'e'.

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const SETTIMANE_GRAFICO = 12
const RIGHE_TABELLA = 8

const numero = (n: number): string => n.toLocaleString('it-IT', { maximumFractionDigits: 1 })

const parti = (iso: string): [number, number, number] => {
  const [a, m, g] = iso.split('-').map(Number)
  return [a, m, g]
}

// "3–9 nov", "27 ott–2 nov"; l'anno solo se non e' quello di oggi
function nomeSettimana(s: SettimanaCarico): string {
  const [a1, m1, g1] = parti(s.lunedi)
  const [, m2, g2] = parti(s.domenica)
  const anno = a1 !== new Date().getFullYear() ? ` ${a1}` : ''
  return m1 === m2 ? `${g1}–${g2} ${MESI[m2 - 1]}${anno}` : `${g1} ${MESI[m1 - 1]}–${g2} ${MESI[m2 - 1]}${anno}`
}

const breve = (s: SettimanaCarico): string => {
  const [, m, g] = parti(s.lunedi)
  return `${g} ${MESI[m - 1]}`
}

// "160–240", "≥ 9", "≤ 40"
function intervallo(v: VoceSettimana): string {
  if (v.da != null && v.a != null) return v.da === v.a ? `${v.da}` : `${v.da}–${v.a}`
  if (v.da != null) return `≥ ${v.da}`
  if (v.a != null) return `≤ ${v.a}`
  return ''
}

const ESITO = { ok: 'nella dose', poco: 'sotto la dose', troppo: 'sopra la dose' } as const

export default function CaricoSettimane({ paziente }: { paziente: PazienteDettaglio }): React.JSX.Element | null {
  const [dati, setDati] = useState<CaricoPaziente | null>(null)
  const [voce, setVoce] = useState<string | null>(null)
  const [tutte, setTutte] = useState(false)
  const [sopra, setSopra] = useState<number | null>(null)

  // Dipende dal paziente intero: dopo ogni seduta salvata l'oggetto cambia.
  useEffect(() => {
    let attuale = true
    window.api.dose
      .caricoPaziente(paziente.id)
      .then((d) => attuale && setDati(d))
      .catch((e) => toastErrore(errMsg(e)))
    return () => {
      attuale = false
    }
  }, [paziente])

  const nome = (k: string): string =>
    dati?.nomi[k] ?? TIPI_LAVORO.find((t) => t.tipo === k)?.breve ?? k
  const unita = (k: string): string => (k.startsWith('plio') ? 'contatti' : 'serie')

  // nell'ordine della seduta: prima la pliometria, poi potenza e forza
  const chiavi = useMemo(() => {
    if (!dati) return []
    const ordine = (k: string): number => TIPI_LAVORO.findIndex((t) => k.startsWith(t.tipo))
    const n = (k: string): string => dati.nomi[k] ?? k
    return [...dati.chiavi].sort((a, b) => ordine(a) - ordine(b) || n(a).localeCompare(n(b), 'it'))
  }, [dati])

  if (!dati || chiavi.length === 0 || dati.settimane.length === 0) return null

  // la voce del grafico: quella scelta, o la prima con una dose nell'ultima settimana
  const scelta =
    voce != null && chiavi.includes(voce)
      ? voce
      : (chiavi.find((k) => {
          const v = dati.settimane.find((s) => s.sedute > 0)?.voci[k]
          return v != null && (v.da != null || v.a != null)
        }) ?? chiavi[0])

  const nelGrafico = dati.settimane.slice(0, SETTIMANE_GRAFICO).reverse()
  const inTabella = tutte ? dati.settimane : dati.settimane.slice(0, RIGHE_TABELLA)
  const settimanaSopra = sopra == null ? null : nelGrafico[sopra]
  const avviso = dati.avviso
  const senzaFrequenza = dati.frequenza == null && chiavi.some((k) => k.startsWith('forza:'))

  return (
    <section className="card carico-settimane">
      <h3>
        Carico settimana per settimana
        <Aiuto testo="Quanto ha fatto il paziente ogni settimana, confrontato con la dose della fase: contatti di pliometria e serie di potenza e di forza, contati come nella riga della dose in seduta. La pliometria e la potenza hanno la dose per seduta, quindi la settimana vale la dose per le sedute fatte; la forza vale la dose per le sedute a settimana del paziente. La fase della settimana è quella dell'ultima seduta. Le sedute al campo non contano nel carico, ma dolore e sforzo sì. Nella settimana in corso non si segna mai 'poco': può ancora arrivare. Serve solo a programmare: non compare nella cartella né nei referti." />
      </h3>

      {avviso && (
        <p className="avviso-carico">
          <TriangleAlert size={16} />
          <span>
            Nelle ultime tre settimane il dolore medio è salito ({avviso.dolori.map(numero).join(' → ')}) mentre{' '}
            <b>{nome(avviso.chiave)}</b> cresceva ({avviso.valori.join(' → ')} {unita(avviso.chiave)}).
          </span>
        </p>
      )}

      <div className="carico-grafici">
        <div className="carico-testata">
          <label className="compila-data">
            Nel grafico
            <Tendina value={scelta} onChange={(e) => setVoce(e.target.value)}>
              {chiavi.map((k) => (
                <option key={k} value={k}>
                  {nome(k)}
                </option>
              ))}
            </Tendina>
          </label>
          {/* Quello che c'e' sotto il mouse: una riga sola, sempre allo stesso posto. */}
          <span className="carico-lettura" aria-live="polite">
            {settimanaSopra ? (
              <Lettura s={settimanaSopra} k={scelta} nome={nome(scelta)} unita={unita(scelta)} />
            ) : (
              <span className="hint">Passa sopra una settimana per leggerne i numeri.</span>
            )}
          </span>
        </div>
        <GraficoCarico settimane={nelGrafico} k={scelta} unita={unita(scelta)} sopra={sopra} onSopra={setSopra} />
        <GraficoDoloreSforzo settimane={nelGrafico} sopra={sopra} onSopra={setSopra} />
      </div>

      {senzaFrequenza && (
        <p className="hint">
          Scrivi le sedute a settimana (qui sopra): senza, la dose di forza si moltiplica per le sedute fatte.
        </p>
      )}

      <div className="carico-tabella-scorre">
        <table className="data-table tabella-carico">
          <thead>
            <tr>
              <th>Settimana</th>
              <th>Fase</th>
              {chiavi.map((k) => (
                <th key={k} title={unita(k)}>
                  {nome(k)}
                </th>
              ))}
              <th>Sforzo</th>
              <th>Dolore</th>
            </tr>
          </thead>
          <tbody>
            {inTabella.map((s) => (
              <tr key={s.lunedi} className={s.sedute + s.seduteCampo === 0 ? 'settimana-vuota' : undefined}>
                <td>
                  <span className="carico-settimana-nome">{nomeSettimana(s)}</span>
                  {s.inCorso && <span className="badge">in corso</span>}
                  {s.sedute + s.seduteCampo > 0 && (
                    <span className="hint carico-settimana-sedute">
                      {s.sedute === 1 ? '1 seduta' : `${s.sedute} sedute`}
                      {s.seduteCampo > 0 && ` · ${s.seduteCampo} al campo`}
                    </span>
                  )}
                </td>
                {s.sedute + s.seduteCampo === 0 ? (
                  <td colSpan={chiavi.length + 3} className="hint">
                    Nessuna seduta
                  </td>
                ) : (
                  <>
                    <td>{s.fase ?? <span className="hint">—</span>}</td>
                    {chiavi.map((k) => (
                      <td key={k}>
                        <Cella v={s.voci[k]} />
                      </td>
                    ))}
                    <td>{s.sforzo == null ? <span className="hint">—</span> : numero(s.sforzo)}</td>
                    <td>{s.dolore == null ? <span className="hint">—</span> : numero(s.dolore)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dati.settimane.length > RIGHE_TABELLA && (
        <button className="btn-aggiungi-lista" onClick={() => setTutte(!tutte)}>
          {tutte ? 'Mostra solo le ultime' : `Mostra tutte (${dati.settimane.length})`}
        </button>
      )}
    </section>
  )
}

function Cella({ v }: { v: VoceSettimana | undefined }): React.JSX.Element {
  if (!v) return <span className="hint">—</span>
  const dose = intervallo(v)
  return (
    <span className="carico-cella" title={v.esito ? ESITO[v.esito] : undefined}>
      <span className={`voce-dose ${v.esito ?? ''}`}>
        {v.fatto}
        {v.esito === 'ok' && <Check size={14} aria-label="nella dose" />}
        {(v.esito === 'poco' || v.esito === 'troppo') && <TriangleAlert size={14} aria-label={ESITO[v.esito]} />}
      </span>
      {dose && <span className="hint"> / {dose}</span>}
    </span>
  )
}

function Lettura({
  s,
  k,
  nome,
  unita
}: {
  s: SettimanaCarico
  k: string
  nome: string
  unita: string
}): React.JSX.Element {
  const v = s.voci[k]
  const pezzi = [nomeSettimana(s)]
  if (s.sedute + s.seduteCampo === 0) pezzi.push('nessuna seduta')
  else {
    pezzi.push(`${nome} ${v?.fatto ?? 0} ${unita}${v && intervallo(v) ? ` (dose ${intervallo(v)})` : ''}`)
    if (s.dolore != null) pezzi.push(`dolore ${numero(s.dolore)}`)
    if (s.sforzo != null) pezzi.push(`sforzo ${numero(s.sforzo)}`)
  }
  return <span>{pezzi.join(' · ')}</span>
}

// ---- i due grafici: stesse colonne, una per settimana ----

// largo e basso: il riquadro occupa tutta la pagina, e con 640 le scritte
// diventavano enormi
const L = 1000
const SX = 44
const DX = 12
const colonna = (n: number): number => (L - SX - DX) / Math.max(n, 1)
const centro = (i: number, n: number): number => SX + colonna(n) * (i + 0.5)

// Le colonne trasparenti per il mouse: piu' larghe della barra, tutta l'altezza.
function Bersagli({
  n,
  alto,
  onSopra
}: {
  n: number
  alto: number
  onSopra: (i: number | null) => void
}): React.JSX.Element {
  return (
    <g onMouseLeave={() => onSopra(null)}>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={SX + colonna(n) * i}
          y={0}
          width={colonna(n)}
          height={alto}
          fill="transparent"
          onMouseEnter={() => onSopra(i)}
        />
      ))}
    </g>
  )
}

// un passo "tondo" per le linee della griglia: 1, 2, 5, 10, 20, 50...
function passo(massimo: number): number {
  const grezzo = massimo / 4
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(grezzo, 1))))
  return [1, 2, 5, 10].map((m) => m * p).find((x) => x >= grezzo) ?? 10 * p
}

function GraficoCarico({
  settimane,
  k,
  unita,
  sopra,
  onSopra
}: {
  settimane: SettimanaCarico[]
  k: string
  unita: string
  sopra: number | null
  onSopra: (i: number | null) => void
}): React.JSX.Element {
  const A = 180
  const SU = 12
  const GIU = 28
  const alto = A - SU - GIU
  const n = settimane.length
  const valori = settimane.flatMap((s) => {
    const v = s.voci[k]
    return v ? [v.fatto, v.da ?? 0, v.a ?? 0] : [0]
  })
  const p = passo(Math.max(...valori, 1))
  const cima = Math.ceil((Math.max(...valori, 1) * 1.05) / p) * p
  const y = (v: number): number => SU + (1 - v / cima) * alto
  const larga = Math.min(colonna(n) * 0.5, 36)
  const righe: number[] = []
  for (let v = 0; v <= cima; v += p) righe.push(v)
  // con tante settimane l'etichetta va a una si' e una no
  const ogni = n > 8 ? 2 : 1

  return (
    <svg className="grafico grafico-carico" viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Carico per settimana, in ${unita}`}>
      {righe.map((v) => (
        <g key={v}>
          <line className="grafico-griglia" x1={SX} y1={y(v)} x2={L - DX} y2={y(v)} />
          <text className="grafico-etichetta" x={SX - 6} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {sopra != null && (
        <rect className="carico-colonna-sopra" x={SX + colonna(n) * sopra} y={SU} width={colonna(n)} height={alto} />
      )}
      {settimane.map((s, i) => {
        const v = s.voci[k]
        const cx = centro(i, n)
        const fascia = colonna(n) * 0.78
        return (
          <g key={s.lunedi}>
            {/* la dose della settimana: una fascia se ha due numeri, una riga se ne ha uno */}
            {v && v.da != null && v.a != null && (
              <rect className="carico-fascia-dose" x={cx - fascia / 2} y={y(v.a)} width={fascia} height={y(v.da) - y(v.a)} rx={3} />
            )}
            {v && (v.da == null) !== (v.a == null) && (
              <line className="carico-soglia-dose" x1={cx - fascia / 2} x2={cx + fascia / 2} y1={y((v.da ?? v.a)!)} y2={y((v.da ?? v.a)!)} />
            )}
            {v && v.fatto > 0 && (
              <path
                className={`carico-barra${s.inCorso ? ' in-corso' : ''}`}
                d={barra(cx - larga / 2, y(v.fatto), larga, y(0) - y(v.fatto))}
              />
            )}
            {i % ogni === (n - 1) % ogni && (
              <text className="grafico-etichetta" x={cx} y={A - 8} textAnchor="middle">
                {breve(s)}
              </text>
            )}
          </g>
        )
      })}
      <Bersagli n={n} alto={A} onSopra={onSopra} />
    </svg>
  )
}

// Una barra con gli angoli in alto arrotondati (4px) e la base dritta sull'asse.
function barra(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function GraficoDoloreSforzo({
  settimane,
  sopra,
  onSopra
}: {
  settimane: SettimanaCarico[]
  sopra: number | null
  onSopra: (i: number | null) => void
}): React.JSX.Element | null {
  const A = 120
  const SU = 10
  const GIU = 10
  const alto = A - SU - GIU
  const n = settimane.length
  const y = (v: number): number => SU + (1 - v / 10) * alto
  if (settimane.every((s) => s.dolore == null && s.sforzo == null)) return null

  // una linea per tratti: una settimana senza il valore la interrompe
  const tratti = (valore: (s: SettimanaCarico) => number | null): string[] => {
    const fuori: string[] = []
    let ora: string[] = []
    settimane.forEach((s, i) => {
      const v = valore(s)
      if (v == null) {
        if (ora.length > 1) fuori.push(ora.join(' '))
        ora = []
      } else ora.push(`${centro(i, n)},${y(v)}`)
    })
    if (ora.length > 1) fuori.push(ora.join(' '))
    return fuori
  }

  return (
    <>
      <div className="legenda-carico">
        <span>
          <svg width="22" height="12" aria-hidden>
            <line x1="1" y1="6" x2="21" y2="6" className="carico-linea-dolore" />
            <circle cx="11" cy="6" r="4" className="carico-punto-dolore" />
          </svg>
          Dolore medio
        </span>
        <span>
          <svg width="22" height="12" aria-hidden>
            <line x1="1" y1="6" x2="21" y2="6" className="carico-linea-sforzo" />
            <rect x="7" y="2" width="8" height="8" className="carico-punto-sforzo" />
          </svg>
          Sforzo medio
        </span>
        <span className="hint">da 0 a 10</span>
      </div>
      <svg className="grafico grafico-dolore-sforzo" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Dolore e sforzo medi per settimana">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line className="grafico-griglia" x1={SX} y1={y(v)} x2={L - DX} y2={y(v)} />
            <text className="grafico-etichetta" x={SX - 6} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {sopra != null && (
          <rect className="carico-colonna-sopra" x={SX + colonna(n) * sopra} y={SU} width={colonna(n)} height={alto} />
        )}
        {tratti((s) => s.sforzo).map((pt, i) => (
          <polyline key={`s${i}`} className="carico-linea-sforzo" points={pt} />
        ))}
        {tratti((s) => s.dolore).map((pt, i) => (
          <polyline key={`d${i}`} className="carico-linea-dolore" points={pt} />
        ))}
        {settimane.map((s, i) => (
          <g key={s.lunedi}>
            {s.sforzo != null && (
              <rect className="carico-punto-sforzo" x={centro(i, n) - 4} y={y(s.sforzo) - 4} width={8} height={8} />
            )}
            {s.dolore != null && <circle className="carico-punto-dolore" cx={centro(i, n)} cy={y(s.dolore)} r={4.5} />}
          </g>
        ))}
        <Bersagli n={n} alto={A} onSopra={onSopra} />
      </svg>
    </>
  )
}
