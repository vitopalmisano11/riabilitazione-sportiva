import { useEffect, useRef, useState } from 'react'
import { GripVertical, Plus, X } from 'lucide-react'
import type {
  AnamnesiProssima as Dati,
  AndamentoSintomo,
  EpisodioSintomo,
  SintomoAnamnesi
} from '../../../shared/types'
import { toastErrore } from './Toast'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'

// Colloquio con il paziente: nessun campo obbligatorio e nessun ordine da
// seguire. Tutto sta in una schermata sola, cosi' se il paziente anticipa una
// risposta la si scrive subito. Il salvataggio e' automatico: durante il
// colloquio non c'e' un pulsante da ricordare.
const ATTESA_SALVATAGGIO = 1500

const VUOTO: Dati = {
  motivo_consulto: null,
  dolore_notturno: null,
  disturbi_sonno: null,
  tosse_starnuto: null,
  sintomi_neurologici: null,
  relazione_sintomi: null,
  note: null,
  sintomi: []
}

let ultimaChiave = 0
const nuovaChiave = (): number => --ultimaChiave

const SINTOMO_NUOVO = (): SintomoAnamnesi => ({
  id: nuovaChiave(),
  descrizione: null,
  andamento: null,
  da_quanto: null,
  episodio: null,
  esordio: null,
  traumatico: null,
  comportamento: null,
  aggrava: null,
  allevia: null
})

