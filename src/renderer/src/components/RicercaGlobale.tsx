import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { RisultatoRicerca } from '../../../shared/types'
import { useClicSulFondo } from '../clicSulFondo'
import { errMsg, formatData } from '../lib'
import { toastErrore } from './Toast'

// La ricerca in tutto l'archivio (Ctrl+K): pazienti, diario delle sedute,
// anamnesi. Si scrive, si scorre con le frecce, Invio apre. Serve quando si
// ricorda una parola ("la fitta alla spalla") e non di chi era.

const GRUPPI: { tipo: RisultatoRicerca['tipo']; titolo: string }[] = [
  { tipo: 'paziente', titolo: 'Pazienti' },
  { tipo: 'seduta', titolo: 'Diario delle sedute' },
  { tipo: 'anamnesi', titolo: 'Anamnesi' }
]

export default function RicercaGlobale({
  onChiudi,
  onApriPaziente,
  onApriSeduta
}: {
  onChiudi: () => void
  onApriPaziente: (pazienteId: number) => void
  onApriSeduta: (pazienteId: number, sedutaId: number) => void
}): React.JSX.Element {
  const [testo, setTesto] = useState('')
  const [risultati, setRisultati] = useState<RisultatoRicerca[]>([])
  const [scelto, setScelto] = useState(0)
  const [cercato, setCercato] = useState('')
  // Una risposta in ritardo non deve sostituirne una piu' recente.
  const giro = useRef(0)
  const sulFondo = useClicSulFondo(onChiudi)

  useEffect(() => {
    const q = testo.trim()
    const mio = ++giro.current
    if (q.length < 2) {
      setRisultati([])
      setCercato('')
      return
    }
    const t = setTimeout(() => {
      window.api.ricerca
        .cerca(q)
        .then((r) => {
          if (mio !== giro.current) return
          setRisultati(r)
          setCercato(q)
          setScelto(0)
        })
        .catch((e) => toastErrore(errMsg(e)))
    }, 180)
    return () => clearTimeout(t)
  }, [testo])

  // L'ordine in cui si scorre e' quello in cui si vedono, gruppo per gruppo.
  const inOrdine = GRUPPI.flatMap((g) => risultati.filter((r) => r.tipo === g.tipo))

  const apri = (r: RisultatoRicerca): void => {
    onChiudi()
    if (r.tipo === 'seduta' && r.sedutaId != null) onApriSeduta(r.pazienteId, r.sedutaId)
    else onApriPaziente(r.pazienteId)
  }

  const tasto = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onChiudi()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setScelto((i) => Math.min(inOrdine.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setScelto((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && inOrdine[scelto]) {
      e.preventDefault()
      apri(inOrdine[scelto])
    }
  }

  // La voce scelta resta in vista scorrendo con le frecce.
  useEffect(() => {
    document.querySelector('.ricerca-voce.scelta')?.scrollIntoView({ block: 'nearest' })
  }, [scelto, risultati])

  let progressivo = -1
  return (
    <div className="modal-overlay ricerca-overlay" {...sulFondo}>
      <div className="modal ricerca-globale" onClick={(e) => e.stopPropagation()} onKeyDown={tasto}>
        <div className="ricerca-campo">
          <Search size={18} />
          <input
            autoFocus
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Cerca un paziente, una parola nel diario o nell'anamnesi…"
          />
        </div>
        <div className="ricerca-elenco">
          {testo.trim().length < 2 ? (
            <p className="hint">Scrivi almeno due lettere. Maiuscole e accenti non contano.</p>
          ) : cercato === testo.trim() && risultati.length === 0 ? (
            <p className="hint">Niente trovato per «{cercato}».</p>
          ) : (
            GRUPPI.map((g) => {
              const voci = risultati.filter((r) => r.tipo === g.tipo)
              if (voci.length === 0) return null
              return (
                <div key={g.tipo}>
                  <div className="ricerca-gruppo">{g.titolo}</div>
                  {voci.map((r) => {
                    progressivo += 1
                    const mio = progressivo
                    return (
                      <button
                        key={`${r.tipo}-${r.sedutaId ?? r.pazienteId}`}
                        className={`ricerca-voce${mio === scelto ? ' scelta' : ''}`}
                        onMouseMove={() => setScelto(mio)}
                        onClick={() => apri(r)}
                      >
                        <span className="ricerca-titolo">
                          {r.titolo}
                          {r.data && <span className="ricerca-data"> · {formatData(r.data)}</span>}
                          {r.campo && <span className="ricerca-campo-nome"> · {r.campo}</span>}
                        </span>
                        {r.estratto && <span className="ricerca-estratto">{r.estratto}</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
        <div className="ricerca-suggerimenti">↑ ↓ per scorrere · Invio per aprire · Esc per chiudere</div>
      </div>
    </div>
  )
}
