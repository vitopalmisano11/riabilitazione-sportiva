import { useEffect, useState } from 'react'
import Aiuto from '../components/Aiuto'
import type { Tema } from '../../../shared/temi'
import type { VoceCestino } from '../../../shared/types'
import { TEMI } from '../../../shared/temi'
import PannelloBackup from '../components/PannelloBackup'
import { FolderOpen, Trash2, Undo2 } from 'lucide-react'
import { toast, toastErrore } from '../components/Toast'
import { chiedi } from '../components/Conferma'
import { errMsg } from '../lib'

// Impostazioni dell'app: dove stanno i dati e le copie, la password, il colore.
//
// Prima erano due finestrine appese in fondo alla barra laterale, e il tema non
// c'era. Sono cose che si toccano di rado ma che vanno trovate subito, percio'
// stanno in una sezione sola, a schede, come la configurazione.

// Due sole schede, divise per domanda: "dove stanno le mie cose e come sono al
// sicuro" da una parte, "come si comporta l'app con me" dall'altra. Il cestino
// sta con i dati perche' e' l'ultima rete prima di perderli davvero; il colore
// sta con la password perche' sono tutte e due preferenze tue, non dell'archivio.
type Scheda = 'dati' | 'app'

const SCHEDE: { key: Scheda; label: string }[] = [
  { key: 'dati', label: 'Dati e backup' },
  { key: 'app', label: 'Accesso e aspetto' }
]

