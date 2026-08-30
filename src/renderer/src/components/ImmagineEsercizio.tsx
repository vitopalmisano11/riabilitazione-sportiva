import { useEffect, useState } from 'react'
import { errMsg } from '../lib'

// Mostra a schermo intero l'immagine di un esercizio. L'immagine non arriva
// con l'elenco (sarebbe pesante): si chiede al database solo quando serve.
export default function ImmagineEsercizio({
  esercizioId,
  nome,
  onClose
}: {
  esercizioId: number
  nome: string
  onClose: () => void
}): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    let annullato = false
    window.api.esercizi
      .immagine(esercizioId)
      .then((d) => {
        if (annullato) return
        if (d == null) setErrore("Questo esercizio non ha un'immagine.")
        else setSrc(d)
      })
      .catch((e) => {
        if (!annullato) setErrore(errMsg(e))
      })
    return () => {
      annullato = true
    }
  }, [esercizioId])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{nome}</h3>
        {errore ? (
          <p className="auth-error">{errore}</p>
        ) : src ? (
          <img className="immagine-grande" src={src} alt={nome} />
        ) : (
          <p className="hint">Caricamento…</p>
        )}
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
