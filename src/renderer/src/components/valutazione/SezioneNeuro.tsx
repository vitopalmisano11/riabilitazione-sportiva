import { useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import type { RilievoNeuro, VoceNeuro } from '../../../../shared/types'
import { PARTI_NEURO, RIFLESSI, SENSIBILITA } from '../../../../shared/distretti'
import ScalaPallini from '../ScalaPallini'

type Lato = 'sx' | 'dx'
// In tabella la sinistra sta a sinistra e la destra a destra, come si guarda il
// paziente di fronte. L'esame neurologico si fa sempre da tutte e due le parti,
// anche nei distretti senza lato (il rachide).
const LATI: Lato[] = ['sx', 'dx']

// L'esame neurologico di un distretto: una sezione che si apre e si chiude,
// perche' non in tutte le valutazioni si fa. Parte chiusa se vuota e aperta se
// c'e' gia' qualcosa di scritto.
//
//  - sensibilita': non l'elenco di tutte le radici, ma solo quelle alterate,
//    che si aggiungono da una tendina
//  - forza: tutti i muscoli, da 0 a 5
//  - riflessi: ipo / normale / iper
// Quello che non e' segnato non e' stato valutato: non vale come normale.
export function SezioneNeuro({
  voci,
  rilievi,
  nota,
  latoInteressato,
  soloLettura,
  onCambia,
  onNota
}: {
  voci: VoceNeuro[]
  rilievi: RilievoNeuro[]
  nota: string
  latoInteressato: 'dx' | 'sx' | null
  soloLettura: boolean
  // valore null = si toglie il rilievo
  onCambia: (voceId: number, lato: Lato, valore: string | null) => void
  onNota: (nota: string | null) => void
}): React.JSX.Element | null {
  const compilata = rilievi.length > 0 || nota.trim() !== ''
  const [aperta, setAperta] = useState(compilata)
  // radici aggiunte e ancora senza un valore: restano in tabella finche' non si
  // sceglie, altrimenti sparirebbero appena aggiunte
  const [aggiunte, setAggiunte] = useState<number[]>([])

  const valoreDi = (voceId: number, lato: Lato): string | null =>
    rilievi.find((r) => r.voce_id === voceId && r.lato === lato)?.valore ?? null

  // In sola lettura, senza niente da mostrare, la sezione non c'e'.
  if (soloLettura && !compilata) return null
  if (voci.length === 0 && !compilata) return null

  const radici = voci.filter((v) => v.tipo === 'radice')
  const radiciInTabella = radici.filter(
    (v) => aggiunte.includes(v.id as number) || LATI.some((l) => valoreDi(v.id as number, l) != null)
  )
  const radiciDaAggiungere = radici.filter((v) => !radiciInTabella.includes(v))

  const togliRadice = (voceId: number): void => {
    for (const l of LATI) onCambia(voceId, l, null)
    setAggiunte(aggiunte.filter((x) => x !== voceId))
  }

  const intestazione = (primaColonna: string): React.JSX.Element => (
    <>
      <div className="gm-titolo">{primaColonna}</div>
      {LATI.map((lato) => (
        <div key={lato} className={lato === latoInteressato ? 'gm-lato interessato' : 'gm-lato'}>
          {lato === 'dx' ? 'Destra' : 'Sinistra'}
          {lato === latoInteressato && <span className="nota-lato">lato interessato</span>}
        </div>
      ))}
    </>
  )

  // Una scelta fra poche parole: ripremendo quella scelta si toglie.
  const scelta = (
    voceId: number,
    lato: Lato,
    opzioni: readonly { valore: string; etichetta: string }[]
  ): React.JSX.Element => {
    const corrente = valoreDi(voceId, lato)
    return (
      <span className="scelta-coppia segmentata esito-test">
        {opzioni.map((o) => (
          <button
            key={o.valore}
            type="button"
            disabled={soloLettura}
            className={corrente === o.valore ? 'scelta-attiva' : ''}
            onClick={() => onCambia(voceId, lato, corrente === o.valore ? null : o.valore)}
          >
            {o.etichetta}
          </button>
        ))}
      </span>
    )
  }

  const riga = (
    i: number,
    chiave: number,
    nome: React.ReactNode,
    celle: (lato: Lato) => React.ReactNode
  ): React.JSX.Element => (
    <div key={chiave} className={i % 2 === 1 ? 'gm-riga pari' : 'gm-riga'}>
      <div className="gm-nome">{nome}</div>
      {LATI.map((lato) => (
        <div key={lato} className={lato === 'dx' ? 'gt-esito secondo-lato' : 'gt-esito'}>
          {celle(lato)}
        </div>
      ))}
    </div>
  )

  const muscoli = voci.filter((v) => v.tipo === 'muscolo')
  const riflessi = voci.filter((v) => v.tipo === 'riflesso')
  const titolo = (tipo: string): string => PARTI_NEURO.find((p) => p.tipo === tipo)?.titolo ?? ''

  return (
    <div className="riquadro-test sezione-neuro">
      <button
        type="button"
        className="neuro-testata"
        aria-expanded={aperta}
        onClick={() => setAperta(!aperta)}
      >
        {aperta ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <span className="sotto-titolo">Esame neurologico</span>
        {compilata && !aperta && <span className="neuro-badge">compilato</span>}
      </button>

      {aperta && (
        <>
          {radici.length > 0 && (
            <div className="neuro-parte">
              <div className="sotto-titolo">{titolo('radice')}</div>
              {radiciInTabella.length > 0 && (
                <div className="griglia-test due-lati griglia-neuro">
                  {intestazione('Radice')}
                  {radiciInTabella.map((v, i) =>
                    riga(
                      i,
                      v.id as number,
                      <>
                        {v.nome}
                        {!soloLettura && (
                          <button
                            type="button"
                            className="neuro-toglie"
                            title="Togli la radice"
                            onClick={() => togliRadice(v.id as number)}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </>,
                      (lato) => scelta(v.id as number, lato, SENSIBILITA)
                    )
                  )}
                </div>
              )}
              {!soloLettura && radiciDaAggiungere.length > 0 && (
                <select
                  className="neuro-aggiungi"
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    if (id) setAggiunte([...aggiunte, id])
                  }}
                >
                  <option value="">Aggiungi la radice con sensibilità alterata…</option>
                  {radiciDaAggiungere.map((v) => (
                    <option key={v.id} value={v.id as number}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {muscoli.length > 0 && (
            <div className="neuro-parte">
              <div className="sotto-titolo">{titolo('muscolo')}</div>
              <div className="griglia-test due-lati griglia-neuro">
                {intestazione('Muscolo')}
                {muscoli.map((v, i) =>
                  riga(i, v.id as number, v.nome, (lato) => {
                    const valore = valoreDi(v.id as number, lato)
                    return (
                      <ScalaPallini
                        min={0}
                        max={5}
                        valore={valore == null ? null : Number(valore)}
                        soloLettura={soloLettura}
                        onCambia={(n) =>
                          onCambia(v.id as number, lato, valore === String(n) ? null : String(n))
                        }
                      />
                    )
                  })
                )}
              </div>
            </div>
          )}

          {riflessi.length > 0 && (
            <div className="neuro-parte">
              <div className="sotto-titolo">{titolo('riflesso')}</div>
              <div className="griglia-test due-lati griglia-neuro">
                {intestazione('Riflesso')}
                {riflessi.map((v, i) =>
                  riga(i, v.id as number, v.nome, (lato) => scelta(v.id as number, lato, RIFLESSI))
                )}
              </div>
            </div>
          )}

          <label>
            Note sull’esame neurologico
            <textarea
              rows={1}
              className={soloLettura ? 'testo-adatta' : undefined}
              disabled={soloLettura}
              value={nota}
              onChange={(e) => onNota(e.target.value || null)}
            />
          </label>
        </>
      )}
    </div>
  )
}
