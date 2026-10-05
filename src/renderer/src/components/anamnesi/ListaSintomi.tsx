import { Plus, X } from 'lucide-react'
import type { AndamentoSintomo, EpisodioSintomo, SintomoAnamnesi } from '../../../../shared/types'
import { sposta, useRiordino } from '../../riordino'
import { COLORI } from '../GraficoAndamento'
import ScalaPallini from '../ScalaPallini'
import { UNITA_DURATA, faseDurata, type UnitaDurata } from '../../../../shared/sintomi'
import { Scelta } from './Campi'

let ultimaChiave = 0

const nuovaChiave = (): number => --ultimaChiave

const SINTOMO_NUOVO = (): SintomoAnamnesi => ({
  id: nuovaChiave(),
  descrizione: null,
  andamento: null,
  durata_numero: null,
  durata_unita: null,
  da_quanto: null,
  episodio: null,
  esordio: null,
  esordio_modo: null,
  traumatico: null,
  comportamento: null,
  aggrava: null,
  allevia: null,
  nprs_attuale: null,
  nprs_peggiore: null,
  nprs_migliore: null,
  punti: []
})

export function ListaSintomi({
  sintomi,
  onChange
}: {
  sintomi: SintomoAnamnesi[]
  onChange: (s: SintomoAnamnesi[]) => void
}): React.JSX.Element {
  const { contenitore, presa } = useRiordino<number>((da, a) =>
    onChange(sposta(sintomi, da, a))
  )

  const modifica = (i: number, patch: Partial<SintomoAnamnesi>): void =>
    onChange(sintomi.map((s, j) => (i === j ? { ...s, ...patch } : s)))

  return (
    <div className="lista-domande">
      <div className="sotto-titolo">Sintomi, in ordine di importanza</div>

      {sintomi.map((s, i) => {
        const dnd = contenitore(i)
        return (
          <div key={s.id ?? i} {...dnd} {...presa(i)} className={['domanda-card', dnd.className].filter(Boolean).join(' ')}>
            <div className="domanda-testata">
              <span
                className="domanda-numero"
                style={{ background: COLORI[i % COLORI.length], color: '#fff' }}
              >
                {i + 1}
              </span>
              <input
                className="domanda-testo"
                placeholder="Descrizione e sede del sintomo"
                value={s.descrizione ?? ''}
                onChange={(e) => modifica(i, { descrizione: e.target.value || null })}
              />
              <span className="item-actions-static">
                <button
                  className="danger"
                  title="Togli questo sintomo"
                  onClick={() => onChange(sintomi.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </span>
            </div>

            {/* Quattro coppie sulla stessa riga, ognuna con il suo nome sopra:
                le due scelte di una coppia sono attaccate, cosi' si vede che
                sono l'una o l'altra, e fra una coppia e l'altra c'e' aria. Con
                i caratteri grandi le coppie vanno a capo intere. */}
            <div className="scelte-rapide">
              <div className="gruppo-scelta">
                <span className="didascalia-scelta">Andamento</span>
                <Scelta
                  segmentata
                  etichette={[
                    ['costante', 'Costante'],
                    ['intermittente', 'Intermittente']
                  ]}
                  valore={s.andamento}
                  onScegli={(v) => modifica(i, { andamento: v as AndamentoSintomo | null })}
                />
              </div>
              <div className="gruppo-scelta">
                <span className="didascalia-scelta">Episodio</span>
                <Scelta
                  segmentata
                  etichette={[
                    ['primo', 'Primo episodio'],
                    ['recidiva', 'Recidiva']
                  ]}
                  valore={s.episodio}
                  onScegli={(v) => modifica(i, { episodio: v as EpisodioSintomo | null })}
                />
              </div>
              <div className="gruppo-scelta">
                <span className="didascalia-scelta">Esordio</span>
                <Scelta
                  segmentata
                  etichette={[
                    ['improvviso', 'Improvviso'],
                    ['graduale', 'Graduale']
                  ]}
                  valore={s.esordio_modo}
                  onScegli={(v) =>
                    modifica(i, { esordio_modo: v as SintomoAnamnesi['esordio_modo'] })
                  }
                />
              </div>
              <div className="gruppo-scelta">
                <span className="didascalia-scelta">Trauma</span>
                <Scelta
                  segmentata
                  etichette={[
                    ['1', 'Traumatico'],
                    ['0', 'Non traumatico']
                  ]}
                  valore={s.traumatico == null ? null : String(s.traumatico)}
                  onScegli={(v) =>
                    modifica(i, { traumatico: v == null ? null : (Number(v) as 0 | 1) })
                  }
                />
              </div>
            </div>

            {/* La durata: un numero e l'unita' con un clic, e da li' la fase.
                La casella accanto e' per quello che non sta in un numero. */}
            <div className="riga-durata">
              <span className="nome-domanda">Da quanto tempo</span>
              <input
                type="number"
                min={0}
                className="campo-stretto"
                value={s.durata_numero ?? ''}
                onChange={(e) =>
                  modifica(i, {
                    durata_numero: e.target.value === '' ? null : Number(e.target.value)
                  })
                }
              />
              <Scelta
                segmentata
                etichette={UNITA_DURATA.map((u) => [u.valore, u.tanti] as [string, string])}
                valore={s.durata_unita}
                onScegli={(v) => modifica(i, { durata_unita: v as UnitaDurata | null })}
              />
              {faseDurata(s.durata_numero, s.durata_unita) && (
                <span className="badge-fase-durata">
                  fase {faseDurata(s.durata_numero, s.durata_unita)}
                </span>
              )}
              <input
                className="campo-altro"
                placeholder="Oppure scrivilo (es. da dopo la partita)"
                value={s.da_quanto ?? ''}
                onChange={(e) => modifica(i, { da_quanto: e.target.value || null })}
              />
            </div>

            <div className="form-row-2">
              <label>
                Come è iniziato
                <input
                  placeholder="Caratteristiche del disturbo all'insorgenza"
                  value={s.esordio ?? ''}
                  onChange={(e) => modifica(i, { esordio: e.target.value || null })}
                />
              </label>
              <label>
                Comportamento messo in atto
                <input
                  placeholder="Cosa ha fatto finora"
                  value={s.comportamento ?? ''}
                  onChange={(e) => modifica(i, { comportamento: e.target.value || null })}
                />
              </label>
            </div>

            <div className="form-row-2">
              <label>
                Cosa lo aggrava
                <input
                  placeholder="es. scale, stare seduto, tosse o starnuto"
                  value={s.aggrava ?? ''}
                  onChange={(e) => modifica(i, { aggrava: e.target.value || null })}
                />
              </label>
              <label>
                Cosa lo allevia
                <input
                  value={s.allevia ?? ''}
                  onChange={(e) => modifica(i, { allevia: e.target.value || null })}
                />
              </label>
            </div>

            {/* L'intensita' del dolore sulla scala da 0 a 10. Si riclicca il
                pallino scelto per toglierlo. */}
            <div className="intensita-sintomo">
              <span className="nome-domanda">Intensità del dolore (NPRS)</span>
              {(
                [
                  ['nprs_attuale', 'Attuale'],
                  ['nprs_peggiore', 'Peggiore'],
                  ['nprs_migliore', 'Migliore']
                ] as const
              ).map(([chiave, nome]) => (
                <div key={chiave} className="riga-nprs">
                  <span className="nome-nprs">{nome}</span>
                  <ScalaPallini
                    min={0}
                    max={10}
                    valore={s[chiave]}
                    onCambia={(v) => modifica(i, { [chiave]: s[chiave] === v ? null : v })}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <button onClick={() => onChange([...sintomi, SINTOMO_NUOVO()])}>
        <Plus size={16} /> Aggiungi sintomo
      </button>
    </div>
  )
}
