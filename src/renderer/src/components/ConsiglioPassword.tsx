import { controllaPassword } from '../../../shared/password'

// Sotto il campo di una password nuova: cosa non va, mentre la si scrive, con
// la stessa regola che poi la accetta o la rifiuta (shared/password.ts).
export default function ConsiglioPassword({ password }: { password: string }): React.JSX.Element | null {
  if (password === '') return null
  const errore = controllaPassword(password)
  return errore ? (
    <span className="hint-campo esito-attenzione">{errore}</span>
  ) : (
    <span className="hint-campo">Va bene.</span>
  )
}
