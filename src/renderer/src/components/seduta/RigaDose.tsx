import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import type { Categoria } from '../../../../shared/types'
import {
  controllaDose,
  intervalloTesto,
  TIPI_LAVORO,
  type ControlloDose,
  type DoseFase,
  type DoseSettimana
} from '../../../../shared/dose'
import { toastErrore } from '../Toast'
import { errMsg } from '../../lib'

// Quanta dose c'e' nella seduta, confrontata con quella della fase: una riga
// sola sopra agli esercizi ("Pliometria est. 90 ✓ · Quadricipite 3 serie ✓").
// Un clic la apre e dice da dove vengono i numeri: per la forza, quante serie
// sono gia' nelle altre sedute della settimana e quante ne restano da fare.
// Serve solo a programmare: non finisce in nessun documento.

const nomeVoce = (chiave: string, categorie: Categoria[]): string =>
  chiave.startsWith('forza:')
    ? (categorie.find((c) => c.id === Number(chiave.slice(6)))?.nome ?? 'Forza')
    : (TIPI_LAVORO.find((t) => t.tipo === chiave)?.breve ?? chiave)

const unita = (chiave: string): string => (chiave.startsWith('plio') ? 'contatti' : 'serie')

const ESITO: Record<ControlloDose['esito'], string> = {
  ok: 'va bene',
  poco: 'poco',
  troppo: 'troppo'
}

export default function RigaDose({
  dosi,
  conto,
  settimana,
  categorie,
  pazienteId,
  onFrequenza
}: {
  dosi: DoseFase[]
  conto: Record<string, number>
  settimana: DoseSettimana
  categorie: Categoria[]
  pazienteId: number
  onFrequenza: (quante: number | null) => void
}): React.JSX.Element | null {
  const [aperta, setAperta] = useState(false)
  const [frequenza, setFrequenza] = useState(settimana.frequenza?.toString() ?? '')
  // la settimana arriva dall'archivio dopo che la riga e' gia' disegnata
  useEffect(() => setFrequenza(settimana.frequenza?.toString() ?? ''), [settimana.frequenza])
  // nell'ordine della seduta: prima la pliometria, poi potenza e forza
  const ordine = (k: string): number => TIPI_LAVORO.findIndex((t) => k.startsWith(t.tipo))
  const controlli = controllaDose(dosi, conto, settimana).sort(
    (a, b) => ordine(a.chiave) - ordine(b.chiave) || nomeVoce(a.chiave, categorie).localeCompare(nomeVoce(b.chiave, categorie), 'it')
  )
  if (controlli.length === 0) return null

  const salvaFrequenza = async (): Promise<void> => {
    const testo = frequenza.trim()
    const quante = testo === '' ? null : Number(testo)
    if (quante === settimana.frequenza) return
    try {
      await window.api.pazienti.setSeduteSettimana(pazienteId, quante)
      onFrequenza(quante)
    } catch (e) {
      toastErrore(errMsg(e))
      setFrequenza(settimana.frequenza?.toString() ?? '')
    }
  }

  const icona = (c: ControlloDose): React.JSX.Element =>
    c.esito === 'ok' ? <Check size={14} /> : <TriangleAlert size={14} />

  return (
    <section className="riga-dose">
      <button className="riga-dose-sintesi" aria-expanded={aperta} onClick={() => setAperta(!aperta)}>
        {aperta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {controlli.map((c) => (
          <span key={c.chiave} className={`voce-dose ${c.esito}`} title={ESITO[c.esito]}>
            {nomeVoce(c.chiave, categorie)} {c.questa}
            {c.chiave.startsWith('plio') ? '' : ` ${unita(c.chiave)}`} {icona(c)}
          </span>
        ))}
      </button>

      {aperta && (
        <div className="riga-dose-dettaglio">
          <ul>
            {controlli.map((c) => (
              <li key={c.chiave} className={c.esito}>
                <b>{nomeVoce(c.chiave, categorie)}</b>: in questa seduta {c.questa} {unita(c.chiave)}
                {(c.da != null || c.a != null) && (
                  <>
                    {' '}
                    · {c.settimana ? 'da fare oggi' : 'per seduta'} {intervalloTesto(c.da, c.a)}
                  </>
                )}
                {c.settimana && (
                  <span className="hint">
                    {' '}
                    · in settimana {c.settimana.fatte} su {intervalloTesto(c.settimana.da, c.settimana.a)}, da
                    dividere su {c.settimana.restano === 1 ? 'questa seduta' : `${c.settimana.restano} sedute`}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <label className="riga-dose-frequenza">
            Sedute a settimana
            <input
              type="number"
              min={1}
              max={14}
              value={frequenza}
              onChange={(e) => setFrequenza(e.target.value)}
              onBlur={() => void salvaFrequenza()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
          </label>
          {settimana.frequenza == null && (
            <p className="hint">
              Scrivi le sedute a settimana: serve a contare la forza.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
