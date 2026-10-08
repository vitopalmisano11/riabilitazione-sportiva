import Tendina from './Tendina'
import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type {
  PazienteDettaglio,
  ProtocolloScreening,
  Promemoria,
  Questionario
} from '../../../shared/types'
import Aiuto from './Aiuto'
import { toastErrore } from './Toast'
import { errMsg, formatData, oggiIso } from '../lib'

// Fra quante settimane da oggi, in formato aaaa-mm-gg.
function fraSettimane(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n * 7)
  const p = (x: number): string => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const SCADENZE_RAPIDE = [2, 4, 6, 12]

// I promemoria del paziente: quando fargli rifare un questionario o uno
// screening. Si spuntano a mano oppure si chiudono da soli quando il
// questionario viene compilato o lo screening aperto per quel paziente.
export default function PromemoriaPaziente({
  paziente
}: {
  paziente: PazienteDettaglio
}): React.JSX.Element {
  const [elenco, setElenco] = useState<Promemoria[]>([])
  const [questionari, setQuestionari] = useState<Questionario[]>([])
  const [protocolli, setProtocolli] = useState<ProtocolloScreening[]>([])
  const [aggiungi, setAggiungi] = useState(false)
  const [tipo, setTipo] = useState<'questionario' | 'screening'>('questionario')
  const [riferimento, setRiferimento] = useState<number | ''>('')
  const [scadenza, setScadenza] = useState(fraSettimane(4))
  const [nota, setNota] = useState('')
  const [fatti, setFatti] = useState(false)

  const carica = useCallback(async (): Promise<void> => {
    try {
      setElenco(await window.api.promemoria.list(paziente.id))
      setQuestionari(await window.api.questionari.list(false))
      setProtocolli((await window.api.screening.list(null)).filter((p) => p.archiviato === 0))
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }, [paziente.id])

  useEffect(() => {
    void carica()
  }, [carica])

  const esegui = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const salva = (): void => {
    if (riferimento === '' || !scadenza) return
    void esegui(async () => {
      await window.api.promemoria.create({
        paziente_id: paziente.id,
        tipo,
        riferimento_id: riferimento,
        scadenza,
        nota: nota.trim() || null
      })
      setAggiungi(false)
      setRiferimento('')
      setNota('')
    })
  }

  const oggi = oggiIso()
  const aperti = elenco.filter((p) => p.fatto_il == null)
  const chiusi = elenco.filter((p) => p.fatto_il != null)
  const scelte = tipo === 'questionario' ? questionari : protocolli

  return (
    <section className="card">
      <div className="card-header-row">
        <h3>
          Promemoria
          <Aiuto testo="Quando fargli rifare un questionario o uno screening. Compare nella pagina Follow-up e nel numerino del menu quando la data arriva. Si chiude da solo appena compili quel questionario o apri quello screening per questo paziente; puoi anche spuntarlo a mano." />
        </h3>
        {!aggiungi && (
          <button className="btn-icona" title="Aggiungi un promemoria" onClick={() => setAggiungi(true)}>
            <Plus size={18} />
          </button>
        )}
      </div>

      {aggiungi && (
        <div className="promemoria-nuovo">
          <span className="scelta-coppia segmentata">
            {(['questionario', 'screening'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={tipo === t ? 'scelta-attiva' : ''}
                onClick={() => {
                  setTipo(t)
                  setRiferimento('')
                }}
              >
                {t === 'questionario' ? 'Questionario' : 'Screening'}
              </button>
            ))}
          </span>
          <Tendina
            value={riferimento}
            onChange={(e) => setRiferimento(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">{tipo === 'questionario' ? 'Scegli il questionario…' : 'Scegli lo screening…'}</option>
            {scelte.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Tendina>
          <label className="compila-data">
            Entro il
            <input type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} />
          </label>
          <span className="scadenze-rapide">
            {SCADENZE_RAPIDE.map((n) => (
              <button key={n} type="button" onClick={() => setScadenza(fraSettimane(n))}>
                +{n} sett.
              </button>
            ))}
          </span>
          <input placeholder="Nota (facoltativa)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <span className="modal-actions">
            <button onClick={() => setAggiungi(false)}>Annulla</button>
            <button className="primary" disabled={riferimento === '' || !scadenza} onClick={salva}>
              Aggiungi
            </button>
          </span>
        </div>
      )}

      {aperti.length === 0 && !aggiungi && <p className="hint">Nessun promemoria in programma.</p>}

      <ul className="sedute-list elenco-promemoria">
        {aperti.map((p) => (
          <li key={p.id}>
            <input
              type="checkbox"
              title="Fatto"
              checked={false}
              onChange={() => void esegui(() => window.api.promemoria.setFatto(p.id, true))}
            />
            <span className="promemoria-cosa">
              {p.tipo === 'questionario' ? 'Questionario' : 'Screening'}: {p.riferimento_nome}
              {p.nota && <span className="sotto-riga">{p.nota}</span>}
            </span>
            <span className={p.scadenza <= oggi ? 'data-scaduta promemoria-data' : 'promemoria-data'}>
              entro il {formatData(p.scadenza)}
            </span>
            <button
              className="danger"
              title="Elimina il promemoria"
              onClick={() => void esegui(() => window.api.promemoria.remove(p.id))}
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>

      {chiusi.length > 0 && (
        <>
          <button className="link-discreto" onClick={() => setFatti(!fatti)}>
            {fatti ? 'Nascondi' : 'Mostra'} i promemoria fatti ({chiusi.length})
          </button>
          {fatti && (
            <ul className="sedute-list elenco-promemoria promemoria-fatti">
              {chiusi.map((p) => (
                <li key={p.id}>
                  <input
                    type="checkbox"
                    title="Rimettilo da fare"
                    checked
                    onChange={() => void esegui(() => window.api.promemoria.setFatto(p.id, false))}
                  />
                  <span className="promemoria-cosa">
                    {p.tipo === 'questionario' ? 'Questionario' : 'Screening'}: {p.riferimento_nome}
                  </span>
                  <span className="promemoria-data">fatto il {formatData(p.fatto_il as string)}</span>
                  <button
                    className="danger"
                    title="Elimina il promemoria"
                    onClick={() => void esegui(() => window.api.promemoria.remove(p.id))}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
