import { useState } from 'react'

// La data si scrive a mano in gg/mm/aaaa: il calendario a comparsa e' scomodo
// quando il paziente dice "cinque anni fa". Si accetta anche l'anno a due cifre.
function isoInItaliano(iso: string | null): string {
  if (!iso) return ''
  const [a, m, g] = iso.split('-')
  return a && m && g ? `${g}/${m}/${a}` : ''
}

function italianoInIso(testo: string): string | null {
  const p = testo.trim().split(/[/.-]/)
  if (p.length !== 3) return null
  const g = Number(p[0])
  const m = Number(p[1])
  let a = Number(p[2])
  if (!g || !m || !a) return null
  if (p[2].length <= 2) a += a <= new Date().getFullYear() % 100 + 1 ? 2000 : 1900
  if (m < 1 || m > 12 || g < 1 || g > 31) return null
  const d = new Date(a, m - 1, g)
  if (d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== g) return null
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`
}

// Coppia di pulsanti: si clicca per scegliere, si riclicca per togliere la
// scelta — durante il colloquio capita di aver segnato la risposta sbagliata.
export function Scelta({
  etichette,
  valore,
  segmentata,
  onScegli
}: {
  etichette: [string, string][]
  valore: string | null
  // i pulsanti attaccati in un pezzo solo, come un selettore
  segmentata?: boolean
  onScegli: (v: string | null) => void
}): React.JSX.Element {
  return (
    <span className={segmentata ? 'scelta-coppia segmentata' : 'scelta-coppia'}>
      {etichette.map(([v, testo]) => (
        <button
          key={v}
          className={valore === v ? 'scelta-attiva' : ''}
          onClick={() => onScegli(valore === v ? null : v)}
        >
          {testo}
        </button>
      ))}
    </span>
  )
}

// Data digitata, non scelta dal calendario. Si tiene quel che l'utente sta
// scrivendo finche' non forma una data valida, altrimenti il campo si
// riscriverebbe sotto le dita a meta' digitazione.
export function CampoData({
  etichetta,
  valore,
  autoFocus,
  onCambia
}: {
  etichetta: string
  valore: string | null
  autoFocus?: boolean
  onCambia: (iso: string | null) => void
}): React.JSX.Element {
  const [testo, setTesto] = useState<string | null>(null)
  const mostrato = testo ?? isoInItaliano(valore)
  const valida = testo == null || italianoInIso(testo) != null

  return (
    <label className="compila-data">
      {etichetta}
      <input
        className={['campo-data', valida ? '' : 'campo-errato'].filter(Boolean).join(' ')}
        autoFocus={autoFocus}
        placeholder="gg/mm/aaaa"
        value={mostrato}
        onChange={(e) => {
          setTesto(e.target.value)
          const iso = italianoInIso(e.target.value)
          if (iso) onCambia(iso)
        }}
        onBlur={() => setTesto(null)}
      />
    </label>
  )
}
