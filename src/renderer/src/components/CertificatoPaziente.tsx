import { useEffect, useState } from 'react'
import type {
  PazienteDettaglio,
  PazienteInput,
  Profilo,
  SedutaRiepilogo
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import Aiuto from './Aiuto'
import Modale from './Modale'
import MenuScelta from './MenuScelta'
import { errMsg, formatData, oggiIso } from '../lib'

// Il certificato di presenza: il foglio da portare al datore di lavoro. Quello
// che c'e' gia' (i tuoi dati in Impostazioni, quelli del paziente nella sua
// scheda) arriva precompilato; quello che manca si scrive qui e si ricorda, cosi'
// la volta dopo e' gia' a posto.

const PROFILO_VUOTO: Profilo = {
  nome: null,
  qualifica: null,
  studio: null,
  indirizzo: null,
  codice_fiscale: null,
  partita_iva: null,
  numero_iscrizione: null,
  telefono: null,
  email: null
}

const testo = (v: string | null | undefined): string => v ?? ''
const vuotoNull = (v: string): string | null => v.trim() || null

// Una casella che deve esserci per il certificato: se e' vuota si vede.
function Obbligatorio({ vuoto }: { vuoto: boolean }): React.JSX.Element | null {
  return vuoto ? <span className="hint-campo">da compilare</span> : null
}

export default function CertificatoPaziente({
  paziente,
  onChiudi
}: {
  paziente: PazienteDettaglio
  // true se sono stati salvati dati del paziente: la scheda va riletta
  onChiudi: (datiCambiati: boolean) => void
}): React.JSX.Element {
  const [profilo, setProfilo] = useState<Profilo>(PROFILO_VUOTO)
  const [profiloPartenza, setProfiloPartenza] = useState<Profilo | null>(null)
  const [sedute, setSedute] = useState<SedutaRiepilogo[]>([])
  const [sedutaId, setSedutaId] = useState<number | ''>('')
  const [data, setData] = useState('')
  const [oraInizio, setOraInizio] = useState('')
  const [oraFine, setOraFine] = useState('')
  const [viaggio, setViaggio] = useState(false)
  const [emissione, setEmissione] = useState(oggiIso())
  const [nascita, setNascita] = useState(testo(paziente.data_nascita))
  const [cf, setCf] = useState(testo(paziente.codice_fiscale))
  const [occupato, setOccupato] = useState(false)

  useEffect(() => {
    void window.api.profilo
      .leggi()
      .then((p) => {
        setProfilo(p)
        setProfiloPartenza(p)
      })
      .catch((e) => toastErrore(errMsg(e)))
    void window.api.sedute
      .list(paziente.id)
      .then((lista) => {
        setSedute(lista)
        // La piu' recente fra quelle gia' fatte (le programmate per i giorni
        // dopo non si certificano): di solito il certificato si fa subito dopo.
        const oggi = oggiIso()
        const ultima = lista.find((s) => s.data <= oggi) ?? lista[0]
        if (ultima) scegliSeduta(ultima)
      })
      .catch((e) => toastErrore(errMsg(e)))
    // si carica una volta sola, all'apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paziente.id])

  const scegliSeduta = (s: SedutaRiepilogo): void => {
    setSedutaId(s.id)
    setData(s.data)
    setOraInizio(testo(s.ora))
    // la fine dipende da quanto e' durata davvero: non si indovina
    setOraFine('')
  }

  const cambiaProfilo = (k: keyof Profilo, v: string): void =>
    setProfilo((prec) => ({ ...prec, [k]: v }))

  // Quello che si e' scritto o corretto qui si ricorda: la prossima volta la
  // casella e' gia' piena. Il numero d'iscrizione e il nome vanno nel profilo
  // di Impostazioni, e da li' escono anche sugli altri fogli.
  const salvaModifiche = async (): Promise<boolean> => {
    const nuovaNascita = nascita || null
    const nuovoCf = vuotoNull(cf)?.toUpperCase() ?? null
    const pazienteCambiato =
      nuovaNascita !== paziente.data_nascita || nuovoCf !== paziente.codice_fiscale
    if (pazienteCambiato) {
      const dati: PazienteInput = {
        nome: paziente.nome,
        cognome: paziente.cognome,
        data_nascita: nuovaNascita,
        codice_fiscale: nuovoCf,
        telefono: paziente.telefono,
        email: paziente.email,
        lavoro: paziente.lavoro,
        inviato_da: paziente.inviato_da,
        sport: paziente.sport,
        diagnosi: paziente.diagnosi,
        tipo_intervento: paziente.tipo_intervento,
        data_intervento: paziente.data_intervento,
        precauzioni: paziente.precauzioni,
        arto_operato: paziente.arto_operato,
        gruppo_id: paziente.gruppo_id
      }
      await window.api.pazienti.update(paziente.id, dati)
    }
    if (JSON.stringify(profilo) !== JSON.stringify(profiloPartenza)) {
      await window.api.profilo.salva(profilo)
      setProfiloPartenza(profilo)
    }
    return pazienteCambiato
  }

  // Un clic fuori dalla finestra, o Invio, la chiude senza fare il PDF, ma
  // senza buttare quello che si e' appena completato.
  const chiudiSalvando = async (): Promise<void> => {
    try {
      onChiudi(await salvaModifiche())
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const crea = async (): Promise<void> => {
    setOccupato(true)
    try {
      const cambiato = await salvaModifiche()
      const percorso = await window.api.esporta.certificato({
        professionista: {
          nome: vuotoNull(testo(profilo.nome)),
          qualifica: vuotoNull(testo(profilo.qualifica)),
          numero_iscrizione: vuotoNull(testo(profilo.numero_iscrizione)),
          indirizzo: vuotoNull(testo(profilo.indirizzo)),
          telefono: vuotoNull(testo(profilo.telefono)),
          email: vuotoNull(testo(profilo.email))
        },
        paziente: {
          nome: paziente.nome,
          cognome: paziente.cognome,
          data_nascita: nascita || null,
          codice_fiscale: vuotoNull(cf)?.toUpperCase() ?? null
        },
        data,
        ora_inizio: oraInizio,
        ora_fine: oraFine,
        comprende_viaggio: viaggio,
        data_emissione: emissione
      })
      if (percorso) {
        toast('Certificato salvato in PDF.')
        onChiudi(cambiato)
      } else if (cambiato) {
        // ha annullato il salvataggio del file: i dati nuovi del paziente ci sono
        // comunque, e la scheda li deve mostrare
        onChiudi(true)
      }
    } catch (e) {
      toastErrore(errMsg(e))
    } finally {
      setOccupato(false)
    }
  }

  return (
    <Modale className="modal-lg" onConferma={() => void chiudiSalvando()}>
      <h3>
        Certificato di presenza — {paziente.cognome} {paziente.nome}
        <Aiuto testo="Il foglio da portare al datore di lavoro per giustificare l'assenza durante la seduta. I tuoi dati vengono da Impostazioni e quelli del paziente dalla sua scheda: quello che manca lo scrivi qui e resta salvato per la volta dopo. Il giorno e l'ora d'inizio arrivano dalla seduta scelta; l'ora di fine la scrivi tu. Se la fascia comprende anche il viaggio, spunta la casella e il foglio lo scrive. La firma la metti a mano sulla carta, in fondo." />
      </h3>

      <div className="sotto-titolo">La seduta</div>
      {sedute.length > 0 && (
        <label>
          Seduta
          <MenuScelta
            valore={sedutaId}
            placeholder="— scegli la seduta —"
            placeholderSceglibile={false}
            opzioni={sedute.map((s) => ({
              valore: s.id,
              etichetta: `${formatData(s.data)}${s.ora ? ` · ${s.ora}` : ''}`
            }))}
            onScegli={(id) => {
              const s = sedute.find((x) => x.id === id)
              if (s) scegliSeduta(s)
            }}
          />
        </label>
      )}
      <div className="form-row-2">
        <label>
          Giorno
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Obbligatorio vuoto={!data} />
        </label>
        <label>
          Data di emissione
          <input type="date" value={emissione} onChange={(e) => setEmissione(e.target.value)} />
        </label>
      </div>
      <div className="form-row-2">
        <label>
          Dalle ore
          <input type="time" value={oraInizio} onChange={(e) => setOraInizio(e.target.value)} />
          <Obbligatorio vuoto={!oraInizio} />
        </label>
        <label>
          Alle ore
          <input type="time" value={oraFine} onChange={(e) => setOraFine(e.target.value)} />
          <Obbligatorio vuoto={!oraFine} />
        </label>
      </div>
      <label className="checkbox-inline">
        <input type="checkbox" checked={viaggio} onChange={(e) => setViaggio(e.target.checked)} />
        La fascia comprende anche il tempo di viaggio
      </label>

      <div className="sotto-titolo">Il paziente</div>
      <div className="form-row-2">
        <label>
          Data di nascita
          <input type="date" value={nascita} onChange={(e) => setNascita(e.target.value)} />
          <Obbligatorio vuoto={!nascita} />
        </label>
        <label>
          Codice fiscale
          <input
            placeholder="es. RSSMRA80A01A662X"
            value={cf}
            onChange={(e) => setCf(e.target.value)}
          />
          <Obbligatorio vuoto={cf.trim() === ''} />
        </label>
      </div>

      <div className="sotto-titolo">I tuoi dati</div>
      <div className="form-row-2">
        <label>
          Nome e cognome
          <input
            value={testo(profilo.nome)}
            placeholder="es. Dott. Mario Rossi"
            onChange={(e) => cambiaProfilo('nome', e.target.value)}
          />
          <Obbligatorio vuoto={testo(profilo.nome).trim() === ''} />
        </label>
        <label>
          Titolo professionale
          <input
            value={testo(profilo.qualifica)}
            placeholder="es. Fisioterapista"
            onChange={(e) => cambiaProfilo('qualifica', e.target.value)}
          />
        </label>
      </div>
      <div className="form-row-2">
        <label>
          Numero di iscrizione all&apos;Ordine (OFI)
          <input
            value={testo(profilo.numero_iscrizione)}
            onChange={(e) => cambiaProfilo('numero_iscrizione', e.target.value)}
          />
          <Obbligatorio vuoto={testo(profilo.numero_iscrizione).trim() === ''} />
        </label>
        <label>
          Indirizzo dello studio
          <input
            value={testo(profilo.indirizzo)}
            onChange={(e) => cambiaProfilo('indirizzo', e.target.value)}
          />
        </label>
      </div>
      <div className="form-row-2">
        <label>
          Telefono
          <input
            value={testo(profilo.telefono)}
            onChange={(e) => cambiaProfilo('telefono', e.target.value)}
          />
        </label>
        <label>
          E-mail
          <input
            value={testo(profilo.email)}
            onChange={(e) => cambiaProfilo('email', e.target.value)}
          />
        </label>
      </div>

      <div className="modal-actions">
        <button onClick={() => void chiudiSalvando()}>Chiudi</button>
        <button className="primary" disabled={occupato} onClick={() => void crea()}>
          Crea il certificato
        </button>
      </div>
    </Modale>
  )
}
