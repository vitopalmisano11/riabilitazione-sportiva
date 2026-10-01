import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AndamentoRiferito,
  SedutaPrecedente,
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
  Dumbbell,
  ImageIcon,
  Pencil,
  Plus,
  Video,
  X
} from 'lucide-react'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import ImmagineEsercizio from './ImmagineEsercizio'
import Aiuto from './Aiuto'
import DiarioSeduta, { UltimaVoltaSeduta } from './DiarioSeduta'
import { errMsg, formatData, oggiIso } from '../lib'
import { scorciatoieBloccate, useScorciatoie } from '../scorciatoie'
import { useSalvaUscendo } from '../salvaUscendo'
import { sposta, useRiordino } from '../riordino'
import { caricoTesto, recuperoTesto, rirTesto, volumeTesto } from '../../../shared/dosaggio'

// Da 0 a 10: la scala che si usa a voce con il paziente.
const VOTI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface Props {
  paziente: PazienteDettaglio
  sedutaId: number | null // valorizzato = modifica di una seduta esistente
  duplicaDa?: number // valorizzato (con sedutaId null) = nuova seduta prefillata
  // il giorno della seduta nuova, se non e' oggi (copiando dalla settimana)
  dataIniziale?: string
  onClose: (salvata: boolean) => void
}

// Una riga della seduta in costruzione. chiaveVolo e' una chiave locale, mai
// salvata e mai vista dal database: serve solo a dare alla lista di React
// qualcosa di stabile per le righe "al volo" (esercizio_id null), che
// altrimenti sarebbero tutte indistinguibili l'una dall'altra.
type RigaBuilder = SedutaEsercizioDettaglio & { chiaveVolo?: number }

interface SezioneBuilder {
  sezione_id: number | null
  nome: string
  righe: RigaBuilder[]
}

// Quello che si sta componendo, messo da parte cosi' com'e'.
interface BozzaSeduta {
  data: string
  ora?: string
  faseId: number | null
  focus?: string
  riferitoAndamento?: AndamentoRiferito | null
  riferito?: string
  tecnicaIds?: number[]
  trattamento?: string
  note: string
  sezioni: SezioneBuilder[]
}

