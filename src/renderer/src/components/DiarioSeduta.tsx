import { useEffect, useState } from 'react'
import { Check, ChevronDown, History, Plus, X } from 'lucide-react'
import type { AndamentoRiferito, SedutaPrecedente, Tecnica } from '../../../shared/types'
import Aiuto from './Aiuto'
import { toast, toastErrore } from './Toast'
import { errMsg, formatData } from '../lib'

// Il diario della seduta, in cima alla seduta: prima come sta il paziente
// tornando, poi cosa gli si fa. Gli esercizi vengono dopo.

const ANDAMENTI: { valore: AndamentoRiferito; nome: string }[] = [
  { valore: 'meglio', nome: 'Meglio' },
  { valore: 'uguale', nome: 'Uguale' },
  { valore: 'peggio', nome: 'Peggio' }
]

export const NOME_ANDAMENTO: Record<AndamentoRiferito, string> = {
  meglio: 'meglio',
  uguale: 'uguale',
  peggio: 'peggio'
}

// La volta prima, in poche righe: si legge prima di chiedere "come va?".
export function UltimaVoltaSeduta({
  precedente
}: {
  precedente: SedutaPrecedente
}): React.JSX.Element {
  const p = precedente
  const trattamento = [p.tecniche.join(', '), p.trattamento].filter(Boolean).join(' — ')
  const numeri = [
    p.dolore != null ? `dolore ${p.dolore}/10` : null,
    p.sforzo != null ? `sforzo ${p.sforzo}/10` : null,
    // "5/10" per le scale da 0 a 10, altrimenti il numero con la sua unita'
    ...p.segni.map((g) => {
      const v = String(g.valore).replace('.', ',')
      return `${g.nome} ${g.unita === '0-10' ? `${v}/10` : `${v}${g.unita ? ` ${g.unita}` : ''}`}`
    })
  ].filter(Boolean)
  const vuota = !p.riferito_andamento && !p.riferito && !trattamento && numeri.length === 0 && !p.note
  // Chiusa e' una riga sola, con l'essenziale; aperta mostra tutto.
  const [aperta, setAperta] = useState(false)
  const inBreve = [
    p.riferito_andamento ? NOME_ANDAMENTO[p.riferito_andamento] : null,
    p.tecniche.join(', ') || null,
    p.dolore != null ? `dolore ${p.dolore}/10` : null
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className={aperta ? 'card ultima-seduta aperta' : 'card ultima-seduta'}>
      <button
        type="button"
        className="titolo-ultima"
        title={aperta ? 'Chiudi' : 'Vedi tutto'}
        onClick={() => setAperta(!aperta)}
      >
        <History size={16} />
        <span className="data-ultima">L&apos;ultima volta — {formatData(p.data)}</span>
        {!aperta && <span className="in-breve">{vuota ? 'niente di scritto' : inBreve}</span>}
        <ChevronDown size={16} className="freccia-ultima" />
      </button>
      {!aperta ? null : vuota ? (
        <p className="hint">In quella seduta non erano scritti né come stava né il trattamento.</p>
      ) : (
        <dl className="righe-ultima">
          {(p.riferito_andamento || p.riferito) && (
            <div>
              <dt>Riferiva</dt>
              <dd>
                {p.riferito_andamento && (
                  <span className={`badge-andamento ${p.riferito_andamento}`}>
                    {NOME_ANDAMENTO[p.riferito_andamento]}
                  </span>
                )}
                {p.riferito}
              </dd>
            </div>
          )}
          {trattamento && (
            <div>
              <dt>Trattamento</dt>
              <dd>{trattamento}</dd>
            </div>
          )}
          {numeri.length > 0 && (
            <div>
              <dt>Misure</dt>
              <dd>{numeri.join(' · ')}</dd>
            </div>
          )}
          {p.note && (
            <div>
              <dt>Note</dt>
              <dd>{p.note}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}

export default function DiarioSeduta({
  andamento,
  riferito,
  tecnicaIds,
  trattamento,
  onCambia
}: {
  andamento: AndamentoRiferito | null
  riferito: string
  tecnicaIds: number[]
  trattamento: string
  onCambia: (patch: {
    andamento?: AndamentoRiferito | null
    riferito?: string
    tecnicaIds?: number[]
    trattamento?: string
  }) => void
}): React.JSX.Element {
  const [tecniche, setTecniche] = useState<Tecnica[]>([])
  const [nuova, setNuova] = useState<string | null>(null)
  const [modificaElenco, setModificaElenco] = useState(false)

  const carica = (): void => {
    window.api.tecniche
      .list(true)
      .then(setTecniche)
      .catch((e) => toastErrore(errMsg(e)))
  }
  useEffect(carica, [])

  // In elenco le tecniche attive, e anche quelle archiviate che questa seduta
  // aveva gia': una seduta vecchia deve continuare a mostrarle.
  const visibili = tecniche.filter((t) => t.archiviata === 0 || tecnicaIds.includes(t.id))

  const aggiungi = async (): Promise<void> => {
    const nome = (nuova ?? '').trim()
    if (!nome) return
    try {
      const id = await window.api.tecniche.crea(nome)
      setNuova(null)
      carica()
      if (!tecnicaIds.includes(id)) onCambia({ tecnicaIds: [...tecnicaIds, id] })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const archivia = async (t: Tecnica): Promise<void> => {
    try {
      await window.api.tecniche.setArchiviata(t.id, true)
      carica()
      toast(`"${t.nome}" tolta dall'elenco. Per rimetterla, aggiungila di nuovo.`)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <>
    {/* Chiuse all'inizio, come le altre sezioni facoltative (segni,
        indicazioni per casa, cestino): occupavano spazio in cima alla seduta
        anche quando non c'era niente da scrivere. Si aprono con un clic e
        restano com'erano finche' non si tocca la freccia. */}
    <details className="blocco-apribile blocco-riferisce">
      <summary>
        Cosa riferisce{andamento ? ` (${NOME_ANDAMENTO[andamento]})` : ''}
        <Aiuto testo="Come sta tornando, rispetto alla volta prima: un clic su meglio, uguale o peggio, e con le sue parole quello che racconta. Nel diario si legge seduta dopo seduta, e la volta dopo lo ritrovi in cima alla seduta nuova." />
      </summary>
      <div className="contenuto-apribile contenuto-riferisce">
        <div className="riga-diario">
        <span className="scelta-coppia segmentata">
          {ANDAMENTI.map((a) => (
            <button
              key={a.valore}
              type="button"
              className={andamento === a.valore ? `scelta-attiva ${a.valore}` : ''}
              onClick={() => onCambia({ andamento: andamento === a.valore ? null : a.valore })}
            >
              {a.nome}
            </button>
          ))}
        </span>
        <textarea
          rows={1}
          className="cresce"
          placeholder="es. meno dolore la mattina, fatica ancora sulle scale"
          value={riferito}
          onChange={(e) => onCambia({ riferito: e.target.value })}
        />
        </div>
      </div>
    </details>

    <details className="blocco-apribile blocco-trattamento">
      <summary>
        Trattamento eseguito{tecnicaIds.length > 0 ? ` (${tecnicaIds.length})` : ''}
        <Aiuto testo="Le tecniche che fai oggi: si spuntano con un clic. L'elenco è tuo: con Aggiungi ne scrivi una nuova, con Modifica elenco togli quelle che non usi più (le sedute vecchie continuano a mostrarle). Nella casella sotto i dettagli, per esempio la zona o i parametri." />
      </summary>
      <div className="contenuto-apribile contenuto-trattamento">
        <div className="riga-diario">
        <div className="riga-modifica-elenco">
          <button
            type="button"
            className="link-discreto"
            onClick={() => setModificaElenco(!modificaElenco)}
          >
            {modificaElenco ? 'Fatto' : 'Modifica elenco'}
          </button>
        </div>
        <div className="scelte-multiple tecniche">
          {visibili.map((t) => {
            const dentro = tecnicaIds.includes(t.id)
            return (
              <span key={t.id} className={modificaElenco ? 'tecnica in-modifica' : 'tecnica'}>
                <button
                  type="button"
                  className={dentro ? 'scelta-attiva' : ''}
                  // mentre si modifica l'elenco il nome non si spunta: si
                  // toglie con la X accanto, senza spuntare per sbaglio
                  onClick={() => {
                    if (modificaElenco) return
                    onCambia({
                      tecnicaIds: dentro ? tecnicaIds.filter((x) => x !== t.id) : [...tecnicaIds, t.id]
                    })
                  }}
                >
                  {dentro && <Check size={14} />}
                  {t.nome}
                </button>
                {modificaElenco && t.archiviata === 0 && (
                  <button
                    type="button"
                    className="togli-tecnica"
                    title={`Togli "${t.nome}" dall'elenco`}
                    onClick={() => void archivia(t)}
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            )
          })}
          {nuova == null ? (
            <button type="button" className="btn-piccolo" onClick={() => setNuova('')}>
              <Plus size={14} /> Aggiungi
            </button>
          ) : (
            <span className="nuova-tecnica">
              <input
                autoFocus
                placeholder="es. onde d'urto"
                value={nuova}
                onChange={(e) => setNuova(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void aggiungi()
                  if (e.key === 'Escape') setNuova(null)
                }}
              />
              <button type="button" className="primary btn-piccolo" onClick={() => void aggiungi()}>
                Aggiungi
              </button>
            </span>
          )}
        </div>
        <textarea
          rows={1}
          className="cresce"
          placeholder="Dettagli (facoltativo): zona, parametri, come ha risposto"
          value={trattamento}
          onChange={(e) => onCambia({ trattamento: e.target.value })}
        />
        </div>
      </div>
    </details>
    </>
  )
}
