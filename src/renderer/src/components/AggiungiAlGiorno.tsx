import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { PazienteDettaglio, SedutaRiepilogo } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import SceltaConRicerca from './SceltaConRicerca'
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
  pazienteIniziale,
  onChiudi,
  onApriPaziente,
  onNuovaSeduta
}: {
  data: string
  // arrivando dalla ricerca in cima alla settimana il paziente e' gia' scelto
  pazienteIniziale?: PazienteDettaglio | null
  onChiudi: (creata: boolean) => void
  onApriPaziente: (id: number) => void
  // una seduta nuova da zero, per quel paziente in quel giorno
  onNuovaSeduta: (pazienteId: number, data: string) => void
}): React.JSX.Element {
  const [pazienti, setPazienti] = useState<PazienteDettaglio[]>([])
  const [ricerca, setRicerca] = useState('')
  const [scelto, setScelto] = useState<PazienteDettaglio | null>(null)
  const [sue, setSue] = useState<SedutaRiepilogo[] | null>(null)
  const [origine, setOrigine] = useState<number | null>(null)
  // A che ora viene, quel giorno: facoltativo.
  const [ora, setOra] = useState('')

  useEffect(() => {
    void window.api.pazienti
      .list()
      .then(setPazienti)
      .catch((e) => toastErrore(errMsg(e)))
    if (pazienteIniziale) scegli(pazienteIniziale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await window.api.sedute.programma(origine, [data], ora || null)
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
                  <button onClick={() => onApriPaziente(scelto.id)}>Apri la scheda</button>
                  <button className="primary" onClick={() => onNuovaSeduta(scelto.id, data)}>
                    <Plus size={16} /> Nuova seduta
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="riga-campi">
                  <label className="field">
                    Copia il programma da
                    <SceltaConRicerca
                      voci={sue.map((s) => ({
                        id: s.id,
                        nome: `${formatData(s.data)} — ${s.num_esercizi} ${s.num_esercizi === 1 ? 'esercizio' : 'esercizi'}`
                      }))}
                      valore={origine ?? ''}
                      onCambia={(id) => setOrigine(id === '' ? null : id)}
                    />
                  </label>
                  <label className="field ora-field">
                    Ora
                    <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} />
                  </label>
                </div>
                <p className="hint">
                  La seduta compare nel giorno scelto: poi la apri e cambi quello che serve.
                </p>
                <div className="modal-actions">
                  <button onClick={() => onChiudi(false)}>Annulla</button>
                  {/* Da zero, quando non c'e' niente da ricopiare: si apre la
                      seduta vuota in quel giorno. */}
                  <button onClick={() => onNuovaSeduta(scelto.id, data)}>Da zero</button>
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
