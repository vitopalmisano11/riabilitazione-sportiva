import { useEffect, useState } from 'react'
import { Copy, Download, FileText, Images, Pencil, Presentation, Trash2 } from 'lucide-react'
import type { Fase, PazienteDettaglio, SedutaRiepilogo } from '../../../../shared/types'
import { toast, toastErrore } from '../../components/Toast'
import { chiedi } from '../../components/Conferma'
import Modale from '../../components/Modale'
import { errMsg, formatData, oggiIso } from '../../lib'
import { SchedaIllustrata } from './SchedaIllustrata'

export function DiarioCard({
  paziente,
  onNuova,
  onApri,
  onDuplica
}: {
  paziente: PazienteDettaglio
  onNuova: () => void
  onApri: (id: number) => void
  onDuplica: (id: number) => void
}): React.JSX.Element {
  const [sedute, setSedute] = useState<SedutaRiepilogo[]>([])
  const [periodo, setPeriodo] = useState<{ dal: string; al: string } | null>(null)
  const [menuScarica, setMenuScarica] = useState<number | null>(null)
  const [anteprima, setAnteprima] = useState<number | null>(null)

  const load = async (): Promise<void> => setSedute(await window.api.sedute.list(paziente.id))

  // Una seduta e' "programmata" se la sua data deve ancora arrivare: nessuno
  // stato da mettere a mano, la data basta. Le programmate si leggono dalla piu'
  // vicina, le svolte dalla piu' recente.
  const oggi = oggiIso()
  // Il lavoro al campo va in parallelo a quello in palestra: sta in un elenco
  // suo, che compare solo per chi ce l'ha. Dentro a ognuno dei due, le
  // programmate stanno sopra alle svolte.
  const inPalestra = sedute.filter((s) => s.fase_campo !== 1)
  const alCampo = sedute.filter((s) => s.fase_campo === 1)
  const programmate = inPalestra
    .filter((s) => s.data > oggi)
    .sort((a, b) => a.data.localeCompare(b.data))
  const fatte = inPalestra.filter((s) => s.data <= oggi)
  const campoProgrammate = alCampo
    .filter((s) => s.data > oggi)
    .sort((a, b) => a.data.localeCompare(b.data))
  const campoFatte = alCampo.filter((s) => s.data <= oggi)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paziente.id])

  const elimina = async (s: SedutaRiepilogo): Promise<void> => {
    if (!(await chiedi(`Eliminare la seduta del ${formatData(s.data)}?`))) return
    try {
      await window.api.sedute.remove(s.id)
      await load()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const esportaSingola = async (
    id: number,
    formato: 'pdf' | 'docx',
    illustrata = false
  ): Promise<void> => {
    try {
      const path = await window.api.esporta.seduta(id, formato, illustrata)
      if (path) toast(`Seduta esportata${formato === 'pdf' ? ' in PDF' : ' in Word'}.`)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const esportaPeriodo = async (formato: 'pdf' | 'docx'): Promise<void> => {
    if (!periodo) return
    if (periodo.dal > periodo.al) {
      toastErrore('Intervallo non valido: la data "dal" è successiva ad "al".')
      return
    }
    try {
      const path = await window.api.esporta.storico(paziente.id, periodo.dal, periodo.al, formato)
      if (path) {
        setPeriodo(null)
        toast('Storico esportato.')
      }
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  // La riga di una seduta si disegna una volta sola: la usano l'elenco delle
  // svolte e quello delle programmate.
  const riga = (s: SedutaRiepilogo): React.JSX.Element => (
          <li key={s.id}>
            <div className="seduta-info">
              <span className="seduta-data">{formatData(s.data)}</span>
              {/* Fase e focus sulla stessa riga: il focus in evidenza, perche'
                  e' quello che distingue due sedute della stessa fase. */}
              <span className="seduta-meta">
                {s.fase_nome ?? 'senza fase'}
                {s.focus && <span className="seduta-focus">{s.focus}</span>}
                {s.dolore != null && ` · dolore ${s.dolore}/10`}
              </span>
              {/* Sotto alla data, il trattamento fatto. */}
              {(s.tecniche_nomi || s.trattamento) && (
                <span className="riga-diario-elenco">
                  <span className="etichetta-diario">Trattamento</span>
                  {[s.tecniche_nomi, s.trattamento].filter(Boolean).join(' — ')}
                </span>
              )}
            </div>
            <span className="row-actions">
              <button
                title="Mostra la scheda al paziente (si apre in una finestra a parte)"
                onClick={() => void window.api.scheda.apri(s.id).catch((e) => toastErrore(errMsg(e)))}
              >
                <Presentation size={18} />
              </button>
              <button
                title="Scheda illustrata per il paziente (foto e spiegazioni)"
                onClick={() => setAnteprima(s.id)}
              >
                <Images size={18} />
              </button>
              <button title="Modifica la seduta" onClick={() => onApri(s.id)}>
                <Pencil size={18} />
              </button>
              <button title="Nuova seduta partendo da questa" onClick={() => onDuplica(s.id)}>
                <Copy size={18} />
              </button>
              <span className="menu-wrapper">
                <button
                  title="Scarica la seduta"
                  onClick={() => setMenuScarica(menuScarica === s.id ? null : s.id)}
                >
                  <Download size={18} />
                </button>
                {menuScarica === s.id && (
                  <>
                    <div className="menu-chiudi" onClick={() => setMenuScarica(null)} />
                    <div className="menu-tendina">
                      <button
                        onClick={() => {
                          setMenuScarica(null)
                          void esportaSingola(s.id, 'pdf')
                        }}
                      >
                        <FileText size={18} /> Scarica PDF
                      </button>
                      <button
                        onClick={() => {
                          setMenuScarica(null)
                          void esportaSingola(s.id, 'docx')
                        }}
                      >
                        <FileText size={18} /> Scarica Word
                      </button>
                    </div>
                  </>
                )}
              </span>
              <button className="danger" title="Elimina" onClick={() => void elimina(s)}>
                <Trash2 size={18} />
              </button>
            </span>
          </li>
  )

  return (
    <section className="card">
      <div className="card-header-row">
        {/* Il titolo e il pulsante "Nuova seduta" stanno gia' nella barra qui
            sopra: ripeterli dentro al riquadro era solo rumore. */}
        <h3>Sedute</h3>
        <span className="row-actions">
          {sedute.length > 0 && (
            <button
              onClick={() =>
                setPeriodo({ dal: sedute[sedute.length - 1].data, al: sedute[0].data })
              }
            >
              Esporta sedute
            </button>
          )}
        </span>
      </div>
      {/* Le sedute con la data di domani in poi sono quelle che hai preparato:
          stanno sopra, in ordine di quando toccano, cosi' si vede a colpo
          d'occhio cosa aspetta il paziente. */}
      {programmate.length > 0 && (
        <div className="blocco-programmate">
          <div className="sotto-titolo">Programmate</div>
          <ul className="sedute-list">{programmate.map(riga)}</ul>
        </div>
      )}
      {fatte.length === 0 ? (
        <p className="hint">
          {programmate.length > 0
            ? 'Nessuna seduta svolta finora: quelle qui sopra sono programmate.'
            : 'Nessuna seduta ancora: creane una — si aprirà già sulla fase corrente del paziente.'}
        </p>
      ) : (
        <ul className="sedute-list">{fatte.map(riga)}</ul>
      )}

      {/* Il campo: un riquadro a parte, che c'e' solo per chi ha quel percorso
          (in pratica i crociati). Per tutti gli altri la scheda resta identica. */}
      {alCampo.length > 0 && (
        <div className="blocco-campo">
          <div className="sotto-titolo">Al campo</div>
          {campoProgrammate.length > 0 && (
            <ul className="sedute-list">{campoProgrammate.map(riga)}</ul>
          )}
          {campoFatte.length > 0 && <ul className="sedute-list">{campoFatte.map(riga)}</ul>}
        </div>
      )}

      {periodo && (
        // Invio e clic fuori valgono come il pulsante "primary" (Esporta
        // PDF): non c'e' nulla da perdere, e' solo l'esportazione di un file.
        <Modale className="modal-sm" onConferma={() => void esportaPeriodo('pdf')}>
            <h3>Esporta storico sedute</h3>
            <div className="form-row-2">
              <label>
                Dal
                <input
                  type="date"
                  value={periodo.dal}
                  onChange={(e) => setPeriodo({ ...periodo, dal: e.target.value })}
                />
              </label>
              <label>
                Al
                <input
                  type="date"
                  value={periodo.al}
                  onChange={(e) => setPeriodo({ ...periodo, al: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setPeriodo(null)}>Annulla</button>
              <button onClick={() => void esportaPeriodo('docx')}>Esporta Word</button>
              <button className="primary" onClick={() => void esportaPeriodo('pdf')}>
                Esporta PDF
              </button>
            </div>
        </Modale>
      )}

      {anteprima != null && (
        <SchedaIllustrata
          sedutaId={anteprima}
          onClose={() => setAnteprima(null)}
          onScarica={() => void esportaSingola(anteprima, 'pdf', true)}
        />
      )}
    </section>
  )
}
