import { useEffect, useState } from 'react'
import Aiuto from '../../components/Aiuto'
import type { EsitoArchivio } from '../../../../shared/types'
import PannelloBackup from '../../components/PannelloBackup'
import GuidaDati from '../../components/GuidaDati'
import { BookOpen, FolderOpen, ShieldCheck } from 'lucide-react'
import { toast, toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'
import { SchedaCestino } from './SchedaCestino'

export function SchedaDati(): React.JSX.Element {
  const [guida, setGuida] = useState(false)
  const [esitoArchivio, setEsitoArchivio] = useState<EsitoArchivio | null>(null)
  const [inCorso, setInCorso] = useState(false)

  const controlla = async (): Promise<void> => {
    setInCorso(true)
    try {
      setEsitoArchivio(await window.api.archivio.controlla())
    } catch (e) {
      setEsitoArchivio({ ok: false, messaggio: errMsg(e), pazienti: 0, sedute: 0 })
    } finally {
      setInCorso(false)
    }
  }

  const [cartella, setCartella] = useState('')
  const [cartellaExport, setCartellaExport] = useState('')

  useEffect(() => {
    void window.api.impostazioni.info().then((i) => {
      setCartella(i.cartella)
      setCartellaExport(i.cartellaExport)
    })
  }, [])

  const cambiaDati = async (): Promise<void> => {
    try {
      const nuova = await window.api.impostazioni.cambiaCartella()
      if (nuova) {
        setCartella(nuova)
        toast('Dati spostati nella nuova cartella.')
      }
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const cambiaExport = async (): Promise<void> => {
    try {
      const nuova = await window.api.impostazioni.cambiaCartellaExport()
      if (nuova) setCartellaExport(nuova)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      {/* Prima le copie di sicurezza: sono la cosa che conta, e prima stavano
          in mezzo. Poi dove vivono i file, e in fondo le cose che si toccano
          solo quando qualcosa non va. */}
      <PannelloBackup />

      <div className="griglia-impostazioni stacco-blocco">
      <div className="blocco-impostazione">
        <div className="sotto-titolo">
          Cartella dei dati
          <Aiuto testo="Tutti i tuoi dati vivono qui: riabilitazione.db (il database cifrato) e auth.json (le chiavi di accesso). Servono entrambi: senza auth.json il database non è apribile." />
        </div>
        <div className="cartella-path">{cartella}</div>
        <div className="modal-actions">
          <button onClick={() => void window.api.impostazioni.apriCartella()}>Apri cartella</button>
          <button onClick={() => void cambiaDati()}>Cambia cartella…</button>
        </div>
      </div>

      <div className="blocco-impostazione">
        <div className="sotto-titolo">
          Cartella per gli export
          <Aiuto testo="Dove l'app propone di salvare quando esporti una seduta o uno storico. Puoi cambiarla di volta in volta nella finestra di salvataggio: l'ultima cartella usata viene ricordata." />
        </div>
        <div className="cartella-path">{cartellaExport}</div>
        <div className="modal-actions">
          <button onClick={() => void cambiaExport()}>Cambia cartella…</button>
        </div>
      </div>
      </div>

      <div className="stacco-blocco">
        <SchedaCestino />
      </div>

      {/* Le due cose che si toccano solo quando qualcosa non torna, insieme in
          un riquadro solo: il controllo dell'archivio e il registro. */}
      <div className="blocco-impostazione stacco-blocco">
        <div className="sotto-titolo">Quando qualcosa non va</div>
        <div className="riga-interruttore">
          <span className="nome-interruttore">
            Controllo dell&apos;archivio
            <Aiuto testo="Controlla che il file dell'archivio non si sia rovinato e che i collegamenti fra le schede siano interi. È il controllo da fare dopo uno spegnimento brutto del computer, o quando qualcosa non torna." />
          </span>
          <span className="regola-ingrandimento">
            <button disabled={inCorso} onClick={() => void controlla()}>
              <ShieldCheck size={16} /> {inCorso ? 'Controllo…' : 'Controlla'}
            </button>
          </span>
        </div>
        {esitoArchivio && (
          <span
            className={esitoArchivio.ok ? 'esito-copia esito-buono' : 'esito-copia esito-guasto'}
          >
            {esitoArchivio.ok
              ? `Tutto in ordine — ${esitoArchivio.pazienti} pazienti, ${esitoArchivio.sedute} sedute.`
              : esitoArchivio.messaggio}
          </span>
        )}

        <div className="riga-interruttore riga-staccata">
          <span className="nome-interruttore">
            Registro degli errori
            <Aiuto testo="Ogni errore dell'app lascia una riga in un file di testo, con la data e il punto in cui è successo. Contiene solo messaggi tecnici, nessun dato dei pazienti: serve a capire cosa si è rotto anche a giorni di distanza." />
          </span>
          <span className="regola-ingrandimento">
            <button onClick={() => void window.api.registro.apri()}>
              <FolderOpen size={16} /> Apri il registro
            </button>
          </span>
        </div>
      </div>

      {/* In fondo, dove uno arriva dopo aver visto i pulsanti e si e' chiesto
          cosa fa ognuno: la spiegazione di tutti, in una finestra sola. */}
      <div className="modal-actions riga-guida">
        <button onClick={() => setGuida(true)}>
          <BookOpen size={16} /> Come vengono conservati i miei dati?
        </button>
      </div>

      {guida && <GuidaDati onChiudi={() => setGuida(false)} />}
    </section>
  )
}
