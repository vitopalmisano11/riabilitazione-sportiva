import { useEffect, useRef, useState } from 'react'
import type { AnamnesiProssima as Dati, AttivitaPartecipazione } from '../../../shared/types'
import { toastErrore } from './Toast'
import Modale from './Modale'
import { chiediUscita } from '../modificheInCorso'
import { errMsg } from '../lib'
import { useScorciatoie } from '../scorciatoie'
import { useSalvaUscendo } from '../salvaUscendo'
import IndicatoreSalvataggio from './IndicatoreSalvataggio'
import { TIPI_NEURO, tipiNeuro } from '../../../shared/sintomi'
import { ListaSintomi } from './anamnesi/ListaSintomi'
import { Grafici } from './anamnesi/Grafici'
import { Scelta } from './anamnesi/Campi'

// Colloquio con il paziente: nessun campo obbligatorio e nessun ordine da
// seguire. Tutto sta in una schermata sola, cosi' se il paziente anticipa una
// risposta la si scrive subito. Il salvataggio e' automatico: durante il
// colloquio non c'e' un pulsante da ricordare.
const ATTESA_SALVATAGGIO = 1500

const VUOTO: Dati = {
  motivo_consulto: null,
  notturno_sn: null,
  dolore_notturno: null,
  sonno_sn: null,
  disturbi_sonno: null,
  neuro_sn: null,
  neuro_tipi: null,
  tosse_starnuto: null,
  sintomi_neurologici: null,
  relazione_sintomi: null,
  note: null,
  note_giorno: null,
  note_esordio: null,
  sintomi: []
}



