import { useState } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import {
  condizioniLeggibili,
  formattaValore,
  valoreDellaMisura,
  type GiornoPedana,
  type GruppoPedana,
  type LatoPedana,
  type MisuraPedana
} from '../../../../shared/pedana'
import { useScorciatoie } from '../../scorciatoie'
import MenuScelta from '../MenuScelta'
import Modale from '../Modale'
import { formatData } from '../../lib'
import GraficiCurve from './GraficiCurve'
import GraficoStabilogramma from './GraficoStabilogramma'
import { raggioTracciato, titoloLato } from '../../../../shared/pedana-curve'

const NOME_LATO: Record<LatoPedana, string> = { dx: 'Destro', sx: 'Sinistro' }

export const dataDellaRiga = (g: GiornoPedana): string =>
  g.dataFine ? `${formatData(g.data)} – ${formatData(g.dataFine)}` : formatData(g.data)

// Una variazione in percentuale col segno vero (e il meno tipografico): verde
// se e' nel verso giusto per quella misura, rossa se no. Senza un verso
// (`meglio` nullo) resta neutra: non si dice se e' migliorato o peggiorato.
function Variazione({
  valore,
  meglio
}: {
  valore: number | null
  meglio: 'alto' | 'basso' | null
}): React.JSX.Element | null {
  if (valore === null) return null
  const buona = meglio === null ? null : meglio === 'alto' ? valore > 0 : valore < 0
  const classe = valore === 0 || buona === null ? '' : buona ? 'meglio' : 'peggio'
  return (
    <span className={classe}>
      {valore > 0 ? '+' : valore < 0 ? '−' : ''}
      {Math.abs(valore)}%
    </span>
  )
}

// Le prove di una misura, per lato: "31,2 · 33 · 32,4".
function proveDi(m: MisuraPedana, lato: LatoPedana | null): string {
  return m.valori
    .filter((v) => v.lato === lato)
    .sort((a, b) => (a.prova ?? 0) - (b.prova ?? 0))
    .map((v) => formattaValore(v.valore, null))
    .join(' · ')
}

// Le misure raggruppate per cio' che dicono, cosi' non sono una lista sola di
// quindici righe. Si riconoscono dal codice; quelle che non si conoscono vanno
// in fondo, in "Altre misure".
const GRUPPI_MISURE: { titolo: string; codici: RegExp }[] = [
  {
    titolo: 'Forza',
    codici:
      /^(picco_kg|sostenuta_kg|picco_pct_peso|picco_migliore_kg|picco_medio_kg|picco_forza_n|picco_forza_eccentrica_n|picco_forza_concentrica_n)$/
  },
  {
    titolo: 'Rapidità',
    codici: /^(tempo_90_ms|tempo_picco_ms|rfd200_kg_s|rfd_max_kg_s|rfd_max_n_s)$/
  },
  { titolo: 'Costanza', codici: /^(impulso_kg_s|costanza_cv_pct)$/ },
  {
    titolo: 'Salto',
    codici: /^(altezza_cm|tempo_volo_ms|durata_salto_ms|tempo_contatto_ms|rsi)$/
  },
  {
    titolo: 'Fasi del movimento',
    codici: /^(fase_eccentrica_ms|fase_concentrica_ms|tempo_eccentrico_forza_positiva_ms)$/
  },
  {
    titolo: 'Atterraggio',
    codici: /^(picco_atterraggio_n|stabilizzazione_ms)$/
  },
  { titolo: 'Carico sui due lati', codici: /^carico_sx_/ },
  {
    titolo: 'Oscillazione',
    codici: /^(percorso_mm|velocita_.*|range_.*|rms_.*|area_ellisse_mm2|durata_s)$/
  }
]

