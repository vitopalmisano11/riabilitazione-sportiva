import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  HeartPulse,
  Settings,
  SlidersHorizontal,
  Users
} from 'lucide-react'
import PatologiePage from './pages/PatologiePage'
import GruppiPage from './pages/GruppiPage'
import EserciziPage from './pages/EserciziPage'
import QuestionariPage from './pages/QuestionariPage'
import TestValutazionePage from './pages/TestValutazionePage'
import ProtocolliScreeningPage from './pages/ProtocolliScreeningPage'
import ScreeningRtpPage from './pages/ScreeningRtpPage'
import DistrettiPage from './pages/DistrettiPage'
import PazientiPage from './pages/PazientiPage'
import FollowUpPage from './pages/FollowUpPage'
import SettimanaPage from './pages/SettimanaPage'
import ImpostazioniPage from './pages/ImpostazioniPage'
import AuthGate from './components/AuthGate'
import SchermoBloccato from './components/SchermoBloccato'
import ToastHost, { toastErrore } from './components/Toast'
import ConfermaHost from './components/Conferma'
import { errMsg, oggiIso } from './lib'
import type { Tema } from '../../shared/temi'

type Sezione =
  | 'settimana'
  | 'pazienti'
  | 'followup'
  | 'screening'
  | 'configurazione'
  | 'impostazioni'

type TabConfig =
  | 'patologie'
  | 'distretti'
  | 'esercizi'
  | 'questionari'
  | 'testValutazione'
  | 'screening'
  | 'gruppi'

const TAB_CONFIG: { key: TabConfig; label: string }[] = [
  { key: 'patologie', label: 'Patologie e fasi' },
  { key: 'distretti', label: 'Distretti' },
  { key: 'esercizi', label: 'Libreria esercizi' },
  { key: 'questionari', label: 'Questionari' },
  { key: 'testValutazione', label: 'Test di valutazione' },
  { key: 'screening', label: 'Screening' },
  { key: 'gruppi', label: 'Gruppi' }
]

