import { useEffect, useState } from 'react'
import type { PazienteDettaglio, TestValore } from '../../../../shared/types'
import ObiettiviFase from '../../components/ObiettiviFase'
import { toastErrore } from '../../components/Toast'
import Modale from '../../components/Modale'
import { errMsg } from '../../lib'

// Obiettivi della fase corrente con stato "raggiunto" persistente sul paziente,
// più la checklist informativa dei test di avanzamento.
export function ObiettiviCard({ paziente }: { paziente: PazienteDettaglio }): React.JSX.Element {
  const [test, setTest] = useState<TestValore[]>([])
  const [testAperti, setTestAperti] = useState(false)

  const faseId = paziente.fase_corrente_id

  const loadTest = async (): Promise<void> => {
    if (faseId == null) {
      setTest([])
      return
    }
    setTest(await window.api.pazienti.testValori(paziente.id, faseId))
  }

  useEffect(() => {
    void loadTest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paziente.id, faseId])

  const eseguiti = test.filter((t) => t.eseguito).length

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>Obiettivi della fase corrente</h3>
        {test.length > 0 && (
          <button onClick={() => setTestAperti(true)}>
            Test di avanzamento ({eseguiti}/{test.length})
          </button>
        )}
      </div>
      <ObiettiviFase pazienteId={paziente.id} faseId={faseId} />

      {testAperti && (
        <TestModal
          paziente={paziente}
          test={test}
          onClose={() => {
            setTestAperti(false)
            void loadTest()
          }}
        />
      )}
    </section>
  )
}

function TestModal({
  paziente,
  test,
  onClose
}: {
  paziente: PazienteDettaglio
  test: TestValore[]
  onClose: () => void
}): React.JSX.Element {
  const [righe, setRighe] = useState<TestValore[]>(test)

  const salva = async (riga: TestValore): Promise<void> => {
    try {
      await window.api.pazienti.setTestValore(
        paziente.id,
        riga.test_id,
        riga.eseguito === 1,
        riga.valore?.trim() || null
      )
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const aggiorna = (testId: number, patch: Partial<TestValore>, salvaSubito: boolean): void => {
    setRighe((prev) => {
      const next = prev.map((r) => (r.test_id === testId ? { ...r, ...patch } : r))
      if (salvaSubito) {
        const riga = next.find((r) => r.test_id === testId)
        if (riga) void salva(riga)
      }
      return next
    })
  }

  return (
    <Modale onConferma={onClose}>
        <h3>Test di avanzamento — {paziente.nome} {paziente.cognome}</h3>
        <p className="modal-testo">
          Checklist di supporto per valutare il passaggio di fase: spunta i test eseguiti e
          registra il valore. Non blocca l&apos;avanzamento, che resta una tua decisione.
        </p>
        <ul className="test-list">
          {righe.map((t) => (
            <li key={t.test_id}>
              <label className="test-check">
                <input
                  type="checkbox"
                  checked={t.eseguito === 1}
                  onChange={(e) =>
                    aggiorna(t.test_id, { eseguito: e.target.checked ? 1 : 0 }, true)
                  }
                />
                <span className={t.eseguito === 1 ? 'obiettivo-raggiunto' : ''}>{t.nome}</span>
              </label>
              <input
                className="test-valore"
                placeholder="valore…"
                value={t.valore ?? ''}
                onChange={(e) => aggiorna(t.test_id, { valore: e.target.value }, false)}
                onBlur={() => {
                  const riga = righe.find((r) => r.test_id === t.test_id)
                  if (riga) void salva(riga)
                }}
              />
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Chiudi
          </button>
        </div>
    </Modale>
  )
}