function misureRaggruppate(misure: MisuraPedana[]): { titolo: string; misure: MisuraPedana[] }[] {
  const gruppi = [
    ...GRUPPI_MISURE.map((g) => ({
      titolo: g.titolo,
      misure: [] as MisuraPedana[]
    })),
    { titolo: 'Altre misure', misure: [] as MisuraPedana[] }
  ]
  for (const m of misure) {
    const i = GRUPPI_MISURE.findIndex((g) => g.codici.test(m.codice))
    gruppi[i === -1 ? gruppi.length - 1 : i].misure.push(m)
  }
  return gruppi.filter((g) => g.misure.length > 0)
}

type Sezione = 'risultato' | 'misure' | 'report' | 'come' | 'tempo'

const TITOLO_SEZIONE: Record<Sezione, string> = {
  risultato: 'Risultato e grafici',
  misure: 'Misure',
  report: 'Report sintetico',
  come: 'Come è stato fatto',
  tempo: 'Nel tempo'
}

// La finestra di un test: una sezione per volta, cosi' non e' tutto sullo
// stesso foglio. Sola lettura (l'unica cosa che si cambia e' il lato
// interessato, che si salva da solo): Invio e clic fuori la chiudono.
export default function DettaglioPedana({
  gruppo,
  giorno,
  armoOperato,
  onLato,
  onElimina,
  onChiudi
}: {
  gruppo: GruppoPedana
  giorno: GiornoPedana
  armoOperato: LatoPedana | null
  onLato: (lato: LatoPedana | null) => void
  onElimina: () => void
  onChiudi: () => void
}): React.JSX.Element {
  const test = giorno.test
  const u = gruppo.misura.unita
  const lati = [
    ...new Set(test.flatMap((t) => t.misure.flatMap((m) => m.valori.map((v) => v.lato))))
  ]
  const avvertenze = [...new Set(test.flatMap((t) => t.avvertenze))]
  const riassunto = test.flatMap((t) => t.riassunto)
  // il report sintetico di ogni registrazione, scritto di seguito come un testo
  const reportPerTest = test
    .filter((t) => t.riassunto.length > 0)
    .map((t) => ({ id: t.id, lato: t.lato, testo: t.riassunto.join(' ') }))
  const condizioni = [...new Set(test.flatMap((t) => condizioniLeggibili(t.condizioni)))]
  // i tracciati, il destro prima del sinistro, affiancati e alla stessa scala
  const tracciati = test
    .flatMap((t) =>
      t.serie.filter((s) => s.codice === 'stabilogramma').map((serie) => ({ serie, lato: t.lato }))
    )
    .sort((a, b) => (a.lato === 'dx' ? 0 : 1) - (b.lato === 'dx' ? 0 : 1))
  const raggioComune = Math.max(0, ...tracciati.map((t) => raggioTracciato(t.serie)))
  const dispositivo = [
    ...new Set(
      test.map((t) => [t.dispositivo_tipo, t.dispositivo_modello].filter(Boolean).join(' · '))
    )
  ].filter(Boolean)
  const pesi = [...new Set(test.map((t) => t.peso_kg).filter((p): p is number => p != null))]
  const ore = [...new Set(test.map((t) => t.ora).filter((o): o is string => !!o))]

  const sezioni: Sezione[] = ['risultato', 'misure']
  if (riassunto.length > 0) sezioni.push('report')
  sezioni.push('come')
  if (gruppo.giorni.length > 1) sezioni.push('tempo')
  const [sezione, setSezione] = useState<Sezione>('risultato')

  // il menu mostra "scelto qui" solo se il lato e' stato scelto per questo
  // test; altrimenti vale quello della scheda e il menu resta sul segnaposto
  const sceltoQui =
    gruppo.latoInteressato !== null && gruppo.latoInteressato !== armoOperato
      ? gruppo.latoInteressato
      : ''
  const v = gruppo.variazione
  // Esc chiude la finestra e si torna alla scheda del paziente, sulla pedana
  useScorciatoie([{ tasto: 'Escape', azione: onChiudi }])

  return (
    <Modale
      className="dettaglio-pedana"
      overlayClassName="modal-overlay-contenuto"
      onConferma={onChiudi}
    >
      <div className="testata-dettaglio-pedana">
        <div>
          <h3>{gruppo.nome}</h3>
          <p className="hint">
            {dataDellaRiga(giorno)}
            {lati.length > 1 && ' — destro e sinistro'}
            {lati.length === 1 && lati[0] && ` — ${NOME_LATO[lati[0]].toLowerCase()}`}
          </p>
        </div>
        <span className="row-actions">
          <button className="danger" title="Elimina questo test" onClick={onElimina}>
            <Trash2 size={18} />
          </button>
          <button title="Chiudi (Esc)" aria-label="Chiudi" onClick={onChiudi}>
            <X size={18} />
          </button>
        </span>
      </div>

      <div className="config-tabs">
        {sezioni.map((s) => (
          <button key={s} className={s === sezione ? 'active' : ''} onClick={() => setSezione(s)}>
            {TITOLO_SEZIONE[s]}
          </button>
        ))}
      </div>

      <div className="corpo-dettaglio-pedana">
        {sezione === 'risultato' && (
          <>
            {gruppo.frase && <p className="frase-pedana">{gruppo.frase}</p>}
            {gruppo.perLato && gruppo.misura.nome && <p className="hint">{gruppo.misura.nome}</p>}
            <div className="numeri-pedana">
              {gruppo.perLato ? (
                <>
                  <div>
                    <span className="lato-piccolo">Destro</span>
                    <strong>{formattaValore(giorno.dx, u)}</strong>
                  </div>
                  <div>
                    <span className="lato-piccolo">Sinistro</span>
                    <strong>{formattaValore(giorno.sx, u)}</strong>
                  </div>
                  {giorno.lsi !== null && (
                    <div>
                      <span className="lato-piccolo">
                        {gruppo.latoInteressato ? 'LSI' : 'Fra i lati'}
                      </span>
                      <strong>{formattaValore(giorno.lsi, '%')}</strong>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <span className="lato-piccolo">{gruppo.misura.nome || 'Valore'}</span>
                  <strong>{formattaValore(giorno.unico, u)}</strong>
                </div>
              )}
            </div>

            {gruppo.famiglia === 'forza' && gruppo.perLato && (
              <label className="lato-interessato-pedana">
                Lato interessato
                <MenuScelta
                  valore={sceltoQui}
                  placeholder={
                    armoOperato
                      ? `Come nella scheda (${NOME_LATO[armoOperato].toLowerCase()})`
                      : 'Non indicato'
                  }
                  opzioni={[
                    { valore: 'dx', etichetta: 'Destro' },
                    { valore: 'sx', etichetta: 'Sinistro' }
                  ]}
                  onScegli={(l) => onLato(l === '' ? null : l)}
                  title="Vale solo per questo test: serve a calcolare l'LSI"
                />
              </label>
            )}

            {avvertenze.map((a) => (
              <p key={a} className="avviso-pedana">
                <AlertTriangle size={14} /> {a}
              </p>
            ))}

            {tracciati.length > 0 && (
              <div className="tracciati-pedana">
                {tracciati.map((t, i) => (
                  <GraficoStabilogramma
                    key={i}
                    serie={t.serie}
                    titolo={`Tracciato del centro di pressione${titoloLato(t.lato)}`}
                    raggio={tracciati.length > 1 ? raggioComune : undefined}
                    lato={t.lato}
                  />
                ))}
              </div>
            )}
            <GraficiCurve test={test} />
          </>
        )}

        {sezione === 'misure' && (
          <>
            <div className="gruppi-misure-pedana">
              {misureRaggruppate([
                ...new Map(test.flatMap((t) => t.misure).map((m) => [m.codice, m])).values()
              ]).map((g) => (
                <section key={g.titolo} className="gruppo-misure-pedana">
                  <h4>{g.titolo}</h4>
                  <table className="tabella-misure-pedana">
                    {lati.length > 1 && (
                      <thead>
                        <tr>
                          <th />
                          {lati.map((l) => (
                            <th key={l ?? 'unico'}>{l ? NOME_LATO[l] : ''}</th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {g.misure.map((m) => (
                        <tr key={m.codice}>
                          <th>{m.nome}</th>
                          {lati.map((l) => {
                            const prove = m.valori.filter((x) => x.lato === l)
                            return (
                              <td key={l ?? 'unico'}>
                                {prove.length > 0 ? (
                                  <>
                                    <strong>
                                      {formattaValore(valoreDellaMisura(m, l), m.unita)}
                                    </strong>
                                    {m.per_prova && prove.length > 1 && (
                                      <span className="hint prove-pedana">{proveDi(m, l)}</span>
                                    )}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          </>
        )}

        {sezione === 'report' && (
          <div className="report-sintetico-pedana">
            {reportPerTest.map((r) => (
              <section key={r.id}>
                {reportPerTest.length > 1 && (
                  <h4>{r.lato ? `Lato ${NOME_LATO[r.lato].toLowerCase()}` : 'Test'}</h4>
                )}
                <p>{r.testo}</p>
              </section>
            ))}
          </div>
        )}

        {sezione === 'come' && (
          <>
            <ul className="elenco-come-pedana">
              <li>
                <span className="lato-piccolo">Data</span> {dataDellaRiga(giorno)}
                {ore.length > 0 && ` alle ${ore.join(', ')}`}
              </li>
              {pesi.length > 0 && (
                <li>
                  <span className="lato-piccolo">Peso corporeo</span>{' '}
                  {pesi.map((p) => formattaValore(p, 'kg')).join(', ')}
                </li>
              )}
              {dispositivo.length > 0 && (
                <li>
                  <span className="lato-piccolo">Pedana</span> {dispositivo.join(', ')}
                </li>
              )}
              {condizioni.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </>
        )}

        {sezione === 'tempo' && (
          <>
            {v && (
              <p className="variazione-pedana">
                Dal {formatData(v.dal)}:{' '}
                {gruppo.perLato ? (
                  <>
                    destro <Variazione valore={v.dx} meglio={gruppo.misura.meglio} /> · sinistro{' '}
                    <Variazione valore={v.sx} meglio={gruppo.misura.meglio} />
                  </>
                ) : (
                  <Variazione valore={v.unico} meglio={gruppo.misura.meglio} />
                )}
              </p>
            )}
            <table className="tabella-misure-pedana tabella-nel-tempo">
              <thead>
                <tr>
                  <th>Data</th>
                  {gruppo.perLato ? (
                    <>
                      <th>Destro</th>
                      <th>Sinistro</th>
                      {gruppo.famiglia === 'forza' && (
                        <th>{gruppo.latoInteressato ? 'LSI' : 'Fra i lati'}</th>
                      )}
                    </>
                  ) : (
                    <th>{gruppo.misura.nome || 'Valore'}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {gruppo.giorni.map((g) => (
                  <tr key={g.test[0]?.id} className={g === giorno ? 'riga-corrente' : ''}>
                    <th>{dataDellaRiga(g)}</th>
                    {gruppo.perLato ? (
                      <>
                        <td>{formattaValore(g.dx, u)}</td>
                        <td>{formattaValore(g.sx, u)}</td>
                        {gruppo.famiglia === 'forza' && (
                          <td>{g.lsi !== null ? formattaValore(g.lsi, '%') : '—'}</td>
                        )}
                      </>
                    ) : (
                      <td>{formattaValore(g.unico, u)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="modal-actions">
        <button className="primary" onClick={onChiudi}>
          Chiudi
        </button>
      </div>
    </Modale>
  )
}