export default function AnamnesiProssima({
  pazienteId,
  onChiudi
}: {
  pazienteId: number
  onChiudi: () => void
}): React.JSX.Element {
  const [dati, setDati] = useState<Dati | null>(null)
  const [stato, setStato] = useState<'fermo' | 'salvo' | 'salvato' | 'errore'>('fermo')
  const [errore, setErrore] = useState<string | null>(null)
  // Il salvataggio aspetta un secondo e mezzo dall'ultima lettera: chiudendo
  // il programma in quel mezzo, quello che resta si salva subito.
  const salvaAllaChiusura = useSalvaUscendo(stato === 'salvo' || stato === 'errore')
  useScorciatoie([{ tasto: 'Escape', azione: () => chiudi() }])
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
  salvaAllaChiusura.current = () => salvaSubito()
  const salvaSubito = async (): Promise<boolean> => {
    const d = daSalvare.current
    const a = attivitaDaSalvare.current
    if (!d && !a) return true
    daSalvare.current = null
    attivitaDaSalvare.current = null
    setStato('salvo')
    try {
      if (d) await window.api.anamnesi.salva(pazienteId, d)
      if (a) await window.api.anamnesi.salvaAttivita(pazienteId, a)
      setStato('salvato')
      return true
    } catch (e) {
      // Quello che non e' andato si rimette in attesa (a meno che nel frattempo
      // si sia scritto altro, che e' piu' nuovo): chiudendo, o al prossimo
      // tentativo, si riprova, invece di darlo per salvato.
      daSalvare.current ??= d
      attivitaDaSalvare.current ??= a
      setStato('errore')
      setErrore(errMsg(e))
      toastErrore(errMsg(e))
      return false
    }
  }

  const programmaSalvataggio = (): void => {
    setStato('salvo')
    if (attesa.current) clearTimeout(attesa.current)
    attesa.current = setTimeout(() => void salvaSubito(), ATTESA_SALVATAGGIO)
  }

  useEffect(() => {
    return () => {
      // Chiudendo la scheda (o cambiando paziente) il componente si smonta
      // subito, prima che il secondo e mezzo sia passato: senza questo,
      // l'ultima frase scritta andava persa in silenzio, perche' il
      // salvataggio in attesa veniva solo annullato. Qui invece si esegue,
      // senza toccare lo stato del componente: non c'e' piu'.
      if (!attesa.current) return
      clearTimeout(attesa.current)
      const d = daSalvare.current
      const a = attivitaDaSalvare.current
      daSalvare.current = null
      attivitaDaSalvare.current = null
      if (d) void window.api.anamnesi.salva(pazienteId, d).catch((e) => toastErrore(errMsg(e)))
      if (a)
        void window.api.anamnesi
          .salvaAttivita(pazienteId, a)
          .catch((e) => toastErrore(errMsg(e)))
    }
  }, [pazienteId])

  // Definita prima del controllo sul caricamento qui sotto: la scorciatoia Esc
  // e' gia' collegata mentre i dati stanno ancora arrivando, e deve trovarla.
  const chiudi = (): void => {
    if (attesa.current) clearTimeout(attesa.current)
    void salvaSubito().then(async (ok) => {
      if (ok || (await chiediUscita())) onChiudi()
    })
  }

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

  const campo =
    (k: keyof Omit<Dati, 'sintomi'>) =>
    (e: { target: { value: string } }): void =>
      aggiorna({ [k]: e.target.value || null } as Partial<Dati>)

  return (
    <Modale className="modal-lg" onConferma={chiudi}>
        <div className="card-header-row">
          <h3>Anamnesi prossima</h3>
          {/* qui si salva da solo mentre si scrive: l'indicatore e' lo stesso
              delle altre schede (vedi salvataggio.ts) */}
          <IndicatoreSalvataggio stato={stato === 'fermo' ? 'pulito' : stato} errore={errore} />
        </div>

        <label>
          Motivo del consulto, con le parole del paziente
          {/* Piu' alta delle altre: qui si trascrive quello che dice il
              paziente, e sono righe intere, non due parole. */}
          <textarea
            rows={5}
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
        {/* Si' o no con un clic, e accanto il dettaglio se serve: la relazione
            scritta cosi' dice "riferisce" o "nega" senza indovinare. */}
        <div className="form-row-2">
          <div className="domanda-sino">
            <span className="nome-domanda">Dolore o sintomi notturni</span>
            <Scelta
              etichette={[
                ['1', 'Sì'],
                ['0', 'No']
              ]}
              valore={dati.notturno_sn == null ? null : String(dati.notturno_sn)}
              onScegli={(v) => aggiorna({ notturno_sn: v == null ? null : (Number(v) as 0 | 1) })}
            />
            <input
              placeholder="Dettagli (facoltativo)"
              value={dati.dolore_notturno ?? ''}
              onChange={campo('dolore_notturno')}
            />
          </div>
          <div className="domanda-sino">
            <span className="nome-domanda">Disturbi del sonno</span>
            <Scelta
              etichette={[
                ['1', 'Sì'],
                ['0', 'No']
              ]}
              valore={dati.sonno_sn == null ? null : String(dati.sonno_sn)}
              onScegli={(v) => aggiorna({ sonno_sn: v == null ? null : (Number(v) as 0 | 1) })}
            />
            <input
              placeholder="Dettagli (facoltativo)"
              value={dati.disturbi_sonno ?? ''}
              onChange={campo('disturbi_sonno')}
            />
          </div>
        </div>
        {/* Si' o no; con il si' compaiono i tipi, che si possono scegliere
            anche insieme. Con il no la domanda resta di una riga. */}
        <div className="domanda-neuro">
          <span className="nome-domanda">Sintomi neurologici</span>
          <Scelta
            etichette={[
              ['1', 'Sì'],
              ['0', 'No']
            ]}
            valore={dati.neuro_sn == null ? null : String(dati.neuro_sn)}
            onScegli={(v) => aggiorna({ neuro_sn: v == null ? null : (Number(v) as 0 | 1) })}
          />
          {dati.neuro_sn === 1 && (
            <span className="scelte-multiple">
              {TIPI_NEURO.map((t) => {
                const scelti = tipiNeuro(dati.neuro_tipi)
                const dentro = scelti.includes(t.valore)
                return (
                  <button
                    key={t.valore}
                    type="button"
                    className={dentro ? 'scelta-attiva' : ''}
                    onClick={() => {
                      const nuovi = dentro
                        ? scelti.filter((x) => x !== t.valore)
                        : [...scelti, t.valore]
                      aggiorna({ neuro_tipi: nuovi.length > 0 ? nuovi.join(',') : null })
                    }}
                  >
                    {t.pulsante}
                  </button>
                )
              })}
            </span>
          )}
          <input
            placeholder="Sede o dettagli (facoltativo)"
            value={dati.sintomi_neurologici ?? ''}
            onChange={campo('sintomi_neurologici')}
          />
        </div>

        {/* Tosse e starnuto non si chiedono piu' qui: se servono, stanno in
            "Cosa lo aggrava". Chi li aveva gia' scritti continua a vederli. */}
        {dati.tosse_starnuto && (
          <label>
            Tosse o starnuto
            <input value={dati.tosse_starnuto ?? ''} onChange={campo('tosse_starnuto')} />
          </label>
        )}
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
        {/* Le tre caselle una sotto l'altra: sono tre risposte alla stessa
            domanda e affiancarne due faceva sembrare la prima diversa dalle
            altre. */}
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

        <div className="modal-actions">
          <button className="primary" onClick={chiudi}>
            Chiudi
          </button>
        </div>
    </Modale>
  )
}
