import { useCallback, useEffect, useRef, useState } from 'react'
import Aiuto from './Aiuto'
import { FileText, ImageIcon, Plus, Trash2 } from 'lucide-react'
import type { AnamnesiRemota as Dati, Bioimmagine, RispostaSiNo } from '../../../shared/types'
import { toastErrore } from './Toast'
import { chiedi } from './Conferma'
import { errMsg, formatData } from '../lib'

const ATTESA_SALVATAGGIO = 1500

// Le nove domande di sicurezza del foglio: nome a sinistra, si'/no a destra,
// su piu' colonne perche' occupino poco.
const SI_NO: { chiave: keyof Dati; etichetta: string }[] = [
  { chiave: 'peso', etichetta: 'Variazioni di peso' },
  { chiave: 'febbre', etichetta: 'Febbre' },
  { chiave: 'sudorazione', etichetta: 'Sudorazione' },
  { chiave: 'nausea', etichetta: 'Nausea o vomito' },
  { chiave: 'fumo', etichetta: 'Fumo' },
  { chiave: 'neoplasie', etichetta: 'Neoplasie' },
  { chiave: 'gravidanza', etichetta: 'Gravidanza' },
  { chiave: 'pacemaker', etichetta: 'Pacemaker' },
  { chiave: 'schegge', etichetta: 'Schegge metalliche' }
]

const VUOTO: Dati = {
  patologie: null,
  traumi: null,
  interventi: null,
  riabilitazioni: null,
  bioimmagini_note: null,
  peso: null,
  febbre: null,
  sudorazione: null,
  nausea: null,
  fumo: null,
  neoplasie: null,
  gravidanza: null,
  pacemaker: null,
  schegge: null
}

export default function AnamnesiRemota({
  pazienteId,
  onChiudi
}: {
  pazienteId: number
  onChiudi: () => void
}): React.JSX.Element {
  const [dati, setDati] = useState<Dati | null>(null)
  const [referti, setReferti] = useState<Bioimmagine[]>([])
  const [stato, setStato] = useState<'fermo' | 'salvo' | 'salvato'>('fermo')
  const attesa = useRef<ReturnType<typeof setTimeout> | null>(null)
  const daSalvare = useRef<Dati | null>(null)

  const caricaReferti = useCallback(
    (): Promise<void> => window.api.bioimmagini.list(pazienteId).then(setReferti),
    [pazienteId]
  )

  useEffect(() => {
    window.api.anamnesi
      .remota(pazienteId)
      .then((d) => setDati({ ...VUOTO, ...d }))
      .catch((e) => toastErrore(errMsg(e)))
    void caricaReferti()
    return () => {
      if (attesa.current) clearTimeout(attesa.current)
    }
  }, [pazienteId, caricaReferti])

  const salvaSubito = async (): Promise<void> => {
    const d = daSalvare.current
    if (!d) return
    daSalvare.current = null
    setStato('salvo')
    try {
      await window.api.anamnesi.salvaRemota(pazienteId, d)
      setStato('salvato')
    } catch (e) {
      setStato('fermo')
      toastErrore(errMsg(e))
    }
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
    setStato('salvo')
    if (attesa.current) clearTimeout(attesa.current)
    attesa.current = setTimeout(() => void salvaSubito(), ATTESA_SALVATAGGIO)
  }

  const chiudi = (): void => {
    if (attesa.current) clearTimeout(attesa.current)
    void salvaSubito().then(onChiudi)
  }

  const testo =
    (k: keyof Dati) =>
    (e: { target: { value: string } }): void =>
      aggiorna({ [k]: e.target.value || null } as Partial<Dati>)

  const aggiungiReferto = async (): Promise<void> => {
    try {
      const quanti = await window.api.bioimmagini.aggiungi(pazienteId)
      if (quanti > 0) await caricaReferti()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const eliminaReferto = async (r: Bioimmagine): Promise<void> => {
    if (!(await chiedi(`Eliminare "${r.nome}"?`))) return
    try {
      await window.api.bioimmagini.remove(r.id)
      await caricaReferti()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={chiudi}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="card-header-row">
          <h3>Anamnesi remota</h3>
          <span className="hint">
            {stato === 'salvo' ? 'Salvataggio…' : stato === 'salvato' ? 'Salvato' : ''}
          </span>
        </div>

        {/* Prima di tutto il resto: quello che il paziente si porta dietro da
            prima, e che cambia come lo si tratta. */}
        <label>
          Altre patologie
          <textarea
            rows={2}
            placeholder="Diabete, ipertensione, tiroide, artrite reumatoide…"
            value={dati.patologie ?? ''}
            onChange={testo('patologie')}
          />
        </label>
        <label>
          Incidenti e traumi precedenti
          <textarea rows={2} value={dati.traumi ?? ''} onChange={testo('traumi')} />
        </label>
        <label>
          Interventi chirurgici
          <textarea rows={2} value={dati.interventi ?? ''} onChange={testo('interventi')} />
        </label>
        <label>
          Precedenti riabilitativi
          <textarea rows={2} value={dati.riabilitazioni ?? ''} onChange={testo('riabilitazioni')} />
        </label>

        <div className="sotto-titolo">Informazioni cliniche complementari</div>
        <div className="griglia-sino">
          {SI_NO.map((d) => (
            <div key={d.chiave} className="riga-sino">
              <span>{d.etichetta}</span>
              <SiNo
                valore={dati[d.chiave] as RispostaSiNo}
                onScegli={(v) => aggiorna({ [d.chiave]: v } as Partial<Dati>)}
              />
            </div>
          ))}
        </div>

        <div className="sotto-titolo">Bioimmagini</div>
        <label>
          In breve
          <textarea
            rows={2}
            placeholder="Le cose essenziali del referto"
            value={dati.bioimmagini_note ?? ''}
            onChange={testo('bioimmagini_note')}
          />
        </label>

        {referti.length > 0 && (
          <ul className="sedute-list">
            {referti.map((r) => (
              <li key={r.id}>
                <div className="seduta-info">
                  <span className="seduta-data">
                    {r.tipo === 'application/pdf' ? (
                      <FileText size={16} />
                    ) : (
                      <ImageIcon size={16} />
                    )}{' '}
                    {r.nome}
                  </span>
                  <span className="seduta-meta">caricato il {formatData(r.data)}</span>
                </div>
                <span className="row-actions">
                  <button
                    onClick={() =>
                      window.api.bioimmagini.apri(r.id).catch((e) => toastErrore(errMsg(e)))
                    }
                  >
                    Apri
                  </button>
                  <button className="danger" title="Elimina" onClick={() => void eliminaReferto(r)}>
                    <Trash2 size={18} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div>
          <button onClick={() => void aggiungiReferto()}>
            <Plus size={16} /> Carica referto (foto o PDF)
          </button>
          <Aiuto testo="Le foto vengono rimpicciolite. I file finiscono nell'archivio cifrato, quindi rientrano nel backup della cartella dati." />
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={chiudi}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// Due pulsantini: si riclicca la scelta per toglierla (domanda non fatta).
function SiNo({
  valore,
  onScegli
}: {
  valore: RispostaSiNo
  onScegli: (v: RispostaSiNo) => void
}): React.JSX.Element {
  return (
    <span className="scelta-coppia">
      <button className={valore === 1 ? 'scelta-attiva' : ''} onClick={() => onScegli(valore === 1 ? null : 1)}>
        Sì
      </button>
      <button className={valore === 0 ? 'scelta-attiva' : ''} onClick={() => onScegli(valore === 0 ? null : 0)}>
        No
      </button>
    </span>
  )
}
