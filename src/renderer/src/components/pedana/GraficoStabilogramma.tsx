import { useMemo } from 'react'
import type { LatoPedana, SeriePedana } from '../../../../shared/pedana'
import { tracciatoSvg } from '../../../../shared/pedana-curve'

// Il tracciato del centro di pressione di una stabilometria (statokinesigramma),
// con l'ovale al 95% se il file lo ha. Il disegno e' lo stesso dei documenti
// (shared/pedana-curve.ts): una stringa SVG fatta solo di numeri e di etichette
// nostre.
export default function GraficoStabilogramma({
  serie,
  titolo = 'Tracciato del centro di pressione',
  raggio,
  lato = null
}: {
  serie: SeriePedana
  titolo?: string
  // il raggio (mm) comune a due tracciati da confrontare: stessa scala
  raggio?: number
  // il piede d'appoggio: da' il colore all'ovale
  lato?: LatoPedana | null
}): React.JSX.Element | null {
  const svg = useMemo(() => tracciatoSvg(serie, { raggio, lato }), [serie, raggio, lato])
  if (!svg) return null
  return (
    <figure className="grafico-stabilogramma">
      <figcaption className="titolo-grafico-pedana">{titolo}</figcaption>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="hint">
        Il punto pieno è l&apos;inizio, quello vuoto la fine
        {serie.ellisse ? '. L’ovale colorato contiene il 95% dei punti' : ''}.
      </figcaption>
    </figure>
  )
}