export default function AnamnesiProssima({
  pazienteId,
  onChiudi
}: {
  pazienteId: number
  onChiudi: () => void
}): React.JSX.Element {
  const [dati, setDati] = useState<Dati | null>(null)
  const [stato, setStato] = useState<'fermo' | 'salvo' | 'salvato'>('fermo')
  const attesa = useRef<ReturnType<typeof setTimeout> | null>(null)
  const daSalvare = useRef<Dati | null>(null)

  useEffect(() => {
    window.api.anamnesi
      .get(pazienteId)
      .then((d) => setDati({ ...VUOTO, ...d }))
      .catch((e) => toastErrore(errMsg(e)))
  }, [pazienteId])

  // Salva quel che c'e' in sospeso: alla chiusura non si aspetta il timer.
  const salvaSubito = async (): Promise<void> => {
    const d = daSalvare.current
    if (!d) return
    daSalvare.current = null
    setStato('salvo')
    try {
      await window.api.anamnesi.salva(pazienteId, d)
      setStato('salvato')
    } catch (e) {
      setStato('fermo')
      toastErrore(errMsg(e))
    }
  }

  useEffect(() => {
    return () => {
      if (attesa.current) clearTimeout(attesa.current)
    }
  }, [])

  if (!dati) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <p className="hint">Caricamento…</p>
        </div>
      </div>
    )
  }

  const aggiorna = (patch: Partial<Dati>): void => {
    const nuovo = { ...dati, ...patch }
    setDati(nuovo)
    daSalvare.current = nuovo
    setStato('salvo')
    if (attesa.current) clearTimeout(attesa.current)
    attesa.current = setTimeout(() => void salvaSubito(), ATTESA_SALVATAGGIO)
  }

  const chiudi = (): void => {
    if (attesa.current) clearTimeout(attesa.current)
    void salvaSubito().then(onChiudi)
  }

  const campo =
    (k: keyof Omit<Dati, 'sintomi'>) =>
    (e: { target: { value: string } }): void =>
      aggiorna({ [k]: e.target.value || null } as Partial<Dati>)

  return (
    <div className="modal-overlay" onClick={chiudi}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="card-header-row">
          <h3>Anamnesi prossima</h3>
          <span className="hint">
            {stato === 'salvo' ? 'Salvataggio…' : stato === 'salvato' ? 'Salvato' : ''}
          </span>
        </div>

        <label>
          Motivo del consulto, con le parole del paziente
          <textarea
            rows={2}
            autoFocus
            placeholder="Che cosa la porta qui? — trascrivi come lo dice lui"
            value={dati.motivo_consulto ?? ''}
            onChange={campo('motivo_consulto')}
          />
        </label>

        <ListaSintomi
          sintomi={dati.sintomi}
          onChange={(sintomi) => aggiorna({ sintomi })}
        />

        <div className="sotto-titolo">Il quadro nel suo insieme</div>
        <div className="form-row-2">
          <label>
            Dolore o sintomi notturni
            <input value={dati.dolore_notturno ?? ''} onChange={campo('dolore_notturno')} />
          </label>
          <label>
            Disturbi del sonno
            <input value={dati.disturbi_sonno ?? ''} onChange={campo('disturbi_sonno')} />
          </label>
        </div>
        <div className="form-row-2">
          <label>
            Tosse o starnuto
            <input
              placeholder="Peggiorano il sintomo?"
              value={dati.tosse_starnuto ?? ''}
              onChange={campo('tosse_starnuto')}
            />
          </label>
          <label>
            Sintomi neurologici
            <input
              placeholder="Formicolii, perdita di forza…"
              value={dati.sintomi_neurologici ?? ''}
              onChange={campo('sintomi_neurologici')}
            />
          </label>
        </div>
        <label>
          Relazione fra i sintomi
          <textarea
            rows={2}
            placeholder="Compaiono insieme? Uno tira l'altro?"
            value={dati.relazione_sintomi ?? ''}
            onChange={campo('relazione_sintomi')}
          />
        </label>
        <label>
          Note
          <textarea rows={2} value={dati.note ?? ''} onChange={campo('note')} />
        </label>

        <div className="modal-actions">
          <button className="primary" onClick={chiudi}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

function ListaSintomi({
  sintomi,
  onChange
}: {
  sintomi: SintomoAnamnesi[]
  onChange: (s: SintomoAnamnesi[]) => void
}): React.JSX.Element {
  const { contenitore, maniglia } = useRiordino<number>((da, a) =>
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
          <div key={s.id ?? i} {...dnd} className={['domanda-card', dnd.className].filter(Boolean).join(' ')}>
            <div className="domanda-testata">
              <span className="domanda-numero">{i + 1}</span>
              <input
                className="domanda-testo"
                placeholder="Descrizione e sede del sintomo"
                value={s.descrizione ?? ''}
                onChange={(e) => modifica(i, { descrizione: e.target.value || null })}
              />
              <span className="item-actions-static">
                <button {...maniglia(i)}>
                  <GripVertical size={16} />
                </button>
                <button
                  className="danger"
                  title="Togli questo sintomo"
                  onClick={() => onChange(sintomi.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              </span>
            </div>

            <div className="scelte-rapide">
              <Scelta
                etichette={[
                  ['costante', 'Costante'],
                  ['intermittente', 'Intermittente']
                ]}
                valore={s.andamento}
                onScegli={(v) => modifica(i, { andamento: v as AndamentoSintomo | null })}
              />
              <Scelta
                etichette={[
                  ['primo', 'Primo episodio'],
                  ['recidiva', 'Recidiva']
                ]}
                valore={s.episodio}
                onScegli={(v) => modifica(i, { episodio: v as EpisodioSintomo | null })}
              />
              <Scelta
                etichette={[
                  ['1', 'Esordio traumatico'],
                  ['0', 'Non traumatico']
                ]}
                valore={s.traumatico == null ? null : String(s.traumatico)}
                onScegli={(v) => modifica(i, { traumatico: v == null ? null : ((Number(v) as 0 | 1)) })}
              />
            </div>

            <div className="form-row-2">
              <label>
                Da quanto tempo
                <input
                  value={s.da_quanto ?? ''}
                  onChange={(e) => modifica(i, { da_quanto: e.target.value || null })}
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

            <label>
              Come è iniziato
              <input
                placeholder="Caratteristiche del disturbo all'insorgenza"
                value={s.esordio ?? ''}
                onChange={(e) => modifica(i, { esordio: e.target.value || null })}
              />
            </label>

            <div className="form-row-2">
              <label>
                Cosa lo aggrava
                <input
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
          </div>
        )
      })}

      <button onClick={() => onChange([...sintomi, SINTOMO_NUOVO()])}>
        <Plus size={16} /> Aggiungi sintomo
      </button>
    </div>
  )
}

// Coppia di pulsanti: si clicca per scegliere, si riclicca per togliere la
// scelta — durante il colloquio capita di aver segnato la risposta sbagliata.
function Scelta({
  etichette,
  valore,
  onScegli
}: {
  etichette: [string, string][]
  valore: string | null
  onScegli: (v: string | null) => void
}): React.JSX.Element {
  return (
    <span className="scelta-coppia">
      {etichette.map(([v, testo]) => (
        <button
          key={v}
          className={valore === v ? 'scelta-attiva' : ''}
          onClick={() => onScegli(valore === v ? null : v)}
        >
          {testo}
        </button>
      ))}
    </span>
  )
}
