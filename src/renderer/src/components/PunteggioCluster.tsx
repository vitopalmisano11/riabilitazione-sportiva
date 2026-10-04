import { useEffect, useState } from 'react'
import { CircleAlert, Plus, X } from 'lucide-react'
import type {
  FasciaPunteggio,
  PunteggioProtocollo,
  RegolaPunteggio,
  RisultatoPunteggio,
  SezioneScreening
} from '../../../shared/types'
import Aiuto from './Aiuto'
import { errMsg } from '../lib'
import { toastErrore } from './Toast'
import { avvisoPunteggio, puntiTesto } from '../../../shared/punteggio'
import { DECIMALI_MISURA, DECIMALI_PERCENTUALE } from '../../../shared/misure'
import { controllaIntervalli, frasiControllo } from '../../../shared/soglie'

// Il punteggio del cluster, nella configurazione del protocollo.
//
// Le voci si scelgono fra le misure dei test e i punteggi dei questionari che
// il protocollo contiene gia': il punteggio si costruisce sopra ai test, non ne
// aggiunge di nuovi. Un protocollo senza voci non ha punteggio, e allora in
// esecuzione e nel report non compare niente.

interface Fonte {
  chiave: string
  misura_id: number | null
  punteggio_id: number | null
  nome: string
  // la misura e' di un test a una gamba per volta
  perLato: boolean
  unita: string | null
}

const chiaveDi = (r: RegolaPunteggio): string =>
  r.misura_id != null ? `m${r.misura_id}` : r.punteggio_id != null ? `p${r.punteggio_id}` : ''

const numero = (v: string): number | null => (v.trim() === '' ? null : Number(v))