export default function ImpostazioniPage({
  tornaAllInizio,
  tema,
  onTema,
  scuro,
  onScuro,
  barraScura,
  onBarraScura
}: {
  tornaAllInizio: number
  tema: Tema
  onTema: (t: Tema) => void
  scuro: boolean
  onScuro: (valore: boolean) => void
  barraScura: boolean
  onBarraScura: (valore: boolean) => void
}): React.JSX.Element {
  const [scheda, setScheda] = useState<Scheda>('dati')

  useEffect(() => {
    if (tornaAllInizio === 0) return
    setScheda('dati')
  }, [tornaAllInizio])

  return (
    <div className="page">
      <header className="page-header">
        <h2>Impostazioni</h2>
      </header>
      <div className="config-tabs config-tabs-top">
        {SCHEDE.map((t) => (
          <button
            key={t.key}
            className={scheda === t.key ? 'active' : ''}
            onClick={() => setScheda(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* .scheda da' il riquadro bianco alle sezioni, come nella scheda del
          paziente: qui dentro ogni pannello e' una card. */}
      <div className="scheda">
        {scheda === 'dati' && <SchedaDati />}
        {scheda === 'app' && (
          <div className="griglia-impostazioni">
            <SchedaPassword />
            {/* Colore e blocco automatico incolonnati: il blocco e' una riga
                sola, e da solo in fondo alla griglia finiva sotto la password,
                lontano da tutto. */}
            <div className="colonna-schede">
              <SchedaAspetto
                tema={tema}
                onTema={onTema}
                scuro={scuro}
                onScuro={onScuro}
                barraScura={barraScura}
                onBarraScura={onBarraScura}
              />
              <SchedaBlocco />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SchedaDati(): React.JSX.Element {
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
      <div className="griglia-impostazioni">
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

      <PannelloBackup />

      <div className="stacco-cestino">
        <SchedaCestino />
      </div>

      {/* Il registro serve quando qualcosa va storto: dentro ci sono solo il
          nome dell'operazione e l'errore, nessun dato dei pazienti. */}
      <div className="blocco-impostazione">
        <div className="sotto-titolo">
          Registro degli errori
          <Aiuto testo="Ogni errore dell'app lascia una riga in un file di testo, con la data e il punto in cui è successo. Contiene solo messaggi tecnici, nessun dato dei pazienti: serve a capire cosa si è rotto anche a giorni di distanza." />
        </div>
        <div className="modal-actions">
          <button onClick={() => void window.api.registro.apri()}>
            <FolderOpen size={16} /> Apri il registro
          </button>
        </div>
      </div>
    </section>
  )
}

// Quello che hai eliminato di recente, con il pulsante per rimetterlo dov'era.
// Dopo un mese si svuota da solo: e' una rete per gli sbagli di ieri, non un
// secondo archivio.
function SchedaCestino(): React.JSX.Element {
  const [voci, setVoci] = useState<VoceCestino[]>([])

  const carica = (): void => {
    void window.api.cestino
      .list()
      .then(setVoci)
      .catch((e) => toastErrore(errMsg(e)))
  }

  useEffect(carica, [])

  const rimetti = async (v: VoceCestino): Promise<void> => {
    try {
      await window.api.cestino.ripristina(v.id)
      toast(`${v.etichetta} è tornato al suo posto.`)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const butta = async (v: VoceCestino): Promise<void> => {
    if (!(await chiedi(`Eliminare definitivamente “${v.etichetta}”? Non si torna indietro.`))) {
      return
    }
    try {
      await window.api.cestino.svuota(v.id)
      carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const quando = (iso: string): string => {
    const d = new Date(iso)
    return `${d.toLocaleDateString('it-IT')} alle ${d.toLocaleTimeString('it-IT').slice(0, 5)}`
  }

  // Chiuso finche' non serve: quasi sempre e' vuoto, e da aperto occuperebbe
  // mezza schermata per niente.
  return (
    <details className="blocco-apribile blocco-cestino">
      <summary>
        Cestino{voci.length > 0 ? ` (${voci.length})` : ' — vuoto'}
      </summary>
      <div className="contenuto-apribile">
      {voci.length > 0 && (
        <div className="modal-actions">
          <button
            className="danger"
            onClick={() =>
              void (async () => {
                if (!(await chiedi('Svuotare il cestino? Non si torna indietro.'))) return
                await window.api.cestino.svuota()
                carica()
              })()
            }
          >
            <Trash2 size={16} /> Svuota il cestino
          </button>
        </div>
      )}
      {voci.length === 0 ? (
        <p className="hint">
          Quello che elimini finisce qui e resta un mese, poi se ne va da solo.
        </p>
      ) : (
        <ul className="sedute-list">
          {voci.map((v) => (
            <li key={v.id}>
              <div className="seduta-info">
                <span className="seduta-data">{v.etichetta}</span>
                <span className="seduta-meta">
                  {v.tipo} · eliminato il {quando(v.quando)} ·{' '}
                  {v.righe === 1 ? '1 riga' : `${v.righe} righe`}
                </span>
              </div>
              <span className="row-actions">
                <button onClick={() => void rimetti(v)}>
                  <Undo2 size={16} /> Rimetti a posto
                </button>
                <button className="danger" title="Elimina definitivamente" onClick={() => void butta(v)}>
                  <Trash2 size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      </div>
    </details>
  )
}

function SchedaPassword(): React.JSX.Element {
  const [vecchia, setVecchia] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState('')

  const salva = async (): Promise<void> => {
    setErrore('')
    if (nuova.length < 8) {
      setErrore('La nuova password deve avere almeno 8 caratteri.')
      return
    }
    if (nuova !== conferma) {
      setErrore('Le nuove password non coincidono.')
      return
    }
    try {
      await window.api.auth.cambiaPassword(vecchia, nuova)
      toast('Password aggiornata. La chiave di recupero resta valida.')
      setVecchia('')
      setNuova('')
      setConferma('')
    } catch (e) {
      setErrore(errMsg(e))
    }
  }

  return (
    <section className="card single-col">
      <div className="sotto-titolo">
        Cambia password
        <Aiuto testo="La chiave di recupero non cambia: quella che hai messo da parte al primo avvio resta valida." />
      </div>
      <label>
        Password attuale
        <input type="password" value={vecchia} onChange={(e) => setVecchia(e.target.value)} />
      </label>
      <label>
        Nuova password (min 8 caratteri)
        <input type="password" value={nuova} onChange={(e) => setNuova(e.target.value)} />
      </label>
      <label>
        Conferma nuova password
        <input type="password" value={conferma} onChange={(e) => setConferma(e.target.value)} />
      </label>
      {errore && <p className="auth-error">{errore}</p>}
      <div className="modal-actions">
        <button className="primary" onClick={() => void salva()}>
          Salva
        </button>
      </div>
    </section>
  )
}

// Blocco automatico: l'app torna alla password dopo un po' che non la tocchi.
// Sta accanto al cambio password perche' e' la stessa domanda — chi puo' entrare
// — vista da due parti.
function SchedaBlocco(): React.JSX.Element {
  const [attivo, setAttivo] = useState(false)
  const [minuti, setMinuti] = useState(15)

  useEffect(() => {
    void window.api.sicurezza.blocco().then((b) => {
      setAttivo(b.attivo)
      setMinuti(b.minuti)
    })
  }, [])

  const salva = (nuovo: { attivo: boolean; minuti: number }): void => {
    setAttivo(nuovo.attivo)
    setMinuti(nuovo.minuti)
    window.api.sicurezza.setBlocco(nuovo).catch((e) => toastErrore(errMsg(e)))
  }

  return (
    <section className="card single-col">
      <label className="riga-interruttore">
        <span className="nome-interruttore">
          Blocco automatico
          <Aiuto testo="Dopo un po' che non tocchi niente, l'app torna alla schermata della password. Il lavoro aperto resta dov'è: per riprendere basta riscriverla." />
        </span>
        <input
          type="checkbox"
          checked={attivo}
          onChange={(e) => salva({ attivo: e.target.checked, minuti })}
        />
      </label>
      {attivo && (
        <label className="campo-copie">
          Dopo quanti minuti
          <input
            type="number"
            min={1}
            max={240}
            value={minuti}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n) && n >= 1) salva({ attivo, minuti: n })
            }}
          />
        </label>
      )}
    </section>
  )
}

function SchedaAspetto({
  tema,
  onTema,
  scuro,
  onScuro,
  barraScura,
  onBarraScura
}: {
  tema: Tema
  onTema: (t: Tema) => void
  scuro: boolean
  onScuro: (valore: boolean) => void
  barraScura: boolean
  onBarraScura: (valore: boolean) => void
}): React.JSX.Element {
  return (
    <section className="card single-col">
      <div className="sotto-titolo">
        Colore dell&apos;app
        <Aiuto testo="Il colore cambia subito, e vale anche per i documenti che stampi: intestazioni delle sezioni e righe dei titoli nelle tabelle." />
      </div>
      <div className="scelta-tema">
        {TEMI.map((t) => (
          <button
            key={t.valore}
            className={tema === t.valore ? 'scelta-attiva' : ''}
            onClick={() => onTema(t.valore)}
          >
            <span className="pallino-tema" style={{ background: t.colore }} />
            {t.etichetta}
          </button>
        ))}
      </div>

      {/* Prima la barra scura era una caratteristica del blu: gli altri due
          colori non potevano averla, e il blu non poteva farne a meno. Adesso
          e' una scelta a se', valida con qualunque colore. */}
      <label className="riga-interruttore riga-staccata">
        <span className="nome-interruttore">
          Colonna laterale scura
          <Aiuto testo="La striscia con i pulsanti delle sezioni, a sinistra: scura stacca di più dal contenuto, chiara è più leggera. Il colore che hai scelto resta quello." />
        </span>
        <input
          type="checkbox"
          checked={barraScura}
          onChange={(e) => onBarraScura(e.target.checked)}
        />
      </label>

      {/* La modalita' scura non e' una tavolozza a parte: si accende sopra a
          quella scelta, e sta nello stesso riquadro perche' e' la stessa
          domanda — che aspetto ha l'app. */}
      <label className="riga-interruttore riga-luce">
        <span className="nome-interruttore">
          Modalità scura
          <Aiuto testo="Fondi scuri e scritte chiare, con il colore che hai scelto. I documenti che stampi restano chiari: vanno sulla carta." />
        </span>
        <input type="checkbox" checked={scuro} onChange={(e) => onScuro(e.target.checked)} />
      </label>
    </section>
  )
}


