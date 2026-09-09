import { useEffect, useMemo, useState } from 'react'
import type {
  Fase,
  Categoria,
  EsercizioConCategoria,
  Obiettivo,
  PazienteDettaglio,
  SedutaEsercizioDettaglio,
  Segno,
  SedutaInput,
  UltimaVolta
} from '../../../shared/types'
import {
  AlertTriangle,
  CornerDownLeft,
  ImageIcon,
  Pencil,
  Plus,
  Video,
  X
} from 'lucide-react'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import ImmagineEsercizio from './ImmagineEsercizio'
import Aiuto from './Aiuto'
import { errMsg, formatData, oggiIso } from '../lib'
import { useScorciatoie } from '../scorciatoie'
import { sposta, useRiordino } from '../riordino'
import { caricoTesto, recuperoTesto, rirTesto, volumeTesto } from '../../../shared/dosaggio'

// Da 0 a 10: la scala che si usa a voce con il paziente.
const VOTI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface Props {
  paziente: PazienteDettaglio
  sedutaId: number | null // valorizzato = modifica di una seduta esistente
  duplicaDa?: number // valorizzato (con sedutaId null) = nuova seduta prefillata
  onClose: (salvata: boolean) => void
}

interface SezioneBuilder {
  sezione_id: number | null
  nome: string
  righe: SedutaEsercizioDettaglio[]
}

// Quello che si sta componendo, messo da parte cosi' com'e'.
interface BozzaSeduta {
  data: string
  faseId: number | null
  focus?: string
  note: string
  sezioni: SezioneBuilder[]
}

