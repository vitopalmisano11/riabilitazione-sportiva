import { Children, Fragment, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import MenuScelta from './MenuScelta'
import type { OpzioneMenu } from './MenuScelta'

// Al posto di <select>: stesso modo di scriverlo (le <option> dentro, un
// onChange che legge e.target.value), ma il menu lo disegna il programma
// invece di Windows. Cosi' passare da una all'altra e' cambiare una parola.
//
// Un'opzione senza valore la cui scritta comincia con "—" o finisce con "…"
// ("— scegli —", "Scegli il questionario…") e' un invito, non una scelta
// vera: si mostra scolorita finche' non si sceglie altro.
interface PropsOpzione {
  value?: string | number
  children?: ReactNode
}

const testoDi = (figli: ReactNode): string =>
  Children.toArray(figli)
    .filter((f) => typeof f === 'string' || typeof f === 'number')
    .join('')

function leggiOpzioni(figli: ReactNode, fuori: OpzioneMenu<string>[]): void {
  Children.forEach(figli, (f) => {
    if (!isValidElement(f)) return
    const el = f as ReactElement<PropsOpzione>
    if (el.type === Fragment) {
      leggiOpzioni(el.props.children, fuori)
    } else if (el.type === 'option') {
      const etichetta = testoDi(el.props.children)
      fuori.push({ valore: String(el.props.value ?? etichetta), etichetta })
    }
  })
}

export default function Tendina({
  value,
  onChange,
  children,
  className,
  title,
  disabled,
  id
}: {
  value: string | number | null | undefined
  onChange: (e: { target: { value: string } }) => void
  children: ReactNode
  className?: string
  title?: string
  disabled?: boolean
  id?: string
}): React.JSX.Element {
  const tutte: OpzioneMenu<string>[] = []
  leggiOpzioni(children, tutte)

  const invito = tutte.find((o) => o.valore === '' && /^—|…$/.test(o.etichetta))
  const opzioni = invito ? tutte.filter((o) => o !== invito) : tutte

  return (
    <span className={className ? `tendina ${className}` : 'tendina'}>
      <MenuScelta<string>
        id={id}
        valore={String(value ?? '')}
        placeholder={invito?.etichetta}
        opzioni={opzioni}
        onScegli={(v) => onChange({ target: { value: v } })}
        disabled={disabled}
        title={title}
      />
    </span>
  )
}