export default function App(): React.JSX.Element {
  const [sbloccata, setSbloccata] = useState(false)
  // Si apre sulla settimana: la prima domanda della giornata e' chi viene oggi.
  const [sezione, setSezione] = useState<Sezione>('settimana')
  // Il tema scelto: si applica mettendolo sull'elemento radice, e il foglio di
  // stile ridichiara i suoi colori. Arriva dal file delle impostazioni, cosi'
  // resta anche al riavvio, e lo conoscono anche i documenti stampati.
  const [tema, setTema] = useState<Tema>('verde')
  // scuro: com'e' adesso; modoScuro: la scelta (chiara, scura, a orari fissi)
  const [scuro, setScuro] = useState(false)
  const [modoScuro, setModoScuro] = useState<'chiaro' | 'scuro' | 'orari'>('chiaro')
  const [orariScuro, setOrariScuro] = useState({ dalle: '20:00', alle: '07:00' })
  const [barraScura, setBarraScura] = useState(false)
  const [ingrandimento, setIngrandimento] = useState(1)

  // Il ponte applica gia' i colori prima che la pagina compaia: qui si legge lo
  // stesso valore solo per sapere cosa mostrare come scelto in Impostazioni.
  useEffect(() => {
    window.api.impostazioni
      .info()
      .then((i) => {
        setTema(i.tema)
        setScuro(i.scuroAdesso)
        setModoScuro(i.orariScuro.automatico ? 'orari' : i.scuro ? 'scuro' : 'chiaro')
        setOrariScuro({ dalle: i.orariScuro.dalle, alle: i.orariScuro.alle })
        setBarraScura(i.barraScura)
        setIngrandimento(i.ingrandimento)
      })
      .catch(() => undefined)
  }, [])

  const scegliTema = (t: Tema): void => {
    setTema(t)
    document.documentElement.dataset.tema = t
    window.api.impostazioni.setTema(t).catch((e) => toastErrore(errMsg(e)))
  }

  // La barra laterale chiara o scura: era una caratteristica del colore (il blu
  // ce l'aveva scura), adesso e' una scelta a se' che vale con tutti i colori.
  // L'ingrandimento lo applica il ponte alla finestra: qui si tiene solo il
  // numero da mostrare nelle impostazioni.
  const scegliIngrandimento = (valore: number): void => {
    setIngrandimento(valore)
    window.api.impostazioni.setIngrandimento(valore).catch((e) => toastErrore(errMsg(e)))
  }

  const scegliBarraScura = (valore: boolean): void => {
    setBarraScura(valore)
    document.documentElement.dataset.barra = valore ? 'scura' : 'chiara'
    window.api.impostazioni.setBarraScura(valore).catch((e) => toastErrore(errMsg(e)))
  }

  // Blocco automatico: dopo i minuti impostati senza toccare niente, l'app
  // torna alla schermata della password. Il database resta aperto — si chiede
  // solo di riconoscersi — cosi' rientrare e' immediato e non si perde niente.
  const [bloccata, setBloccata] = useState(false)

  useEffect(() => {
    if (!sbloccata || bloccata) return
    let scadenza: NodeJS.Timeout | null = null
    let minuti = 0
    const riparti = (): void => {
      if (scadenza) clearTimeout(scadenza)
      if (minuti > 0) scadenza = setTimeout(() => setBloccata(true), minuti * 60 * 1000)
    }
    const eventi = ['mousedown', 'keydown', 'wheel', 'mousemove'] as const
    void window.api.sicurezza.blocco().then((b) => {
      if (!b.attivo) return
      minuti = b.minuti
      riparti()
      for (const e of eventi) window.addEventListener(e, riparti)
    })
    return () => {
      if (scadenza) clearTimeout(scadenza)
      for (const e of eventi) window.removeEventListener(e, riparti)
    }
  }, [sbloccata, bloccata])

  const applicaScuro = (valore: boolean): void => {
    setScuro(valore)
    if (valore) document.documentElement.dataset.scuro = 'si'
    else delete document.documentElement.dataset.scuro
  }

  const scegliScuro = async (
    modo: 'chiaro' | 'scuro' | 'orari',
    orari = orariScuro
  ): Promise<void> => {
    setModoScuro(modo)
    setOrariScuro(orari)
    try {
      if (modo === 'orari') {
        await window.api.impostazioni.setScuroAutomatico(orari.dalle, orari.alle)
        applicaScuro((await window.api.impostazioni.info()).scuroAdesso)
      } else {
        applicaScuro(modo === 'scuro')
        await window.api.impostazioni.setScuro(modo === 'scuro')
      }
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Il ponte cambia i colori all'ora giusta; qui si tiene allineato quello che
  // mostrano le impostazioni.
  useEffect(() => {
    const t = setInterval(() => setScuro(document.documentElement.dataset.scuro === 'si'), 60_000)
    return () => clearInterval(t)
  }, [])
  // Ripremere la voce della sezione in cui si e' gia' significa "torna alla
  // prima pagina di questa sezione". Da qui non si puo' azzerare cosa c'e'
  // aperto dentro una pagina: le si manda un contatore, e a ogni scatto lei
  // torna al suo elenco. Ne basta uno per tutte: la pagina che lo riceve e'
  // sempre e solo quella visibile.
  const [tornaAllElenco, setTornaAllElenco] = useState(0)

  // Il numerino accanto a "Follow-up": quanti pazienti hanno la data per
  // risentirli oggi o gia' passata. Si rilegge cambiando sezione, quando la
  // pagina del follow-up cambia qualcosa e ogni dieci minuti (a mezzanotte
  // cambia il giorno).
  const [daSentire, setDaSentire] = useState(0)
  const contaDaSentire = (): void => {
    window.api.followUp
      .list()
      .then(({ concluso }) => {
        const oggi = oggiIso()
        setDaSentire(concluso.filter((p) => p.follow_up_il != null && p.follow_up_il <= oggi).length)
      })
      .catch(() => {})
  }
  useEffect(() => {
    if (!sbloccata) return
    contaDaSentire()
    const t = setInterval(contaDaSentire, 600_000)
    return () => clearInterval(t)
  }, [sbloccata, sezione, tornaAllElenco])

  // Premere una voce del menu riporta sempre alla prima pagina di quella
  // sezione, anche arrivando da un'altra: se stavi dentro a una scheda o a una
  // seduta, esci. Prima il segnale partiva solo ripremendo la voce in cui gia'
  // eri, e cambiando sezione ci si ritrovava dentro a quello che si era lasciato
  // aperto la volta prima.
  const vaiA = (s: Sezione): void => {
    setSezione(s)
    setTornaAllElenco((n) => n + 1)
    // Si dimentica anche il paziente che si era chiesto di aprire da un'altra
    // sezione. Restava li' anche dopo, e siccome la pagina dei pazienti la si
    // chiude e riapre passando da un'altra voce del menu, quella richiesta
    // vecchia veniva eseguita di nuovo: si premeva "Pazienti" e si
    // finiva dentro alla scheda dell'ultimo paziente invece che nell'elenco.
    setApriPaziente(null)
    setTornaA(null)
  }
  // Richiesta di aprire la scheda di un paziente da un'altra sezione. Il numero
  // progressivo serve a far scattare l'apertura anche se si richiede due volte
  // lo stesso paziente.
  const [apriPaziente, setApriPaziente] = useState<{
    id: number
    // Se c'e', si apre direttamente quella seduta invece della sola scheda.
    sedutaId?: number
    // Se c'e', si apre una seduta nuova copiata da questa, nel giorno data.
    duplicaDa?: number
    // Una seduta nuova da zero, nel giorno data.
    nuova?: boolean
    data?: string
    seq: number
  } | null>(null)

  const vaiAlPaziente = (id: number): void => {
    setSezione('pazienti')
    setApriPaziente((p) => ({ id, seq: (p?.seq ?? 0) + 1 }))
  }

  // Da dove si e' arrivati alla seduta: chiudendola si torna li'.
  const [tornaA, setTornaA] = useState<Sezione | null>(null)

  const vaiAllaSeduta = (id: number, sedutaId: number, da: Sezione): void => {
    setTornaA(da)
    setSezione('pazienti')
    setApriPaziente((p) => ({ id, sedutaId, seq: (p?.seq ?? 0) + 1 }))
  }

  // Una seduta nuova copiata da un'altra, in un altro giorno: salvata o chiusa,
  // si torna da dove si e' partiti.
  const nuovaSeduta = (id: number, data: string, da: Sezione): void => {
    setTornaA(da)
    setSezione('pazienti')
    setApriPaziente((p) => ({ id, nuova: true, data, seq: (p?.seq ?? 0) + 1 }))
  }

  const copiaSeduta = (id: number, sedutaId: number, data: string, da: Sezione): void => {
    setTornaA(da)
    setSezione('pazienti')
    setApriPaziente((p) => ({ id, duplicaDa: sedutaId, data, seq: (p?.seq ?? 0) + 1 }))
  }

  if (!sbloccata) {
    return <AuthGate onUnlocked={() => setSbloccata(true)} />
  }

  if (bloccata) {
    return <SchermoBloccato onSbloccato={() => setBloccata(false)} />
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>
          <span className="logo-badge">
            <HeartPulse size={20} />
          </span>
          Fisioterapia
        </h1>
        <nav>
          {/* Per prima: e' la schermata del lunedi' mattina, quella che
              risponde a "oggi chi viene". */}
          <button
            className={sezione === 'settimana' ? 'active' : ''}
            onClick={() => vaiA('settimana')}
          >
            <CalendarDays size={18} />
            La settimana
          </button>
          <button
            className={sezione === 'pazienti' ? 'active' : ''}
            onClick={() => vaiA('pazienti')}
          >
            <Users size={18} />
            Pazienti
          </button>
          <button
            className={sezione === 'followup' ? 'active' : ''}
            onClick={() => vaiA('followup')}
          >
            <CalendarClock size={18} />
            Follow-up
            {daSentire > 0 && (
              <span
                className="conta-menu"
                title={daSentire === 1 ? '1 paziente da sentire' : `${daSentire} pazienti da sentire`}
              >
                {daSentire}
              </span>
            )}
          </button>
          <button
            className={sezione === 'screening' ? 'active' : ''}
            onClick={() => vaiA('screening')}
          >
            <ClipboardCheck size={18} />
            Return To Play
          </button>
        </nav>
        <div className="sidebar-footer">
          <button
            className={sezione === 'configurazione' ? 'active' : ''}
            onClick={() => vaiA('configurazione')}
          >
            <Settings size={17} />
            Configurazione
          </button>
          {/* Dati e backup, password e colore stanno insieme qui: si toccano di
              rado, e prima erano finestrine appese al menu. */}
          <button
            className={sezione === 'impostazioni' ? 'active' : ''}
            onClick={() => vaiA('impostazioni')}
          >
            <SlidersHorizontal size={17} />
            Impostazioni
          </button>
        </div>
      </aside>
      <main className="content">
        {/* la chiave cambia con la sezione: la pagina nuova entra con la sua
            dissolvenza */}
        <div key={sezione} className="entrata-pagina">
        {sezione === 'settimana' && (
          <SettimanaPage
            onApriPaziente={vaiAlPaziente}
            onApriSeduta={(id, sedutaId) => vaiAllaSeduta(id, sedutaId, 'settimana')}
            onCopiaSeduta={(id, sedutaId, data) => copiaSeduta(id, sedutaId, data, 'settimana')}
            onNuovaSeduta={(id, data) => nuovaSeduta(id, data, 'settimana')}
            tornaAllElenco={tornaAllElenco}
          />
        )}
        {sezione === 'pazienti' && (
          <PazientiPage
            tornaAllElenco={tornaAllElenco}
            apriPaziente={apriPaziente}
            onEsciDallaSeduta={() => {
              if (tornaA) setSezione(tornaA)
              setTornaA(null)
            }}
          />
        )}
        {sezione === 'followup' && (
          <FollowUpPage
            onApriPaziente={vaiAlPaziente}
            ricarica={tornaAllElenco}
            onCambiato={contaDaSentire}
          />
        )}
        {sezione === 'screening' && <ScreeningRtpPage tornaAllElenco={tornaAllElenco} />}
        {sezione === 'configurazione' && <ConfigurazionePage tornaAllInizio={tornaAllElenco} />}
        {sezione === 'impostazioni' && (
          <ImpostazioniPage
            tornaAllInizio={tornaAllElenco}
            tema={tema}
            onTema={scegliTema}
            scuro={scuro}
            modoScuro={modoScuro}
            orariScuro={orariScuro}
            onScuro={(modo, orari) => void scegliScuro(modo, orari)}
            barraScura={barraScura}
            onBarraScura={scegliBarraScura}
            ingrandimento={ingrandimento}
            onIngrandimento={scegliIngrandimento}
          />
        )}
        </div>
      </main>
      <ConfermaHost />
      <ToastHost />
    </div>
  )
}

function ConfigurazionePage({
  tornaAllInizio
}: {
  // Cambia quando si ripreme "Configurazione" nel menu: si torna alla prima
  // scheda, che e' la sua prima pagina.
  tornaAllInizio: number
}): React.JSX.Element {
  const [tab, setTab] = useState<TabConfig>('patologie')
  // Cambia a ogni pressione di una linguetta, anche quella gia' aperta: la
  // pagina ricomincia dal suo elenco. Stavi modificando il ginocchio, premi
  // "Distretti", e ritrovi tutti i distretti; quello che avevi scritto si e'
  // salvato da solo uscendo.
  const [giro, setGiro] = useState(0)

  useEffect(() => {
    if (tornaAllInizio === 0) return
    setTab('patologie')
    setGiro((g) => g + 1)
  }, [tornaAllInizio])

  return (
    <div className="config-wrapper">
      <div className="config-tabs config-tabs-top">
        {TAB_CONFIG.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => {
              setTab(t.key)
              setGiro((g) => g + 1)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'patologie' && <PatologiePage key={giro} />}
      {tab === 'gruppi' && <GruppiPage key={giro} />}
      {tab === 'distretti' && <DistrettiPage key={giro} />}
      {tab === 'esercizi' && <EserciziPage key={giro} />}
      {tab === 'questionari' && <QuestionariPage key={giro} />}
      {tab === 'testValutazione' && <TestValutazionePage key={giro} />}
      {tab === 'screening' && (
        <ProtocolliScreeningPage key={giro} tornaAllElenco={tornaAllInizio} />
      )}
    </div>
  )
}
