import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  SedutaPrecedente,
  Fase,
  Categoria,
  EsercizioConCategoria,
  Obiettivo,
  PazienteDettaglio,
  SedutaEsercizioDettaglio,
  Segno,
  StatoProgressione,
  UltimaVolta
} from '../../../shared/types'
import { AlertTriangle, Dumbbell } from 'lucide-react'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import ImmagineEsercizio from './ImmagineEsercizio'
import Modale from './Modale'
import SpecchiettoProgressioni from './SpecchiettoProgressioni'
import DiarioSeduta, { UltimaVoltaSeduta } from './DiarioSeduta'
import { errMsg, oggiIso } from '../lib'
import { useScorciatoie } from '../scorciatoie'
import { useSalvataggio } from '../salvataggio'
import { useRiordino } from '../riordino'
import {
  campiDaBozza,
  esitiDaSalvare,
  haQualcosa,
  inputSeduta,
  misuraNonNumerica,
  totaleEsercizi as contaEsercizi,
  type BozzaSeduta,
  type CampiSeduta,
  type SezioneBuilder
} from './seduta/modello'
import { useSezioni } from './seduta/useSezioni'
import { useBozza } from './seduta/useBozza'
import TestataSeduta from './seduta/TestataSeduta'
import SezioneSeduta from './seduta/SezioneSeduta'
import ChiusuraSeduta from './seduta/ChiusuraSeduta'

// La costruzione di una seduta. Qui stanno il caricamento, il salvataggio e
// l'uscita; i pezzi stanno in seduta/: le forme dei dati e le loro
// trasformazioni (modello.ts, provate in test/costruzione-seduta.test.ts), le
// sezioni con Ctrl+Z (useSezioni), la bozza (useBozza), e i pezzi della
// schermata (testata, sezione, riga, chiusura).

interface Props {
  paziente: PazienteDettaglio
  sedutaId: number | null // valorizzato = modifica di una seduta esistente
  duplicaDa?: number // valorizzato (con sedutaId null) = nuova seduta prefillata
  // il giorno della seduta nuova, se non e' oggi (copiando dalla settimana)
  dataIniziale?: string
  onClose: (salvata: boolean) => void
}

// Quello che serve per comporre e che non cambia mentre si compone: si legge
// all'apertura (e in parte cambiando fase).
interface Contesto {
  libreria: EsercizioConCategoria[]
  categorie: Categoria[]
  // Le fasi della patologia del paziente: servono a sapere se c'e' un percorso
  // al campo e quali sono le sue fasi.
  fasi: Fase[]
  focusUsati: string[]
  // Cosa aveva fatto l'ultima volta, esercizio per esercizio.
  ultime: Record<number, UltimaVolta>
  // I segni di riferimento di questo paziente.
  segni: Segno[]
  obiettivi: Obiettivo[]
  raggiunti: number[]
  templateCats: Record<number, number[]>
  // Le progressioni della fase, con lo step del paziente: per i suggerimenti,
  // l'esito e lo specchietto. Servono solo a programmare.
  progressioni: StatoProgressione[]
}

// Lo step del paziente conta fino a oggi: le sedute programmate per i giorni a
// venire non sono ancora andate in nessun modo. E fino al giorno della seduta,
// se e' un giorno passato che si sta correggendo.
const finoAl = (data: string): string => (data < oggiIso() ? data : oggiIso())

const CONTESTO_VUOTO: Contesto = {
  libreria: [],
  categorie: [],
  fasi: [],
  focusUsati: [],
  ultime: {},
  segni: [],
  obiettivi: [],
  raggiunti: [],
  templateCats: {},
  progressioni: []
}

