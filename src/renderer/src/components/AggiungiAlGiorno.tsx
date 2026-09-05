import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { PazienteDettaglio, SedutaRiepilogo } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg, formatData } from '../lib'

// Aggiungere una seduta a un giorno della settimana.
//
// Programmare partendo dal paziente c'e' gia' (dalla sua scheda); qui si parte
// dal giorno, che e' come si ragiona quando si prepara la settimana: "il
// martedi' chi ci metto?". Si sceglie il paziente e da quale sua seduta
// ricopiare il programma — quasi sempre l'ultima — e la seduta compare nel
// giorno, gia' pronta da ritoccare.
export default function AggiungiAlGiorno({
  data,
  onChiudi,
  onApriPaziente
}: {
  data: string
  onChiudi: (creata: boolean) => void
  onApriPaziente: (id: number) => void
}): React.JSX.Element {
  const [pazienti, setPazienti] = useState<PazienteDettaglio[]>([])
  const [ricerca, setRicerca] = useState('')
  const [scelto, setScelto] = useState<PazienteDettaglio | null>(null)
  const [sue, setSue] = useState<SedutaRiepilogo[] | null>(null)
  const [origine, setOrigine] = useState<number | null>(null)

  useEffect(() => {
    void window.api.pazienti
      .list()
      .then(setPazienti)
      .catch((e) => toastErrore(errMsg(e)))
  }, [])

  // Scegliendo il paziente si guardano le sue sedute: si copia da una di
  // quelle, e la piu' recente e' quella giusta nove volte su dieci.
  const scegli = (p: PazienteDettaglio): void => {
    setScelto(p)
    setSue(null)
    void window.api.sedute
      .list(p.id)
      .then((elenco) => {
        setSue(elenco)
        setOrigine(elenco[0]?.id ?? null)
      })
      .catch((e) => toastErrore(errMsg(e)))
  }

  const q = ricerca.trim().toLowerCase()
  const visibili = pazienti
    .filter((p) => q === '' || `${p.cognome} ${p.nome}`.toLowerCase().includes(q))
    .slice(0, 8)

  const aggiungi = async (): Promise<void> => {
    if (origine == null) return
    try {
      await window.api.sedute.programma(origine, [data])
      toast(`Seduta aggiunta al ${formatData(data)}.`)
      onChiudi(true)
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  return (
    <div className="modal-overlay" onClick={() => onChiudi(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Aggiungi una seduta — {formatData(data)}</h3>

        {scelto == null ? (
          <>
            <label>
              Per quale paziente
              <input
                autoFocus
                type="search"
                placeholder="Cerca per cognome o nome…"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
              />
            </label>
            {/* In cima chi e' passato di recente: quando si prepara la settimana
                si ha in mente chi si sta seguendo adesso. */}
            <ul className="esercizi-proposti">
              {visibili.map((p) => (
                <li key={p.id}>
                  <button className="btn-aggiungi-riga" onClick={() => scegli(p)}>
                    <Plus size={16} />
                  </button>
                  <span className="item-nome">
                    {p.cognome} {p.nome}
                  </span>
                  <span className="default-hint">
                    {[p.fase_nome, p.ultima_seduta ? `ultima ${formatData(p.ultima_seduta)}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
              {visibili.length === 0 && <li className="empty">Nessun paziente con questo nome.</li>}
            </ul>
          </>
        ) : (
          <>
            <div className="modal-actions">
              <span className="item-nome">
                <b>
                  {scelto.cognome} {scelto.nome}
                </b>
              </span>
              <span className="spacer" />
              <button onClick={() => setScelto(null)}>
                <X size={16} /> Cambia paziente
              </button>
            </div>

            {sue == null ? (
              <p className="hint">Caricamento…</p>
            ) : sue.length === 0 ? (
              <>
                <p className="hint">
                  Questo paziente non ha ancora nessuna seduta da cui copiare: la prima si
                  costruisce dalla sua scheda, scegliendo le sezioni della fase.
                </p>
                <div className="modal-actions">
                  <button onClick={() => onChiudi(false)}>Annulla</button>
                  <button className="primary" onClick={() => onApriPaziente(scelto.id)}>
                    Apri la scheda
                  </button>
                </div>
              </>
            ) : (
              <>
                <label>
                  Copia il programma da
                  <select
                    value={origine ?? 0}
                    onChange={(e) => setOrigine(Number(e.target.value))}
                  >
                    {sue.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatData(s.data)} — {s.num_esercizi}{' '}
                        {s.num_esercizi === 1 ? 'esercizio' : 'esercizi'}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="hint">
                  La seduta compare nel giorno scelto: poi la apri e cambi quello che serve.
                </p>
                <div className="modal-actions">
                  <button onClick={() => onChiudi(false)}>Annulla</button>
                  <button className="primary" onClick={() => void aggiungi()}>
                    <Plus size={16} /> Aggiungi al {formatData(data)}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
