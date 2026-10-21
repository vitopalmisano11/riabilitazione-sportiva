import { useMemo } from 'react'
import { curvaSvg, curvePedana } from '../../../../shared/pedana-curve'
import type { TestPedanaSalvato } from '../../../../shared/pedana'

// Le curve dei test di una riga (forza nel tempo, salto, oscillazione). Il
// disegno e' lo stesso dei documenti: una stringa SVG fatta solo di numeri e
// di etichette scritte da noi, senza niente che arrivi dal file come codice.
export default function GraficiCurve({
  test
}: {
  test: TestPedanaSalvato[]
}): React.JSX.Element | null {
  const curve = useMemo(
    () =>
      curvePedana(test)
        .map((c) => ({ c, svg: curvaSvg(c) }))
        .filter((x) => x.svg),
    [test]
  )
  if (curve.length === 0) return null
  return (
    <div className="curve-pedana">
      {curve.map(({ c, svg }) => (
        <figure key={c.chiave}>
          <figcaption>{c.titolo}</figcaption>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </figure>
      ))}
    </div>
  )
}
