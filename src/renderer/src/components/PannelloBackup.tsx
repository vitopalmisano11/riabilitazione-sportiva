import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, RotateCcw, Save } from 'lucide-react'
import type { InfoBackup } from '../../../shared/types'
import { toast, toastErrore } from './Toast'
import { errMsg } from '../lib'

// Copie di sicurezza dell'archivio. Ogni copia contiene il database cifrato e
// il file delle chiavi: servono entrambi, uno solo non riapre niente.
export default function PannelloBackup(): React.JSX.Element {
  const [info, setInfo] = useState<InfoBackup | null>(null)

  const carica = useCallback(
    (): Promise<void> => window.api.backup.info().then(setInfo),
    []
  )

  useEffect(() => {
    void carica().catch((e) => toastErrore(errMsg(e)))
  }, [carica])

  if (!info) return <p className="hint">Caricamento…</p>

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await carica()
    } catch (e) {
      toastErrore(errMsg(e))
    }
  }

  const quando = (nome: string): string => {
    // nome nella forma 2026-08-31_1435, eventualmente con un prefisso
    const m = nome.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/)
    if (!m) return nome
    return `${m[3]}/${m[2]}/${m[1]} alle ${m[4]}:${m[5]}`
  }

  const peso = (byte: number): string =>
    byte > 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.round(byte / 1024)} kB`

  const ripristina = (nome: string): void => {
    if (
      !confirm(
        `Riportare l'archivio a com'era il ${quando(nome)}?\n\n` +
          'Tutto quello che hai aggiunto dopo quella data sparirà dall’app.\n' +
          'Prima di procedere viene fatta una copia dello stato attuale, così è comunque recuperabile.\n\n' +
          "L'app si riavvierà e dovrai rientrare con la password."
      )
    ) {
      return
    }
    void window.api.backup.ripristina(nome).catch((e) => toastErrore(errMsg(e)))
  }

  return (
    <div className="blocco-impostazione">
      <div className="sotto-titolo">Copie di sicurezza</div>
      <p className="modal-testo">
        L&apos;app tiene da sola delle copie datate del tuo archivio: una all&apos;accesso e una
        alla chiusura. Se metti la cartella dentro OneDrive, finiscono online da sole.
      </p>

      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={info.attivo}
          onChange={(e) => void run(() => window.api.backup.setAttivo(e.target.checked))}
        />
        Fai le copie automaticamente
      </label>

      <div className="cartella-path">{info.cartella}</div>

      <div className="modal-actions riga-backup">
        {/* Scritta sopra alla casella, come tutti gli altri campi: accanto
            restava schiacciata contro il numero. */}
        <label className="campo-copie">
          Copie da tenere
          <input
            type="number"
            min={1}
            max={100}
            value={info.daTenere}
            onChange={(e) => void run(() => window.api.backup.setDaTenere(Number(e.target.value)))}
          />
        </label>
        <span className="spacer" />
        <button onClick={() => void window.api.backup.apriCartella()}>
          <FolderOpen size={16} /> Apri cartella
        </button>
        <button onClick={() => void run(() => window.api.backup.cambiaCartella())}>
          Cambia cartella…
        </button>
        <button
          className="primary"
          onClick={() =>
            void run(async () => {
              await window.api.backup.eseguiOra()
              toast('Copia di sicurezza creata.')
            })
          }
        >
          <Save size={16} /> Fai una copia ora
        </button>
      </div>

      {info.copie.length === 0 ? (
        <p className="hint">
          Nessuna copia ancora. Premi &ldquo;Fai una copia ora&rdquo; per averne subito una.
        </p>
      ) : (
        <ul className="sedute-list">
          {info.copie.map((c) => (
            <li key={c.nome}>
              <div className="seduta-info">
                <span className="seduta-data">{quando(c.nome)}</span>
                <span className="seduta-meta">
                  {peso(c.dimensione)}
                  {c.nome.startsWith('prima-del-ripristino') && ' · prima di un ripristino'}
                </span>
              </div>
              <span className="row-actions">
                <button title="Riporta l'archivio a questa copia" onClick={() => ripristina(c.nome)}>
                  <RotateCcw size={18} /> Ripristina
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
