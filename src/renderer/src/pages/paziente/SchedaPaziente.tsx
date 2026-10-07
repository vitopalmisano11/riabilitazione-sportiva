import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarPlus, Copy, Plus } from 'lucide-react'
import type { Fase, Patologia, PazienteDettaglio, SedutaRiepilogo } from '../../../../shared/types'
import ProgrammaSettimana from '../../components/ProgrammaSettimana'
import QuestionariPaziente from '../../components/QuestionariPaziente'
import PromemoriaPaziente from '../../components/PromemoriaPaziente'
import AnagraficaPaziente from '../../components/AnagraficaPaziente'
import SceltaConRicerca from '../../components/SceltaConRicerca'
import SegniPaziente from '../../components/SegniPaziente'
import IndicazioniCasa from '../../components/IndicazioniCasa'
import MassimaliPaziente from '../../components/MassimaliPaziente'
import AnamnesiPaziente from '../../components/AnamnesiPaziente'
import ValutazionePaziente from '../../components/ValutazionePaziente'
import QuadroPaziente from '../../components/QuadroPaziente'
import { toastErrore } from '../../components/Toast'
import { chiedi } from '../../components/Conferma'
import { errMsg, oggiIso } from '../../lib'
import { ObiettiviCard } from './ObiettiviCard'
import { DiarioCard } from './DiarioCard'

export type SchedaAperta = 'quadro' | 'diario' | 'clinica' | 'percorso'

const SCHEDE_PAZIENTE: { key: SchedaAperta; label: string }[] = [
  // Prima voce e prima cosa che si vede aprendo un paziente: e' la domanda
  // che ci si fa per prima, "sta migliorando?", prima ancora di guardare il
  // diario di oggi.
  { key: 'quadro', label: 'Quadro' },
  { key: 'diario', label: 'Diario sedute' },
  { key: 'clinica', label: 'Clinica' },
  { key: 'percorso', label: 'Percorso' }
]

