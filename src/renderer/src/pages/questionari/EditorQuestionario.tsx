import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, RefreshCw } from 'lucide-react'
import type { Questionario, QuestionarioCompleto } from '../../../../shared/types'
import { toast, toastErrore } from '../../components/Toast'
import { chiedi } from '../../components/Conferma'
import { errMsg } from '../../lib'
import { useSalvataggio } from '../../salvataggio'
import IndicatoreSalvataggio from '../../components/IndicatoreSalvataggio'
import { Tab, TABS } from './modello'
import { TabDomande } from './TabDomande'
import { TabPunteggi } from './TabPunteggi'
import { TabFasce } from './TabFasce'
import { TabCambiamento } from './TabCambiamento'

export function EditorQuestionario({
  id,
  onChanged
}: {
  id: number
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const [dati, setDati] = useState<QuestionarioCompleto | null>(null)
  const [tab, setTab] = useState<Tab>('domande')
  const [modificato, setModificato] = useState(false)
  // uscendo con modifiche non salvate, si salvano da sole (vedi salvataggio.ts)
  const salvataggio = useSalvataggio(modificato)
  // Le compilazioni gia' fatte che con le regole di adesso darebbero punteggi o
  // fascia diversi: restano com'erano finche' non si chiede di ricalcolarle.
  const [daRicalcolare, setDaRicalcolare] = useState(0)
  const contaDaRicalcolare = useCallback(
    (): Promise<void> =>
      window.api.questionari
        .daRicalcolare(id)
        .then(setDaRicalcolare)
        .catch(() => undefined),
    [id]
  )

  useEffect(() => {
    window.api.questionari
      .get(id)
      .then(setDati)
      .catch((e) => toastErrore(errMsg(e)))
    void contaDaRicalcolare()
  }, [id, contaDaRicalcolare])

  if (!dati) return <p className="hint">Caricamento…</p>

  const aggiorna = (patch: Partial<QuestionarioCompleto>): void => {
    setDati({ ...dati, ...patch })
    setModificato(true)
  }

  const salva = async (): Promise<boolean> => {
    try {
      await window.api.questionari.salva(dati)
      const fresco = await window.api.questionari.get(id)
      setDati(fresco)
      setModificato(false)
      await onChanged()
      await contaDaRicalcolare()
      toast('Questionario salvato.')
      return true
    } catch (e) {
      toastErrore(errMsg(e))
      return false
    }
  }
  salvataggio.funzione.current = salva

  const ricalcolaTutte = async (): Promise<void> => {
    if (
      !(await chiedi({
        titolo: 'Ricalcolare le compilazioni già fatte?',
        testo:
          `${daRicalcolare === 1 ? 'Una compilazione' : `${daRicalcolare} compilazioni`} di «${dati.questionario.nome}» ` +
          'avranno punteggi e fascia calcolati con le regole di adesso. Le risposte non cambiano. ' +
          'I valori di prima non si potranno ritrovare.',
        conferma: 'Ricalcola'
      }))
    ) {
      return
    }
    try {
      const fatte = await window.api.questionari.ricalcolaCompilazioni(id)
      toast(fatte === 1 ? 'Ricalcolata una compilazione.' : `Ricalcolate ${fatte} compilazioni.`)
      await contaDaRicalcolare()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="config-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <label>
        Istruzioni per il paziente (facoltative)
        {/* Le istruzioni dei questionari sono spesso lunghe (periodo di
            riferimento, come rispondere): la casella parte da cinque righe e
            si allunga a mano se serve. */}
        <textarea
          rows={5}
          style={{ resize: 'vertical' }}
          placeholder="es. Pensando alle ultime due settimane, indichi la risposta…"
          value={dati.questionario.istruzioni ?? ''}
          onChange={(e) =>
            aggiorna({ questionario: { ...dati.questionario, istruzioni: e.target.value || null } })
          }
        />
      </label>

      {tab === 'domande' && (
        <TabDomande
          domande={dati.domande}
          onChange={(domande) => aggiorna({ domande })}
        />
      )}
      {tab === 'punteggi' && (
        <TabPunteggi
          domande={dati.domande}
          punteggi={dati.punteggi}
          onChange={(punteggi) => aggiorna({ punteggi })}
        />
      )}
      {tab === 'fasce' && (
        <TabFasce
          punteggi={dati.punteggi}
          fasce={dati.fasce}
          onChange={(fasce) => aggiorna({ fasce })}
        />
      )}
      {tab === 'mcid' && (
        <TabCambiamento
          questionario={dati.questionario}
          punteggi={dati.punteggi}
          onChange={(questionario) => aggiorna({ questionario })}
        />
      )}

      {daRicalcolare > 0 && !modificato && (
        <div className="esito-copia esito-attenzione">
          <CircleAlert size={15} />
          <span>
            {daRicalcolare === 1
              ? 'Una compilazione già fatta è stata calcolata'
              : `${daRicalcolare} compilazioni già fatte sono state calcolate`}{' '}
            con regole diverse da quelle di adesso: mostrano ancora punteggi e fascia di allora.{' '}
            <button className="link-btn" onClick={() => void ricalcolaTutte()}>
              <RefreshCw size={13} /> Ricalcolale con le regole di adesso
            </button>
          </span>
        </div>
      )}

      <div className="modal-actions">
        <IndicatoreSalvataggio stato={salvataggio.stato} errore={salvataggio.errore} />
        <button
          className="primary"
          disabled={!modificato || salvataggio.stato === 'salvo'}
          onClick={() => void salvataggio.salva()}
        >
          Salva questionario
        </button>
      </div>
    </section>
  )
}
