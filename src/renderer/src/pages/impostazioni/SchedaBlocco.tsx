import { useEffect, useState } from 'react'
import Aiuto from '../../components/Aiuto'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { toastErrore } from '../../components/Toast'
import { errMsg } from '../../lib'

// Blocco automatico: l'app torna alla password dopo un po' che non la tocchi.
// Sta accanto al cambio password perche' e' la stessa domanda — chi puo' entrare
// — vista da due parti.
export function SchedaBlocco({
  ingrandimento,
  onIngrandimento
}: {
  ingrandimento: number
  onIngrandimento: (valore: number) => void
}): React.JSX.Element {
  const [attivo, setAttivo] = useState(false)
  const [minuti, setMinuti] = useState(15)

  useEffect(() => {
    void window.api.sicurezza.blocco().then((b) => {
      setAttivo(b.attivo)
      setMinuti(b.minuti)
    })
  }, [])

  const salva = (nuovo: { attivo: boolean; minuti: number }): void => {
    setAttivo(nuovo.attivo)
    setMinuti(nuovo.minuti)
    window.api.sicurezza.setBlocco(nuovo).catch((e) => toastErrore(errMsg(e)))
  }

  return (
    <section className="card single-col">
      {/* Il programma e' scritto in pixel fissi: invece di cambiare i numeri uno
          per uno si ingrandisce tutta la pagina, come fa il browser con Ctrl +.
          Cosi' cresce ogni cosa in proporzione — scritte, caselle, spazi — e
          niente si scompone. */}
      <div className="riga-interruttore">
        <span className="nome-interruttore">
          Dimensione dei caratteri
          <Aiuto testo="Ingrandisce o rimpicciolisce tutto il programma, non solo le scritte: caselle, pulsanti e spazi crescono insieme. Se ti sembra scritto piccolo, alza qui invece di avvicinarti allo schermo." />
        </span>
        <span className="regola-ingrandimento">
          <button
            title="Più piccolo"
            disabled={ingrandimento <= 0.8}
            onClick={() => onIngrandimento(Math.round((ingrandimento - 0.1) * 10) / 10)}
          >
            <Minus size={16} />
          </button>
          <span className="valore-ingrandimento">{Math.round(ingrandimento * 100)}%</span>
          <button
            title="Più grande"
            disabled={ingrandimento >= 1.6}
            onClick={() => onIngrandimento(Math.round((ingrandimento + 0.1) * 10) / 10)}
          >
            <Plus size={16} />
          </button>
          <button title="Torna alla misura normale" onClick={() => onIngrandimento(1)}>
            <RotateCcw size={15} />
          </button>
        </span>
      </div>

      <label className="riga-interruttore riga-staccata">
        <span className="nome-interruttore">
          Blocco automatico
          <Aiuto testo="Dopo un po' che non tocchi niente, l'app torna alla schermata della password. Il lavoro aperto resta dov'è: per riprendere basta riscriverla." />
        </span>
        <input
          type="checkbox"
          className="interruttore"
          checked={attivo}
          onChange={(e) => salva({ attivo: e.target.checked, minuti })}
        />
      </label>
      {attivo && (
        <label className="campo-copie">
          Dopo quanti minuti
          <input
            type="number"
            min={1}
            max={240}
            value={minuti}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n) && n >= 1) salva({ attivo, minuti: n })
            }}
          />
        </label>
      )}
    </section>
  )
}
