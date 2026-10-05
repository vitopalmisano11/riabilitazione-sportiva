import { useCallback, useEffect, useState } from 'react'
import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Distretto, PazienteDettaglio, ValutazioneRiepilogo } from '../../../shared/types'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import Modale from './Modale'
import { errMsg, formatData, oggiIso } from '../lib'
import { SchedaValutazione } from './valutazione/SchedaValutazione'

// Storico delle valutazioni obiettive: si aggiunge, si rivede e si modifica,
// come la body chart.
export default function ValutazionePaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [elenco, setElenco] = useState<ValutazioneRiepilogo[]>([])
  const [distretti, setDistretti] = useState<Distretto[]>([])
  const [aperta, setAperta] = useState<{ id: number; soloLettura: boolean } | null>(null)
  const [scelta, setScelta] = useState<number[] | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      setElenco(await window.api.valutazioni.list(paziente.id))
      setDistretti(await window.api.distretti.list())
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void load()
  }, [load])

  // All'apertura si preselezionano i distretti abituali della patologia.
  const apriScelta = async (): Promise<void> => {
    try {
      const suggeriti =
        paziente.patologia_id != null
          ? await window.api.patologie.distretti(paziente.patologia_id)
          : []
      setScelta(suggeriti)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Un clic sul distretto apre subito la valutazione: sceglierlo e poi premere
  // un secondo pulsante era un passaggio in piu' per la cosa che si fa sempre.
  const crea = async (distretti: number[]): Promise<void> => {
    if (distretti.length === 0) return
    try {
      const id = await window.api.valutazioni.create(paziente.id, oggiIso(), distretti)
      setScelta(null)
      await load()
      setAperta({ id, soloLettura: false })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // Rivalutare vuol dire rifare gli stessi movimenti: si riparte dai valori
  // dell'altra volta e si cambiano solo quelli cambiati. I testi discorsivi
  // restano vuoti, perche' raccontano quel giorno la'.
  const duplica = async (v: ValutazioneRiepilogo): Promise<void> => {
    try {
      const id = await window.api.valutazioni.duplica(v.id, oggiIso())
      await load()
      setAperta({ id, soloLettura: false })
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const elimina = async (v: ValutazioneRiepilogo): Promise<void> => {
    if (!(await chiedi(`Eliminare la valutazione del ${formatData(v.data)}?`))) return
    try {
      await window.api.valutazioni.remove(v.id)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>Valutazione obiettiva</h3>
        <span className="row-actions">
          <button
            className="primary"
            title="Nuova valutazione"
            disabled={distretti.length === 0}
            onClick={() => void apriScelta()}
          >
            <Plus size={18} />
          </button>
        </span>
      </div>

      {distretti.length === 0 ? (
        <p className="hint">
          Nessun distretto configurato: creane uno in Configurazione, &ldquo;Distretti&rdquo;, con i
          suoi movimenti e test.
        </p>
      ) : elenco.length === 0 ? (
        <p className="hint">Nessuna valutazione per questo paziente.</p>
      ) : (
        <ul className="sedute-list">
          {elenco.map((v) => (
            <li key={v.id}>
              <div className="seduta-info">
                <span className="seduta-data">{formatData(v.data)}</span>
                <span className="seduta-meta">
                  {v.num_distretti === 1 ? '1 distretto' : `${v.num_distretti} distretti`}
                </span>
                {v.note && <span className="seduta-obiettivi">{v.note}</span>}
              </div>
              <span className="row-actions">
                <button title="Anteprima" onClick={() => setAperta({ id: v.id, soloLettura: true })}>
                  <Eye size={18} />
                </button>
                <button title="Modifica" onClick={() => setAperta({ id: v.id, soloLettura: false })}>
                  <Pencil size={18} />
                </button>
                <button
                  title="Nuova valutazione partendo da questa"
                  onClick={() => void duplica(v)}
                >
                  <Copy size={18} />
                </button>
                <button className="danger" title="Elimina" onClick={() => void elimina(v)}>
                  <Trash2 size={18} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {scelta != null && (
        // Niente pulsante "primary" da confermare qui: si sceglie cliccando
        // direttamente il distretto. Invio e clic fuori chiudono e basta.
        <Modale className="modal-sm" onConferma={() => setScelta(null)}>
            <h3>Quale distretto valuti?</h3>
            <p className="modal-testo">
              {scelta.length > 0
                ? 'Quelli abituali della patologia sono in cima. Clicca il distretto: la valutazione si apre subito.'
                : 'Clicca il distretto: la valutazione si apre subito.'}
            </p>
            <ul className="scelte-questionari">
              {/* Prima quelli abituali della patologia, poi gli altri: la scelta
                  piu' probabile sta in cima e si trova senza cercare. */}
              {[...distretti]
                .sort(
                  (a, b) =>
                    Number(scelta.includes(b.id)) - Number(scelta.includes(a.id)) ||
                    a.nome.localeCompare(b.nome)
                )
                .map((d) => (
                  <li key={d.id}>
                    <button
                      className={scelta.includes(d.id) ? 'scelta-attiva' : ''}
                      onClick={() => void crea([d.id])}
                    >
                      {d.nome}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="modal-actions">
              <button onClick={() => setScelta(null)}>Annulla</button>
            </div>
        </Modale>
      )}

      {aperta && (
        <SchedaValutazione
          key={aperta.id}
          id={aperta.id}
          soloLettura={aperta.soloLettura}
          latoInteressato={paziente.arto_operato ?? null}
          onChiudi={(salvata) => {
            setAperta(null)
            if (salvata) void load()
          }}
        />
      )}
    </section>
  )
}
