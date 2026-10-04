import { useEffect, useState } from 'react'
import { BadgeCheck, Eraser, FileDown, Pencil, Trash2 } from 'lucide-react'
import type {
  Fase,
  Gruppo,
  Patologia,
  PazienteDettaglio,
  PazienteInput
} from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { chiedi } from './Conferma'
import SceltaConRicerca from './SceltaConRicerca'
import Modale from './Modale'
import { errMsg, daQuando, eta, formatData } from '../lib'
import EsportaCartella from './EsportaCartella'
import CertificatoPaziente from './CertificatoPaziente'
import { COSA_RESTA_NELLE_COPIE } from '../testiCancellazione'

// Dati del paziente: si leggono, non si modificano per sbaglio. Per cambiarli
// si apre la finestra con la matita, accanto al cestino.
export default function AnagraficaPaziente({
  paziente,
  onChanged,
  onDeleted
}: {
  paziente: PazienteDettaglio
  onChanged: () => Promise<void> | void
  onDeleted: () => void
}): React.JSX.Element {
  const [modifica, setModifica] = useState(false)
  const [esporta, setEsporta] = useState(false)
  const [certificato, setCertificato] = useState(false)

  const elimina = async (): Promise<void> => {
    if (
      !(await chiedi(
        `Eliminare ${paziente.nome} ${paziente.cognome}?\nVerranno eliminate anche tutte le sue sedute (diario). Va nel cestino: per un mese lo puoi rimettere a posto da Impostazioni.`
      ))
    ) {
      return
    }
    try {
      await window.api.pazienti.remove(paziente.id)
      onDeleted()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Il diritto alla cancellazione: via subito, senza passare dal cestino.
  const eliminaPerSempre = async (): Promise<void> => {
    const nome = `${paziente.nome} ${paziente.cognome}`
    if (
      !(await chiedi({
        titolo: 'Eliminare per sempre?',
        testo: `Eliminare per sempre ${nome}, con tutte le sue sedute e gli altri dati?\nSparisce subito dall'archivio e non si può rimettere a posto: non passa dal cestino.\n${COSA_RESTA_NELLE_COPIE}`,
        conferma: 'Elimina per sempre',
        pericolo: true
      }))
    ) {
      return
    }
    try {
      await window.api.pazienti.removeForever(paziente.id)
      toast(`${nome} è stato eliminato per sempre dall'archivio.`)
      onDeleted()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const anni = eta(paziente.data_nascita)
  const dallIntervento = daQuando(paziente.data_intervento)
  const nascita = paziente.data_nascita
    ? `${formatData(paziente.data_nascita)}${anni != null ? ` (${anni} anni)` : ''}`
    : null

  const voci: { etichetta: string; valore: string | null }[] = [
    { etichetta: 'Data di nascita', valore: nascita },
    { etichetta: 'Codice fiscale', valore: paziente.codice_fiscale },
    { etichetta: 'Telefono', valore: paziente.telefono },
    { etichetta: 'E-mail', valore: paziente.email },
    { etichetta: 'Lavoro / Hobby', valore: paziente.lavoro },
    { etichetta: 'Sport', valore: paziente.sport },
    { etichetta: 'Diagnosi', valore: paziente.diagnosi },
    { etichetta: 'Inviato da', valore: paziente.inviato_da },
    { etichetta: 'Tipo di intervento', valore: paziente.tipo_intervento },
    {
      etichetta: 'Data intervento',
      // Come per la data di nascita, accanto alla data c'e' quello che serve
      // davvero saper leggere al volo: a che punto del percorso siamo.
      valore: paziente.data_intervento
        ? `${formatData(paziente.data_intervento)}${
            dallIntervento != null ? ` (${dallIntervento})` : ''
          }`
        : null
    },
    {
      etichetta: 'Lato operato/infortunato',
      valore:
        paziente.arto_operato === 'dx'
          ? 'Destro'
          : paziente.arto_operato === 'sx'
            ? 'Sinistro'
            : null
    }
  ]
  const compilate = voci.filter((v) => v.valore)

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>
          {paziente.cognome} {paziente.nome}
        </h3>
        <span className="row-actions">
          <button title="Esporta la cartella in PDF" onClick={() => setEsporta(true)}>
            <FileDown size={18} />
          </button>
          <button title="Certificato di presenza" onClick={() => setCertificato(true)}>
            <BadgeCheck size={18} />
          </button>
          <button title="Modifica i dati" onClick={() => setModifica(true)}>
            <Pencil size={18} />
          </button>
          <button className="danger" title="Elimina paziente" onClick={() => void elimina()}>
            <Trash2 size={18} />
          </button>
          <button
            className="danger"
            title="Elimina per sempre, senza passare dal cestino"
            onClick={() => void eliminaPerSempre()}
          >
            <Eraser size={18} />
          </button>
        </span>
      </div>

      {compilate.length === 0 ? (
        <p className="hint">Nessun dato inserito: usa la matita qui sopra per aggiungerli.</p>
      ) : (
        <dl className="dati-paziente">
          {compilate.map((v) => (
            <div key={v.etichetta} className="dato">
              <dt>{v.etichetta}</dt>
              <dd>{v.valore}</dd>
            </div>
          ))}
        </dl>
      )}

      {esporta && <EsportaCartella paziente={paziente} onChiudi={() => setEsporta(false)} />}

      {certificato && (
        <CertificatoPaziente
          paziente={paziente}
          onChiudi={(datiCambiati) => {
            setCertificato(false)
            if (datiCambiati) void onChanged()
          }}
        />
      )}

      {modifica && (
        <ModaleDatiPaziente
          paziente={paziente}
          patologie={[]}
          onChiudi={(salvato) => {
            setModifica(false)
            if (salvato) void onChanged()
          }}
        />
      )}
    </section>
  )
}

const VUOTO = {
  nome: '',
  cognome: '',
  data_nascita: '',
  codice_fiscale: '',
  telefono: '',
  email: '',
  lavoro: '',
  inviato_da: '',
  sport: '',
  diagnosi: '',
  precauzioni: '',
  tipo_intervento: '',
  data_intervento: '',
  arto_operato: ''
}

// Stessa finestra per creare un paziente e per modificarlo, cosi' i campi non
// possono divergere fra i due momenti. In creazione compaiono anche patologia e
// fase iniziale; in modifica quelle vivono nella scheda "Percorso riabilitativo".
export function ModaleDatiPaziente({
  paziente,
  patologie,
  onChiudi
}: {
  paziente: PazienteDettaglio | null
  patologie: Patologia[]
  onChiudi: (salvato: boolean, nuovoId?: number) => void
}): React.JSX.Element {
  const nuovo = paziente == null
  const [form, setForm] = useState(
    paziente
      ? {
          nome: paziente.nome,
          cognome: paziente.cognome,
          data_nascita: paziente.data_nascita ?? '',
          codice_fiscale: paziente.codice_fiscale ?? '',
          telefono: paziente.telefono ?? '',
          email: paziente.email ?? '',
          lavoro: paziente.lavoro ?? '',
          inviato_da: paziente.inviato_da ?? '',
          sport: paziente.sport ?? '',
          diagnosi: paziente.diagnosi ?? '',
          precauzioni: paziente.precauzioni ?? '',
          tipo_intervento: paziente.tipo_intervento ?? '',
          data_intervento: paziente.data_intervento ?? '',
          arto_operato: paziente.arto_operato ?? ''
        }
      : { ...VUOTO }
  )
  const [patologiaId, setPatologiaId] = useState<number | ''>('')
  const [faseId, setFaseId] = useState<number | ''>('')
  const [fasi, setFasi] = useState<Fase[]>([])
  const [gruppoId, setGruppoId] = useState<number | ''>(paziente?.gruppo_id ?? '')
  const [gruppi, setGruppi] = useState<Gruppo[]>([])

  useEffect(() => {
    if (patologiaId === '') {
      setFasi([])
      return
    }
    void window.api.fasi.list(patologiaId).then(setFasi)
  }, [patologiaId])

  // Il gruppo compare sempre, anche modificando un paziente esistente: a
  // differenza della patologia non ha effetti a cascata da gestire, quindi
  // l'elenco serve qui una volta sola, senza passarlo da fuori.
  useEffect(() => {
    void window.api.gruppi.list().then(setGruppi)
  }, [])

  const campo =
    (k: keyof typeof form) =>
    (e: { target: { value: string } }): void =>
      setForm({ ...form, [k]: e.target.value })

  const salva = async (): Promise<void> => {
    if (!form.nome.trim() || !form.cognome.trim()) {
      toastErrore('Nome e cognome sono obbligatori.')
      return
    }
    const vuotoNull = (v: string): string | null => v.trim() || null
    const dati: PazienteInput = {
      nome: form.nome,
      cognome: form.cognome,
      data_nascita: form.data_nascita || null,
      codice_fiscale: vuotoNull(form.codice_fiscale)?.toUpperCase() ?? null,
      telefono: vuotoNull(form.telefono),
      email: vuotoNull(form.email),
      lavoro: vuotoNull(form.lavoro),
      inviato_da: vuotoNull(form.inviato_da),
      sport: vuotoNull(form.sport),
      diagnosi: vuotoNull(form.diagnosi),
      precauzioni: vuotoNull(form.precauzioni),
      tipo_intervento: vuotoNull(form.tipo_intervento),
      data_intervento: form.data_intervento || null,
      arto_operato: form.arto_operato === '' ? null : (form.arto_operato as 'dx' | 'sx'),
      gruppo_id: gruppoId === '' ? null : gruppoId
    }
    try {
      if (nuovo) {
        const id = await window.api.pazienti.create({
          ...dati,
          patologia_id: patologiaId === '' ? null : patologiaId,
          fase_corrente_id: faseId === '' ? null : faseId
        })
        onChiudi(true, id)
      } else {
        await window.api.pazienti.update(paziente.id, dati)
        toast('Dati aggiornati.')
        onChiudi(true)
      }
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const anni = eta(form.data_nascita)

  // Creando un paziente nuovo, se non ha ancora un nome un clic fuori (o
  // Invio) chiude e basta, come farebbe "Annulla": non ha senso salvare un
  // paziente senza nome ne' mostrare un errore per un clic finito fuori dalla
  // finestra per sbaglio. Con nome e cognome gia' scritti, o modificando un
  // paziente che li ha gia', si salva come premendo "Salva"/"Crea paziente".
  const chiudiCliccandoFuori = (): void | Promise<void> => {
    if (nuovo && !form.nome.trim() && !form.cognome.trim()) {
      onChiudi(false)
      return
    }
    return salva()
  }

  return (
    <Modale onConferma={chiudiCliccandoFuori}>
        <h3>{nuovo ? 'Nuovo paziente' : 'Dati del paziente'}</h3>

        <div className="form-row-2">
          <label>
            Nome *
            <input autoFocus value={form.nome} onChange={campo('nome')} />
          </label>
          <label>
            Cognome *
            <input value={form.cognome} onChange={campo('cognome')} />
          </label>
        </div>

        <div className="form-row-2">
          <label>
            Data di nascita{anni != null ? ` — ${anni} anni` : ''}
            <input type="date" value={form.data_nascita} onChange={campo('data_nascita')} />
          </label>
          <label>
            Codice fiscale
            <input
              placeholder="es. RSSMRA80A01A662X"
              value={form.codice_fiscale}
              onChange={campo('codice_fiscale')}
            />
          </label>
        </div>

        <div className="form-row-2">
          <label>
            Telefono
            <input value={form.telefono} onChange={campo('telefono')} />
          </label>
          <label>
            E-mail
            <input value={form.email} onChange={campo('email')} />
          </label>
        </div>

        <div className="form-row-2">
          <label>
            Lavoro / Hobby
            <input
              placeholder="es. impiegato, calcio a 5 due volte a settimana"
              value={form.lavoro}
              onChange={campo('lavoro')}
            />
          </label>
          <label>
            Sport
            <input
              placeholder="es. Calcio (portiere)"
              value={form.sport}
              onChange={campo('sport')}
            />
          </label>
        </div>

        <div className="form-row-2">
          <label>
            Gruppo
            <SceltaConRicerca
              voci={gruppi}
              valore={gruppoId}
              segnaposto="— nessun gruppo —"
              vuoto="— nessun gruppo —"
              onCambia={setGruppoId}
            />
          </label>
        </div>

        <div className="sotto-titolo">Quadro clinico</div>

        <label>
          Diagnosi
          <textarea
            rows={1}
            placeholder="Quella del medico o la tua ipotesi"
            value={form.diagnosi}
            onChange={campo('diagnosi')}
          />
        </label>

        {/* Le precauzioni non stanno fra le note: quello che si scrive qui
            compare in cima alla scheda e mentre si compone la seduta, dove non
            si puo' non vederlo. */}
        <label>
          Precauzioni e limiti
          <textarea
            rows={1}
            placeholder="es. non oltre 90° di flessione fino a 6 settimane, carico parziale"
            value={form.precauzioni}
            onChange={campo('precauzioni')}
          />
        </label>

        <div className="form-row-2">
          <label>
            Inviato da
            <input
              placeholder="es. Dott. Bianchi"
              value={form.inviato_da}
              onChange={campo('inviato_da')}
            />
          </label>
          <label>
            Tipo di intervento
            <input
              placeholder="es. Ricostruzione LCA dx"
              value={form.tipo_intervento}
              onChange={campo('tipo_intervento')}
            />
          </label>
        </div>

        <div className="form-row-2">
          <label>
            Data intervento
            <input type="date" value={form.data_intervento} onChange={campo('data_intervento')} />
            {daQuando(form.data_intervento) && (
              <span className="hint-campo">{daQuando(form.data_intervento)} fa</span>
            )}
          </label>
          {/* Serve agli screening: sapendo qual e' il lato interessato il
              confronto fra i due diventa interessato ÷ sano, cioè l'LSI. */}
          <label>
            Lato operato/infortunato
            <select value={form.arto_operato} onChange={campo('arto_operato')}>
              <option value="">— nessuno —</option>
              <option value="dx">Destro</option>
              <option value="sx">Sinistro</option>
            </select>
          </label>
        </div>

        {nuovo && (
          <>
            <div className="sotto-titolo">Percorso riabilitativo</div>
            <div className="form-row-2">
              <label>
                Patologia
                <SceltaConRicerca
                  voci={patologie}
                  valore={patologiaId}
                  segnaposto="— nessuna —"
                  vuoto="— nessuna —"
                  onCambia={(id) => {
                    setPatologiaId(id)
                    setFaseId('')
                  }}
                />
              </label>
              <label>
                Fase iniziale
                <select
                  value={faseId}
                  disabled={patologiaId === ''}
                  onChange={(e) => setFaseId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">— non impostata —</option>
                  {fasi
                    .filter((f) => f.campo !== 1)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button onClick={() => onChiudi(false)}>Annulla</button>
          <button className="primary" onClick={() => void salva()}>
            {nuovo ? 'Crea paziente' : 'Salva'}
          </button>
        </div>
    </Modale>
  )
}
