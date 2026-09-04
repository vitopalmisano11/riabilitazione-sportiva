import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  HelpCircle,
  Plus,
  Save,
  Trash2
} from 'lucide-react'
import type {
  MisuraTest,
  PazienteDettaglio,
  ProtocolloScreening,
  ScreeningCompleto,
  ScreeningRiepilogo,
  ValoreScreening,
  VoceEseguita
} from '../../../shared/types'
import { toast, toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import CompilaQuestionario from '../components/CompilaQuestionario'
import { errMsg, formatData, oggiIso } from '../lib'

// Esecuzione di uno screening: si sceglie il paziente e uno dei protocolli
// programmati in Configurazione, e si scrivono i numeri misurati.
//
// I test si compilano; i protocolli si costruiscono altrove. Qui non si può
// aggiungere o togliere un test: quello che compare è esattamente il protocollo
// com'era il giorno in cui hai aperto lo screening.

// Chiave di un valore nella mappa di lavoro: misura, lato, prova.
const chiave = (misuraId: number, lato: string | null, prova: number | null): string =>
  `${misuraId}|${lato ?? ''}|${prova ?? ''}`

export default function ScreeningRtpPage({
  tornaAllElenco
}: {
  tornaAllElenco: number
}): React.JSX.Element {
  const [elenco, setElenco] = useState<ScreeningRiepilogo[]>([])
  // Due passi prima di arrivare ai numeri: l'elenco dei pazienti, poi i suoi
  // screening, poi quello aperto. Con dieci pazienti e cinque screening a testa
  // una lista sola diventerebbe illeggibile.
  const [pazienteId, setPazienteId] = useState<number | null>(null)
  const [apertoId, setApertoId] = useState<number | null>(null)
  const [nuovo, setNuovo] = useState(false)

  const carica = useCallback(async (): Promise<void> => {
    try {
      setElenco(await window.api.screeningSvolti.list(null))
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [])

  useEffect(() => {
    void carica()
  }, [carica])

  useEffect(() => {
    if (tornaAllElenco === 0) return
    setApertoId(null)
    setPazienteId(null)
  }, [tornaAllElenco])

  if (apertoId != null) {
    return (
      <Esecuzione
        key={apertoId}
        id={apertoId}
        onIndietro={() => setApertoId(null)}
        onSalvato={carica}
      />
    )
  }

  if (pazienteId != null) {
    return (
      <ScreeningDelPaziente
        screening={elenco.filter((s) => s.paziente_id === pazienteId)}
        onIndietro={() => setPazienteId(null)}
        onApri={setApertoId}
        onCambiato={carica}
      />
    )
  }

  // Un paziente per riga, con quanti screening ha e quando è l'ultimo.
  const pazienti = elenco
    .map((s) => s.paziente_id)
    .filter((id, i, a) => a.indexOf(id) === i)
    .map((id) => {
      const suoi = elenco.filter((s) => s.paziente_id === id)
      return { id, primo: suoi[0], quanti: suoi.length, ultimo: suoi[0].data }
    })

  return (
    <div className="page">
      <header className="page-header">
        <h2>Screening e RTP</h2>
        <p>
          Esegui su un paziente uno dei protocolli che hai programmato in Configurazione, e
          registra i valori misurati.
        </p>
      </header>

      <div className="scheda">
        <section className="card">
          <div className="card-header-row">
            <h3>Pazienti con screening</h3>
            <span className="row-actions">
              <button className="primary" title="Nuovo screening" onClick={() => setNuovo(true)}>
                <Plus size={18} />
              </button>
            </span>
          </div>
          {pazienti.length === 0 ? (
            <p className="hint">
              Nessuno screening ancora. Premi il + qui sopra per cominciarne uno.
            </p>
          ) : (
            <ul className="sedute-list">
              {pazienti.map((p) => (
                <li key={p.id} className="riga-screening">
                  <button
                    className="nome-cliccabile"
                    title="Vedi i suoi screening"
                    onClick={() => setPazienteId(p.id)}
                  >
                    {p.primo.paziente_cognome} {p.primo.paziente_nome}
                  </button>
                  <span className="colonna-protocollo">
                    {p.quanti === 1 ? '1 screening' : `${p.quanti} screening`}
                  </span>
                  <span className="colonna-sport">{p.primo.sport}</span>
                  <span className="colonna-data">ultimo {formatData(p.ultimo)}</span>
                  <span />
                  <span className="row-actions">
                    <button title="Vedi i suoi screening" onClick={() => setPazienteId(p.id)}>
                      <ChevronRight size={18} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {nuovo && (
          <NuovoScreening
            onAnnulla={() => setNuovo(false)}
            onCreato={async (id) => {
              setNuovo(false)
              await carica()
              setApertoId(id)
            }}
          />
        )}
      </div>
    </div>
  )
}

// Gli screening di un solo paziente, e da qui il report che li mette a
// confronto.
function ScreeningDelPaziente({
  screening,
  onIndietro,
  onApri,
  onCambiato
}: {
  screening: ScreeningRiepilogo[]
  onIndietro: () => void
  onApri: (id: number) => void
  onCambiato: () => Promise<void>
}): React.JSX.Element {
  const [scelta, setScelta] = useState(false)
  const p = screening[0]

  const elimina = async (s: ScreeningRiepilogo): Promise<void> => {
    if (
      !(await chiedi(
        `Eliminare lo screening del ${formatData(s.data)}?\nI valori misurati andranno persi.`
      ))
    ) {
      return
    }
    try {
      await window.api.screeningSvolti.remove(s.id)
      await onCambiato()
      if (screening.length === 1) onIndietro()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  if (!p) {
    onIndietro()
    return <p className="hint">Caricamento…</p>
  }

  return (
    <div className="page">
      <header className="page-header builder-header">
        <h2>
          {p.paziente_cognome} {p.paziente_nome}
          <span className="titolo-sport"> · screening</span>
        </h2>
        <span className="row-actions">
          <button onClick={onIndietro}>
            <ChevronLeft size={18} /> Tutti i pazienti
          </button>
        </span>
      </header>

      <div className="scheda">
        <section className="card">
          <div className="card-header-row">
            <h3>Screening svolti</h3>
            <span className="row-actions">
              <button
                title="Report che confronta due screening"
                disabled={screening.length === 0}
                onClick={() => setScelta(true)}
              >
                <FileText size={18} /> Report
              </button>
            </span>
          </div>
          <ul className="sedute-list">
            {screening.map((s) => (
              <li key={s.id} className="riga-screening">
                <button
                  className="nome-cliccabile"
                  title="Apri lo screening"
                  onClick={() => onApri(s.id)}
                >
                  {formatData(s.data)}
                </button>
                <span className="colonna-protocollo">{s.protocollo_nome}</span>
                <span className="colonna-sport">{s.sport}</span>
                <span className="colonna-data" />
                {s.num_valori === 0 ? <span className="badge">da compilare</span> : <span />}
                <span className="row-actions">
                  <button className="danger" title="Elimina" onClick={() => void elimina(s)}>
                    <Trash2 size={18} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {scelta && (
        <SceltaConfronto screening={screening} onChiudi={() => setScelta(false)} />
      )}
    </div>
  )
}

// Quali screening mettere nel report. Due sono la scelta giusta quasi sempre —
// il prima e il dopo — ma se ne possono spuntare di più: ogni screening in più
// e' un punto in più sulle linee dell'andamento.
function SceltaConfronto({
  screening,
  onChiudi
}: {
  screening: ScreeningRiepilogo[]
  onChiudi: () => void
}): React.JSX.Element {
  // L'elenco arriva dal più recente: i due in cima sono il confronto naturale.
  const [scelti, setScelti] = useState<number[]>(screening.slice(0, 2).map((s) => s.id))

  const cambia = (id: number, dentro: boolean): void =>
    setScelti((prec) =>
      dentro ? [...prec, id] : prec.filter((x) => x !== id)
    )

  const apri = async (): Promise<void> => {
    // dal più vecchio al più recente: l'ultimo è quello che si legge nelle
    // tabelle del report
    const ordinati = screening
      .filter((s) => scelti.includes(s.id))
      .slice()
      .reverse()
      .map((s) => s.id)
    try {
      await window.api.screeningSvolti.anteprimaReport(ordinati)
      onChiudi()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={onChiudi}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Quali screening mettere a confronto?</h3>
        <p className="modal-testo">
          Il più recente fra quelli spuntati è quello che si legge nelle tabelle; gli altri
          diventano i punti dei grafici dell&apos;andamento.
        </p>
        <div className="checkbox-list">
          {screening.map((s) => (
            <label key={s.id} className="checkbox-inline">
              <input
                type="checkbox"
                checked={scelti.includes(s.id)}
                onChange={(e) => cambia(s.id, e.target.checked)}
              />
              {formatData(s.data)} · {s.protocollo_nome}
              {s.num_valori === 0 && ' · vuoto'}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          {scelti.length > 2 && (
            <span className="hint">
              Con più di due i grafici si affollano: due si leggono meglio.
            </span>
          )}
          <span className="spacer" />
          <button onClick={onChiudi}>Annulla</button>
          <button className="primary" disabled={scelti.length === 0} onClick={() => void apri()}>
            <FileText size={16} /> Apri il report
          </button>
        </div>
      </div>
    </div>
  )
}

function NuovoScreening({
  onAnnulla,
  onCreato
}: {
  onAnnulla: () => void
  onCreato: (id: number) => Promise<void>
}): React.JSX.Element {
  const [pazienti, setPazienti] = useState<PazienteDettaglio[]>([])
  const [protocolli, setProtocolli] = useState<ProtocolloScreening[]>([])
  const [pazienteId, setPazienteId] = useState<number | ''>('')
  const [protocolloId, setProtocolloId] = useState<number | ''>('')
  const [data, setData] = useState(oggiIso())

  useEffect(() => {
    void window.api.pazienti.list().then(setPazienti)
    void window.api.screening.list(null).then(setProtocolli)
  }, [])

  const crea = async (): Promise<void> => {
    if (pazienteId === '' || protocolloId === '') return
    try {
      await onCreato(
        await window.api.screeningSvolti.create(Number(pazienteId), Number(protocolloId), data)
      )
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <h3>Nuovo screening</h3>
      {protocolli.length === 0 && (
        <p className="hint">
          Non hai ancora protocolli: creane uno in Configurazione, scheda &ldquo;Screening&rdquo;.
        </p>
      )}
      <div className="riga-nuovo-screening">
        <label>
          Paziente
          <select
            value={pazienteId}
            onChange={(e) => setPazienteId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">— scegli —</option>
            {pazienti.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cognome} {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Protocollo
          <select
            value={protocolloId}
            onChange={(e) => setProtocolloId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">— scegli —</option>
            {protocolli.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sport} · {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
      </div>
      <div className="modal-actions">
        <button onClick={onAnnulla}>Annulla</button>
        <button
          className="primary"
          disabled={pazienteId === '' || protocolloId === ''}
          onClick={() => void crea()}
        >
          Comincia
        </button>
      </div>
    </section>
  )
}

function Esecuzione({
  id,
  onIndietro,
  onSalvato
}: {
  id: number
  onIndietro: () => void
  onSalvato: () => Promise<void>
}): React.JSX.Element {
  const [dati, setDati] = useState<ScreeningCompleto | null>(null)
  // I valori si tengono come testo mentre si scrivono: "1," a metà digitazione
  // non è ancora un numero, e convertirlo subito cancellerebbe la virgola.
  const [valori, setValori] = useState<Record<string, string>>({})
  const [data, setData] = useState('')
  const [note, setNote] = useState('')
  const [modificato, setModificato] = useState(false)
  // Questionario da compilare adesso, se ce n'e' uno aperto.
  const [compila, setCompila] = useState<number | null>(null)

  useEffect(() => {
    window.api.screeningSvolti
      .get(id)
      .then((d) => {
        setDati(d)
        setData(d.sessione.data)
        setNote(d.sessione.note ?? '')
        setValori(
          Object.fromEntries(
            d.valori.map((v) => [chiave(v.misura_id, v.lato, v.prova), String(v.valore)])
          )
        )
      })
      .catch((e) => toastErrore(errMsg(e)))
  }, [id])

  const salva = async (): Promise<void> => {
    const daSalvare: ValoreScreening[] = []
    for (const [k, testo] of Object.entries(valori)) {
      const numero = Number(testo.replace(',', '.'))
      if (testo.trim() === '' || !Number.isFinite(numero)) continue
      const [misura, lato, prova] = k.split('|')
      daSalvare.push({
        misura_id: Number(misura),
        lato: lato === '' ? null : (lato as 'dx' | 'sx'),
        prova: prova === '' ? null : Number(prova),
        valore: numero
      })
    }
    try {
      await window.api.screeningSvolti.salva(id, data, note.trim() || null, daSalvare)
      setModificato(false)
      await onSalvato()
      toast('Screening salvato.')
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const indietro = async (): Promise<void> => {
    if (modificato && !(await chiedi('Ci sono valori non salvati. Uscire lo stesso?'))) return
    onIndietro()
  }

  // Il report legge dall'archivio, non dalle caselle: senza salvare mostrerebbe
  // i valori di prima.
  const apriReport = async (): Promise<void> => {
    if (modificato) {
      if (!(await chiedi('Ci sono valori non salvati: il report non li conterrebbe.\n\nSalvo prima?'))) {
        return
      }
      await salva()
    }
    try {
      await window.api.screeningSvolti.anteprimaReport([id])
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const scrivi = (k: string, testo: string): void => {
    setValori((prec) => ({ ...prec, [k]: testo }))
    setModificato(true)
  }

  if (!dati) return <p className="hint">Caricamento…</p>

  return (
    <div className="page">
      <header className="page-header builder-header">
        <h2>
          {dati.sessione.paziente_cognome} {dati.sessione.paziente_nome}
          <span className="titolo-sport">
            {' · '}
            {dati.sessione.protocollo_nome}
          </span>
        </h2>
        <span className="row-actions">
          <button onClick={() => void indietro()}>
            <ChevronLeft size={18} /> Tutti gli screening
          </button>
          <button
            title="Guarda il report, poi lo scarichi da lì"
            onClick={() => void apriReport()}
          >
            <FileText size={16} /> Report
          </button>
          <button className="primary" disabled={!modificato} onClick={() => void salva()}>
            <Save size={16} /> Salva
          </button>
        </span>
      </header>

      {/* Una striscia sola sotto al titolo: a sinistra di che screening si
          tratta, a destra il giorno in cui e' stato fatto. Le note stanno in
          fondo, dopo i test: si scrivono quando si e' finito di misurare. */}
      <div className="testata-screening">
        <span className="dettaglio-screening">
          {dati.sessione.protocollo_nome} · {dati.sessione.sport}
        </span>
        <label className="compila-data">
          Data
          <input
            type="date"
            value={data}
            onChange={(e) => {
              setData(e.target.value)
              setModificato(true)
            }}
          />
        </label>
      </div>

      {dati.sezioni.length === 0 && (
        <p className="hint">
          Il protocollo di questo screening è stato eliminato: restano i valori già salvati.
        </p>
      )}

      <div className="colonne-sezioni">
        {dati.sezioni.map((sez, i) => (
          <section key={i} className="card sezione-screening">
            <h3>{sez.nome}</h3>
            {sez.voci.length === 0 && <p className="hint">Nessun test in questa sezione.</p>}
            {sez.voci.map((v, j) => (
              <Voce
                key={j}
                voce={v}
                valori={valori}
                onScrivi={scrivi}
                onCompila={(questionarioId) => setCompila(questionarioId)}
                artoOperato={dati.sessione.arto_operato}
              />
            ))}
          </section>
        ))}
      </div>

      <section className="card note-screening">
        <label>
          Note (facoltative)
          <textarea
            rows={3}
            placeholder="es. terreno bagnato, atleta reduce da influenza, test interrotto per dolore"
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setModificato(true)
            }}
          />
        </label>
      </section>

      {/* Il questionario si compila da qui e si salva nella scheda del paziente
          come tutti gli altri, con la sua data: allo screening resta collegato,
          ma non e' una copia a parte. */}
      {compila != null && (
        <CompilaQuestionario
          pazienteId={dati.sessione.paziente_id}
          questionarioId={compila}
          compilazione={null}
          soloLettura={false}
          onChiudi={(compilazioneId) => {
            const q = compila
            setCompila(null)
            if (compilazioneId == null || q == null) return
            void window.api.screeningSvolti
              .collegaQuestionario(id, q, compilazioneId)
              .then(() => window.api.screeningSvolti.get(id))
              .then(setDati)
              .catch((e) => toastErrore(errMsg(e)))
          }}
        />
      )}
    </div>
  )
}

function Voce({
  voce,
  valori,
  onScrivi,
  onCompila,
  artoOperato
}: {
  voce: VoceEseguita
  valori: Record<string, string>
  onScrivi: (k: string, testo: string) => void
  onCompila: (questionarioId: number) => void
  artoOperato: 'dx' | 'sx' | null
}): React.JSX.Element {
  const [mostraComeSiFa, setMostraComeSiFa] = useState(false)

  if (voce.tipo === 'questionario') {
    return (
      <div className="voce-test">
        <div className="voce-testata">
          <span className="voce-nome">{voce.nome}</span>
          <span className="badge">questionario</span>
        </div>
        {voce.compilazione_id != null ? (
          <p className="hint">
            <ClipboardList size={14} /> Compilato il {formatData(voce.compilazione_data ?? '')}
            {voce.fascia && ` · ${voce.fascia}`}
          </p>
        ) : (
          <button onClick={() => onCompila(voce.questionario_id)}>
            <ClipboardList size={16} /> Compila
          </button>
        )}
      </div>
    )
  }

  const lati: ('dx' | 'sx' | null)[] = voce.per_lato ? ['dx', 'sx'] : [null]

  return (
    <div className="voce-test">
      <div className="voce-testata">
        <span className="voce-nome">{voce.nome}</span>
        {voce.per_lato === 1 && <span className="badge">per lato</span>}
        {/* Come si esegue il test si legge solo se serve: qui davanti servono le
            caselle, non il ripasso del protocollo. */}
        {voce.protocollo && (
          <button
            className="btn-icona-tonda"
            title={mostraComeSiFa ? 'Nascondi come si esegue' : 'Come si esegue'}
            onClick={() => setMostraComeSiFa(!mostraComeSiFa)}
          >
            <HelpCircle size={16} />
          </button>
        )}
      </div>
      {voce.protocollo && mostraComeSiFa && <p className="hint">{voce.protocollo}</p>}
      {voce.misure.length === 0 ? (
        <p className="hint">
          Questo test non ha misure: definiscile in Configurazione, &ldquo;Test di
          valutazione&rdquo;.
        </p>
      ) : (
        voce.misure.map((m) => (
          <Misura
            key={m.id ?? m.nome}
            misura={m}
            misure={voce.misure}
            prove={voce.prove}
            lati={lati}
            lsiCutoff={voce.lsi_cutoff}
            artoOperato={artoOperato}
            valori={valori}
            onScrivi={onScrivi}
          />
        ))
      )}
    </div>
  )
}

function Misura({
  misura,
  misure,
  prove,
  lati,
  lsiCutoff,
  artoOperato,
  valori,
  onScrivi
}: {
  misura: MisuraTest
  // Tutte le misure del test: servono a chi si calcola dalle altre.
  misure: MisuraTest[]
  prove: number
  lati: ('dx' | 'sx' | null)[]
  lsiCutoff: number | null
  artoOperato: 'dx' | 'sx' | null
  valori: Record<string, string>
  onScrivi: (k: string, testo: string) => void
}): React.JSX.Element {
  const misuraId = misura.id ?? 0
  const calcolata = misura.calcolo != null && misura.calcolo_a != null && misura.calcolo_b != null
  // Le misure "a ogni prova" hanno una casella per prova; le altre una sola.
  const colonne = misura.per_prova === 1 ? Array.from({ length: prove }, (_, i) => i + 1) : [null]

  const numero = (id: number, lato: 'dx' | 'sx' | null, prova: number | null): number | null => {
    const t = valori[chiave(id, lato, prova)]
    if (t == null || t.trim() === '') return null
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  // Il valore che conta: la prova migliore, la media o la peggiore, come deciso
  // sulla misura in libreria.
  const riassumi = (id: number, come: string, lato: 'dx' | 'sx' | null): number | null => {
    const presi = colonne.map((c) => numero(id, lato, c)).filter((x): x is number => x != null)
    if (presi.length === 0) return null
    if (come === 'media') return presi.reduce((a, b) => a + b, 0) / presi.length
    if (come === 'peggiore') return Math.min(...presi)
    return Math.max(...presi)
  }

  const fonte = (id: number | null, lato: 'dx' | 'sx' | null): number | null => {
    const m = misure.find((x) => x.id === id)
    return m?.id == null ? null : riassumi(m.id, m.riassunto, lato)
  }

  const sintesi = useMemo(() => {
    const perLato = new Map<string, number | null>()
    for (const lato of lati) {
      if (calcolata) {
        const a = fonte(misura.calcolo_a, lato)
        const b = fonte(misura.calcolo_b, lato)
        const v =
          a == null || b == null
            ? null
            : misura.calcolo === 'rapporto'
              ? b === 0
                ? null
                : a / b
              : a - b
        perLato.set(lato ?? '', v)
        continue
      }
      perLato.set(lato ?? '', riassumi(misuraId, misura.riassunto, lato))
    }
    return perLato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valori, misura.riassunto, misura.calcolo, prove])

  const dx = sintesi.get('dx')
  const sx = sintesi.get('sx')
  // L'LSI vero e' arto operato diviso arto sano. Senza sapere quale sia
  // l'operato resta il confronto fra i due lati, che dice quanto sono diversi
  // ma non in che verso.
  const operato = artoOperato === 'dx' ? dx : artoOperato === 'sx' ? sx : null
  const sano = artoOperato === 'dx' ? sx : artoOperato === 'sx' ? dx : null
  const lsi =
    operato != null && sano != null && sano > 0
      ? (operato / sano) * 100
      : dx != null && sx != null && Math.max(dx, sx) > 0
        ? (Math.min(dx, sx) / Math.max(dx, sx)) * 100
        : null
  const superato = lsi != null && lsiCutoff != null ? lsi >= lsiCutoff : null

  return (
    <div className="misura-riga">
      <div className="misura-nome">
        {misura.nome}
        {misura.unita && <span className="unita"> ({misura.unita})</span>}
        {calcolata && <span className="unita"> — calcolata</span>}
      </div>
      <table className="tabella-misura">
        <thead>
          <tr>
            <th />
            {!calcolata &&
              colonne.map((c) => (
                <th key={c ?? 'unica'}>{c == null ? 'Valore' : `Prova ${c}`}</th>
              ))}
            <th>
              {calcolata
                ? 'Risultato'
                : misura.riassunto === 'media'
                  ? 'Media'
                  : misura.riassunto === 'peggiore'
                    ? 'Peggiore'
                    : 'Migliore'}
            </th>
          </tr>
        </thead>
        <tbody>
          {lati.map((lato) => (
            <tr key={lato ?? 'unico'}>
              <th>
                {lato == null ? '' : lato === 'dx' ? 'Destra' : 'Sinistra'}
                {lato != null && artoOperato === lato && (
                  <span className="unita"> (interessato)</span>
                )}
              </th>
              {!calcolata &&
                colonne.map((c) => (
                  <td key={c ?? 'unica'}>
                    <input
                      inputMode="decimal"
                      value={valori[chiave(misuraId, lato, c)] ?? ''}
                      onChange={(e) => onScrivi(chiave(misuraId, lato, c), e.target.value)}
                    />
                  </td>
                ))}
              <td className="valore-sintesi">
                {sintesi.get(lato ?? '') != null
                  ? Number(sintesi.get(lato ?? '')).toFixed(2)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {lsi != null && (
        <p className={`asimmetria${superato === false ? ' alta' : ''}`}>
          {artoOperato != null ? 'LSI' : 'Simmetria'} {lsi.toFixed(1)}%
          {lsiCutoff != null &&
            (superato ? ` — superato (soglia ${lsiCutoff}%)` : ` — sotto la soglia di ${lsiCutoff}%`)}
        </p>
      )}
    </div>
  )
}
