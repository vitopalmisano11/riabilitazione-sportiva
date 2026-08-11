import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

type Tipo = 'ok' | 'errore'

interface ToastMsg {
  id: number
  tipo: Tipo
  testo: string
}

type Listener = (t: ToastMsg) => void
let listener: Listener | null = null
let prossimoId = 1

export function toast(testo: string): void {
  listener?.({ id: prossimoId++, tipo: 'ok', testo })
}

export function toastErrore(testo: string): void {
  listener?.({ id: prossimoId++, tipo: 'errore', testo })
}

export default function ToastHost(): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastMsg[]>([])

  useEffect(() => {
    listener = (t) => {
      setToasts((prev) => [...prev, t])
      setTimeout(
        () => setToasts((prev) => prev.filter((x) => x.id !== t.id)),
        t.tipo === 'errore' ? 6000 : 3500
      )
    }
    return () => {
      listener = null
    }
  }, [])

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tipo}`}>
          {t.tipo === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{t.testo}</span>
        </div>
      ))}
    </div>
  )
}
