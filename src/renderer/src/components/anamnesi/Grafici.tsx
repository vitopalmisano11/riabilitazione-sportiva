import { useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import type { AnamnesiProssima as Dati, PuntoAndamento } from '../../../../shared/types'
import { chiedi } from '../Conferma'
import Modale from '../Modale'
import { oggiIso } from '../../lib'
import GraficoAndamento, { COLORI, type Selezione } from '../GraficoAndamento'
import { CampoData } from './Campi'

// I due andamenti. Si sceglie a quale sintomo si stanno mettendo i punti, si
// clicca sul grafico per aggiungerne uno e sul punto per toglierlo. Le note
// sotto servono quando basta una frase e non serve nessun punto.
export function Grafici({
  dati,
  sintomoAttivo,
  onSintomoAttivo,
  onAggiorna
}: {
  dati: Dati
  sintomoAttivo: number
  onSintomoAttivo: (i: number) => void
  onAggiorna: (patch: Partial<Dati>) => void
}): React.JSX.Element {
  const [selezione, setSelezione] = useState<Selezione | null>(null)
  // punto dall'esordio in attesa di data e intensita'
  const [inArrivo, setInArrivo] = useState<{ sintomo: number; data: string; dolore: number } | null>(
    null
  )

  // Dal grafico del giorno si aggiunge subito; da quello dall'esordio si passa
  // dalla finestrella, perche' la data la scrive il fisioterapista.
  const richiediPunto = (indice: number, punto: Omit<PuntoAndamento, 'id'>): void => {
    if (punto.grafico === 'giorno') {
      aggiungiPunto(indice, punto)
      return
    }
    setInArrivo({
      sintomo: indice,
      data: oggiIso(),
      dolore: punto.dolore
    })
  }

  // Un solo punto per data su ogni sintomo: se la data c'e' gia', se ne
  // aggiorna il valore invece di sovrapporne un altro.
  const confermaPunto = (): void => {
    if (!inArrivo) return
    const { sintomo, data, dolore } = inArrivo
    const punti = dati.sintomi[sintomo].punti
    const esistente = punti.findIndex((p) => p.grafico === 'esordio' && p.data === data)
    const nuoviPunti =
      esistente >= 0
        ? punti.map((p, j) => (j === esistente ? { ...p, dolore } : p))
        : [...punti, { id: null, grafico: 'esordio' as const, minuti: null, data, dolore }]
    onAggiorna({
      sintomi: dati.sintomi.map((s, i) => (i === sintomo ? { ...s, punti: nuoviPunti } : s))
    })
    setSelezione({
      sintomo,
      punto: esistente >= 0 ? esistente : nuoviPunti.length - 1
    })
    setInArrivo(null)
  }

  // Svuota un grafico: toglie i punti di quel tipo da tutti i sintomi.
  const svuota = async (tipo: 'giorno' | 'esordio'): Promise<void> => {
    const quanti = dati.sintomi.reduce(
      (n, s) => n + s.punti.filter((p) => p.grafico === tipo).length,
      0
    )
    if (quanti === 0) return
    const nome = tipo === 'giorno' ? 'delle 24 ore' : "dall'esordio"
    if (!(await chiedi(`Togliere tutti i ${quanti} punti del grafico ${nome}?`))) return
    onAggiorna({
      sintomi: dati.sintomi.map((s) => ({
        ...s,
        punti: s.punti.filter((p) => p.grafico !== tipo)
      }))
    })
    setSelezione(null)
  }

  const aggiungiPunto = (indice: number, punto: Omit<PuntoAndamento, 'id'>): void =>
  {
    onAggiorna({
      sintomi: dati.sintomi.map((s, i) =>
        i === indice ? { ...s, punti: [...s.punti, { id: null, ...punto }] } : s
      )
    })
    // il punto appena messo resta scelto: i suoi valori si correggono qui sotto
    setSelezione({ sintomo: indice, punto: dati.sintomi[indice].punti.length })
  }

  const togliPunto = (indice: number, indicePunto: number): void => {
    onAggiorna({
      sintomi: dati.sintomi.map((s, i) =>
        i === indice ? { ...s, punti: s.punti.filter((_, j) => j !== indicePunto) } : s
      )
    })
    setSelezione(null)
  }

  const cambiaPunto = (sel: Selezione, patch: Partial<PuntoAndamento>): void =>
    onAggiorna({
      sintomi: dati.sintomi.map((s, i) =>
        i === sel.sintomo
          ? { ...s, punti: s.punti.map((p, j) => (j === sel.punto ? { ...p, ...patch } : p)) }
          : s
      )
    })

  const scelto =
    selezione != null ? dati.sintomi[selezione.sintomo]?.punti[selezione.punto] : undefined

  return (
    <div className="lista-domande">
      <div className="sotto-titolo">Andamento nel tempo</div>

      <div className="legenda-sintomi">
        <span className="regola-parola">Sto segnando il sintomo</span>
        {dati.sintomi.map((s, i) => (
          <button
            key={s.id ?? i}
            className={sintomoAttivo === i ? 'scelta-attiva' : ''}
            onClick={() => onSintomoAttivo(i)}
          >
            <span className="pallino" style={{ background: COLORI[i % COLORI.length] }} />
            {i + 1}. {s.descrizione || 'senza nome'}
          </button>
        ))}
      </div>

      {selezione != null && scelto && (
        <div className="segno-strumenti">
          <span className="regola-parola">Punto scelto</span>
          {scelto.grafico === 'giorno' ? (
            <label className="compila-data">
              Ora
              <input
                type="number"
                className="campo-stretto"
                min={0}
                max={23}
                value={Math.floor((scelto.minuti ?? 0) / 60)}
                onChange={(e) =>
                  cambiaPunto(selezione, {
                    minuti: Math.min(23, Math.max(0, Number(e.target.value))) * 60
                  })
                }
              />
            </label>
          ) : (
            <CampoData
              etichetta="Data"
              valore={scelto.data}
              onCambia={(iso) => cambiaPunto(selezione, { data: iso })}
            />
          )}
          <label className="compila-data">
            Dolore
            <input
              type="number"
              className="campo-stretto"
              min={0}
              max={10}
              value={scelto.dolore}
              onChange={(e) =>
                cambiaPunto(selezione, {
                  dolore: Math.min(10, Math.max(0, Number(e.target.value)))
                })
              }
            />
          </label>
          <button
            className="danger"
            title="Togli questo punto"
            onClick={() => togliPunto(selezione.sintomo, selezione.punto)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {inArrivo && (
        <Modale
          className="modal-sm"
          onConferma={() => (inArrivo.data ? confermaPunto() : setInArrivo(null))}
        >
            <h3>Nuova misurazione</h3>
            <p className="modal-testo">
              Sintomo {inArrivo.sintomo + 1} —{' '}
              {dati.sintomi[inArrivo.sintomo]?.descrizione || 'senza nome'}
            </p>
            <div className="form-row-2">
              <CampoData
                etichetta="Data"
                valore={inArrivo.data}
                autoFocus
                onCambia={(iso) => setInArrivo({ ...inArrivo, data: iso ?? inArrivo.data })}
              />
              <label>
                Intensità del dolore
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={inArrivo.dolore}
                  onChange={(e) =>
                    setInArrivo({
                      ...inArrivo,
                      dolore: Math.min(10, Math.max(0, Number(e.target.value)))
                    })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setInArrivo(null)}>Annulla</button>
              <button className="primary" disabled={!inArrivo.data} onClick={confermaPunto}>
                Aggiungi
              </button>
            </div>
        </Modale>
      )}

      <div className="form-row-2">
        <div className="riquadro-grafico">
          <div className="testata-grafico">
            <span className="sotto-titolo">Nelle 24 ore</span>
            <button title="Togli tutti i punti" onClick={() => void svuota('giorno')}>
              <RotateCcw size={16} /> Svuota
            </button>
          </div>
          <GraficoAndamento
            tipo="giorno"
            sintomi={dati.sintomi}
            sintomoAttivo={sintomoAttivo}
            selezione={selezione}
            onSeleziona={setSelezione}
            onAggiungi={richiediPunto}
            onSposta={cambiaPunto}
          />
          <label>
            Note
            <textarea
              rows={2}
              placeholder="es. peggio la mattina appena sveglio"
              value={dati.note_giorno ?? ''}
              onChange={(e) => onAggiorna({ note_giorno: e.target.value || null })}
            />
          </label>
        </div>

        <div className="riquadro-grafico">
          <div className="testata-grafico">
            <span className="sotto-titolo">Dall&apos;esordio</span>
            <button title="Togli tutti i punti" onClick={() => void svuota('esordio')}>
              <RotateCcw size={16} /> Svuota
            </button>
          </div>
          <GraficoAndamento
            tipo="esordio"
            sintomi={dati.sintomi}
            sintomoAttivo={sintomoAttivo}
            selezione={selezione}
            onSeleziona={setSelezione}
            onAggiungi={richiediPunto}
            onSposta={cambiaPunto}
          />
          <label>
            Note
            <textarea
              rows={2}
              placeholder="es. migliora lentamente da tre settimane"
              value={dati.note_esordio ?? ''}
              onChange={(e) => onAggiorna({ note_esordio: e.target.value || null })}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
