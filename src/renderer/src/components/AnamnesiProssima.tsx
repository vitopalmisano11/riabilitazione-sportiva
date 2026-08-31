import { useEffect, useRef, useState } from 'react'
import { GripVertical, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type {
  AnamnesiProssima as Dati,
  AndamentoSintomo,
  AttivitaPartecipazione,
  EpisodioSintomo,
  PuntoAndamento,
  SintomoAnamnesi
} from '../../../shared/types'
import { toastErrore } from './Toast'
import { errMsg } from '../lib'
import { sposta, useRiordino } from '../riordino'
import GraficoAndamento, { COLORI, type Selezione } from './GraficoAndamento'

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
  note_giorno: null,
  note_esordio: null,
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
  allevia: null,
  punti: []
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
  const [sintomoAttivo, setSintomoAttivo] = useState(0)
  const [attivita, setAttivita] = useState<AttivitaPartecipazione | null>(null)
  const attesa = useRef<ReturnType<typeof setTimeout> | null>(null)
  const daSalvare = useRef<Dati | null>(null)
  const attivitaDaSalvare = useRef<AttivitaPartecipazione | null>(null)

  useEffect(() => {
    window.api.anamnesi
      .get(pazienteId)
      .then((d) => setDati({ ...VUOTO, ...d }))
      .catch((e) => toastErrore(errMsg(e)))
    window.api.anamnesi
      .attivita(pazienteId)
      .then(setAttivita)
      .catch((e) => toastErrore(errMsg(e)))
  }, [pazienteId])

  // Salva quel che c'e' in sospeso: alla chiusura non si aspetta il timer.
  const salvaSubito = async (): Promise<void> => {
    const d = daSalvare.current
    const a = attivitaDaSalvare.current
    if (!d && !a) return
    daSalvare.current = null
    attivitaDaSalvare.current = null
    setStato('salvo')
    try {
      if (d) await window.api.anamnesi.salva(pazienteId, d)
      if (a) await window.api.anamnesi.salvaAttivita(pazienteId, a)
      setStato('salvato')
    } catch (e) {
      setStato('fermo')
      toastErrore(errMsg(e))
    }
  }

  const programmaSalvataggio = (): void => {
    setStato('salvo')
    if (attesa.current) clearTimeout(attesa.current)
    attesa.current = setTimeout(() => void salvaSubito(), ATTESA_SALVATAGGIO)
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
    programmaSalvataggio()
  }

  const aggiornaAttivita = (patch: Partial<AttivitaPartecipazione>): void => {
    const nuovo = { ...(attivita ?? { attivita: null, partecipazione: null, fattori_interni: null }), ...patch }
    setAttivita(nuovo)
    attivitaDaSalvare.current = nuovo
    programmaSalvataggio()
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

        {dati.sintomi.length > 0 && (
          <Grafici
            dati={dati}
            sintomoAttivo={Math.min(sintomoAttivo, dati.sintomi.length - 1)}
            onSintomoAttivo={setSintomoAttivo}
            onAggiorna={aggiorna}
          />
        )}

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

        <div className="sotto-titolo">Attività e partecipazione</div>
        <label>
          Attività
          <textarea
            rows={2}
            placeholder="Cosa non riesce più a fare"
            value={attivita?.attivita ?? ''}
            onChange={(e) => aggiornaAttivita({ attivita: e.target.value || null })}
          />
        </label>
        <div className="form-row-2">
          <label>
            Partecipazione
            <textarea
              rows={2}
              placeholder="Lavoro, sport, vita sociale"
              value={attivita?.partecipazione ?? ''}
              onChange={(e) => aggiornaAttivita({ partecipazione: e.target.value || null })}
            />
          </label>
          <label>
            Impairment psicologici e fattori interni
            <textarea
              rows={2}
              placeholder="Paure, aspettative, convinzioni sul dolore"
              value={attivita?.fattori_interni ?? ''}
              onChange={(e) => aggiornaAttivita({ fattori_interni: e.target.value || null })}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={chiudi}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// La data si scrive a mano in gg/mm/aaaa: il calendario a comparsa e' scomodo
// quando il paziente dice "cinque anni fa". Si accetta anche l'anno a due cifre.
function isoInItaliano(iso: string | null): string {
  if (!iso) return ''
  const [a, m, g] = iso.split('-')
  return a && m && g ? `${g}/${m}/${a}` : ''
}

function italianoInIso(testo: string): string | null {
  const p = testo.trim().split(/[/.-]/)
  if (p.length !== 3) return null
  const g = Number(p[0])
  const m = Number(p[1])
  let a = Number(p[2])
  if (!g || !m || !a) return null
  if (p[2].length <= 2) a += a <= new Date().getFullYear() % 100 + 1 ? 2000 : 1900
  if (m < 1 || m > 12 || g < 1 || g > 31) return null
  const d = new Date(a, m - 1, g)
  if (d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== g) return null
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`
}

// I due andamenti. Si sceglie a quale sintomo si stanno mettendo i punti, si
// clicca sul grafico per aggiungerne uno e sul punto per toglierlo. Le note
// sotto servono quando basta una frase e non serve nessun punto.
function Grafici({
  dati,
  sintomoAttivo,
  onSintomoAttivo,
  onAggiorna
}: {
  dati: Dati
  sintomoAttivo: number
  onSintomoAttivo: (i: number) => void
  onAggiorna: (patch: Partial<Dati>) => void
}): React.JSX.Element {
  const [selezione, setSelezione] = useState<Selezione | null>(null)
  // punto dall'esordio in attesa di data e intensita'
  const [inArrivo, setInArrivo] = useState<{ sintomo: number; data: string; dolore: number } | null>(
    null
  )

  // Dal grafico del giorno si aggiunge subito; da quello dall'esordio si passa
  // dalla finestrella, perche' la data la scrive il fisioterapista.
  const richiediPunto = (indice: number, punto: Omit<PuntoAndamento, 'id'>): void => {
    if (punto.grafico === 'giorno') {
      aggiungiPunto(indice, punto)
      return
    }
    setInArrivo({
      sintomo: indice,
      data: new Date().toISOString().slice(0, 10),
      dolore: punto.dolore
    })
  }

  // Un solo punto per data su ogni sintomo: se la data c'e' gia', se ne
  // aggiorna il valore invece di sovrapporne un altro.
  const confermaPunto = (): void => {
    if (!inArrivo) return
    const { sintomo, data, dolore } = inArrivo
    const punti = dati.sintomi[sintomo].punti
    const esistente = punti.findIndex((p) => p.grafico === 'esordio' && p.data === data)
    const nuoviPunti =
      esistente >= 0
        ? punti.map((p, j) => (j === esistente ? { ...p, dolore } : p))
        : [...punti, { id: null, grafico: 'esordio' as const, minuti: null, data, dolore }]
    onAggiorna({
      sintomi: dati.sintomi.map((s, i) => (i === sintomo ? { ...s, punti: nuoviPunti } : s))
    })
    setSelezione({
      sintomo,
      punto: esistente >= 0 ? esistente : nuoviPunti.length - 1
    })
    setInArrivo(null)
  }

  // Svuota un grafico: toglie i punti di quel tipo da tutti i sintomi.
  const svuota = (tipo: 'giorno' | 'esordio'): void => {
    const quanti = dati.sintomi.reduce(
      (n, s) => n + s.punti.filter((p) => p.grafico === tipo).length,
      0
    )
    if (quanti === 0) return
    const nome = tipo === 'giorno' ? 'delle 24 ore' : "dall'esordio"
    if (!confirm(`Togliere tutti i ${quanti} punti del grafico ${nome}?`)) return
    onAggiorna({
      sintomi: dati.sintomi.map((s) => ({
        ...s,
        punti: s.punti.filter((p) => p.grafico !== tipo)
      }))
    })
    setSelezione(null)
  }

  const aggiungiPunto = (indice: number, punto: Omit<PuntoAndamento, 'id'>): void =>
  {
    onAggiorna({
      sintomi: dati.sintomi.map((s, i) =>
        i === indice ? { ...s, punti: [...s.punti, { id: null, ...punto }] } : s
      )
    })
    // il punto appena messo resta scelto: i suoi valori si correggono qui sotto
    setSelezione({ sintomo: indice, punto: dati.sintomi[indice].punti.length })
  }

  const togliPunto = (indice: number, indicePunto: number): void => {
    onAggiorna({
      sintomi: dati.sintomi.map((s, i) =>
        i === indice ? { ...s, punti: s.punti.filter((_, j) => j !== indicePunto) } : s
      )
    })
    setSelezione(null)
  }

  const cambiaPunto = (sel: Selezione, patch: Partial<PuntoAndamento>): void =>
    onAggiorna({
      sintomi: dati.sintomi.map((s, i) =>
        i === sel.sintomo
          ? { ...s, punti: s.punti.map((p, j) => (j === sel.punto ? { ...p, ...patch } : p)) }
          : s
      )
    })

  const scelto =
    selezione != null ? dati.sintomi[selezione.sintomo]?.punti[selezione.punto] : undefined

  return (
    <div className="lista-domande">
      <div className="sotto-titolo">Andamento nel tempo</div>

      <div className="legenda-sintomi">
        <span className="regola-parola">Sto segnando il sintomo</span>
        {dati.sintomi.map((s, i) => (
          <button
            key={s.id ?? i}
            className={sintomoAttivo === i ? 'scelta-attiva' : ''}
            onClick={() => onSintomoAttivo(i)}
          >
            <span className="pallino" style={{ background: COLORI[i % COLORI.length] }} />
            {i + 1}. {s.descrizione || 'senza nome'}
          </button>
        ))}
      </div>

      {selezione != null && scelto && (
        <div className="segno-strumenti">
          <span className="regola-parola">Punto scelto</span>
          {scelto.grafico === 'giorno' ? (
            <label className="compila-data">
              Ora
              <input
                type="number"
                className="campo-stretto"
                min={0}
                max={23}
                value={Math.floor((scelto.minuti ?? 0) / 60)}
                onChange={(e) =>
                  cambiaPunto(selezione, {
                    minuti: Math.min(23, Math.max(0, Number(e.target.value))) * 60
                  })
                }
              />
            </label>
          ) : (
            <CampoData
              etichetta="Data"
              valore={scelto.data}
              onCambia={(iso) => cambiaPunto(selezione, { data: iso })}
            />
          )}
          <label className="compila-data">
            Dolore
            <input
              type="number"
              className="campo-stretto"
              min={0}
              max={10}
              value={scelto.dolore}
              onChange={(e) =>
                cambiaPunto(selezione, {
                  dolore: Math.min(10, Math.max(0, Number(e.target.value)))
                })
              }
            />
          </label>
          <button
            className="danger"
            title="Togli questo punto"
            onClick={() => togliPunto(selezione.sintomo, selezione.punto)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {inArrivo && (
        <div className="modal-overlay" onClick={() => setInArrivo(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>Nuova misurazione</h3>
            <p className="modal-testo">
              Sintomo {inArrivo.sintomo + 1} —{' '}
              {dati.sintomi[inArrivo.sintomo]?.descrizione || 'senza nome'}
            </p>
            <div className="form-row-2">
              <CampoData
                etichetta="Data"
                valore={inArrivo.data}
                autoFocus
                onCambia={(iso) => setInArrivo({ ...inArrivo, data: iso ?? inArrivo.data })}
              />
              <label>
                Intensità del dolore
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={inArrivo.dolore}
                  onChange={(e) =>
                    setInArrivo({
                      ...inArrivo,
                      dolore: Math.min(10, Math.max(0, Number(e.target.value)))
                    })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setInArrivo(null)}>Annulla</button>
              <button className="primary" disabled={!inArrivo.data} onClick={confermaPunto}>
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="form-row-2">
        <div className="riquadro-grafico">
          <div className="testata-grafico">
            <span className="sotto-titolo">Nelle 24 ore</span>
            <button title="Togli tutti i punti" onClick={() => svuota('giorno')}>
              <RotateCcw size={16} /> Svuota
            </button>
          </div>
          <GraficoAndamento
            tipo="giorno"
            sintomi={dati.sintomi}
            sintomoAttivo={sintomoAttivo}
            selezione={selezione}
            onSeleziona={setSelezione}
            onAggiungi={richiediPunto}
            onSposta={cambiaPunto}
          />
          <label>
            Note
            <textarea
              rows={2}
              placeholder="es. peggio la mattina appena sveglio"
              value={dati.note_giorno ?? ''}
              onChange={(e) => onAggiorna({ note_giorno: e.target.value || null })}
            />
          </label>
        </div>

        <div className="riquadro-grafico">
          <div className="testata-grafico">
            <span className="sotto-titolo">Dall&apos;esordio</span>
            <button title="Togli tutti i punti" onClick={() => svuota('esordio')}>
              <RotateCcw size={16} /> Svuota
            </button>
          </div>
          <GraficoAndamento
            tipo="esordio"
            sintomi={dati.sintomi}
            sintomoAttivo={sintomoAttivo}
            selezione={selezione}
            onSeleziona={setSelezione}
            onAggiungi={richiediPunto}
            onSposta={cambiaPunto}
          />
          <label>
            Note
            <textarea
              rows={2}
              placeholder="es. migliora lentamente da tre settimane"
              value={dati.note_esordio ?? ''}
              onChange={(e) => onAggiorna({ note_esordio: e.target.value || null })}
            />
          </label>
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

// Data digitata, non scelta dal calendario. Si tiene quel che l'utente sta
// scrivendo finche' non forma una data valida, altrimenti il campo si
// riscriverebbe sotto le dita a meta' digitazione.
function CampoData({
  etichetta,
  valore,
  autoFocus,
  onCambia
}: {
  etichetta: string
  valore: string | null
  autoFocus?: boolean
  onCambia: (iso: string | null) => void
}): React.JSX.Element {
  const [testo, setTesto] = useState<string | null>(null)
  const mostrato = testo ?? isoInItaliano(valore)
  const valida = testo == null || italianoInIso(testo) != null

  return (
    <label className="compila-data">
      {etichetta}
      <input
        className={['campo-data', valida ? '' : 'campo-errato'].filter(Boolean).join(' ')}
        autoFocus={autoFocus}
        placeholder="gg/mm/aaaa"
        value={mostrato}
        onChange={(e) => {
          setTesto(e.target.value)
          const iso = italianoInIso(e.target.value)
          if (iso) onCambia(iso)
        }}
        onBlur={() => setTesto(null)}
      />
    </label>
  )
}