export default function SedutaBuilder({
  paziente,
  sedutaId,
  duplicaDa,
  dataIniziale,
  onClose
}: Props): React.JSX.Element {
  const [pronto, setPronto] = useState(false)
  const [contesto, setContesto] = useState<Contesto>(CONTESTO_VUOTO)
  const [campi, setCampi] = useState<CampiSeduta>({
    data: dataIniziale ?? oggiIso(),
    ora: '',
    faseId: paziente.fase_corrente_id,
    faseNome: paziente.fase_nome,
    focus: '',
    dolore: '',
    sforzo: '',
    misure: {},
    note: '',
    riferitoAndamento: null,
    riferito: '',
    tecnicaIds: [],
    trattamento: '',
    esiti: {}
  })
  const cambia = useCallback((p: Partial<CampiSeduta>) => setCampi((c) => ({ ...c, ...p })), [])
  const { sezioni, invia } = useSezioni()
  // La seduta di prima, da ricordare prima di chiedere "come va?".
  const [precedente, setPrecedente] = useState<SedutaPrecedente | null>(null)
  // Le righe in cui i numeri dell'ultima volta sono gia' stati ricopiati: la
  // scritta sparisce, quei numeri stanno gia' nelle caselle sopra.
  const [ricopiate, setRicopiate] = useState<string[]>([])
  const onRicopiata = useCallback((chiave: string) => setRicopiate((r) => [...r, chiave]), [])
  // Quale sezione ha la ricerca aperta. Una per volta: prima ogni sezione
  // teneva sempre in vista la sua casella di ricerca e fino a otto esercizi
  // proposti, e con tre o quattro sezioni lo schermo era pieno di strumenti
  // invece che della seduta.
  const [sezioneAperta, setSezioneAperta] = useState<number | null>(null)
  const [nuovaSezione, setNuovaSezione] = useState('')
  const [immagineAperta, setImmagineAperta] = useState<{ id: number; nome: string } | null>(null)
  const [specchietto, setSpecchietto] = useState(false)

  // Contatore per le chiavi locali delle righe "al volo" (sempre negative,
  // cosi' non si confondono mai con un esercizio_id vero).
  const contatoreVolo = useRef(0)
  const nuovaChiaveVolo = useCallback((): number => --contatoreVolo.current, [])
  // Le sezioni lette dall'archivio (o da una seduta da duplicare) hanno righe
  // "al volo" gia' salvate ma senza una chiave locale: gliene si assegna una
  // qui, una volta sola, invece che a ogni disegno.
  const assegnaChiavi = (
    lette: { sezione_id: number | null; nome: string; esercizi: SedutaEsercizioDettaglio[] }[]
  ): SezioneBuilder[] =>
    lette.map((sz) => ({
      sezione_id: sz.sezione_id,
      nome: sz.nome,
      righe: sz.esercizi.map((r) => (r.esercizio_id == null ? { ...r, chiaveVolo: nuovaChiaveVolo() } : r))
    }))

  useEffect(() => {
    void (async () => {
      try {
        const [lib, cats, ragg, elencoFasi, usati, precedenti, elencoSegni] = await Promise.all([
          window.api.esercizi.list(false),
          window.api.categorie.list(),
          window.api.pazienti.obiettiviRaggiunti(paziente.id),
          paziente.patologia_id == null ? Promise.resolve([] as Fase[]) : window.api.fasi.list(paziente.patologia_id),
          window.api.sedute.focusUsati(),
          window.api.sedute.ultimaVolta(paziente.id, sedutaId),
          window.api.segni.list(paziente.id)
        ])
        const ctx: Contesto = {
          ...CONTESTO_VUOTO,
          libreria: lib,
          categorie: cats,
          raggiunti: ragg,
          fasi: elencoFasi,
          focusUsati: usati,
          ultime: Object.fromEntries(precedenti.map((u) => [u.esercizio_id, u])),
          segni: elencoSegni
        }

        let fase = paziente.fase_corrente_id
        let faseNome: string | null = paziente.fase_nome
        let iniziali: SezioneBuilder[] | null = null
        const letti: Partial<CampiSeduta> = {}
        if (sedutaId != null) {
          const s = await window.api.sedute.get(sedutaId)
          const gia = await window.api.segni.dellaSeduta(sedutaId)
          Object.assign(letti, {
            data: s.data,
            ora: s.ora ?? '',
            focus: s.focus ?? '',
            dolore: s.dolore == null ? '' : String(s.dolore),
            sforzo: s.sforzo == null ? '' : String(s.sforzo),
            misure: Object.fromEntries(gia.map((v) => [v.segno_id, String(v.valore)])),
            note: s.note ?? '',
            riferitoAndamento: s.riferito_andamento ?? null,
            riferito: s.riferito ?? '',
            tecnicaIds: s.tecnica_ids ?? [],
            trattamento: s.trattamento ?? '',
            esiti: Object.fromEntries((s.progressioni ?? []).map((p) => [p.progressione_id, p.esito]))
          })
          void window.api.sedute
            .precedente(paziente.id, sedutaId, s.data)
            .then(setPrecedente)
            .catch(() => undefined)
          iniziali = assegnaChiavi(s.sezioni)
          fase = s.fase_id
          faseNome = s.fase_nome
        } else if (duplicaDa != null) {
          const s = await window.api.sedute.get(duplicaDa)
          iniziali = assegnaChiavi(s.sezioni)
          letti.focus = s.focus ?? ''
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
              Object.assign(letti, campiDaBozza(salvata))
              iniziali = salvata.sezioni
              // La fase della bozza (al campo, per esempio): con il suo nome,
              // i suoi obiettivi e le proposte della sua struttura. Prima si
              // leggeva e poi si perdeva, e la seduta ripresa si salvava con la
              // fase del paziente.
              if (salvata.faseId != null && salvata.faseId !== fase) {
                fase = salvata.faseId
                faseNome = elencoFasi.find((f) => f.id === fase)?.nome ?? faseNome
              }
            } else {
              await window.api.bozze.elimina(paziente.id)
            }
          }
          void window.api.sedute
            .precedente(paziente.id, null, dataIniziale ?? oggiIso())
            .then(setPrecedente)
            .catch(() => undefined)
        }

        if (fase != null) {
          const [obs, template, progr] = await Promise.all([
            window.api.obiettivi.list(fase),
            window.api.sezioni.list(fase),
            window.api.progressioni.stato(paziente.id, fase, finoAl(letti.data ?? dataIniziale ?? oggiIso()), sedutaId)
          ])
          ctx.obiettivi = obs
          ctx.progressioni = progr
          ctx.templateCats = Object.fromEntries(template.map((t) => [t.id, t.categoria_ids]))
          // nuova seduta: struttura di default dal template della fase
          if (iniziali == null) iniziali = template.map((t) => ({ sezione_id: t.id, nome: t.nome, righe: [] }))
        }

        setContesto(ctx)
        cambia({ ...letti, faseId: fase, faseNome })
        invia({ tipo: 'imposta', sezioni: iniziali ?? [] })
        setPronto(true)
      } catch (e) {
        toastErrore(errMsg(e))
        onClose(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { fasi } = contesto
  const fasiCampo = fasi.filter((f) => f.campo === 1)
  const alCampo = fasi.find((f) => f.id === campi.faseId)?.campo === 1

  // Passare da palestra a campo (o cambiare fase del campo) vuol dire
  // ricominciare da un'altra struttura: si chiede prima, perche' quello che
  // c'e' dentro andrebbe perso.
  const cambiaFase = async (nuova: number | null): Promise<void> => {
    if (nuova === campi.faseId) return
    const pieno = sezioni.some((s) => s.righe.length > 0)
    if (
      pieno &&
      !(await chiedi(
        'Cambiando programma le sezioni e gli esercizi di questa seduta vengono sostituiti con quelli della struttura scelta. Procedere?'
      ))
    ) {
      return
    }
    cambia({ faseId: nuova, faseNome: nuova == null ? null : (fasi.find((f) => f.id === nuova)?.nome ?? null) })
    // gli esiti erano delle progressioni della fase di prima
    cambia({ esiti: {} })
    if (nuova == null) {
      invia({ tipo: 'imposta', sezioni: [] })
      setContesto((c) => ({ ...c, obiettivi: [], templateCats: {}, progressioni: [] }))
      return
    }
    try {
      const [obs, template, progr] = await Promise.all([
        window.api.obiettivi.list(nuova),
        window.api.sezioni.list(nuova),
        window.api.progressioni.stato(paziente.id, nuova, finoAl(campi.data), sedutaId)
      ])
      setContesto((c) => ({
        ...c,
        obiettivi: obs,
        templateCats: Object.fromEntries(template.map((t) => [t.id, t.categoria_ids])),
        progressioni: progr
      }))
      invia({ tipo: 'imposta', sezioni: template.map((t) => ({ sezione_id: t.id, nome: t.nome, righe: [] })) })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const totaleEsercizi = useMemo(() => contaEsercizi(sezioni), [sezioni])

  // Gli esercizi gia' in seduta, per non riproporli, e le progressioni che ne
  // hanno almeno uno: per quelle si chiede com'e' andata (ma solo se la seduta
  // e' di oggi o passata).
  const inSeduta = useMemo(
    () => new Set(sezioni.flatMap((s) => s.righe.map((r) => r.esercizio_id).filter((x): x is number => x != null))),
    [sezioni]
  )
  const progressioniInSeduta = useMemo(
    () =>
      campi.data > oggiIso()
        ? []
        : contesto.progressioni.filter((p) => p.step.some((s) => inSeduta.has(s.esercizio_id))),
    [contesto.progressioni, inSeduta, campi.data]
  )

  // Trascinando, le sezioni e le righe si spostano passo passo: nella storia di
  // Ctrl+Z finisce solo il primo passo (vedi riduciSezioni). Le righe si
  // riordinano solo dentro la propria sezione: la chiave e' "sezione:riga".
  const riordinoSezioni = useRiordino<number>((da, a, primo) => invia({ tipo: 'spostaSezione', da, a, primo }))
  const riordinoRighe = useRiordino<string>((da, a, primo) => {
    const [sezDa, rigaDa] = da.split(':').map(Number)
    const [sezA, rigaA] = a.split(':').map(Number)
    if (sezDa !== sezA) return false
    invia({ tipo: 'spostaRiga', sez: sezDa, da: rigaDa, a: rigaA, primo })
    return true
  })

  const aggiungiSezione = (): void => {
    if (!nuovaSezione.trim()) return
    invia({ tipo: 'nuovaSezione', nome: nuovaSezione })
    setNuovaSezione('')
  }

  const bozza = useBozza(pronto && sedutaId == null, paziente.id, campi, sezioni)

  // Una seduta gia' salvata non ha bozza: quello che si cambia vive solo qui
  // dentro. Si confronta lo stato di adesso con quello di quando e' stata
  // aperta, cosi' non serve segnare "modificato" in ogni singolo campo. La
  // firma si ricalcola solo quando cambia qualcosa, non a ogni disegno.
  const firma = useMemo(() => {
    const { faseNome: _nome, ...daConfrontare } = campi
    void _nome
    return JSON.stringify([daConfrontare, sezioni])
  }, [campi, sezioni])
  const [firmaAperta, setFirmaAperta] = useState<string | null>(null)
  useEffect(() => {
    if (pronto) setFirmaAperta((prima) => prima ?? firma)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto])
  const qualcosa = haQualcosa(campi, sezioni)
  // Una seduta nuova non ha una firma di partenza con cui confrontarsi: e'
  // da salvare appena c'e' qualcosa dentro (e la data).
  const modificata =
    sedutaId != null ? firmaAperta != null && firma !== firmaAperta : pronto && campi.data !== '' && qualcosa

  // Uscendo con Annulla/Esc la scelta l'ha gia' fatta l'utente (tenere la
  // bozza o buttare tutto), e dopo un salvataggio non c'e' piu' niente da
  // salvare: in questi casi lo smontaggio non deve salvare una seduta, o
  // salvarla due volte.
  const giaGestita = useRef(false)
  // Se e' l'uscita a far salvare, la pagina sotto e' gia' un'altra: non le si
  // dice "chiuso", altrimenti potrebbe riportare indietro chi ha cambiato
  // sezione.
  const smontata = useRef(false)
  // Si rimette a false all'avvio: in sviluppo React monta, smonta e rimonta
  // subito ogni componente, e senza questo restava "smontata" per sempre e
  // salvando la finestra non si chiudeva piu'.
  useEffect(() => {
    smontata.current = false
    return () => {
      smontata.current = true
    }
  }, [])

  // Chiudendo il programma, o uscendo da questa scheda (anche cliccando in un'
  // altra sezione), con la seduta a meta' di una modifica o appena
  // cominciata: si salva da sola.
  //
  // Un solo salvataggio alla volta (ci pensa useSalvataggio): Ctrl+S premuto
  // due volte, un doppio clic o l'uscita che salva mentre un salvataggio e'
  // gia' partito scrivevano la seduta due volte nel diario. Chi chiede di
  // salvare mentre un salvataggio e' in corso aspetta quello.
  const salvataggio = useSalvataggio(modificata && !giaGestita.current)
  salvataggio.funzione.current = () => (giaGestita.current ? Promise.resolve(true) : salvaSeduta())
  const salva = salvataggio.salva

  // Esc annulla, Ctrl+S salva: la seduta si compila con la tastiera, senza
  // tornare col mouse in fondo alla finestra.
  // Su una seduta gia' salvata che si sta modificando non c'e' niente da
  // chiedere: uscendo si salva da sola (vedi useSalvataggio sopra). Resta da
  // decidere solo per una seduta NUOVA, mai salvata: buttarla via subito, o
  // tenerla in bozza per riprenderla. Chiedere qui e' meglio che ritrovarsela
  // proposta domani senza averlo voluto.
  const annulla = async (): Promise<void> => {
    if (
      sedutaId == null &&
      (totaleEsercizi > 0 ||
        campi.note.trim() !== '' ||
        campi.riferito.trim() !== '' ||
        campi.trattamento.trim() !== '' ||
        campi.tecnicaIds.length > 0)
    ) {
      if (!(await chiedi('Tengo quello che hai messo, per riprenderlo dopo?'))) {
        bozza.chiudi()
        await window.api.bozze.elimina(paziente.id).catch(() => undefined)
      }
    }
    giaGestita.current = true
    onClose(false)
  }

  useScorciatoie([
    { tasto: 'Escape', azione: () => void annulla() },
    { tasto: 's', ctrl: true, azione: () => void salva() }
  ])

  const salvaSeduta = async (): Promise<boolean> => {
    if (!campi.data) {
      toastErrore('Imposta la data della seduta.')
      return false
    }
    // Una seduta di sole tecniche e' una seduta vera: basta che ci sia
    // qualcosa — esercizi, trattamento, cosa riferisce o le note.
    if (!qualcosa) {
      toastErrore('La seduta è vuota: scrivi cosa riferisce, il trattamento o aggiungi un esercizio.')
      return false
    }
    const nonNumerico = misuraNonNumerica(contesto.segni, campi.misure)
    if (nonNumerico) {
      toastErrore(
        `Il valore di «${nonNumerico.nome}» deve essere un numero (per esempio 5 o 5,5): ora c'è scritto «${(campi.misure[nonNumerico.id] ?? '').trim()}».`
      )
      return false
    }
    const input = inputSeduta(
      paziente.id,
      campi,
      sezioni,
      contesto.segni,
      esitiDaSalvare(campi.esiti, contesto.progressioni, sezioni, campi.data, oggiIso())
    )
    bozza.chiudi()
    try {
      if (sedutaId == null) await window.api.sedute.create(input)
      else await window.api.sedute.update(sedutaId, input)
      // Salvata la seduta, la bozza non serve piu' e va tolta subito. Restando
      // li' veniva riproposta ("c'e' una seduta lasciata a meta'") alla seduta
      // nuova successiva dello stesso paziente, anche se non si era perso
      // niente: la seduta di prima era salvata benissimo.
      await window.api.bozze.elimina(paziente.id).catch(() => undefined)
      giaGestita.current = true
      if (!smontata.current) onClose(true)
      return true
    } catch (e) {
      bozza.riapri()
      toastErrore(errMsg(e))
      return false
    }
  }

  const onImmagine = useCallback((e: { id: number; nome: string }) => setImmagineAperta(e), [])

  if (!pronto) {
    return (
      <div className="page">
        <p className="hint">Caricamento…</p>
      </div>
    )
  }

  const { obiettivi, raggiunti } = contesto
  return (
    <div className="page builder-col">
      <TestataSeduta
        paziente={paziente}
        nuova={sedutaId == null}
        copiata={duplicaDa != null}
        campi={campi}
        onCambia={cambia}
        fasiCampo={fasiCampo}
        alCampo={alCampo}
        onCambiaFase={(f) => void cambiaFase(f)}
        focusUsati={contesto.focusUsati}
        salvataggio={salvataggio}
        onAnnulla={() => void annulla()}
        onSalva={() => void salva()}
      />

      {/* I limiti da non superare, sotto all'intestazione: si compone la seduta
          guardandoli, non ricordandoseli. */}
      {paziente.precauzioni && (
        <p className="fascia-precauzioni">
          <AlertTriangle size={16} />
          {paziente.precauzioni}
        </p>
      )}

      {/* Prima la volta scorsa, poi com'e' oggi e cosa gli si fa: e' l'ordine
          della seduta vera. Gli esercizi vengono dopo. */}
      {precedente && <UltimaVoltaSeduta precedente={precedente} />}
      <DiarioSeduta
        andamento={campi.riferitoAndamento}
        riferito={campi.riferito}
        tecnicaIds={campi.tecnicaIds}
        trattamento={campi.trattamento}
        onCambia={(p) => {
          const patch: Partial<CampiSeduta> = {}
          if (p.andamento !== undefined) patch.riferitoAndamento = p.andamento
          if (p.riferito !== undefined) patch.riferito = p.riferito
          if (p.tecnicaIds !== undefined) patch.tecnicaIds = p.tecnicaIds
          if (p.trattamento !== undefined) patch.trattamento = p.trattamento
          cambia(patch)
        }}
      />

      {/* Da qui in giu' gli esercizi: un titolo li separa dal diario sopra. */}
      <div className="titolo-esercizi">
        <Dumbbell size={18} />
        Esercizi
      </div>

      {campi.faseId != null && obiettivi.length > 0 && (
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
            {campi.faseId == null
              ? 'Il paziente non ha una fase corrente: imposta la fase nella sua scheda, oppure aggiungi sezioni manualmente qui sotto.'
              : 'Questa fase non ha una struttura di seduta configurata: definiscila in "Patologie e fasi" oppure aggiungi le sezioni manualmente qui sotto.'}
          </p>
        </section>
      )}

      {sezioni.map((s, idxSez) => (
        <SezioneSeduta
          key={idxSez}
          sezione={s}
          indice={idxSez}
          categorie={contesto.categorie}
          templateCats={contesto.templateCats}
          libreria={contesto.libreria}
          ultime={contesto.ultime}
          ricopiate={ricopiate}
          progressioni={contesto.progressioni}
          inSeduta={inSeduta}
          onSpecchietto={() => setSpecchietto(true)}
          aperta={sezioneAperta === idxSez}
          onApri={setSezioneAperta}
          riordinoSezioni={riordinoSezioni}
          riordinoRighe={riordinoRighe}
          invia={invia}
          nuovaChiaveVolo={nuovaChiaveVolo}
          onRicopiata={onRicopiata}
          onImmagine={onImmagine}
        />
      ))}

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

      <ChiusuraSeduta
        campi={campi}
        onCambia={cambia}
        segni={contesto.segni}
        progressioni={progressioniInSeduta}
        totaleEsercizi={totaleEsercizi}
        salvataggio={salvataggio}
        onAnnulla={() => void annulla()}
        onSalva={() => void salva()}
      />

      {specchietto && (
        <Modale onConferma={() => setSpecchietto(false)} className="modal-specchietto">
          <h3>Dove siamo nelle progressioni</h3>
          <SpecchiettoProgressioni stati={contesto.progressioni} />
          <div className="modal-actions">
            <button className="primary" onClick={() => setSpecchietto(false)}>
              Chiudi
            </button>
          </div>
        </Modale>
      )}

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