export function SchedaPaziente({
  paziente,
  patologie,
  scheda,
  onSchedaChange,
  onChanged,
  onDeleted,
  onNuovaSeduta,
  onApriSeduta,
  onDuplicaSeduta
}: {
  paziente: PazienteDettaglio
  patologie: Patologia[]
  // Quale linguetta e' aperta: vive nel componente sopra (PazientiPage), non
  // qui, perche' aprire una seduta smonta questo componente. Se lo stato
  // fosse qui dentro, tornando dalla seduta la scheda ripartirebbe sempre dal
  // quadro invece di restare sulla linguetta da cui si era partiti.
  scheda: SchedaAperta
  onSchedaChange: (s: SchedaAperta) => void
  onChanged: () => Promise<void> | void
  onDeleted: () => void
  onNuovaSeduta: () => void
  onApriSeduta: (id: number) => void
  onDuplicaSeduta: (id: number) => void
}): React.JSX.Element {
  const [fasi, setFasi] = useState<Fase[]>([])
  // Serve solo a sapere se c'e' una seduta da riprendere e quale.
  const [ultimaSeduta, setUltimaSeduta] = useState<number | null>(null)

  // Dipende dal paziente intero e non dal solo id: quando si salva una seduta
  // l'elenco dei pazienti si ricarica, l'oggetto cambia, e cosi' "Riprendi
  // l'ultima" punta davvero all'ultima.
  const [sedutePaziente, setSedutePaziente] = useState<SedutaRiepilogo[]>([])
  // Quante sedute aspettano il paziente: si vede sulla linguetta, senza entrare.
  const daFare = sedutePaziente.filter((s) => s.data > oggiIso()).length
  const [programma, setProgramma] = useState(false)

  const ricaricaUltima = useCallback((): void => {
    const oggi = oggiIso()
    void window.api.sedute
      .list(paziente.id)
      // le sedute programmate per i giorni a venire non sono "l'ultima": si
      // riparte da quella davvero svolta
      .then((righe) => {
        setSedutePaziente(righe)
        setUltimaSeduta(righe.find((s) => s.data <= oggi)?.id ?? null)
      })
  }, [paziente])

  useEffect(ricaricaUltima, [ricaricaUltima])

  useEffect(() => {
    if (paziente.patologia_id == null) {
      setFasi([])
      return
    }
    void window.api.fasi.list(paziente.patologia_id).then(setFasi)
  }, [paziente.patologia_id])

  const setPatologia = async (patologiaId: number | null): Promise<void> => {
    if (
      paziente.patologia_id != null &&
      patologiaId !== paziente.patologia_id &&
      !(await chiedi('Cambiare patologia? La fase corrente verrà azzerata.'))
    ) {
      return
    }
    try {
      await window.api.pazienti.setPatologiaFase(paziente.id, patologiaId, null)
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const setFase = async (faseId: number | null): Promise<void> => {
    try {
      await window.api.pazienti.setPatologiaFase(paziente.id, paziente.patologia_id, faseId)
      await onChanged()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // L'avanzamento cammina solo sulle fasi di palestra: da Intermedia si passa
  // ad Avanzata, mai a una fase del campo, che e' un percorso parallelo.
  const fasiPalestra = fasi.filter((f) => f.campo !== 1)
  const idxFase = fasiPalestra.findIndex((f) => f.id === paziente.fase_corrente_id)
  // Se la fase corrente non e' nell'elenco (una fase del campo rimasta da prima)
  // non si sa da dove ripartire: niente "Avanza", si sceglie dall'elenco.
  const faseFuoriElenco = paziente.fase_corrente_id != null && idxFase < 0
  const prossima = faseFuoriElenco
    ? undefined
    : idxFase >= 0
      ? fasiPalestra[idxFase + 1]
      : fasiPalestra[0]

  const avanza = async (): Promise<void> => {
    if (!prossima) return
    const domanda =
      paziente.fase_corrente_id == null
        ? `Impostare "${prossima.nome}" come fase corrente di ${paziente.nome} ${paziente.cognome}?`
        : `Avanzare ${paziente.nome} ${paziente.cognome} a "${prossima.nome}"?\nLe nuove sedute useranno la struttura della nuova fase.`
    if (!(await chiedi(domanda))) return
    await setFase(prossima.id)
  }

  return (
    <div className="scheda">
      <AnagraficaPaziente paziente={paziente} onChanged={onChanged} onDeleted={onDeleted} />

      {/* I limiti da non superare, subito sotto al nome e sopra a tutto il
          resto: si scrivono nei dati del paziente e si rileggono qui senza
          doverli cercare. */}
      {paziente.precauzioni && (
        <p className="fascia-precauzioni">
          <AlertTriangle size={16} />
          {paziente.precauzioni}
        </p>
      )}

      {/* I due gesti di tutti i giorni restano sempre a portata di clic, in
          qualunque linguetta ti trovi: creare la seduta di oggi, o ripartire da
          quella di ieri invece di rifarla da zero. */}
      <div className="barra-scheda">
        <div className="config-tabs">
          {SCHEDE_PAZIENTE.map((t) => (
            <button
              key={t.key}
              className={scheda === t.key ? 'active' : ''}
              onClick={() => onSchedaChange(t.key)}
            >
              {t.label}
              {t.key === 'diario' && daFare > 0 && <span className="pallino-conta">{daFare}</span>}
            </button>
          ))}
        </div>
        <span className="row-actions">
          <button
            disabled={ultimaSeduta == null}
            title="Nuova seduta copiando l'ultima"
            onClick={() => ultimaSeduta != null && onDuplicaSeduta(ultimaSeduta)}
          >
            <Copy size={17} /> Riprendi l&apos;ultima
          </button>
          <button
            disabled={sedutePaziente.length === 0}
            title="Copia un programma su piu' giorni"
            onClick={() => setProgramma(true)}
          >
            <CalendarPlus size={17} /> Programma…
          </button>
          <button className="primary" onClick={onNuovaSeduta}>
            <Plus size={17} /> Nuova seduta
          </button>
        </span>
      </div>

      {programma && (
        <ProgrammaSettimana
          sedute={sedutePaziente}
          onChiudi={(create) => {
            setProgramma(false)
            if (create > 0) {
              ricaricaUltima()
              void onChanged()
            }
          }}
        />
      )}

      {scheda === 'quadro' && <QuadroPaziente paziente={paziente} />}

      {scheda === 'diario' && (
        <DiarioCard
          paziente={paziente}
          onNuova={onNuovaSeduta}
          onApri={onApriSeduta}
          onDuplica={onDuplicaSeduta}
        />
      )}

      {scheda === 'clinica' && (
        <>
          <AnamnesiPaziente paziente={paziente} />

          <ValutazionePaziente paziente={paziente} />

          <QuestionariPaziente paziente={paziente} />

          <PromemoriaPaziente paziente={paziente} />

          {/* I segni stanno in fondo, chiusi: chi non li usa non li vede, e
              tante cose (il gonfiore, per dirne una) si scrivono meglio nelle
              note della seduta. */}
          <SegniPaziente paziente={paziente} />
        </>
      )}

      {scheda === 'percorso' && (
        <>
      <section className="card">
        <h3>Percorso riabilitativo</h3>
        {/* Patologia, fase e il pulsante che fa avanzare stanno su una riga
            sola: sono la stessa decisione, presa in tre passi. */}
        <div className="riga-percorso">
          <label className="field">
            Patologia
            <SceltaConRicerca
              voci={patologie}
              valore={paziente.patologia_id ?? ''}
              segnaposto="— nessuna —"
              vuoto="— nessuna —"
              onCambia={(id) => void setPatologia(id === '' ? null : id)}
            />
          </label>
          <label className="field campo-fase">
            Fase corrente
            <SceltaConRicerca
              voci={fasi
                .filter((f) => f.campo !== 1 || f.id === paziente.fase_corrente_id)
                .map((f) => ({ id: f.id, nome: f.nome }))}
              valore={paziente.fase_corrente_id ?? ''}
              disabled={paziente.patologia_id == null}
              segnaposto="— non impostata —"
              vuoto="— non impostata —"
              onCambia={(id) => void setFase(id === '' ? null : id)}
            />
          </label>
          {paziente.patologia_id != null && fasiPalestra.length > 0 && (
            <label className="field campo-avanza">
              {idxFase >= 0
                ? `Fase ${idxFase + 1} di ${fasiPalestra.length}`
                : faseFuoriElenco
                  ? 'Fase fuori dal percorso'
                  : 'Nessuna fase impostata'}
              <button disabled={!prossima} onClick={() => void avanza()}>
                {paziente.fase_corrente_id == null
                  ? 'Imposta prima fase'
                  : faseFuoriElenco
                    ? 'Scegli una fase di palestra'
                    : prossima
                      ? `Avanza a "${prossima.nome}" →`
                      : 'Ultima fase raggiunta'}
              </button>
            </label>
          )}
        </div>
        {paziente.patologia_id == null ? (
          <p className="hint">Assegna una patologia per impostare le fasi.</p>
        ) : fasi.length === 0 ? (
          <p className="hint">
            Questa patologia non ha fasi: definiscile in &ldquo;Patologie e fasi&rdquo;.
          </p>
        ) : null}
      </section>

      <ObiettiviCard paziente={paziente} />

      {/* Sta nel percorso perche' e' parte del programma: cosa deve fare a
          casa, ogni quanto, e come regolarsi. Finisce sul foglio che si porta
          via. */}
      <IndicazioniCasa paziente={paziente} onChanged={onChanged} />

      {/* I massimali con cui si prescrive il carico della fase di forza. */}
      <MassimaliPaziente paziente={paziente} />
        </>
      )}
    </div>
  )
}