export default function SedutaBuilder({
  paziente,
  sedutaId,
  duplicaDa,
  dataIniziale,
  onClose
}: Props): React.JSX.Element {
  const [pronto, setPronto] = useState(false)
  const [data, setData] = useState(dataIniziale ?? oggiIso())
  // L'orario dell'appuntamento: facoltativo, serve a ordinare la settimana.
  const [ora, setOra] = useState('')
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
  // Il diario: come sta tornando e cosa gli si fa oggi.
  const [riferitoAndamento, setRiferitoAndamento] = useState<AndamentoRiferito | null>(null)
  const [riferito, setRiferito] = useState('')
  const [tecnicaIds, setTecnicaIds] = useState<number[]>([])
  const [trattamento, setTrattamento] = useState('')
  // La seduta di prima, da ricordare prima di chiedere "come va?".
  const [precedente, setPrecedente] = useState<SedutaPrecedente | null>(null)
  const [sezioni, setSezioni] = useState<SezioneBuilder[]>([])
  // Ctrl+Z: com'erano le sezioni prima di ogni cambiamento (un esercizio
  // aggiunto o tolto, una sezione tolta, un riordino), dal piu' recente.
  const storia = useRef<{ sezioni: SezioneBuilder[]; cosa: string }[]>([])
  // Contatore per le chiavi locali delle righe "al volo" (sempre negative,
  // cosi' non si confondono mai con un esercizio_id vero).
  const contatoreVolo = useRef(0)
  const chiaveVoloNuova = (): number => --contatoreVolo.current

  // Le sezioni lette dall'archivio (o da una seduta da duplicare) hanno righe
  // "al volo" gia' salvate ma senza una chiave locale: gliene si assegna una
  // qui, una volta sola, invece che a ogni render.
  const assegnaChiavi = (
    sezioniLette: { sezione_id: number | null; nome: string; esercizi: SedutaEsercizioDettaglio[] }[]
  ): SezioneBuilder[] =>
    sezioniLette.map((sz) => ({
      sezione_id: sz.sezione_id,
      nome: sz.nome,
      righe: sz.esercizi.map((r) => (r.esercizio_id == null ? { ...r, chiaveVolo: chiaveVoloNuova() } : r))
    }))
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
          setOra(s.ora ?? '')
          setFocus(s.focus ?? '')
          setDolore(s.dolore == null ? '' : String(s.dolore))
          setSforzo(s.sforzo == null ? '' : String(s.sforzo))
          const gia = await window.api.segni.dellaSeduta(sedutaId)
          setMisure(Object.fromEntries(gia.map((v) => [v.segno_id, String(v.valore)])))
          setNote(s.note ?? '')
          setRiferitoAndamento(s.riferito_andamento ?? null)
          setRiferito(s.riferito ?? '')
          setTecnicaIds(s.tecnica_ids ?? [])
          setTrattamento(s.trattamento ?? '')
          void window.api.sedute
            .precedente(paziente.id, sedutaId, s.data)
            .then(setPrecedente)
            .catch(() => undefined)
          setSezioni(assegnaChiavi(s.sezioni))
          fase = s.fase_id
          faseN = s.fase_nome
        } else if (duplicaDa != null) {
          const s = await window.api.sedute.get(duplicaDa)
          setSezioni(assegnaChiavi(s.sezioni))
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
              setOra(salvata.ora ?? '')
              setFocus(salvata.focus ?? '')
              setNote(salvata.note)
              setRiferitoAndamento(salvata.riferitoAndamento ?? null)
              setRiferito(salvata.riferito ?? '')
              setTecnicaIds(salvata.tecnicaIds ?? [])
              setTrattamento(salvata.trattamento ?? '')
              setSezioni(salvata.sezioni)
              if (salvata.faseId != null) fase = salvata.faseId
            } else {
              await window.api.bozze.elimina(paziente.id)
            }
          }
        }
        if (sedutaId == null) {
          void window.api.sedute
            .precedente(paziente.id, null, dataIniziale ?? oggiIso())
            .then(setPrecedente)
            .catch(() => undefined)
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
  // Un esercizio "al volo" non ha categoria (categoria_nome null): non
  // corrisponde a nessuna categoria configurata, quindi niente cluster/RIR a
  // meno che la riga non li abbia gia' un valore scritto (vedi sopra).
  const mostraCluster = (r: { categoria_nome: string | null; cluster: string | null }): boolean =>
    (r.cluster ?? '') !== '' ||
    categorie.some((c) => c.nome === r.categoria_nome && c.dosaggio_cluster === 1)

  // La casellina del RIR compare dove la categoria la prevede, e comunque dove
  // un numero c'e' gia': una seduta vecchia deve restare modificabile anche se
  // nel frattempo la spunta e' stata tolta.
  const mostraRir = (r: { categoria_nome: string | null; rir: string | null }): boolean =>
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
  // Cambia le sezioni ricordando com'erano, per Ctrl+Z.
  const modificaSezioni = (nuove: SezioneBuilder[], cosa: string): void => {
    storia.current.push({ sezioni, cosa })
    if (storia.current.length > 50) storia.current.shift()
    setSezioni(nuove)
  }

  const annullaUltima = (): void => {
    const ultima = storia.current.pop()
    if (!ultima) {
      toast('Niente da annullare.')
      return
    }
    setSezioni(ultima.sezioni)
    toast(`Annullato: ${ultima.cosa}.`)
  }

  // Ctrl+Z dentro a una casella di testo annulla quello che si e' scritto,
  // come sempre; fuori dalle caselle annulla l'ultimo cambiamento della seduta.
  useEffect(() => {
    const tasto = (e: KeyboardEvent): void => {
      if (scorciatoieBloccate()) return
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      e.preventDefault()
      annullaUltima()
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  })

  const aggiungi = (idx: number, e: EsercizioConCategoria): void => {
    modificaSezioni(
      sezioni.map((s, i) => {
        if (i !== idx || s.righe.some((r) => r.esercizio_id === e.id)) return s
        const riga: RigaBuilder = {
          esercizio_id: e.id,
          nome_libero: null,
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
      }),
      `aggiunto ${e.nome}`
    )
  }

  // Un esercizio "al volo": una variante scritta li' per li', che vale solo
  // per questa seduta. Non tocca la libreria e non ha categoria, dosaggi di
  // default, foto o link: solo il nome, e i campi della riga (serie,
  // ripetizioni, carico...) restano da compilare come per tutti gli altri.
  const aggiungiAlVolo = (idx: number, nomeGrezzo: string): void => {
    const nome = nomeGrezzo.trim()
    if (!nome) return
    modificaSezioni(
      sezioni.map((s, i) => {
        if (i !== idx) return s
        const riga: RigaBuilder = {
          esercizio_id: null,
          nome_libero: nome,
          nome,
          categoria_nome: null,
          unita_carico: null,
          serie: null,
          cluster: null,
          ripetizioni: null,
          rir: null,
          carico: null,
          recupero_cluster: null,
          recupero: null,
          nota: null,
          link: null,
          ha_immagine: 0,
          chiaveVolo: chiaveVoloNuova()
        }
        // Nessun raggruppamento per categoria: un esercizio al volo non ne ha
        // una, quindi finisce semplicemente in fondo alla sezione.
        return { ...s, righe: [...s.righe, riga] }
      }),
      `aggiunto ${nome} (solo per questa seduta)`
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
    modificaSezioni(
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
      ),
      `ricopiati i numeri di ${sezioni[idxSez]?.righe[idxRiga]?.nome ?? "un esercizio"}`
    )
  }

  // Cosa aveva fatto l'ultima volta, gia' scritto come si legge.
  const testoUltima = (r: SedutaEsercizioDettaglio, u: UltimaVolta): string =>
    [volumeTesto(u), rirTesto(u), caricoTesto(u.carico, r.unita_carico), recuperoTesto(u)]
      .filter(Boolean)
      .join(' · ')

  const rimuoviRiga = (idxSez: number, idxRiga: number): void => {
    const nome = sezioni[idxSez]?.righe[idxRiga]?.nome ?? 'esercizio'
    modificaSezioni(
      sezioni.map((s, i) =>
        i === idxSez ? { ...s, righe: s.righe.filter((_, j) => j !== idxRiga) } : s
      ),
      `tolto ${nome}`
    )
    toast(`${nome} tolto dalla seduta. Ctrl+Z per rimetterlo.`)
  }

  // Trascinando, le sezioni si spostano passo passo: nella cronologia di Ctrl+Z
  // ne finisce uno solo, quello di partenza, altrimenti annullare uno
  // spostamento vorrebbe dire premere Ctrl+Z una volta per ogni sezione
  // scavalcata.
  const { contenitore: contSez, presa: presaSez } = useRiordino<number>((da, a, primo) => {
    const nuove = sposta(sezioni, da, a)
    if (primo) modificaSezioni(nuove, 'spostata una sezione')
    else setSezioni(nuove)
  })

  // Le righe si riordinano solo dentro la propria sezione: la chiave e' "sezione:riga".
  const { contenitore: contRiga, presa: presaRiga } = useRiordino<string>((da, a, primo) => {
    const [sezDa, rigaDa] = da.split(':').map(Number)
    const [sezA, rigaA] = a.split(':').map(Number)
    if (sezDa !== sezA) return false
    const nuove = sezioni.map((s, i) =>
      i === sezDa ? { ...s, righe: sposta(s.righe, rigaDa, rigaA) } : s
    )
    if (primo) modificaSezioni(nuove, 'spostato un esercizio')
    else setSezioni(nuove)
    return true
  })

  const rimuoviSezione = async (idx: number): Promise<void> => {
    const s = sezioni[idx]
    if (
      s.righe.length > 0 &&
      !(await chiedi(`Rimuovere la sezione "${s.nome}" e i suoi ${s.righe.length} esercizi da questa seduta?`))
    ) {
      return
    }
    modificaSezioni(
      sezioni.filter((_, i) => i !== idx),
      `tolta la sezione ${s.nome}`
    )
    toast(`Sezione "${s.nome}" tolta. Ctrl+Z per rimetterla.`)
  }

  // window.prompt non è supportato in Electron: rename inline della sezione
  const [editSez, setEditSez] = useState<{ idx: number; nome: string } | null>(null)

  const aggiungiSezione = (): void => {
    const nome = nuovaSezione.trim()
    if (!nome) return
    modificaSezioni([...sezioni, { sezione_id: null, nome, righe: [] }], `aggiunta la sezione ${nome}`)
    setNuovaSezione('')
  }

  // Vero dopo che un salvataggio della bozza e' fallito e finche' non ne riesce uno.
  const bozzaInErrore = useRef(false)

  // La bozza si mette da parte da sola mentre componi, un secondo dopo l'ultima
  // modifica: se l'app si chiude, alla riapertura la ritrovi. Vale solo per le
  // sedute nuove — quelle gia' salvate sono gia' al sicuro nel loro posto.
  useEffect(() => {
    if (!pronto || sedutaId != null) return
    const diarioVuoto =
      riferitoAndamento == null && riferito.trim() === '' && tecnicaIds.length === 0 && trattamento.trim() === ''
    if (totaleEsercizi === 0 && note.trim() === '' && focus.trim() === '' && diarioVuoto) return
    const bozza: BozzaSeduta = {
      data,
      ora: ora || undefined,
      faseId,
      focus,
      riferitoAndamento,
      riferito,
      tecnicaIds,
      trattamento,
      note,
      sezioni
    }
    const attesa = setTimeout(() => {
      window.api.bozze
        .salva(paziente.id, JSON.stringify(bozza))
        .then(() => {
          bozzaInErrore.current = false
        })
        .catch((e) => {
          // Una volta sola finche' non torna a funzionare: un avviso a ogni
          // secondo mentre si scrive sarebbe peggio del problema.
          if (bozzaInErrore.current) return
          bozzaInErrore.current = true
          toastErrore(
            `La bozza non si sta salvando (${errMsg(e)}). Se il programma si chiude adesso, questa seduta va persa: salvala appena puoi.`
          )
        })
    }, 1000)
    return () => clearTimeout(attesa)
  }, [
    pronto,
    sedutaId,
    paziente.id,
    data,
    ora,
    faseId,
    focus,
    note,
    sezioni,
    totaleEsercizi,
    riferitoAndamento,
    riferito,
    tecnicaIds,
    trattamento
  ])

  // Una seduta gia' salvata non ha bozza: quello che si cambia vive solo qui
  // dentro. Si confronta lo stato di adesso con quello di quando e' stata
  // aperta, cosi' non serve segnare "modificato" in ogni singolo campo.
  const firma = JSON.stringify([
    data,
    ora,
    faseId,
    focus,
    dolore,
    sforzo,
    misure,
    note,
    riferitoAndamento,
    riferito,
    tecnicaIds,
    trattamento,
    sezioni
  ])
  const [firmaAperta, setFirmaAperta] = useState<string | null>(null)
  useEffect(() => {
    if (pronto) setFirmaAperta((prima) => prima ?? firma)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto])
  // Una seduta e' vera se c'e' scritto o messo qualcosa: solo tecniche,
  // trattamento, cosa riferisce, note o esercizi.
  const haQualcosa =
    totaleEsercizi > 0 ||
    tecnicaIds.length > 0 ||
    trattamento.trim() !== '' ||
    riferito.trim() !== '' ||
    riferitoAndamento != null ||
    note.trim() !== ''
  // Una seduta nuova non ha una firma di partenza con cui confrontarsi: e'
  // da salvare appena c'e' qualcosa dentro (e la data).
  const modificata =
    sedutaId != null
      ? firmaAperta != null && firma !== firmaAperta
      : pronto && data !== '' && haQualcosa

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
  const salvaAllaChiusura = useSalvaUscendo(modificata && !giaGestita.current)
  salvaAllaChiusura.current = () => (giaGestita.current ? Promise.resolve(true) : salva())

  // Esc annulla, Ctrl+S salva: la seduta si compila con la tastiera, senza
  // tornare col mouse in fondo alla finestra.
  // Su una seduta gia' salvata che si sta modificando non c'e' niente da
  // chiedere: uscendo si salva da sola (vedi useSalvaUscendo sopra). Resta da
  // decidere solo per una seduta NUOVA, mai salvata: buttarla via subito, o
  // tenerla in bozza per riprenderla. Chiedere qui e' meglio che ritrovarsela
  // proposta domani senza averlo voluto.
  const annulla = async (): Promise<void> => {
    if (
      sedutaId == null &&
      (totaleEsercizi > 0 ||
        note.trim() !== '' ||
        riferito.trim() !== '' ||
        trattamento.trim() !== '' ||
        tecnicaIds.length > 0)
    ) {
      if (!(await chiedi('Tengo quello che hai messo, per riprenderlo dopo?'))) {
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

  const salva = async (): Promise<boolean> => {
    if (!data) {
      toastErrore('Imposta la data della seduta.')
      return false
    }
    // Una seduta di sole tecniche e' una seduta vera: basta che ci sia
    // qualcosa — esercizi, trattamento, cosa riferisce o le note.
    if (!haQualcosa) {
      toastErrore('La seduta è vuota: scrivi cosa riferisce, il trattamento o aggiungi un esercizio.')
      return false
    }
    const input: SedutaInput = {
      paziente_id: paziente.id,
      data,
      ora: ora || null,
      fase_id: faseId,
      focus: focus.trim() || null,
      dolore: dolore === '' ? null : Number(dolore),
      sforzo: sforzo === '' ? null : Number(sforzo),
      // Solo i segni che hai misurato davvero: una casella lasciata vuota non
      // e' uno zero.
      segni: segni
        .map((g) => ({ segno_id: g.id, valore: Number((misure[g.id] ?? '').replace(',', '.')) }))
        .filter((v) => (misure[v.segno_id] ?? '').trim() !== '' && !Number.isNaN(v.valore)),
      riferito_andamento: riferitoAndamento,
      riferito: riferito.trim() || null,
      tecnica_ids: tecnicaIds,
      trattamento: trattamento.trim() || null,
      note: note.trim() || null,
      sezioni: sezioni.map((s) => ({ sezione_id: s.sezione_id, nome: s.nome })),
      esercizi: sezioni.flatMap((s, i) =>
        s.righe.map((r) => ({
          esercizio_id: r.esercizio_id,
          nome_libero: r.nome_libero,
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
      giaGestita.current = true
      if (!smontata.current) onClose(true)
      return true
    } catch (e) {
      toastErrore(errMsg(e))
      return false
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
          {/* Facoltativo: serve a sapere a che ora viene, e a ordinare la
              settimana per appuntamento invece che per cognome. */}
          <label className="field ora-field">
            Ora
            <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} />
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

      {/* Prima la volta scorsa, poi com'e' oggi e cosa gli si fa: e' l'ordine
          della seduta vera. Gli esercizi vengono dopo. */}
      {precedente && <UltimaVoltaSeduta precedente={precedente} />}
      <DiarioSeduta
        andamento={riferitoAndamento}
        riferito={riferito}
        tecnicaIds={tecnicaIds}
        trattamento={trattamento}
        onCambia={(p) => {
          if (p.andamento !== undefined) setRiferitoAndamento(p.andamento)
          if (p.riferito !== undefined) setRiferito(p.riferito)
          if (p.tecnicaIds !== undefined) setTecnicaIds(p.tecnicaIds)
          if (p.trattamento !== undefined) setTrattamento(p.trattamento)
        }}
      />

      {/* Da qui in giu' gli esercizi: un titolo li separa dal diario sopra. */}
      <div className="titolo-esercizi">
        <Dumbbell size={18} />
        Esercizi
      </div>

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
        const testoRicerca = (ricerche[idxSez] ?? '').trim()
        const ricerca = testoRicerca.toLowerCase()
        const inSezione = new Set(s.righe.map((r) => r.esercizio_id))
        // Se quello che hai scritto non e' gia' il nome di un esercizio della
        // libreria, si puo' aggiungerlo cosi' com'e', solo per questa seduta.
        const corrispondeInLibreria = libreria.some((e) => e.nome.toLowerCase() === ricerca)
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
                        modificaSezioni(
                          sezioni.map((x, i) =>
                            i === idxSez ? { ...x, nome: editSez.nome.trim() } : x
                          ),
                          'rinominata una sezione'
                        )
                        setEditSez(null)
                      }
                      if (e.key === 'Escape') setEditSez(null)
                    }}
                  />
                  <button
                    onClick={() => {
                      if (editSez.nome.trim()) {
                        modificaSezioni(
                          sezioni.map((x, i) =>
                            i === idxSez ? { ...x, nome: editSez.nome.trim() } : x
                          ),
                          'rinominata una sezione'
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
                  // In una variabile a parte, cosi' il tipo resta "number" (non
                  // "number | null") anche dentro le funzioni piu' sotto: un
                  // esercizio al volo non ce l'ha, e quel blocco per lui non si
                  // mostra proprio.
                  const idEsercizio = r.esercizio_id
                  // Gli esercizi della stessa categoria restano vicini perche'
                  // e' li' che vengono inseriti, ma senza scriverne il nome: con
                  // categorie fini ("Rinforzo quadricipite", "Rinforzo
                  // hamstring") le intestazioni erano piu' delle righe.
                  return (
                  <li
                    key={r.esercizio_id ?? r.chiaveVolo}
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
                              // Il pulsante compare solo con ha_immagine === 1, cosa vera
                              // solo per un esercizio di libreria: qui esercizio_id c'e' sempre.
                              setImmagineAperta({ id: r.esercizio_id!, nome: r.nome })
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
                    {/* Un esercizio "al volo" non ha uno storico: niente da
                        ricopiare. */}
                    {idEsercizio != null &&
                      ultime[idEsercizio] &&
                      !ricopiate.includes(`${idxSez}:${idEsercizio}`) &&
                      testoUltima(r, ultime[idEsercizio]) !== '' && (
                        <div className="ultima-volta">
                          <span className="ultima-quando">
                            l&apos;ultima volta, {formatData(ultime[idEsercizio].data)}:
                          </span>
                          <span className="ultima-dose">
                            {testoUltima(r, ultime[idEsercizio])}
                          </span>
                          <button
                            className="btn-piccolo"
                            title="Rimetti questi numeri nella riga"
                            onClick={() => {
                              ricopiaUltima(idxSez, idxRiga, ultime[idEsercizio])
                              setRicopiate([...ricopiate, `${idxSez}:${idEsercizio}`])
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
                <span className="hint">
                  Scegli un esercizio da aggiungere a “{s.nome}”
                  <Aiuto testo="Non trovi l'esercizio che ti serve? Scrivi il suo nome nella casella e aggiungilo con il pulsante che compare sotto: resta solo per questa seduta, senza salvarlo in libreria." />
                </span>
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
              {/* L'esercizio "al volo": una variante scritta li' per li', che
                  non e' in libreria e non ci finisce nemmeno lei. */}
              {testoRicerca !== '' && !corrispondeInLibreria && (
                <button
                  className="btn-al-volo"
                  onClick={() => {
                    aggiungiAlVolo(idxSez, testoRicerca)
                    setRicerche({ ...ricerche, [idxSez]: '' })
                  }}
                >
                  <Plus size={16} /> Aggiungi «{testoRicerca}» come esercizio solo per questa seduta
                </button>
              )}
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