export default function SedutaBuilder({
  paziente,
  sedutaId,
  duplicaDa,
  onClose
}: Props): React.JSX.Element {
  const [pronto, setPronto] = useState(false)
  const [data, setData] = useState(oggiIso())
  const [faseId, setFaseId] = useState<number | null>(paziente.fase_corrente_id)
  const [faseNome, setFaseNome] = useState<string | null>(paziente.fase_nome)
  // Di cosa e' fatta la giornata. Testo libero, con i suggerimenti di quelli
  // gia' usati.
  const [focus, setFocus] = useState('')
  const [focusUsati, setFocusUsati] = useState<string[]>([])
  // Come e' andata: due numeri da 0 a 10, vuoti se non li si chiede.
  const [dolore, setDolore] = useState('')
  const [sforzo, setSforzo] = useState('')
  // Cosa aveva fatto l'ultima volta, esercizio per esercizio.
  const [ultime, setUltime] = useState<Record<number, UltimaVolta>>({})
  // Le righe in cui i numeri dell'ultima volta sono gia' stati ricopiati: la
  // scritta sparisce, quei numeri stanno gia' nelle caselle sopra.
  const [ricopiate, setRicopiate] = useState<string[]>([])
  // I segni di riferimento di questo paziente e la misura di oggi.
  const [segni, setSegni] = useState<Segno[]>([])
  const [misure, setMisure] = useState<Record<number, string>>({})
  const [note, setNote] = useState('')
  const [sezioni, setSezioni] = useState<SezioneBuilder[]>([])
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([])
  const [raggiunti, setRaggiunti] = useState<number[]>([])
  const [templateCats, setTemplateCats] = useState<Record<number, number[]>>({})
  const [libreria, setLibreria] = useState<EsercizioConCategoria[]>([])
  // Le fasi della patologia del paziente: servono a sapere se c'e' un percorso
  // al campo e quali sono le sue fasi.
  const [fasi, setFasi] = useState<Fase[]>([])
  const [categorie, setCategorie] = useState<Categoria[]>([])
  const [ricerche, setRicerche] = useState<Record<number, string>>({})
  const [nuovaSezione, setNuovaSezione] = useState('')
  // Quale sezione ha la ricerca aperta. Una per volta: prima ogni sezione
  // teneva sempre in vista la sua casella di ricerca e fino a otto esercizi
  // proposti, e con tre o quattro sezioni lo schermo era pieno di strumenti
  // invece che della seduta.
  const [sezioneApertaPerAggiungere, setApriAggiungi] = useState<number | null>(null)
  const [immagineAperta, setImmagineAperta] = useState<{ id: number; nome: string } | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [lib, cats, ragg, elencoFasi, usati, precedenti, elencoSegni] = await Promise.all([
          window.api.esercizi.list(false),
          window.api.categorie.list(),
          window.api.pazienti.obiettiviRaggiunti(paziente.id),
          paziente.patologia_id == null
            ? Promise.resolve([] as Fase[])
            : window.api.fasi.list(paziente.patologia_id),
          window.api.sedute.focusUsati(),
          window.api.sedute.ultimaVolta(paziente.id, sedutaId),
          window.api.segni.list(paziente.id)
        ])
        setLibreria(lib)
        setCategorie(cats)
        setRaggiunti(ragg)
        setFasi(elencoFasi)
        setFocusUsati(usati)
        setUltime(Object.fromEntries(precedenti.map((u) => [u.esercizio_id, u])))
        setSegni(elencoSegni)

        let fase = paziente.fase_corrente_id
        let faseN: string | null = paziente.fase_nome
        if (sedutaId != null) {
          const s = await window.api.sedute.get(sedutaId)
          setData(s.data)
          setFocus(s.focus ?? '')
          setDolore(s.dolore == null ? '' : String(s.dolore))
          setSforzo(s.sforzo == null ? '' : String(s.sforzo))
          const gia = await window.api.segni.dellaSeduta(sedutaId)
          setMisure(Object.fromEntries(gia.map((v) => [v.segno_id, String(v.valore)])))
          setNote(s.note ?? '')
          setSezioni(s.sezioni.map((sz) => ({ ...sz, righe: sz.esercizi })))
          fase = s.fase_id
          faseN = s.fase_nome
        } else if (duplicaDa != null) {
          const s = await window.api.sedute.get(duplicaDa)
          setSezioni(s.sezioni.map((sz) => ({ ...sz, righe: sz.esercizi })))
          setFocus(s.focus ?? '')
        }
        setFaseId(fase)
        setFaseNome(faseN)

        if (fase != null) {
          const [obs, template] = await Promise.all([
            window.api.obiettivi.list(fase),
            window.api.sezioni.list(fase)
          ])
          setObiettivi(obs)
          setTemplateCats(Object.fromEntries(template.map((t) => [t.id, t.categoria_ids])))
          if (sedutaId == null && duplicaDa == null) {
            // nuova seduta: struttura di default dal template della fase
            setSezioni(template.map((t) => ({ sezione_id: t.id, nome: t.nome, righe: [] })))
          }
        }

        // Bozza rimasta da una volta in cui l'app si e' chiusa a meta': si
        // chiede prima di rimetterla, perche' potrebbe essere di giorni fa.
        if (sedutaId == null) {
          const bozza = await window.api.bozze.leggi(paziente.id)
          if (bozza) {
            const quando = new Date(bozza.aggiornata_il)
            const etichetta = `${quando.toLocaleDateString('it-IT')} alle ${quando
              .toLocaleTimeString('it-IT')
              .slice(0, 5)}`
            if (await chiedi(`C'è una seduta lasciata a metà il ${etichetta}. Vuoi riprenderla?`)) {
              const salvata = JSON.parse(bozza.contenuto) as BozzaSeduta
              setData(salvata.data)
              setFocus(salvata.focus ?? '')
              setNote(salvata.note)
              setSezioni(salvata.sezioni)
              if (salvata.faseId != null) fase = salvata.faseId
            } else {
              await window.api.bozze.elimina(paziente.id)
            }
          }
        }
        setPronto(true)
      } catch (e) {
        toastErrore(errMsg(e))
        onClose(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fasiCampo = fasi.filter((f) => f.campo === 1)
  const alCampo = fasi.find((f) => f.id === faseId)?.campo === 1

  // Passare da palestra a campo (o cambiare fase del campo) vuol dire
  // ricominciare da un'altra struttura: si chiede prima, perche' quello che
  // c'e' dentro andrebbe perso.
  const cambiaFase = async (nuova: number | null): Promise<void> => {
    if (nuova === faseId) return
    const pieno = sezioni.some((s) => s.righe.length > 0)
    if (
      pieno &&
      !(await chiedi(
        'Cambiando programma le sezioni e gli esercizi di questa seduta vengono sostituiti con quelli della struttura scelta. Procedere?'
      ))
    ) {
      return
    }
    setFaseId(nuova)
    setFaseNome(nuova == null ? null : (fasi.find((f) => f.id === nuova)?.nome ?? null))
    if (nuova == null) {
      setSezioni([])
      setObiettivi([])
      setTemplateCats({})
      return
    }
    try {
      const [obs, template] = await Promise.all([
        window.api.obiettivi.list(nuova),
        window.api.sezioni.list(nuova)
      ])
      setObiettivi(obs)
      setTemplateCats(Object.fromEntries(template.map((t) => [t.id, t.categoria_ids])))
      setSezioni(template.map((t) => ({ sezione_id: t.id, nome: t.nome, righe: [] })))
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const totaleEsercizi = useMemo(
    () => sezioni.reduce((n, s) => n + s.righe.length, 0),
    [sezioni]
  )

  const nomeCategoria = (cid: number): string => categorie.find((c) => c.id === cid)?.nome ?? '?'

  // I campi del cluster si vedono solo dove servono: nelle categorie che lo
  // prevedono (la pliometria estensiva), oppure su una riga che un dosaggio a
  // cluster ce l'ha gia' — cosi' una seduta vecchia resta modificabile anche se
  // nel frattempo la categoria e' cambiata.
  const mostraCluster = (r: { categoria_nome: string; cluster: string | null }): boolean =>
    (r.cluster ?? '') !== '' ||
    categorie.some((c) => c.nome === r.categoria_nome && c.dosaggio_cluster === 1)

  // La casellina del RIR compare dove la categoria la prevede, e comunque dove
  // un numero c'e' gia': una seduta vecchia deve restare modificabile anche se
  // nel frattempo la spunta e' stata tolta.
  const mostraRir = (r: { categoria_nome: string; rir: string | null }): boolean =>
    (r.rir ?? '') !== '' ||
    categorie.some((c) => c.nome === r.categoria_nome && c.dosaggio_rir === 1)

  // Esercizi proposti per una sezione: quelli delle sue categorie, nell'ordine
  // configurato. Agganciare una categoria vuol dire prendere anche i distretti
  // che ci stanno dentro: la sezione "Rinforzo" propone quadricipite e spalla
  // senza che siano stati spuntati uno per uno.
  const proposte = (s: SezioneBuilder): EsercizioConCategoria[] => {
    if (s.sezione_id == null) return []
    const cats = templateCats[s.sezione_id] ?? []
    const conDentro: number[] = []
    for (const cid of cats) {
      if (!conDentro.includes(cid)) conDentro.push(cid)
      for (const c of categorie) {
        if (c.padre_id === cid && !conDentro.includes(c.id)) conDentro.push(c.id)
      }
    }
    return conDentro.flatMap((cid) => libreria.filter((e) => e.categoria_id === cid))
  }

  // L'esercizio nuovo si infila subito dopo l'ultimo della sua categoria, non in
  // fondo: cosi' l'elenco resta raggruppato da solo e ogni categoria ha una sola
  // intestazione, anche aggiungendo gli esercizi in ordine sparso.
  const aggiungi = (idx: number, e: EsercizioConCategoria): void => {
    setSezioni(
      sezioni.map((s, i) => {
        if (i !== idx || s.righe.some((r) => r.esercizio_id === e.id)) return s
        const riga = {
          esercizio_id: e.id,
          nome: e.nome,
          categoria_nome: e.categoria_nome,
          unita_carico: e.unita_carico,
          serie: e.serie_default,
          cluster: e.cluster_default,
          ripetizioni: e.ripetizioni_default,
          rir: e.rir_default,
          carico: e.carico_default,
          recupero_cluster: e.recupero_cluster_default,
          recupero: e.recupero_default,
          nota: null,
          link: e.link,
          ha_immagine: e.ha_immagine
        }
        let dopo = -1
        s.righe.forEach((r, k) => {
          if (r.categoria_nome === e.categoria_nome) dopo = k
        })
        const righe = [...s.righe]
        righe.splice(dopo + 1 === 0 ? righe.length : dopo + 1, 0, riga)
        return { ...s, righe }
      })
    )
  }

  const updateRiga = (
    idxSez: number,
    idxRiga: number,
    campo:
      | 'serie'
      | 'cluster'
      | 'ripetizioni'
      | 'rir'
      | 'carico'
      | 'recupero_cluster'
      | 'recupero'
      | 'nota',
    valore: string
  ): void => {
    setSezioni(
      sezioni.map((s, i) =>
        i === idxSez
          ? { ...s, righe: s.righe.map((r, j) => (j === idxRiga ? { ...r, [campo]: valore } : r)) }
          : s
      )
    )
  }

  // Rimette in riga i numeri dell'ultima volta, tutti insieme: da li' si
  // decide se aumentare o no, che e' il gesto vero della progressione.
  const ricopiaUltima = (idxSez: number, idxRiga: number, u: UltimaVolta): void => {
    setSezioni(
      sezioni.map((s, i) =>
        i === idxSez
          ? {
              ...s,
              righe: s.righe.map((r, j) =>
                j === idxRiga
                  ? {
                      ...r,
                      serie: u.serie,
                      cluster: u.cluster,
                      ripetizioni: u.ripetizioni,
                      rir: u.rir,
                      carico: u.carico,
                      recupero_cluster: u.recupero_cluster,
                      recupero: u.recupero
                    }
                  : r
              )
            }
          : s
      )
    )
  }

  // Cosa aveva fatto l'ultima volta, gia' scritto come si legge.
  const testoUltima = (r: SedutaEsercizioDettaglio, u: UltimaVolta): string =>
    [volumeTesto(u), rirTesto(u), caricoTesto(u.carico, r.unita_carico), recuperoTesto(u)]
      .filter(Boolean)
      .join(' · ')

  const rimuoviRiga = (idxSez: number, idxRiga: number): void => {
    setSezioni(
      sezioni.map((s, i) =>
        i === idxSez ? { ...s, righe: s.righe.filter((_, j) => j !== idxRiga) } : s
      )
    )
  }

  const { contenitore: contSez, presa: presaSez } = useRiordino<number>((da, a) =>
    setSezioni(sposta(sezioni, da, a))
  )

  // Le righe si riordinano solo dentro la propria sezione: la chiave e' "sezione:riga".
  const { contenitore: contRiga, presa: presaRiga } = useRiordino<string>((da, a) => {
    const [sezDa, rigaDa] = da.split(':').map(Number)
    const [sezA, rigaA] = a.split(':').map(Number)
    if (sezDa !== sezA) return
    setSezioni(
      sezioni.map((s, i) => (i === sezDa ? { ...s, righe: sposta(s.righe, rigaDa, rigaA) } : s))
    )
  })

  const rimuoviSezione = async (idx: number): Promise<void> => {
    const s = sezioni[idx]
    if (
      s.righe.length > 0 &&
      !(await chiedi(`Rimuovere la sezione "${s.nome}" e i suoi ${s.righe.length} esercizi da questa seduta?`))
    ) {
      return
    }
    setSezioni(sezioni.filter((_, i) => i !== idx))
  }

  // window.prompt non è supportato in Electron: rename inline della sezione
  const [editSez, setEditSez] = useState<{ idx: number; nome: string } | null>(null)

  const aggiungiSezione = (): void => {
    const nome = nuovaSezione.trim()
    if (!nome) return
    setSezioni([...sezioni, { sezione_id: null, nome, righe: [] }])
    setNuovaSezione('')
  }

  // La bozza si mette da parte da sola mentre componi, un secondo dopo l'ultima
  // modifica: se l'app si chiude, alla riapertura la ritrovi. Vale solo per le
  // sedute nuove — quelle gia' salvate sono gia' al sicuro nel loro posto.
  useEffect(() => {
    if (!pronto || sedutaId != null) return
    if (totaleEsercizi === 0 && note.trim() === '' && focus.trim() === '') return
    const bozza: BozzaSeduta = { data, faseId, focus, note, sezioni }
    const attesa = setTimeout(() => {
      void window.api.bozze.salva(paziente.id, JSON.stringify(bozza)).catch(() => undefined)
    }, 1000)
    return () => clearTimeout(attesa)
  }, [pronto, sedutaId, paziente.id, data, faseId, focus, note, sezioni, totaleEsercizi])

  // Esc annulla, Ctrl+S salva: la seduta si compila con la tastiera, senza
  // tornare col mouse in fondo alla finestra.
  // Annullando si decide cosa farne: buttarla via subito, o tenerla per
  // riprenderla. Chiedere qui e' meglio che ritrovarsela proposta domani senza
  // averlo voluto.
  const annulla = async (): Promise<void> => {
    if (sedutaId == null && (totaleEsercizi > 0 || note.trim() !== '')) {
      if (!(await chiedi('Tengo quello che hai messo, per riprenderlo dopo?'))) {
        await window.api.bozze.elimina(paziente.id).catch(() => undefined)
      }
    }
    onClose(false)
  }

  useScorciatoie([
    { tasto: 'Escape', azione: () => void annulla() },
    { tasto: 's', ctrl: true, azione: () => void salva() }
  ])

  const salva = async (): Promise<void> => {
    if (!data) {
      toastErrore('Imposta la data della seduta.')
      return
    }
    if (totaleEsercizi === 0) {
      toastErrore('Aggiungi almeno un esercizio alla seduta.')
      return
    }
    const input: SedutaInput = {
      paziente_id: paziente.id,
      data,
      fase_id: faseId,
      focus: focus.trim() || null,
      dolore: dolore === '' ? null : Number(dolore),
      sforzo: sforzo === '' ? null : Number(sforzo),
      // Solo i segni che hai misurato davvero: una casella lasciata vuota non
      // e' uno zero.
      segni: segni
        .map((g) => ({ segno_id: g.id, valore: Number((misure[g.id] ?? '').replace(',', '.')) }))
        .filter((v) => (misure[v.segno_id] ?? '').trim() !== '' && !Number.isNaN(v.valore)),
      note: note.trim() || null,
      sezioni: sezioni.map((s) => ({ sezione_id: s.sezione_id, nome: s.nome })),
      esercizi: sezioni.flatMap((s, i) =>
        s.righe.map((r) => ({
          esercizio_id: r.esercizio_id,
          serie: r.serie?.trim() || null,
          cluster: r.cluster?.trim() || null,
          ripetizioni: r.ripetizioni?.trim() || null,
          rir: r.rir?.trim() || null,
          carico: r.carico?.trim() || null,
          recupero_cluster: r.recupero_cluster?.trim() || null,
          recupero: r.recupero?.trim() || null,
          nota: r.nota?.trim() || null,
          sezioneIndex: i
        }))
      )
    }
    try {
      if (sedutaId == null) await window.api.sedute.create(input)
      else await window.api.sedute.update(sedutaId, input)
      // Salvata la seduta, la bozza non serve piu' e va tolta subito. Restando
      // li' veniva riproposta ("c'e' una seduta lasciata a meta'") alla seduta
      // nuova successiva dello stesso paziente, anche se non si era perso
      // niente: la seduta di prima era salvata benissimo.
      await window.api.bozze.elimina(paziente.id).catch(() => undefined)
      onClose(true)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  if (!pronto) {
    return (
      <div className="page">
        <p className="hint">Caricamento…</p>
      </div>
    )
  }

  return (
    <div className="page builder-col">
      <header className="page-header builder-header">
        <div>
          {/* Il nome del paziente riporta alla sua scheda: da qui ci si torna di
              continuo, e prima l'unica strada era "Annulla", che sembra buttare
              via il lavoro. Se c'e' qualcosa di non salvato chiede, come
              "Annulla". */}
          <h2>
            {sedutaId == null ? 'Nuova seduta' : 'Modifica seduta'} —{' '}
            <button
              className="briciola nome-nel-titolo"
              title="Torna alla scheda del paziente"
              onClick={() => void annulla()}
            >
              {paziente.nome} {paziente.cognome}
            </button>
          </h2>
          <p>
            {faseNome ? (
              <>
                Fase: <strong>{faseNome}</strong>
              </>
            ) : (
              'Nessuna fase impostata sul paziente'
            )}
            {duplicaDa != null && ' · contenuti copiati da una seduta precedente'}
          </p>
          {/* I due binari: in palestra si parte dalla fase corrente del
              paziente, al campo da una delle fasi del percorso parallelo. La
              fase corrente del paziente non si tocca mai. Compare solo per le
              patologie che il campo ce l'hanno. */}
          {fasiCampo.length > 0 && (
            <div className="scelta-binario">
              <button
                className={alCampo ? '' : 'scelta-attiva'}
                onClick={() => void cambiaFase(paziente.fase_corrente_id)}
              >
                In palestra
              </button>
              <button
                className={alCampo ? 'scelta-attiva' : ''}
                onClick={() => void cambiaFase(fasiCampo[0].id)}
              >
                Al campo
              </button>
              {alCampo && fasiCampo.length > 1 && (
                <select
                  value={faseId ?? 0}
                  title="Quale programma da campo"
                  onChange={(e) => void cambiaFase(Number(e.target.value))}
                >
                  {fasiCampo.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
        <div className="builder-header-actions">
          <label className="field data-field">
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          {/* Il focus della giornata: due sedute della stessa fase possono
              essere due cose diverse, e nell'elenco si distinguono da qui.
              Si scrive a mano, ma quelli gia' usati si ripropongono. */}
          <label className="field focus-field">
            Focus
            <input
              type="text"
              list="focus-usati"
              placeholder="es. preparazione corsa"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            />
            <datalist id="focus-usati">
              {focusUsati.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </label>
          <button onClick={() => void annulla()}>Annulla</button>
          <button className="primary" onClick={() => void salva()}>
            Salva seduta
          </button>
        </div>
      </header>

      {/* I limiti da non superare, sotto all'intestazione: si compone la seduta
          guardandoli, non ricordandoseli. */}
      {paziente.precauzioni && (
        <p className="fascia-precauzioni">
          <AlertTriangle size={16} />
          {paziente.precauzioni}
        </p>
      )}

      {faseId != null && obiettivi.length > 0 && (
        <section className="card obiettivi-info">
          <h3>Obiettivi da lavorare</h3>
          <div className="chips">
            {obiettivi.map((o) => (
              <span
                key={o.id}
                className={raggiunti.includes(o.id) ? 'chip raggiunto' : 'chip'}
                title={raggiunti.includes(o.id) ? 'Obiettivo raggiunto' : 'Da lavorare'}
              >
                {o.nome}
              </span>
            ))}
          </div>
        </section>
      )}

      {sezioni.length === 0 && (
        <section className="card">
          <p className="hint">
            {faseId == null
              ? 'Il paziente non ha una fase corrente: imposta la fase nella sua scheda, oppure aggiungi sezioni manualmente qui sotto.'
              : 'Questa fase non ha una struttura di seduta configurata: definiscila in "Patologie e fasi" oppure aggiungi le sezioni manualmente qui sotto.'}
          </p>
        </section>
      )}

      {sezioni.map((s, idxSez) => {
        const ricerca = (ricerche[idxSez] ?? '').trim().toLowerCase()
        const inSezione = new Set(s.righe.map((r) => r.esercizio_id))
        // Cercando si trova per nome, ma anche per categoria: spesso non si
        // ha in mente un esercizio precurso ("mi serve qualcosa di
        // propriocettiva"), si ha in mente il tipo di lavoro.
        const daProporre =
          ricerca.length >= 2
            ? libreria
                .filter(
                  (e) =>
                    !inSezione.has(e.id) &&
                    (e.nome.toLowerCase().includes(ricerca) ||
                      nomeCategoria(e.categoria_id).toLowerCase().includes(ricerca))
                )
                .slice(0, 12)
            : proposte(s).filter((e) => !inSezione.has(e.id))
        const dndSez = contSez(idxSez)
        return (
          <section
            key={idxSez}
            {...dndSez}
            {...presaSez(idxSez)}
            className={['card sezione-card', dndSez.className].filter(Boolean).join(' ')}
          >
            <div className="sezione-testata">
              {editSez?.idx === idxSez ? (
                <span className="edit-row">
                  <input
                    autoFocus
                    value={editSez.nome}
                    onChange={(e) => setEditSez({ idx: idxSez, nome: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editSez.nome.trim()) {
                        setSezioni(
                          sezioni.map((x, i) =>
                            i === idxSez ? { ...x, nome: editSez.nome.trim() } : x
                          )
                        )
                        setEditSez(null)
                      }
                      if (e.key === 'Escape') setEditSez(null)
                    }}
                  />
                  <button
                    onClick={() => {
                      if (editSez.nome.trim()) {
                        setSezioni(
                          sezioni.map((x, i) =>
                            i === idxSez ? { ...x, nome: editSez.nome.trim() } : x
                          )
                        )
                      }
                      setEditSez(null)
                    }}
                  >
                    OK
                  </button>
                </span>
              ) : (
                <h3>{s.nome}</h3>
              )}
              <span className="item-actions-static">
                <button
                  className="btn-aggiungi-sezione"
                  title="Aggiungi un esercizio a questa sezione"
                  onClick={() => setApriAggiungi(idxSez)}
                >
                  <Plus size={16} /> Esercizio
                </button>
                <button title="Rinomina" onClick={() => setEditSez({ idx: idxSez, nome: s.nome })}>
                  <Pencil size={16} />
                </button>
                <button title="Rimuovi sezione" className="danger" onClick={() => void rimuoviSezione(idxSez)}>
                  <X size={16} />
                </button>
              </span>
            </div>

            {s.righe.length > 0 && (
              <ul className="righe-seduta">
                {s.righe.map((r, idxRiga) => {
                  const dndRiga = contRiga(`${idxSez}:${idxRiga}`)
                  // Gli esercizi della stessa categoria restano vicini perche'
                  // e' li' che vengono inseriti, ma senza scriverne il nome: con
                  // categorie fini ("Rinforzo quadricipite", "Rinforzo
                  // hamstring") le intestazioni erano piu' delle righe.
                  return (
                  <li
                    key={r.esercizio_id}
                    {...dndRiga}
                    {...presaRiga(`${idxSez}:${idxRiga}`)}
                    className={dndRiga.className}
                  >
                    <div className="riga-testata">
                      <span className="item-nome">
                        {r.nome}
                        {r.link && (
                          <button
                            className="icona-esercizio"
                            title="Apri video"
                            onClick={() =>
                              window.api.apriLink(r.link!).catch((err) => toastErrore(errMsg(err)))
                            }
                          >
                            <Video size={16} />
                          </button>
                        )}
                        {r.ha_immagine === 1 && (
                          <button
                            className="icona-esercizio"
                            title="Vedi immagine"
                            onClick={() =>
                              setImmagineAperta({ id: r.esercizio_id, nome: r.nome })
                            }
                          >
                            <ImageIcon size={16} />
                          </button>
                        )}
                      </span>
                    </div>
                    {/* Parametri e nota sulla stessa riga del nome: le etichette
                        sono nei segnaposto, cosi' un esercizio occupa una riga
                        invece di tre. */}
                    <div className="riga-params">
                      <input
                        title="Serie"
                        placeholder="serie"
                        value={r.serie ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'serie', e.target.value)}
                      />
                      {mostraCluster(r) && (
                        <input
                          className="campo-cluster"
                          title="Cluster per serie"
                          placeholder="cluster"
                          value={r.cluster ?? ''}
                          onChange={(e) => updateRiga(idxSez, idxRiga, 'cluster', e.target.value)}
                        />
                      )}
                      <input
                        title={mostraCluster(r) ? 'Ripetizioni per cluster' : 'Ripetizioni'}
                        placeholder="rip."
                        value={r.ripetizioni ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'ripetizioni', e.target.value)}
                      />
                      {mostraRir(r) && (
                        <input
                          className="campo-cluster"
                          title="Ripetizioni di riserva"
                          placeholder="RIR"
                          value={r.rir ?? ''}
                          onChange={(e) => updateRiga(idxSez, idxRiga, 'rir', e.target.value)}
                        />
                      )}
                      <input
                        title="Carico"
                        placeholder="carico"
                        value={r.carico ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'carico', e.target.value)}
                      />
                      {mostraCluster(r) && (
                        <input
                          className="campo-cluster"
                          title="Recupero tra i cluster"
                          placeholder="rec. cl."
                          value={r.recupero_cluster ?? ''}
                          onChange={(e) =>
                            updateRiga(idxSez, idxRiga, 'recupero_cluster', e.target.value)
                          }
                        />
                      )}
                      <input
                        title={mostraCluster(r) ? 'Recupero tra le serie' : 'Recupero'}
                        placeholder="rec."
                        value={r.recupero ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'recupero', e.target.value)}
                      />
                      <input
                        className="riga-nota"
                        title="Nota"
                        placeholder="nota…"
                        value={r.nota ?? ''}
                        onChange={(e) => updateRiga(idxSez, idxRiga, 'nota', e.target.value)}
                      />
                    </div>
                    {/* Il pulsante che toglie la riga sta in fondo alla riga
                        del nome, sempre nello stesso posto: messo dopo la
                        riga dell'ultima volta finiva a capo, in basso a
                        sinistra. */}
                    <button
                      title="Rimuovi"
                      className="danger btn-togli"
                      onClick={() => rimuoviRiga(idxSez, idxRiga)}
                    >
                      <X size={16} />
                    </button>
                    {/* Cosa aveva fatto l'ultima volta con questo esercizio.
                        Sta sotto ai numeri di oggi, dove serve: la progressione
                        si decide guardando il dato, non a memoria. Il pulsante
                        li rimette in riga tutti insieme, poi si ritocca — e da
                        quel momento la riga sparisce, perche' quei numeri sono
                        gia' li' sopra. */}
                    {ultime[r.esercizio_id] &&
                      !ricopiate.includes(`${idxSez}:${r.esercizio_id}`) &&
                      testoUltima(r, ultime[r.esercizio_id]) !== '' && (
                        <div className="ultima-volta">
                          <span className="ultima-quando">
                            l&apos;ultima volta, {formatData(ultime[r.esercizio_id].data)}:
                          </span>
                          <span className="ultima-dose">
                            {testoUltima(r, ultime[r.esercizio_id])}
                          </span>
                          <button
                            className="btn-piccolo"
                            title="Rimetti questi numeri nella riga"
                            onClick={() => {
                              ricopiaUltima(idxSez, idxRiga, ultime[r.esercizio_id])
                              setRicopiate([...ricopiate, `${idxSez}:${r.esercizio_id}`])
                            }}
                          >
                            <CornerDownLeft size={14} /> Ricopia
                          </button>
                        </div>
                      )}
                  </li>
                  )
                })}
              </ul>
            )}

            {sezioneApertaPerAggiungere === idxSez && (
            <div className="aggiungi-area">
              <div className="testata-aggiungi">
                <span className="hint">Scegli un esercizio da aggiungere a “{s.nome}”</span>
                <button title="Chiudi" onClick={() => setApriAggiungi(null)}>
                  <X size={16} />
                </button>
              </div>
              <input
                autoFocus
                type="search"
                className="filtro-esercizi"
                placeholder={
                  s.sezione_id != null
                    ? 'Filtra i proposti o cerca in tutta la libreria…'
                    : 'Cerca un esercizio nella libreria (min 2 lettere)…'
                }
                value={ricerche[idxSez] ?? ''}
                onChange={(e) => setRicerche({ ...ricerche, [idxSez]: e.target.value })}
              />
              {daProporre.length > 0 ? (
                <ul className="esercizi-proposti">
                  {daProporre.map((e) => (
                    <li key={e.id}>
                      {/* Prima stava in fondo alla riga, e con i nomi lunghi
                          finiva lontanissimo da quello che si stava leggendo. */}
                      <button
                        className="btn-aggiungi-riga"
                        title={`Aggiungi ${e.nome}`}
                        onClick={() => aggiungi(idxSez, e)}
                      >
                        <Plus size={16} />
                      </button>
                      <span className="item-nome">
                        {e.nome}
                        {e.link && (
                          <button
                            className="icona-esercizio"
                            title="Apri video"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              window.api.apriLink(e.link!).catch((err) => toastErrore(errMsg(err)))
                            }}
                          >
                            <Video size={16} />
                          </button>
                        )}
                        {e.ha_immagine === 1 && (
                          <button
                            className="icona-esercizio"
                            title="Vedi immagine"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setImmagineAperta({ id: e.id, nome: e.nome })
                            }}
                          >
                            <ImageIcon size={16} />
                          </button>
                        )}
                      </span>
                      <span className="default-hint">
                        {[nomeCategoria(e.categoria_id), volumeTesto({ serie: e.serie_default, cluster: e.cluster_default, ripetizioni: e.ripetizioni_default }) ?? '']
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            )}
          </section>
        )
      })}

      <section className="card">
        <div className="add-row">
          <input
            placeholder="Aggiungi una sezione a questa seduta… (es. Defaticamento)"
            value={nuovaSezione}
            onChange={(e) => setNuovaSezione(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aggiungiSezione()
            }}
          />
          <button onClick={aggiungiSezione}>Aggiungi sezione</button>
        </div>
      </section>

      <section className="card">
        {/* Come e' andata, prima delle note: due numeri da 0 a 10 che si
            possono confrontare seduta dopo seduta. Restano vuoti se non li si
            chiede: non tutte le sedute vanno misurate. */}
        <div className="riga-percepito">
          <label className="field campo-percepito">
            <span className="nome-percepito">
              Dolore
              <Aiuto testo="Quanto ha fatto male oggi, da 0 (niente) a 10 (il massimo). È quello che dice il paziente, non quello che vedi tu: serve a confrontare le sedute fra loro." />
            </span>
            <select value={dolore} onChange={(e) => setDolore(e.target.value)}>
              <option value="">—</option>
              {VOTI.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="field campo-percepito">
            <span className="nome-percepito">
              Sforzo
              <Aiuto testo="Quanto è stata dura la seduta per lui, da 0 (niente) a 10 (massimo sforzo). Due sedute con gli stessi carichi possono costare molto diverso, e questo numero te lo dice." />
            </span>
            <select value={sforzo} onChange={(e) => setSforzo(e.target.value)}>
              <option value="">—</option>
              {VOTI.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {/* I segni di riferimento di questo paziente, nella stessa riga: si
              ricontrollano qui, seduta dopo seduta, ed e' da questi numeri che
              si vede se la strada e' giusta. Compaiono solo se ne hai scelti,
              dalla scheda Clinica. */}
          {segni.map((g) => (
            <label key={g.id} className="field campo-percepito">
              <span className="nome-percepito">
                {g.nome}
                {g.unita && <span className="unita-segno">{g.unita}</span>}
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="—"
                value={misure[g.id] ?? ''}
                onChange={(e) => setMisure({ ...misure, [g.id]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label className="field note-seduta">
          Note della seduta
          <textarea
            rows={3}
            value={note}
            placeholder="Osservazioni generali, cose da riprendere la prossima volta…"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button onClick={() => void annulla()}>Annulla</button>
          <button className="primary" onClick={() => void salva()}>
            Salva seduta ({totaleEsercizi} esercizi)
          </button>
        </div>
      </section>

      {immagineAperta && (
        <ImmagineEsercizio
          esercizioId={immagineAperta.id}
          nome={immagineAperta.nome}
          onClose={() => setImmagineAperta(null)}
        />
      )}
    </div>
  )
}