export default function PunteggioCluster({
  sezioni,
  punteggio,
  onChange
}: {
  sezioni: SezioneScreening[]
  punteggio: PunteggioProtocollo
  onChange: (p: PunteggioProtocollo) => void
}): React.JSX.Element {
  const [fonti, setFonti] = useState<Fonte[]>([])

  // Le fonti si rileggono quando cambiano i test e i questionari del protocollo.
  const test = [...new Set(sezioni.flatMap((s) => s.voci.map((v) => v.test_id)))].filter(
    (x): x is number => x != null
  )
  const questionari = [
    ...new Set(sezioni.flatMap((s) => s.voci.map((v) => v.questionario_id)))
  ].filter((x): x is number => x != null)
  const chiaveVoci = `${test.join(',')}|${questionari.join(',')}`

  useEffect(() => {
    let annullato = false
    void (async () => {
      try {
        const elenco: Fonte[] = []
        for (const id of test) {
          const t = await window.api.testValutazione.get(id)
          for (const m of t.misure) {
            elenco.push({
              chiave: `m${m.id}`,
              misura_id: m.id,
              punteggio_id: null,
              nome: `${t.test.nome} – ${m.nome}`,
              perLato: t.test.per_lato === 1,
              unita: m.unita
            })
          }
        }
        for (const id of questionari) {
          const q = await window.api.questionari.get(id)
          for (const p of q.punteggi) {
            if (p.id == null || p.id < 0) continue
            elenco.push({
              chiave: `p${p.id}`,
              misura_id: null,
              punteggio_id: p.id,
              nome: `${q.questionario.nome} – ${p.nome}`,
              perLato: false,
              unita: null
            })
          }
        }
        if (!annullato) setFonti(elenco)
      } catch (e) {
        toastErrore(errMsg(e))
      }
    })()
    return () => {
      annullato = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiaveVoci])

  const { regole, fasce } = punteggio
  const cambiaRegola = (i: number, patch: Partial<RegolaPunteggio>): void =>
    onChange({ ...punteggio, regole: regole.map((r, j) => (i === j ? { ...r, ...patch } : r)) })
  const cambiaFascia = (i: number, patch: Partial<FasciaPunteggio>): void =>
    onChange({ ...punteggio, fasce: fasce.map((f, j) => (i === j ? { ...f, ...patch } : f)) })

  const nuovaRegola = (): RegolaPunteggio => ({
    id: null,
    misura_id: null,
    punteggio_id: null,
    lato: null,
    nome: '',
    soglie: [{ minimo: null, massimo: null, punti: 0 }]
  })

  const massimo = regole.reduce(
    (somma, r) => somma + Math.max(0, ...r.soglie.map((s) => Number(s.punti) || 0)),
    0
  )

  return (
    <section className="card punteggio-cluster">
      <div className="card-header-row">
        <h3>
          Punteggio del cluster
          <Aiuto testo="Serve ai cluster che danno un risultato, come l'Ankle-GO. Per ogni voce scegli una misura di un test o il punteggio di un questionario del protocollo, e scrivi le soglie dei punti: si leggono dall'alto, vale la prima che si avvera, e i limiti sono compresi. Sotto, le fasce del risultato sul totale. Quando esegui lo screening il programma assegna i punti, fa il totale e scrive la fascia, anche nel report. Se un protocollo non ha voci, il punteggio non compare da nessuna parte." />
        </h3>
        {regole.length > 0 && <span className="hint">Punteggio massimo: {massimo}</span>}
      </div>

      {regole.length === 0 ? (
        <div className="riga-nuova-sezione">
          <span className="hint">Questo protocollo non ha un punteggio.</span>
          <button
            className="btn-piccolo"
            onClick={() => onChange({ ...punteggio, regole: [nuovaRegola()] })}
          >
            <Plus size={14} /> Aggiungi il punteggio
          </button>
        </div>
      ) : (
        <>
          <div className="lista-domande">
            {regole.map((r, i) => {
              const fonte = fonti.find((f) => f.chiave === chiaveDi(r))
              const persa = chiaveDi(r) !== '' && fonti.length > 0 && !fonte
              return (
                <div key={i} className="domanda-card regola-punteggio">
                  <div className="domanda-testata">
                    <span className="domanda-numero">{i + 1}</span>
                    <select
                      className="domanda-testo"
                      value={chiaveDi(r)}
                      onChange={(e) => {
                        const f = fonti.find((x) => x.chiave === e.target.value)
                        if (!f) return
                        cambiaRegola(i, {
                          misura_id: f.misura_id,
                          punteggio_id: f.punteggio_id,
                          nome: f.nome,
                          lato: f.perLato ? (r.lato ?? 'interessato') : null
                        })
                      }}
                    >
                      <option value="">— scegli la misura o il questionario —</option>
                      {persa && <option value={chiaveDi(r)}>{r.nome} (non più nel protocollo)</option>}
                      {fonti.map((f) => (
                        <option key={f.chiave} value={f.chiave}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                    <span className="item-actions-static">
                      <button
                        className="danger"
                        title="Togli questa voce"
                        onClick={() =>
                          onChange({ ...punteggio, regole: regole.filter((_, j) => j !== i) })
                        }
                      >
                        <X size={16} />
                      </button>
                    </span>
                  </div>

                  {fonte?.perLato && (
                    <div className="regola-fascia">
                      <span className="regola-parola">si guarda</span>
                      <select
                        value={r.lato ?? 'interessato'}
                        onChange={(e) =>
                          cambiaRegola(i, { lato: e.target.value as 'interessato' | 'lsi' })
                        }
                      >
                        <option value="interessato">il lato interessato</option>
                        <option value="lsi">la simmetria fra i lati (LSI %)</option>
                      </select>
                    </div>
                  )}

                  {r.soglie.map((s, k) => (
                    <div key={k} className="regola-fascia">
                      <span className="regola-parola">da</span>
                      <input
                        type="number"
                        className="campo-stretto"
                        value={s.minimo ?? ''}
                        onChange={(e) =>
                          cambiaRegola(i, {
                            soglie: r.soglie.map((x, h) =>
                              h === k ? { ...x, minimo: numero(e.target.value) } : x
                            )
                          })
                        }
                      />
                      <span className="regola-parola">a</span>
                      <input
                        type="number"
                        className="campo-stretto"
                        value={s.massimo ?? ''}
                        onChange={(e) =>
                          cambiaRegola(i, {
                            soglie: r.soglie.map((x, h) =>
                              h === k ? { ...x, massimo: numero(e.target.value) } : x
                            )
                          })
                        }
                      />
                      <span className="regola-parola">
                        {r.lato === 'lsi' && fonte?.perLato ? '%' : (fonte?.unita ?? '')} →
                      </span>
                      <input
                        type="number"
                        className="campo-stretto"
                        value={s.punti}
                        onChange={(e) =>
                          cambiaRegola(i, {
                            soglie: r.soglie.map((x, h) =>
                              h === k ? { ...x, punti: Number(e.target.value) || 0 } : x
                            )
                          })
                        }
                      />
                      <span className="regola-parola">punti</span>
                      <button
                        className="btn-icona danger"
                        title="Togli questa soglia"
                        onClick={() =>
                          cambiaRegola(i, { soglie: r.soglie.filter((_, h) => h !== k) })
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {/* Gli errori tipici delle soglie si vedono qui, mentre si
                      scrivono: un buco farebbe uscire il valore "fuori dalle
                      soglie" davanti al paziente. */}
                  {frasiControllo(
                    controllaIntervalli(
                      r.soglie,
                      r.lato === 'lsi' && fonte?.perLato ? DECIMALI_PERCENTUALE : DECIMALI_MISURA
                    ),
                    'in quel caso il valore resta fuori dalle soglie e il totale è parziale'
                  ).map((f) => (
                    <span key={f} className="esito-copia esito-attenzione">
                      <CircleAlert size={15} /> {f}
                    </span>
                  ))}
                  <div>
                    <button
                      className="btn-piccolo"
                      onClick={() =>
                        cambiaRegola(i, {
                          soglie: [...r.soglie, { minimo: null, massimo: null, punti: 0 }]
                        })
                      }
                    >
                      <Plus size={14} /> Aggiungi soglia
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div>
            <button
              className="btn-piccolo"
              onClick={() => onChange({ ...punteggio, regole: [...regole, nuovaRegola()] })}
            >
              <Plus size={14} /> Aggiungi voce
            </button>
          </div>

          <div className="sotto-titolo">
            Risultato
            <Aiuto testo="Le fasce del totale, lette dall'alto: vale la prima che si avvera, limiti compresi. Per esempio da 11 a 25 recupero completo probabile, da 8 a 10 ritorno allo stesso livello. La fascia si scrive solo quando tutte le voci hanno un valore: con un test mancante il totale sarebbe più basso di quello vero." />
          </div>
          <div className="lista-domande">
            {fasce.map((f, i) => (
              <div key={i} className="regola-fascia">
                <input
                  className="campo-etichetta-fascia"
                  placeholder="Risultato (es. Recupero completo probabile)"
                  value={f.etichetta}
                  onChange={(e) => cambiaFascia(i, { etichetta: e.target.value })}
                />
                <span className="regola-parola">da</span>
                <input
                  type="number"
                  className="campo-stretto"
                  value={f.minimo ?? ''}
                  onChange={(e) => cambiaFascia(i, { minimo: numero(e.target.value) })}
                />
                <span className="regola-parola">a</span>
                <input
                  type="number"
                  className="campo-stretto"
                  value={f.massimo ?? ''}
                  onChange={(e) => cambiaFascia(i, { massimo: numero(e.target.value) })}
                />
                <span className="regola-parola">punti</span>
                <button
                  className="btn-icona danger"
                  title="Togli questa fascia"
                  onClick={() =>
                    onChange({ ...punteggio, fasce: fasce.filter((_, j) => j !== i) })
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {fasce.length > 0 &&
              frasiControllo(
                // i punti sono quasi sempre interi: un totale di 6,5 non esiste, e
                // fra "da 0 a 6" e "da 7" non c'e' nessun buco
                controllaIntervalli(
                  fasce,
                  regole.every((r) => r.soglie.every((s) => Number.isInteger(Number(s.punti))))
                    ? 0
                    : DECIMALI_MISURA,
                  // il totale non scende sotto il minimo possibile ne' supera il massimo
                  {
                    da: regole.reduce(
                      (somma, r) => somma + Math.min(0, ...r.soglie.map((s) => Number(s.punti) || 0)),
                      0
                    ),
                    a: massimo
                  }
                ),
                'in quel caso il totale resta senza fascia'
              ).map((f) => (
                <span key={f} className="esito-copia esito-attenzione">
                  <CircleAlert size={15} /> {f}
                </span>
              ))}
            <div>
              <button
                className="btn-piccolo"
                onClick={() =>
                  onChange({
                    ...punteggio,
                    fasce: [...fasce, { etichetta: '', minimo: null, massimo: null }]
                  })
                }
              >
                <Plus size={14} /> Aggiungi fascia
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

// Il risultato, mentre si esegue lo screening: le voci con i loro punti, il
// totale e la fascia. Si calcola sui valori salvati.
export function RisultatoCluster({
  risultato,
  daAggiornare
}: {
  risultato: RisultatoPunteggio
  // ci sono valori scritti ma non ancora salvati
  daAggiornare: boolean
}): React.JSX.Element {
  // il valore e' gia' arrotondato come lo si giudica: si mostra tutto
  const n = (v: number | null): string => (v == null ? '—' : String(v).replace('.', ','))
  const avviso = avvisoPunteggio(risultato)
  return (
    <section className="card risultato-cluster">
      <div className="card-header-row">
        <h3>
          Punteggio: {n(risultato.totale)} / {n(risultato.massimo)}
          {risultato.fascia && <span className="badge-fascia">{risultato.fascia}</span>}
        </h3>
        {daAggiornare && <span className="hint">Salva per aggiornare il punteggio</span>}
      </div>
      <table className="tabella-punteggio">
        <thead>
          <tr>
            <th>Voce</th>
            <th>Valore</th>
            <th>Punti</th>
          </tr>
        </thead>
        <tbody>
          {risultato.voci.map((v, i) => (
            <tr key={i}>
              <td>{v.nome}</td>
              <td>
                {n(v.valore)}
                {v.valore != null && v.unita ? ` ${v.unita}` : ''}
              </td>
              <td className={v.fuoriFascia ? 'fuori-fascia' : undefined}>{puntiTesto(v, n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {avviso && <p className="hint">{avviso}</p>}
    </section>
  )
}
